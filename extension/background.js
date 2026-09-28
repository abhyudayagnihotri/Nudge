/**
 * Nudge Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Session lifecycle management (active session in chrome.storage.local, historical in IndexedDB)
 * - Inactive/Idle detection (60-second threshold)
 * - Safe ingestion of scroll, activity, video, and tab events
 * - Privacy enforcement (hostname-only domain retention, no keystrokes, no full URLs)
 * - Messaging API for Content Scripts, Popup, and Dashboard
 */

import {
  openDatabase,
  saveSession as saveSessionToDB,
  getAllSessions as getAllSessionsFromDB,
  getSession as getSessionFromDB,
  deleteSession as deleteSessionFromDB,
  clearSessions as clearSessionsFromDB
} from './db.js';

import {
  createSession as makeSession,
  isSessionIdle,
  updateSessionScroll,
  updateSessionActivity,
  updateSessionVideo,
  updateSessionTabSwitch,
  finalizeSessionData,
  getSessionSummary as makeSummary,
  IDLE_THRESHOLD_MS
} from './utils/session.js';

import { extractCleanDomain } from './utils/url.js';

const STORAGE_ACTIVE_KEY = 'activeSession';
const PERSIST_THROTTLE_MS = 3000; // 3 seconds throttle for chrome.storage.local writes

// In-memory active session state
let activeSession = null;
let persistTimer = null;
let lastActiveTabId = null;
let isInitialized = false;

/* =========================================================================
 * SESSION MANAGEMENT FUNCTIONS
 * ========================================================================= */

/**
 * Creates a brand new active session and schedules its persistence.
 */
export function createSession(overrides = {}) {
  activeSession = makeSession(overrides);
  persistActiveSession(true);
  return activeSession;
}

/**
 * Restores the active session from chrome.storage.local upon service worker start.
 * If the restored session was already idle for >= 60 seconds, it is finalized and saved to IndexedDB.
 */
export async function restoreActiveSession() {
  try {
    const data = await chrome.storage.local.get(STORAGE_ACTIVE_KEY);
    const stored = data[STORAGE_ACTIVE_KEY];

    const now = Date.now();

    if (stored && stored.sessionId && stored.startTime) {
      if (isSessionIdle(stored, IDLE_THRESHOLD_MS, now)) {
        console.log('[Nudge] Stored session is idle, finalizing before starting new:', stored.sessionId);
        await finalizeSession(stored);
        createSession();
      } else {
        activeSession = stored;
        console.log('[Nudge] Restored active session:', activeSession.sessionId);
      }
    } else {
      createSession();
    }
  } catch (err) {
    console.error('[Nudge] Error restoring active session:', err);
    createSession();
  }
}

/**
 * Persists the in-memory active session to chrome.storage.local.
 *
 * @param {boolean} [immediate=false] - If true, bypasses throttle and persists immediately
 */
export function persistActiveSession(immediate = false) {
  if (!activeSession) return;

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    chrome.storage.local.set({ [STORAGE_ACTIVE_KEY]: activeSession }).catch((err) => {
      console.error('[Nudge] Error persisting active session immediately:', err);
    });
    return;
  }

  if (!persistTimer) {
    persistTimer = setTimeout(() => {
      persistTimer = null;
      if (activeSession) {
        chrome.storage.local.set({ [STORAGE_ACTIVE_KEY]: activeSession }).catch((err) => {
          console.error('[Nudge] Error persisting active session:', err);
        });
      }
    }, PERSIST_THROTTLE_MS);
  }
}

/**
 * Finalizes an active session and commits it to IndexedDB.
 * Removes the session from chrome.storage.local and creates a new one.
 *
 * @param {Object} [sessionToFinalize=null] - Optional specific session to finalize
 * @returns {Promise<Object>} The finalized session
 */
export async function finalizeSession(sessionToFinalize = null) {
  const session = sessionToFinalize || activeSession;
  if (!session) return null;

  try {
    const finalized = finalizeSessionData(session, Date.now());

    // Only save sessions with meaningful duration or activity
    if (finalized.durationMs >= 1000 || finalized.activityCount > 0 || finalized.scrollCount > 0) {
      await saveSessionToDB(finalized);
      console.log('[Nudge] Session finalized and saved to IndexedDB:', finalized.sessionId);
    }

    // If we finalized the current active session, clear it from storage and memory
    if (!sessionToFinalize || (activeSession && activeSession.sessionId === session.sessionId)) {
      activeSession = null;
      await chrome.storage.local.remove(STORAGE_ACTIVE_KEY);
    }

    return finalized;
  } catch (err) {
    console.error('[Nudge] Failed to finalize session:', err);
    return session;
  }
}

/**
 * Checks if the current session has exceeded the idle threshold.
 * If so, finalizes it and creates a fresh session.
 */
