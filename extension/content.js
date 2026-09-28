/**
 * Nudge Content Script - Privacy-First Behavioral Observer & Intervention UI
 *
 * Observes:
 * 1. Scrolling kinematics (distance, elapsed time, velocity) using document.scrollingElement.scrollTop
 * 2. High-level user activity (clicks, mouse movement, keyboard interaction without key values)
 * 3. Video playback and autoplay detection
 * 4. Renders isolated gentle wellness interventions (Phase 7) via Shadow DOM
 *
 * Guarantees:
 * - NO keystrokes, form inputs, passwords, or text recorded.
 * - NO page content, DOM tree dumps, or screenshots.
 * - Throttled dispatch to minimize background service worker overhead.
 */

(function () {
  'use strict';

  // Guard against double injection
  if (window.__nudgeObserverInitialized) {
    return;
  }
  window.__nudgeObserverInitialized = true;

  /**
   * Safe wrapper to send messages to background service worker.
   */
  function safeSendMessage(message) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        return chrome.runtime.sendMessage(message).catch(() => {
          // Context invalidated or SW warming up
        });
      }
    } catch {
      // Inaccessible runtime
    }
    return Promise.resolve();
  }

  /* =========================================================================
   * 1. SCROLL TRACKING
   * ========================================================================= */

  let lastScrollTop = getScrollTop();
  let lastScrollTimestamp = performance.now();
  let accumulatedScrollDistance = 0;
  let scrollThrottleTimer = null;
  const SCROLL_THROTTLE_MS = 250;

  function getScrollTop() {
    return document.scrollingElement
      ? document.scrollingElement.scrollTop
      : (document.documentElement ? document.documentElement.scrollTop : 0);
  }

  function handleScroll() {
    const currentScrollTop = getScrollTop();
    const now = performance.now();
    const timeDelta = Math.max(1, now - lastScrollTimestamp);
    const distanceDelta = Math.abs(currentScrollTop - lastScrollTop);

    lastScrollTop = currentScrollTop;
    lastScrollTimestamp = now;

    if (distanceDelta > 0) {
      accumulatedScrollDistance += distanceDelta;
      const velocity = distanceDelta / timeDelta; // px/ms

      if (!scrollThrottleTimer) {
        scrollThrottleTimer = setTimeout(() => {
          if (accumulatedScrollDistance > 0) {
            safeSendMessage({
              type: 'SCROLL_EVENT',
              data: {
                timestamp: Date.now(),
                scrollDistance: Math.round(accumulatedScrollDistance),
                velocity: Number(velocity.toFixed(3))
              }
            });
            accumulatedScrollDistance = 0;
          }
          scrollThrottleTimer = null;
        }, SCROLL_THROTTLE_MS);
      }
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  /* =========================================================================
   * 2. USER ACTIVITY TRACKING (PRIVACY-FIRST)
   * ========================================================================= */

  let lastMouseTime = 0;
  let lastKeyTime = 0;
  let lastClickTime = 0;
  const ACTIVITY_THROTTLE_MS = 1000;

  // Track mouse movement (throttled)
  window.addEventListener(
    'mousemove',
    () => {
      const now = Date.now();
      if (now - lastMouseTime >= ACTIVITY_THROTTLE_MS) {
        lastMouseTime = now;
        safeSendMessage({
          type: 'USER_ACTIVITY',
          data: {
            activityType: 'mouse',
            timestamp: now
          }
        });
      }
    },
    { passive: true }
  );

  // Track click interaction (throttled)
  window.addEventListener(
    'click',
    () => {
      const now = Date.now();
      if (now - lastClickTime >= 500) {
        lastClickTime = now;
        safeSendMessage({
          type: 'USER_ACTIVITY',
          data: {
            activityType: 'click',
            timestamp: now
          }
        });
      }
    },
    { passive: true }
  );

  // Track keyboard interaction (ONLY that a key event occurred - NEVER WHICH KEY)
  window.addEventListener(
    'keydown',
    () => {
      const now = Date.now();
      if (now - lastKeyTime >= 500) {
        lastKeyTime = now;
        safeSendMessage({
          type: 'USER_ACTIVITY',
          data: {
            activityType: 'keyboard',
            timestamp: now
          }
        });
      }
    },
    { passive: true }
  );

  /* =========================================================================
   * 3. VIDEO & AUTOPLAY TRACKING
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
      const isAutoplay = isLikelyAutoplay(video);
      safeSendMessage({
        type: 'VIDEO_EVENT',
        data: {
          timestamp: Date.now(),
          isAutoplay: isAutoplay
        }
      });
    }, { passive: true });
  }

  // Scan existing video elements
  document.querySelectorAll('video').forEach(attachVideoListener);

  // Observe dynamically added video elements
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
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      videoObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  /* =========================================================================
   * 4. PHASE 7: GENTLE IN-BROWSER INTERVENTION (SHADOW DOM TOAST)
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
          background: rgba(15, 23, 42, 0.94);
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

    // Event Handlers
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

  // Listen for messages from background service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'SHOW_NUDGE') {
      showNudgeToast(message.data || {});
    }
  });

  // Initial ping to notify active presence
  safeSendMessage({
    type: 'USER_ACTIVITY',
    data: {
      activityType: 'init',
      timestamp: Date.now()
    }
  });
})();
