/**
 * Nudge Background Service Worker (Manifest V3)
 *
 * Full Multi-Phase Implementation:
 * - Phase 1–4: Active Session Management, Idle Rotation (60s), IndexedDB persistence
 * - Phase 5–6: Real-time Feature Extraction & Rule-Based Behavioral Detection
 * - Phase 7: Non-intrusive Gentle Nudge Intervention Dispatcher with Cooldowns
 * - Phase 11: In-Browser Hybrid Machine Learning & Heuristic Inference
 * - Phase 12: Adaptive Baseline Personalization
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
import { extractFeatures } from './utils/features.js';
import { evaluateSessionBehavior } from './detector.js';
import { evaluateSessionHybrid } from './utils/modelRunner.js';
import {
  buildPersonalProfile,
  getStoredPersonalProfile,
  savePersonalProfile
} from './utils/personalization.js';

const STORAGE_ACTIVE_KEY = 'activeSession';
const STORAGE_INTERVENTIONS_KEY = 'nudge_interventions';
const STORAGE_SETTINGS_KEY = 'nudge_settings';
const PERSIST_THROTTLE_MS = 3000;

// Default Settings
const DEFAULT_SETTINGS = {
  nudgeEnabled: true,
  cooldownMinutes: 15,
  sensitivity: 'normal', // 'gentle', 'normal', 'strict'
  doomscrollThreshold: 0.65
};

// In-memory states
let activeSession = null;
let persistTimer = null;
let lastActiveTabId = null;
let isInitialized = false;
let personalProfile = null;
let userSettings = { ...DEFAULT_SETTINGS };
let lastNudgeTimestamp = 0;
let nudgeCooldownUntil = 0;

/* =========================================================================
 * SESSION MANAGEMENT & LIFECYCLE
 * ========================================================================= */

export function createSession(overrides = {}) {
  activeSession = makeSession(overrides);
  persistActiveSession(true);
  return activeSession;
}

export async function restoreActiveSession() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_ACTIVE_KEY,
      STORAGE_SETTINGS_KEY
    ]);

    if (data[STORAGE_SETTINGS_KEY]) {
      userSettings = { ...DEFAULT_SETTINGS, ...data[STORAGE_SETTINGS_KEY] };
    }

    personalProfile = await getStoredPersonalProfile();

    const stored = data[STORAGE_ACTIVE_KEY];
    const now = Date.now();

    if (stored && stored.sessionId && stored.startTime) {
      if (isSessionIdle(stored, IDLE_THRESHOLD_MS, now)) {
        await finalizeSession(stored);
        createSession();
      } else {
        activeSession = stored;
      }
    } else {
      createSession();
    }
  } catch (err) {
    console.error('[Nudge] Error restoring active session:', err);
    createSession();
  }
}

export function persistActiveSession(immediate = false) {
  if (!activeSession) return;

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    chrome.storage.local.set({ [STORAGE_ACTIVE_KEY]: activeSession }).catch(() => {});
    return;
  }

  if (!persistTimer) {
    persistTimer = setTimeout(() => {
      persistTimer = null;
      if (activeSession) {
        chrome.storage.local.set({ [STORAGE_ACTIVE_KEY]: activeSession }).catch(() => {});
      }
    }, PERSIST_THROTTLE_MS);
  }
}