async function checkIdleAndRotateIfNeeded(timestamp = Date.now()) {
  if (!activeSession) {
    createSession({ startTime: timestamp, lastActivityTime: timestamp });
    return;
  }

  if (isSessionIdle(activeSession, IDLE_THRESHOLD_MS, timestamp)) {
    console.log('[Nudge] Session idle threshold exceeded. Rotating session...');
    await finalizeSession();
    createSession({ startTime: timestamp, lastActivityTime: timestamp });
  }
}

/**
 * Returns a summary of the active session.
 */
export function getSessionSummary() {
  if (!activeSession) return null;
  return makeSummary(activeSession, Date.now());
}

/* =========================================================================
 * EVENT HANDLERS
 * ========================================================================= */

export async function handleScroll(scrollData = {}) {
  const now = scrollData.timestamp || Date.now();
  await checkIdleAndRotateIfNeeded(now);

  updateSessionScroll(activeSession, {
    scrollDistance: scrollData.scrollDistance,
    velocity: scrollData.velocity,
    timestamp: now
  });

  persistActiveSession();
}

export async function handleUserActivity(activityData = {}) {
  const now = activityData.timestamp || Date.now();
  await checkIdleAndRotateIfNeeded(now);

  updateSessionActivity(activeSession, {
    activityType: activityData.activityType,
    timestamp: now
  });

  persistActiveSession();
}

export async function handleVideoEvent(videoData = {}) {
  const now = videoData.timestamp || Date.now();
  await checkIdleAndRotateIfNeeded(now);

  updateSessionVideo(activeSession, {
    isAutoplay: Boolean(videoData.isAutoplay),
    timestamp: now
  });

  persistActiveSession();
}

export async function handleTabSwitch(tabId, domain) {
  const now = Date.now();
  await checkIdleAndRotateIfNeeded(now);

  updateSessionTabSwitch(activeSession, {
    domain,
    timestamp: now
  });

  persistActiveSession();
}

/* =========================================================================
 * BROWSER EVENT LISTENERS
 * ========================================================================= */

// Tab switch listener
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const currentTabId = activeInfo.tabId;

    // Do not count the initial activation when lastActiveTabId is null
    if (lastActiveTabId !== null && lastActiveTabId !== currentTabId) {
      let domain = null;
      try {
        const tab = await chrome.tabs.get(currentTabId);
        if (tab && tab.url) {
          domain = extractCleanDomain(tab.url);
        }
      } catch {
        // Tab might be closing or inaccessible
      }

      await handleTabSwitch(currentTabId, domain);
    }

    lastActiveTabId = currentTabId;
  } catch (err) {
    console.error('[Nudge] Error in tabs.onActivated handler:', err);
  }
});

// Periodic idle alarm (checks every minute)
chrome.alarms.create('nudge_idle_check', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'nudge_idle_check') {
    if (activeSession && isSessionIdle(activeSession, IDLE_THRESHOLD_MS, Date.now())) {
      console.log('[Nudge] Idle alarm triggered finalization');
      await finalizeSession();
    }
  }
});

/* =========================================================================
 * MESSAGE DISPATCHER (CONTENT SCRIPT & UI API)
 * ========================================================================= */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate incoming message structure
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    sendResponse({ success: false, error: 'Malformed message' });
    return false;
  }

  // Handle messages asynchronously
  (async () => {
    try {
      // Ensure active session is ready
      if (!activeSession) {
        await restoreActiveSession();
      }

      switch (message.type) {
        case 'SCROLL_EVENT': {
          await handleScroll(message.data || {});
          sendResponse({ success: true });
          break;
        }

        case 'USER_ACTIVITY': {
          await handleUserActivity(message.data || {});
          sendResponse({ success: true });
          break;
        }

        case 'VIDEO_EVENT': {
          await handleVideoEvent(message.data || {});
          sendResponse({ success: true });
          break;
        }

        case 'GET_SESSION': {
          const summary = getSessionSummary();
          sendResponse({ success: true, session: summary });
          break;
        }

        case 'GET_SESSIONS': {
          const sessions = await getAllSessionsFromDB();
          sendResponse({ success: true, sessions });
          break;
        }

        case 'DELETE_SESSION': {
          const sessionId = message.data?.sessionId;
          if (!sessionId) {
            sendResponse({ success: false, error: 'Missing sessionId' });
            return;
          }
          await deleteSessionFromDB(sessionId);
          sendResponse({ success: true });
          break;
        }

        case 'CLEAR_SESSIONS': {
          // Clears historical sessions only, never deletes currently active session
          await clearSessionsFromDB();
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
          break;
      }
    } catch (err) {
      console.error(`[Nudge] Error processing message ${message.type}:`, err);
      sendResponse({ success: false, error: err.message || 'Internal error' });
    }
  })();

  return true; // Keep message channel open for async response
});

/* =========================================================================
 * INITIALIZATION
 * ========================================================================= */

async function init() {
  if (isInitialized) return;
  isInitialized = true;
  await restoreActiveSession();
}

init();
