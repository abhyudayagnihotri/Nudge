/**
 * Nudge Content Script - Privacy-First Behavioral Observer, Live HUD & Intervention UI
 *
 * 1. Scrolling kinematics (captures window, inner containers, and wheel events)
 * 2. High-level user activity (clicks, mouse movement, keyboard interaction without key values)
 * 3. Video playback and autoplay detection
 * 4. Live Floating Wellness HUD (displays real-time scroll velocity and wellness status right on the webpage)
 * 5. Isolated Gentle Wellness Interventions via Shadow DOM
 *
 * Guarantees:
 * - NO keystrokes, form inputs, passwords, or text recorded.
 * - NO page content, DOM tree dumps, or screenshots.
 */

(function () {
  'use strict';

  // Guard against double injection
  if (window.__nudgeObserverInitialized) {
    return;
  }
  window.__nudgeObserverInitialized = true;

  function safeSendMessage(message) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        return chrome.runtime.sendMessage(message).catch(() => {});
      }
    } catch {
      // Inaccessible runtime
    }
    return Promise.resolve();
  }

  /* =========================================================================
   * 1. LIVE FLOATING WELLNESS HUD (SHADOW DOM)
   * ========================================================================= */

  let hudHost = null;
  let hudShadow = null;
  let hudVelocityEl = null;
  let hudScrollsEl = null;
  let hudStatusEl = null;
  let hudPulseDot = null;
  let hudPillEl = null;
  let isHudMinimized = false;

  let localScrollCount = 0;
  let localTotalDistance = 0;
  let localLastVelocity = 0;

  function initHud() {
    if (hudHost) return;

    hudHost = document.createElement('div');
    hudHost.id = 'nudge-hud-root';
    hudHost.style.all = 'initial';
    hudHost.style.position = 'fixed';
    hudHost.style.bottom = '20px';
    hudHost.style.right = '20px';
    hudHost.style.zIndex = '2147483646';
    hudHost.style.pointerEvents = 'auto';

    hudShadow = hudHost.attachShadow({ mode: 'open' });

    hudShadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
        .hud-pill {
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(99, 102, 241, 0.35);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 0 10px rgba(99, 102, 241, 0.15);
          border-radius: 9999px;
          padding: 6px 14px;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          user-select: none;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hud-pill:hover {
          border-color: rgba(99, 102, 241, 0.6);
          transform: translateY(-1px);
        }
        .brand-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          transition: background 0.3s ease;
        }
        .hud-title {
          font-weight: 700;
          color: #a5b4fc;
        }
        .metric-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background: rgba(30, 41, 59, 0.7);
          padding: 2px 7px;
          border-radius: 6px;
          border: 1px solid rgba(51, 65, 85, 0.6);
          color: #38bdf8;
        }
        .status-tag {
          font-weight: 600;
          color: #34d399;
          font-size: 10px;
        }
        .toggle-btn {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 13px;
          cursor: pointer;
          padding: 0 2px;
          line-height: 1;
        }
        .toggle-btn:hover {
          color: #cbd5e1;
        }
        .minimized-pill {
          width: 32px;
          height: 32px;
          padding: 0;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          box-shadow: 0 2px 10px rgba(99, 102, 241, 0.5);
          font-weight: 800;
          font-size: 14px;
          color: #fff;
        }
      </style>

      <div class="hud-pill" id="hudPill" title="Nudge Live Telemetry (Click to toggle view)">
        <span class="brand-dot" id="hudDot"></span>
        <span class="hud-title">Nudge</span>
        <div class="metric-badge">
          <span>⚡</span>
          <span id="hudVelocity">0.0</span>
          <span style="font-size: 9px; color: #94a3b8;">px/ms</span>
        </div>
        <div class="metric-badge">
          <span id="hudScrolls">0</span>
          <span style="font-size: 9px; color: #94a3b8;">scrolls</span>
        </div>
        <span class="status-tag" id="hudStatus">Healthy</span>
        <button class="toggle-btn" id="hudMinimizeBtn" title="Minimize">—</button>
      </div>
    `;

    hudPillEl = hudShadow.getElementById('hudPill');
    hudVelocityEl = hudShadow.getElementById('hudVelocity');
    hudScrollsEl = hudShadow.getElementById('hudScrolls');
    hudStatusEl = hudShadow.getElementById('hudStatus');
    hudPulseDot = hudShadow.getElementById('hudDot');
    const minimizeBtn = hudShadow.getElementById('hudMinimizeBtn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMinimize();
      });
    }

    if (hudPillEl) {
      hudPillEl.addEventListener('click', () => {
        if (isHudMinimized) {
          toggleMinimize();
        }
      });
    }

    if (document.body) {
      document.body.appendChild(hudHost);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(hudHost);
      });
    }
  }

  function toggleMinimize() {
    isHudMinimized = !isHudMinimized;
    if (isHudMinimized) {
      hudPillEl.className = 'hud-pill minimized-pill';
      hudPillEl.innerHTML = 'N';
    } else {
      hudPillEl.className = 'hud-pill';
      hudPillEl.innerHTML = `
        <span class="brand-dot" id="hudDot"></span>
        <span class="hud-title">Nudge</span>
        <div class="metric-badge">
          <span>⚡</span>
          <span id="hudVelocity">${localLastVelocity.toFixed(1)}</span>
          <span style="font-size: 9px; color: #94a3b8;">px/ms</span>
        </div>
        <div class="metric-badge">
          <span id="hudScrolls">${localScrollCount}</span>
          <span style="font-size: 9px; color: #94a3b8;">scrolls</span>
        </div>
        <span class="status-tag" id="hudStatus">Healthy</span>
        <button class="toggle-btn" id="hudMinimizeBtn" title="Minimize">—</button>
      `;
      hudVelocityEl = hudShadow.getElementById('hudVelocity');
      hudScrollsEl = hudShadow.getElementById('hudScrolls');
      hudStatusEl = hudShadow.getElementById('hudStatus');
      hudPulseDot = hudShadow.getElementById('hudDot');
      const minBtn = hudShadow.getElementById('hudMinimizeBtn');
      if (minBtn) {
        minBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleMinimize();
        });
      }
    }
  }

  function updateHudLive(velocity, distanceDelta) {
    if (!hudHost) initHud();
    if (isHudMinimized) return;

    localScrollCount += 1;
    localTotalDistance += distanceDelta;
    localLastVelocity = velocity;

    if (hudVelocityEl) hudVelocityEl.textContent = velocity.toFixed(1);
    if (hudScrollsEl) hudScrollsEl.textContent = localScrollCount;

    // Visual feedback
    if (hudPulseDot) {
      if (velocity > 2.5) {
        hudPulseDot.style.background = '#f43f5e';
        hudPulseDot.style.boxShadow = '0 0 10px #f43f5e';
        if (hudStatusEl) {
          hudStatusEl.textContent = 'Rapid';
          hudStatusEl.style.color = '#fb7185';
        }
      } else if (velocity > 1.4) {
        hudPulseDot.style.background = '#f59e0b';
        hudPulseDot.style.boxShadow = '0 0 8px #f59e0b';
        if (hudStatusEl) {
          hudStatusEl.textContent = 'Active';
          hudStatusEl.style.color = '#fbbf24';
        }
      } else {
        hudPulseDot.style.background = '#10b981';
        hudPulseDot.style.boxShadow = '0 0 8px #10b981';
        if (hudStatusEl) {
          hudStatusEl.textContent = 'Healthy';
          hudStatusEl.style.color = '#34d399';
        }
      }
    }
  }

  /* =========================================================================
   * 2. SCROLL KINEMATICS TRACKING
   * ========================================================================= */

  let lastScrollTimestamp = performance.now();
  let accumulatedScrollDistance = 0;
  let maxBurstVelocity = 0;
  let scrollThrottleTimer = null;
  const SCROLL_THROTTLE_MS = 200;

  function recordScrollTick(distanceDelta) {
    if (distanceDelta <= 0) return;

    const now = performance.now();
    const timeDelta = Math.max(1, now - lastScrollTimestamp);
    lastScrollTimestamp = now;

    const instantVelocity = distanceDelta / timeDelta; // px/ms
    maxBurstVelocity = Math.max(maxBurstVelocity, instantVelocity);
    accumulatedScrollDistance += distanceDelta;

    updateHudLive(instantVelocity, distanceDelta);

    if (!scrollThrottleTimer) {
      scrollThrottleTimer = setTimeout(() => {
        if (accumulatedScrollDistance > 0) {
          safeSendMessage({
            type: 'SCROLL_EVENT',
            data: {
              timestamp: Date.now(),
              scrollDistance: Math.round(accumulatedScrollDistance),
              velocity: Number(maxBurstVelocity.toFixed(3))
            }
          });
          accumulatedScrollDistance = 0;
          maxBurstVelocity = 0;
        }
        scrollThrottleTimer = null;
      }, SCROLL_THROTTLE_MS);
    }
  }

  // 1. Capture scroll on window and all scrolling containers (Reddit, Twitter, feeds, modals)
  let lastPositions = new WeakMap();

  function handleContainerScroll(e) {
    const target = e.target === document ? document.scrollingElement || document.documentElement : e.target;
    if (!target) return;

    const currentTop = target.scrollTop || 0;
    const prevTop = lastPositions.get(target) || 0;
    const delta = Math.abs(currentTop - prevTop);
    lastPositions.set(target, currentTop);

    if (delta > 0 && delta < 5000) {
      recordScrollTick(delta);
    }
  }

  window.addEventListener('scroll', handleContainerScroll, { passive: true, capture: true });

  // 2. Wheel event tracking (instant feedback for trackpad, wheel, and virtual lists)
  window.addEventListener(
    'wheel',
    (e) => {
      const delta = Math.abs(e.deltaY || e.deltaX || 0);
      if (delta > 0 && delta < 2000) {
        recordScrollTick(delta);
      }
    },
    { passive: true, capture: true }
  );

  /* =========================================================================
   * 3. USER ACTIVITY TRACKING (PRIVACY-FIRST)
   * ========================================================================= */

  let lastMouseTime = 0;
  let lastKeyTime = 0;
  let lastClickTime = 0;

  window.addEventListener(
    'mousemove',
    () => {
      const now = Date.now();
      if (now - lastMouseTime >= 1000) {
        lastMouseTime = now;
        safeSendMessage({
          type: 'USER_ACTIVITY',
          data: { activityType: 'mouse', timestamp: now }
        });
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'click',
    () => {
      const now = Date.now();
      if (now - lastClickTime >= 500) {
        lastClickTime = now;
        safeSendMessage({
          type: 'USER_ACTIVITY',
          data: { activityType: 'click', timestamp: now }
        });
      }
    },
    { passive: true }
  );

  // Record presence of key action ONLY (never key content, text or passwords)
  window.addEventListener(
    'keydown',
    () => {
      const now = Date.now();
      if (now - lastKeyTime >= 500) {
        lastKeyTime = now;
        safeSendMessage({
          type: 'USER_ACTIVITY',
          data: { activityType: 'keyboard', timestamp: now }
        });
      }
    },
    { passive: true }
  );

  /* =========================================================================
   * 4. VIDEO & AUTOPLAY TRACKING
   * ========================================================================= */

  const observedVideos = new WeakSet();

  function isLikelyAutoplay(videoElement) {
    if (!videoElement) return false;
    return Boolean(
      videoElement.autoplay ||
      videoElement.hasAttribute('autoplay') ||
      videoElement.getAttribute('data-autoplay') === 'true'
    );
  }

  function attachVideoListener(video) {
    if (!video || observedVideos.has(video)) return;
    observedVideos.add(video);

    video.addEventListener('play', () => {
      safeSendMessage({
        type: 'VIDEO_EVENT',
        data: {
          timestamp: Date.now(),
          isAutoplay: isLikelyAutoplay(video)
        }
      });
    }, { passive: true });
  }

  document.querySelectorAll('video').forEach(attachVideoListener);

  const videoObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'VIDEO') {
            attachVideoListener(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('video').forEach(attachVideoListener);
          }
        }
      }
    }
  });

  if (document.body) {
    videoObserver.observe(document.body, { childList: true, subtree: true });
    initHud();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      videoObserver.observe(document.body, { childList: true, subtree: true });
      initHud();
    });
  }

  /* =========================================================================
   * 5. GENTLE WELLNESS INTERVENTION TOAST
   * ========================================================================= */

  let nudgeContainer = null;
  let shadowRoot = null;

  function createNudgeHost() {
    if (nudgeContainer) return;

    nudgeContainer = document.createElement('div');
    nudgeContainer.id = 'nudge-extension-root';
    nudgeContainer.style.all = 'initial';
    nudgeContainer.style.position = 'fixed';
    nudgeContainer.style.bottom = '24px';
    nudgeContainer.style.right = '24px';
    nudgeContainer.style.zIndex = '2147483647';
    nudgeContainer.style.pointerEvents = 'auto';

    shadowRoot = nudgeContainer.attachShadow({ mode: 'closed' });
    document.documentElement.appendChild(nudgeContainer);
  }

  function showNudgeToast(details = {}) {
    createNudgeHost();
    if (!shadowRoot) return;

    const reasons = (details.reasons || []).slice(0, 3);
    const scorePct = Math.round((details.score || 0.7) * 100);

    shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
        .toast {
          width: 360px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(99, 102, 241, 0.35);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          padding: 18px;
          color: #f8fafc;
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .brand { display: flex; align-items: center; gap: 8px; }
        .logo {
          width: 24px; height: 24px; border-radius: 6px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px; color: #fff;
        }
        .title { font-size: 13px; font-weight: 700; color: #fff; }
        .badge {
          font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
          background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); color: #fb7185;
        }
        .message { font-size: 12.5px; line-height: 1.45; color: #cbd5e1; margin-bottom: 12px; }
        .reasons { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
        .reason-item {
          font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px;
          background: rgba(30, 41, 59, 0.6); padding: 4px 8px; border-radius: 6px;
        }
        .dot { width: 5px; height: 5px; border-radius: 50%; background: #818cf8; }
        .actions { display: flex; gap: 8px; }
        .btn {
          flex: 1; border: none; border-radius: 8px; padding: 8px 10px;
          font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; text-align: center;
        }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
        .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-secondary { background: rgba(51, 65, 85, 0.7); color: #cbd5e1; }
        .btn-secondary:hover { background: rgba(71, 85, 105, 0.9); color: #fff; }
        .btn-ghost { background: transparent; color: #94a3b8; flex: 0 0 auto; padding: 8px 10px; }
        .btn-ghost:hover { color: #f8fafc; }
        .breathing-box { display: none; text-align: center; padding: 12px 0; }
        .circle {
          width: 70px; height: 70px; border-radius: 50%; margin: 0 auto 10px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.5) 0%, rgba(139, 92, 246, 0.1) 70%);
          border: 2px solid #818cf8; animation: breathe 4s ease-in-out infinite;
        }
        @keyframes breathe {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 20px #818cf8; }
        }
        .breathe-text { font-size: 12px; font-weight: 600; color: #a5b4fc; }
      </style>

      <div class="toast" id="nudgeCard">
        <div class="header">
          <div class="brand">
            <div class="logo">N</div>
            <span class="title">Digital Wellness Check-in</span>
          </div>
          <span class="badge">${scorePct}% Compulsive Momentum</span>
        </div>

        <div class="content" id="standardContent">
          <p class="message">
            Your browsing behavior appears increasingly repetitive and compulsive. Consider taking a short pause.
          </p>

          ${
            reasons.length > 0
              ? `<div class="reasons">
                  ${reasons.map((r) => `<div class="reason-item"><span class="dot"></span><span>${r}</span></div>`).join('')}
                </div>`
              : ''
          }

          <div class="actions">
            <button class="btn btn-primary" id="takeBreakBtn">Take a 1-Min Pause</button>
            <button class="btn btn-secondary" id="snoozeBtn">Snooze (10m)</button>
            <button class="btn btn-ghost" id="dismissBtn">Dismiss</button>
          </div>
        </div>

        <div class="breathing-box" id="breathingBox">
          <div class="circle"></div>
          <div class="breathe-text" id="breatheText">Breathe in...</div>
          <button class="btn btn-secondary" id="closeBreatherBtn" style="margin-top: 10px; width: 100%;">
            Resume Mindfully
          </button>
        </div>
      </div>
    `;

    const card = shadowRoot.getElementById('nudgeCard');
    const dismissBtn = shadowRoot.getElementById('dismissBtn');
    const snoozeBtn = shadowRoot.getElementById('snoozeBtn');
    const takeBreakBtn = shadowRoot.getElementById('takeBreakBtn');
    const standardContent = shadowRoot.getElementById('standardContent');
    const breathingBox = shadowRoot.getElementById('breathingBox');
    const closeBreatherBtn = shadowRoot.getElementById('closeBreatherBtn');
    const breatheText = shadowRoot.getElementById('breatheText');

    function closeNudge() {
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.25s ease';
        setTimeout(() => {
          if (nudgeContainer && nudgeContainer.parentNode) {
            nudgeContainer.parentNode.removeChild(nudgeContainer);
            nudgeContainer = null;
            shadowRoot = null;
          }
        }, 250);
      }
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        safeSendMessage({ type: 'LOG_INTERVENTION_ACTION', data: { action: 'dismissed' } });
        closeNudge();
      });
    }

    if (snoozeBtn) {
      snoozeBtn.addEventListener('click', () => {
        safeSendMessage({ type: 'SNOOZE_NUDGE', data: { snoozeMinutes: 10 } });
        closeNudge();
      });
    }

    if (takeBreakBtn) {
      takeBreakBtn.addEventListener('click', () => {
        safeSendMessage({ type: 'LOG_INTERVENTION_ACTION', data: { action: 'took_break' } });
        standardContent.style.display = 'none';
        breathingBox.style.display = 'block';

        let phase = 0;
        const breathInterval = setInterval(() => {
          phase = (phase + 1) % 2;
          if (breatheText) {
            breatheText.textContent = phase === 0 ? 'Breathe in...' : 'Breathe out...';
          }
        }, 2000);

        if (closeBreatherBtn) {
          closeBreatherBtn.addEventListener('click', () => {
            clearInterval(breathInterval);
            closeNudge();
          });
        }
      });
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'SHOW_NUDGE') {
      showNudgeToast(message.data || {});
    }
  });

  safeSendMessage({
    type: 'USER_ACTIVITY',
    data: { activityType: 'init', timestamp: Date.now() }
  });
})();
