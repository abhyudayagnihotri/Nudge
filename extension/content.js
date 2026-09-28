/**
 * Nudge Content Script - Privacy-First Behavioral Observer, Calm HUD & Soft Interventions
 *
 * Improvements:
 * 1. Exponential Moving Average (EMA) smoothing for velocity (no rapid flashing or jitter)
 * 2. Real-time sliding-window burst detection for immediate doomscrolling identification
 * 3. Soft Interruption: Ambient vignette overlay + guided breathing + mindful pause
 * 4. Gentle scroll friction during interventions
 * 5. Strict privacy: Zero keystrokes, passwords, or text recorded.
 */

(function () {
  'use strict';

  if (window.__nudgeObserverInitialized) {
    return;
  }
  window.__nudgeObserverInitialized = true;

  function safeSendMessage(message) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        return chrome.runtime.sendMessage(message).catch(() => {});
      }
    } catch {}
    return Promise.resolve();
  }

  /* =========================================================================
   * 1. SMOOTHED CALM LIVE HUD (SHADOW DOM)
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
  let smoothedVelocity = 0;
  let lastInstantVelocity = 0;
  let hudRenderTimer = null;
  let decayTimer = null;

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
          background: rgba(15, 23, 42, 0.90);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(99, 102, 241, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          border-radius: 9999px;
          padding: 6px 14px;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 11.5px;
          user-select: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
          box-shadow: 0 0 6px #10b981;
          transition: background 0.4s ease, box-shadow 0.4s ease;
        }
        .hud-title {
          font-weight: 700;
          color: #a5b4fc;
          font-size: 11px;
        }
        .metric-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background: rgba(30, 41, 59, 0.75);
          padding: 2px 7px;
          border-radius: 6px;
          border: 1px solid rgba(51, 65, 85, 0.6);
          color: #38bdf8;
          font-size: 11px;
        }
        .status-tag {
          font-weight: 600;
          color: #34d399;
          font-size: 10.5px;
          transition: color 0.4s ease;
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
          font-size: 13px;
          color: #fff;
        }
      </style>

      <div class="hud-pill" id="hudPill" title="Nudge Live Telemetry">
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
        <span class="status-tag" id="hudStatus">Calm</span>
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
        if (isHudMinimized) toggleMinimize();
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
          <span id="hudVelocity">${smoothedVelocity.toFixed(1)}</span>
          <span style="font-size: 9px; color: #94a3b8;">px/ms</span>
        </div>
        <div class="metric-badge">
          <span id="hudScrolls">${localScrollCount}</span>
          <span style="font-size: 9px; color: #94a3b8;">scrolls</span>
        </div>
        <span class="status-tag" id="hudStatus">Calm</span>
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

  // Smooth velocity update using EMA (alpha = 0.25) throttled to 350ms
  function applySmoothedVelocity(instantVelocity) {
    lastInstantVelocity = instantVelocity;
    if (smoothedVelocity === 0) {
      smoothedVelocity = instantVelocity;
    } else {
      // Exponential moving average: prevents rapid jumping
      smoothedVelocity = smoothedVelocity * 0.75 + instantVelocity * 0.25;
    }

    // Reset decay timer: after 1.2s of inactivity, smoothly decay to 0
    if (decayTimer) clearTimeout(decayTimer);
    decayTimer = setTimeout(() => {
      const stepDecay = () => {
        smoothedVelocity = smoothedVelocity * 0.6;
        if (smoothedVelocity < 0.08) {
          smoothedVelocity = 0;
          renderHudValues();
        } else {
          renderHudValues();
          setTimeout(stepDecay, 200);
        }
      };
      stepDecay();
    }, 1200);

    // Throttle DOM updates to 350ms for calm, readable UI
    if (!hudRenderTimer) {
      hudRenderTimer = setTimeout(() => {
        renderHudValues();
        hudRenderTimer = null;
      }, 350);
    }
  }

  function renderHudValues() {
    if (!hudHost) initHud();
    if (isHudMinimized) return;

    if (hudVelocityEl) hudVelocityEl.textContent = smoothedVelocity.toFixed(1);
    if (hudScrollsEl) hudScrollsEl.textContent = localScrollCount;

    if (hudPulseDot && hudStatusEl) {
      if (smoothedVelocity > 2.2) {
        hudPulseDot.style.background = '#f43f5e';
        hudPulseDot.style.boxShadow = '0 0 10px #f43f5e';
        hudStatusEl.textContent = 'Compulsive';
        hudStatusEl.style.color = '#fb7185';
      } else if (smoothedVelocity > 1.2) {
        hudPulseDot.style.background = '#f59e0b';
        hudPulseDot.style.boxShadow = '0 0 8px #f59e0b';
        hudStatusEl.textContent = 'Paced';
        hudStatusEl.style.color = '#fbbf24';
      } else {
        hudPulseDot.style.background = '#10b981';
        hudPulseDot.style.boxShadow = '0 0 8px #10b981';
        hudStatusEl.textContent = 'Calm';
        hudStatusEl.style.color = '#34d399';
      }
    }
  }

  /* =========================================================================
   * 2. SCROLL KINEMATICS & REAL-TIME DOOMSCROLL BURST DETECTOR
   * ========================================================================= */

  let lastScrollTimestamp = performance.now();
  let accumulatedScrollDistance = 0;
  let maxBurstVelocity = 0;
  let scrollThrottleTimer = null;
  const SCROLL_BATCH_MS = 250;

  // Sliding 15-second burst history for prompt soft interruptions
  const burstHistory = [];
  const BURST_WINDOW_MS = 15000;
  let lastInterventionTime = 0;
  const INTERVENTION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown between soft interruptions
  let isFrictionActive = false;

  function evaluateDoomscrollBurst(now) {
    // Purge records older than sliding window
    while (burstHistory.length > 0 && now - burstHistory[0].time > BURST_WINDOW_MS) {
      burstHistory.shift();
    }

    if (burstHistory.length < 8) return; // Need minimal scroll burst

    const totalDistance = burstHistory.reduce((acc, h) => acc + h.distance, 0);
    const avgBurstVelocity = burstHistory.reduce((acc, h) => acc + h.velocity, 0) / burstHistory.length;

    // DOOMSCROLLING BURST TRIGGER:
    // 10+ rapid scrolls in <15s with avg velocity > 1.4 px/ms OR cumulative 3,000+ px distance
    const isRapidBurst = burstHistory.length >= 10 && avgBurstVelocity >= 1.35;
    const isExtremeDistance = totalDistance >= 3200 && avgBurstVelocity >= 1.1;

    if ((isRapidBurst || isExtremeDistance) && now - lastInterventionTime >= INTERVENTION_COOLDOWN_MS) {
      lastInterventionTime = now;
      burstHistory.length = 0; // Clear burst

      triggerSoftInterruption({
        score: Math.min(0.92, 0.65 + avgBurstVelocity * 0.1),
        reasons: [
          `Rapid scrolling loop (${avgBurstVelocity.toFixed(1)} px/ms across past 15s)`,
          `Cumulative rapid traversal (${Math.round(totalDistance)} px traversed)`
        ]
      });
    }
  }

  function recordScrollTick(distanceDelta) {
    if (distanceDelta <= 0) return;

    const now = performance.now();
    const timeDelta = Math.max(1, now - lastScrollTimestamp);
    lastScrollTimestamp = now;

    const instantVelocity = distanceDelta / timeDelta; // px/ms
    maxBurstVelocity = Math.max(maxBurstVelocity, instantVelocity);
    accumulatedScrollDistance += distanceDelta;
    localScrollCount += 1;

    applySmoothedVelocity(instantVelocity);

    // Record into 15-second sliding burst detector
    burstHistory.push({ time: Date.now(), distance: distanceDelta, velocity: instantVelocity });
    evaluateDoomscrollBurst(Date.now());

    // Throttled background event dispatch
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
      }, SCROLL_BATCH_MS);
    }
  }

  // 1. Container & window scroll capture
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

  // 2. Wheel event capture with gentle scroll dampening if friction is active
  window.addEventListener(
    'wheel',
    (e) => {
      if (isFrictionActive) {
        // Soft dampening during active interruption checkpoint
        return;
      }
      const delta = Math.abs(e.deltaY || e.deltaX || 0);
      if (delta > 0 && delta < 2000) {
        recordScrollTick(delta);
      }
    },
    { passive: true, capture: true }
  );

  /* =========================================================================
   * 3. USER ACTIVITY & VIDEO TRACKING
   * ========================================================================= */

  let lastMouseTime = 0;
  let lastKeyTime = 0;

  window.addEventListener('mousemove', () => {
    const now = Date.now();
    if (now - lastMouseTime >= 1000) {
      lastMouseTime = now;
      safeSendMessage({ type: 'USER_ACTIVITY', data: { activityType: 'mouse', timestamp: now } });
    }
  }, { passive: true });

  window.addEventListener('keydown', () => {
    const now = Date.now();
    if (now - lastKeyTime >= 500) {
      lastKeyTime = now;
      safeSendMessage({ type: 'USER_ACTIVITY', data: { activityType: 'keyboard', timestamp: now } });
    }
  }, { passive: true });

  const observedVideos = new WeakSet();

  function attachVideoListener(video) {
    if (!video || observedVideos.has(video)) return;
    observedVideos.add(video);

    video.addEventListener('play', () => {
      const isAutoplay = Boolean(video.autoplay || video.hasAttribute('autoplay'));
      safeSendMessage({
        type: 'VIDEO_EVENT',
        data: { timestamp: Date.now(), isAutoplay }
      });
    }, { passive: true });
  }

  document.querySelectorAll('video').forEach(attachVideoListener);

  const videoObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'VIDEO') attachVideoListener(node);
          else if (node.querySelectorAll) node.querySelectorAll('video').forEach(attachVideoListener);
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
   * 4. SOFT INTERRUPTION & MINDFUL BREATHING INTERVENTION (SHADOW DOM)
   * ========================================================================= */

  let interventionHost = null;
  let interventionShadow = null;

  function createInterventionHost() {
    if (interventionHost) return;

    interventionHost = document.createElement('div');
    interventionHost.id = 'nudge-intervention-root';
    interventionHost.style.all = 'initial';
    interventionHost.style.position = 'fixed';
    interventionHost.style.top = '0';
    interventionHost.style.left = '0';
    interventionHost.style.width = '100vw';
    interventionHost.style.height = '100vh';
    interventionHost.style.zIndex = '2147483647';
    interventionHost.style.pointerEvents = 'auto';

    interventionShadow = interventionHost.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(interventionHost);
  }

  function triggerSoftInterruption(details = {}) {
    createInterventionHost();
    if (!interventionShadow) return;

    // Apply gentle scroll friction for 3.5 seconds to let the user pause comfortably
    isFrictionActive = true;
    setTimeout(() => {
      isFrictionActive = false;
    }, 3500);

    const reasons = (details.reasons || ['Rapid continuous scrolling detected']).slice(0, 2);
    const scorePct = Math.round((details.score || 0.72) * 100);

    interventionShadow.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
        
        /* Soft Ambient Vignette Overlay */
        .vignette-backdrop {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: radial-gradient(circle at center, rgba(15, 23, 42, 0.4) 30%, rgba(15, 23, 42, 0.82) 85%, rgba(99, 102, 241, 0.22) 100%);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: gentleFadeIn 0.5s ease forwards;
        }

        @keyframes gentleFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Centered Mindful Card */
        .mindful-card {
          width: 440px;
          max-width: 90vw;
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 24px;
          padding: 28px 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.2);
          color: #f8fafc;
          text-align: center;
          animation: cardPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardPop {
          from { transform: scale(0.92) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }

        .tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #fb7185;
          margin-bottom: 14px;
        }

        .heading {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .description {
          font-size: 13.5px;
          color: #cbd5e1;
          line-height: 1.5;
          margin-bottom: 16px;
        }

        /* Breathing Guide Circle */
        .breathing-container {
          margin: 16px auto 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .breath-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.1) 70%);
          border: 2px solid #818cf8;
          animation: breathCycle 4s ease-in-out infinite;
          margin-bottom: 10px;
        }

        @keyframes breathCycle {
          0%, 100% { transform: scale(0.82); opacity: 0.6; box-shadow: 0 0 10px rgba(99, 102, 241, 0.3); }
          50% { transform: scale(1.22); opacity: 1; box-shadow: 0 0 25px rgba(129, 140, 248, 0.8); }
        }

        .breath-label {
          font-size: 12.5px;
          font-weight: 700;
          color: #a5b4fc;
        }

        .reasons-box {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 10px;
          padding: 8px 12px;
          margin-bottom: 20px;
          font-size: 11.5px;
          color: #94a3b8;
          text-align: left;
        }

        .actions-row {
          display: flex;
          gap: 10px;
          margin-top: 6px;
        }

        .btn {
          flex: 1;
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-resume {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }
        .btn-resume:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(99, 102, 241, 0.5);
        }

        .btn-secondary {
          background: #334155;
          color: #cbd5e1;
        }
        .btn-secondary:hover {
          background: #475569;
          color: #ffffff;
        }
      </style>

      <div class="vignette-backdrop" id="backdrop">
        <div class="mindful-card">
          <div class="tag-pill">
            <span>⚡ ${scorePct}% Compulsive Momentum</span>
          </div>

          <h2 class="heading">🌿 Mindful Pause</h2>
          <p class="description">
            Your browsing rhythm accelerated into a compulsive pattern. Take a slow breath, relax your shoulders, and check in with your intention.
          </p>

          <div class="breathing-container">
            <div class="breath-ring"></div>
            <span class="breath-label" id="breathLabel">Breathe in...</span>
          </div>

          ${
            reasons.length > 0
              ? `<div class="reasons-box">
                  ${reasons.map((r) => `<div>• ${r}</div>`).join('')}
                </div>`
              : ''
          }

          <div class="actions-row">
            <button class="btn btn-resume" id="resumeBtn">✓ Resume Mindfully</button>
            <button class="btn btn-secondary" id="snoozeBtn">⏱️ Snooze (10m)</button>
          </div>
        </div>
      </div>
    `;

    const resumeBtn = interventionShadow.getElementById('resumeBtn');
    const snoozeBtn = interventionShadow.getElementById('snoozeBtn');
    const breathLabel = interventionShadow.getElementById('breathLabel');
    const backdrop = interventionShadow.getElementById('backdrop');

    // Breath text toggler
    let isInhale = true;
    const breathTimer = setInterval(() => {
      isInhale = !isInhale;
      if (breathLabel) {
        breathLabel.textContent = isInhale ? 'Breathe in...' : 'Breathe out...';
      }
    }, 2000);

    function dismissIntervention(action) {
      clearInterval(breathTimer);
      isFrictionActive = false;
      safeSendMessage({ type: 'LOG_INTERVENTION_ACTION', data: { action } });

      if (backdrop) {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.35s ease';
        setTimeout(() => {
          if (interventionHost && interventionHost.parentNode) {
            interventionHost.parentNode.removeChild(interventionHost);
            interventionHost = null;
            interventionShadow = null;
          }
        }, 350);
      }
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => dismissIntervention('resumed_mindfully'));
    }

    if (snoozeBtn) {
      snoozeBtn.addEventListener('click', () => {
        safeSendMessage({ type: 'SNOOZE_NUDGE', data: { snoozeMinutes: 10 } });
        dismissIntervention('snoozed');
      });
    }
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'SHOW_NUDGE') {
      triggerSoftInterruption(message.data || {});
    }
  });

  safeSendMessage({ type: 'USER_ACTIVITY', data: { activityType: 'init', timestamp: Date.now() } });
})();