export async function finalizeSession(sessionToFinalize = null) {
  const session = sessionToFinalize || activeSession;
  if (!session) return null;

  try {
    const finalized = finalizeSessionData(session, Date.now());

    if (finalized.durationMs >= 1000 || finalized.activityCount > 0 || finalized.scrollCount > 0) {
      // Run hybrid behavioral evaluation and record detection score on final record
      const evaluation = evaluateSessionHybrid(finalized, personalProfile);
      finalized.doomscrollScore = evaluation.score;
      finalized.riskLevel = evaluation.riskLevel;

      await saveSessionToDB(finalized);

      // Re-calibrate personal baseline asynchronously
      calibratePersonalProfile();
    }

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

async function checkIdleAndRotateIfNeeded(timestamp = Date.now()) {
  if (!activeSession) {
    createSession({ startTime: timestamp, lastActivityTime: timestamp });
    return;
  }

  if (isSessionIdle(activeSession, IDLE_THRESHOLD_MS, timestamp)) {
    await finalizeSession();
    createSession({ startTime: timestamp, lastActivityTime: timestamp });
  }
}

export function getSessionSummary() {
  if (!activeSession) return null;
  const summary = makeSummary(activeSession, Date.now());
  const evaluation = evaluateSessionHybrid(activeSession, personalProfile);
  return {
    ...summary,
    evaluation
  };
}

/* =========================================================================
 * PHASE 7 & 11: DETECTION & NUDGE INTERVENTION TRIGGER
 * ========================================================================= */

async function evaluateAndTriggerNudgeIfNeeded() {
  if (!userSettings.nudgeEnabled || !activeSession) return;

  const now = Date.now();
  if (now < nudgeCooldownUntil) return;

  // Evaluate hybrid ML and rule-based score
  const evaluation = evaluateSessionHybrid(activeSession, personalProfile);

  // Trigger if score surpasses threshold
  const threshold = userSettings.doomscrollThreshold || 0.65;
  if (evaluation.score >= threshold && evaluation.isDoomscrolling) {
    // Check cooldown
    const cooldownMs = (userSettings.cooldownMinutes || 15) * 60000;
    if (now - lastNudgeTimestamp >= cooldownMs) {
      lastNudgeTimestamp = now;
      nudgeCooldownUntil = now + cooldownMs;

      // Log intervention
      await recordInterventionEvent({
        sessionId: activeSession.sessionId,
        score: evaluation.score,
        riskLevel: evaluation.riskLevel,
        reasons: evaluation.reasons,
        timestamp: now
      });

      // Dispatch to active tab
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, {
            type: 'SHOW_NUDGE',
            data: {
              score: evaluation.score,
              riskLevel: evaluation.riskLevel,
              reasons: evaluation.reasons,
              recommendation: evaluation.recommendation
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[Nudge] Could not send nudge to active tab:', err);
      }
    }
  }
}

async function recordInterventionEvent(event) {
  try {
    const data = await chrome.storage.local.get(STORAGE_INTERVENTIONS_KEY);
    const history = data[STORAGE_INTERVENTIONS_KEY] || [];
    history.unshift(event);
    // Keep last 50 interventions
    await chrome.storage.local.set({ [STORAGE_INTERVENTIONS_KEY]: history.slice(0, 50) });
  } catch (err) {
    console.error('[Nudge] Error recording intervention:', err);
  }
}

/* =========================================================================
 * PHASE 12: PERSONALIZATION CALIBRATION
 * ========================================================================= */

async function calibratePersonalProfile() {
  try {
    const sessions = await getAllSessionsFromDB();
    if (sessions && sessions.length >= 3) {
      personalProfile = buildPersonalProfile(sessions);
      await savePersonalProfile(personalProfile);
      console.log('[Nudge] Personal baseline profile calibrated successfully:', personalProfile);
    }
  } catch (err) {
    console.warn('[Nudge] Could not calibrate personal profile:', err);
  }
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
  evaluateAndTriggerNudgeIfNeeded();
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
  evaluateAndTriggerNudgeIfNeeded();
}

export async function handleTabSwitch(tabId, domain) {
  const now = Date.now();
  await checkIdleAndRotateIfNeeded(now);

  updateSessionTabSwitch(activeSession, {
    domain,
    timestamp: now
  });

  persistActiveSession();
  evaluateAndTriggerNudgeIfNeeded();
}

/* =========================================================================
 * BROWSER EVENT LISTENERS
 * ========================================================================= */

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const currentTabId = activeInfo.tabId;

    if (lastActiveTabId !== null && lastActiveTabId !== currentTabId) {
      let domain = null;
      try {
        const tab = await chrome.tabs.get(currentTabId);
        if (tab && tab.url) {
          domain = extractCleanDomain(tab.url);
        }
      } catch {
        // Tab closing
      }

      await handleTabSwitch(currentTabId, domain);
    }

    lastActiveTabId = currentTabId;
  } catch (err) {
    console.error('[Nudge] tabs.onActivated error:', err);
  }
});

chrome.alarms.create('nudge_periodic_check', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'nudge_periodic_check') {
    if (activeSession && isSessionIdle(activeSession, IDLE_THRESHOLD_MS, Date.now())) {
      await finalizeSession();
    } else if (activeSession) {
      evaluateAndTriggerNudgeIfNeeded();
    }
  }
});

/* =========================================================================
 * MESSAGE DISPATCHER (CONTENT SCRIPT, POPUP, DASHBOARD API)
 * ========================================================================= */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    sendResponse({ success: false, error: 'Malformed message' });
    return false;
  }

  (async () => {
    try {
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
          await clearSessionsFromDB();
          sendResponse({ success: true });
          break;
        }

        case 'GET_DETECTION': {
          const evaluation = activeSession ? evaluateSessionHybrid(activeSession, personalProfile) : null;
          sendResponse({ success: true, evaluation, personalProfile });
          break;
        }

        case 'SNOOZE_NUDGE': {
          const minutes = Number(message.data?.snoozeMinutes) || 10;
          nudgeCooldownUntil = Date.now() + minutes * 60000;
          sendResponse({ success: true, cooldownUntil: nudgeCooldownUntil });
          break;
        }

        case 'LOG_INTERVENTION_ACTION': {
          const action = message.data?.action || 'unknown';
          const data = await chrome.storage.local.get(STORAGE_INTERVENTIONS_KEY);
          const history = data[STORAGE_INTERVENTIONS_KEY] || [];
          if (history.length > 0) {
            history[0].userAction = action;
            await chrome.storage.local.set({ [STORAGE_INTERVENTIONS_KEY]: history });
          }
          sendResponse({ success: true });
          break;
        }

        case 'GET_INTERVENTIONS': {
          const data = await chrome.storage.local.get(STORAGE_INTERVENTIONS_KEY);
          sendResponse({ success: true, interventions: data[STORAGE_INTERVENTIONS_KEY] || [] });
          break;
        }

        case 'GET_SETTINGS': {
          sendResponse({ success: true, settings: userSettings, personalProfile });
          break;
        }

        case 'UPDATE_SETTINGS': {
          userSettings = { ...userSettings, ...(message.data || {}) };
          await chrome.storage.local.set({ [STORAGE_SETTINGS_KEY]: userSettings });
          sendResponse({ success: true, settings: userSettings });
          break;
        }

        case 'TRIGGER_TEST_NUDGE': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SHOW_NUDGE',
              data: {
                score: 0.85,
                riskLevel: 'SEVERE',
                reasons: ['Test Intervention Triggered by User', 'Scroll velocity elevated (3.2 px/ms)'],
                recommendation: 'This is a test nudge to preview the in-browser intervention UI.'
              }
            }).catch(() => {});
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
          break;
      }
    } catch (err) {
      console.error(`[Nudge] Message error ${message.type}:`, err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id && (!tab.url || (!tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')))) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Nudge] Could not inject content scripts into existing tabs:', err);
  }
});

async function init() {
  if (isInitialized) return;
  isInitialized = true;
  await restoreActiveSession();
  await calibratePersonalProfile();
}

init();

