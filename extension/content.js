/**
 * Nudge Content Script - Privacy-First Behavioral Observer
 *
 * Observes:
 * 1. Scrolling kinematics (distance, elapsed time, velocity) using document.scrollingElement.scrollTop
 * 2. High-level user activity (clicks, mouse movement, keyboard interaction without key values)
 * 3. Video playback and autoplay detection
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
   * Catches errors if extension context was invalidated or background is sleeping.
   */
  function safeSendMessage(message) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage(message).catch(() => {
          // Context invalidated (e.g. extension reloaded) or SW waking up - safely ignore
        });
      }
    } catch {
      // Inaccessible runtime
    }
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

  // Observe dynamically added video elements (e.g. YouTube, TikTok, Reddit, Instagram)
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

  // Initial ping to notify active presence
  safeSendMessage({
    type: 'USER_ACTIVITY',
    data: {
      activityType: 'init',
      timestamp: Date.now()
    }
  });
})();
