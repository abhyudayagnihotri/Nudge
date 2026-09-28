/**
 * Communication bridge between the Dashboard and the Nudge Chrome Extension.
 *
 * Supports two runtime modes:
 * 1. Extension mode: Communicates directly via chrome.runtime.sendMessage with background service worker.
 * 2. Standalone Vite Preview mode: Falls back to mock or localStorage data so the dashboard can be developed and inspected independently.
 */

export function isExtensionAvailable() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
}

// Fallback sample sessions for standalone dashboard preview
const SAMPLE_SESSIONS = [
  {
    sessionId: 'sample_sess_101',
    startTime: Date.now() - 1000 * 60 * 45,
    endTime: Date.now() - 1000 * 60 * 15,
    durationMs: 1000 * 60 * 30,
    scrollCount: 142,
    totalScrollDistance: 48920,
    totalScrollVelocity: 185.4,
    averageScrollVelocity: 1.31,
    maxScrollVelocity: 4.82,
    activityCount: 280,
    tabSwitchCount: 12,
    videoPlayCount: 8,
    autoplayCount: 5,
    idleDurationMs: 0,
    doomscrollScore: 0.74,
    riskLevel: 'ELEVATED',
    domains: ['youtube.com', 'reddit.com', 'x.com']
  },
  {
    sessionId: 'sample_sess_102',
    startTime: Date.now() - 1000 * 60 * 120,
    endTime: Date.now() - 1000 * 60 * 75,
    durationMs: 1000 * 60 * 45,
    scrollCount: 88,
    totalScrollDistance: 21300,
    totalScrollVelocity: 68.2,
    averageScrollVelocity: 0.78,
    maxScrollVelocity: 2.15,
    activityCount: 140,
    tabSwitchCount: 4,
    videoPlayCount: 2,
    autoplayCount: 0,
    idleDurationMs: 0,
    doomscrollScore: 0.18,
    riskLevel: 'HEALTHY',
    domains: ['github.com', 'stackoverflow.com', 'developer.mozilla.org']
  }
];

export async function fetchActiveSession() {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
      if (response && response.success) {
        return response.session;
      }
    } catch (err) {
      console.warn('[Extension Bridge] Error fetching active session:', err);
    }
  }

  // Standalone fallback
  const cached = localStorage.getItem('nudge_preview_active');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      parsed.durationMs = Date.now() - parsed.startTime;
      return parsed;
    } catch {
      // fallback
    }
  }

  return {
    sessionId: 'preview_active_session',
    startTime: Date.now() - 1000 * 60 * 18,
    endTime: null,
    durationMs: 1000 * 60 * 18,
    scrollCount: 78,
    totalScrollDistance: 28420,
    totalScrollVelocity: 112.3,
    averageScrollVelocity: 1.44,
    maxScrollVelocity: 3.8,
    activityCount: 164,
    tabSwitchCount: 6,
    videoPlayCount: 4,
    autoplayCount: 3,
    idleDurationMs: 0,
    domains: ['youtube.com', 'reddit.com', 'news.ycombinator.com'],
    evaluation: {
      score: 0.68,
      riskLevel: 'ELEVATED',
      isDoomscrolling: true,
      mlProbability: 0.72,
      ruleScore: 0.64,
      reasons: [
        'Rapid scrolling detected (1.44 px/ms)',
        'Frequent automated/autoplay consumption',
        'Algorithmic infinite-scroll platforms'
      ],
      drivers: [
        { feature: 'scrollFrequency', contribution: 0.42 },
        { feature: 'infiniteScrollDomainRatio', contribution: 0.38 },
        { feature: 'autoplayRatio', contribution: 0.31 }
      ],
      recommendation: 'Behavioral momentum is rising into a potential doomscrolling cycle.'
    }
  };
}

export async function fetchHistoricalSessions() {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SESSIONS' });
      if (response && response.success) {
        return response.sessions || [];
      }
    } catch (err) {
      console.warn('[Extension Bridge] Error fetching historical sessions:', err);
    }
  }

  const stored = localStorage.getItem('nudge_preview_history');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }

  localStorage.setItem('nudge_preview_history', JSON.stringify(SAMPLE_SESSIONS));
  return SAMPLE_SESSIONS;
}

export async function fetchInterventions() {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_INTERVENTIONS' });
      if (response && response.success) {
        return response.interventions || [];
      }
    } catch (err) {
      console.warn('[Extension Bridge] Error fetching interventions:', err);
    }
  }
  return [
    {
      sessionId: 'sample_sess_101',
      score: 0.76,
      riskLevel: 'ELEVATED',
      reasons: ['High scroll velocity', 'Late-night browsing'],
      timestamp: Date.now() - 1000 * 60 * 35,
      userAction: 'took_break'
    }
  ];
}

export async function fetchSettings() {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) {
        return response;
      }
    } catch (err) {
      console.warn('[Extension Bridge] Error fetching settings:', err);
    }
  }
  return {
    settings: {
      nudgeEnabled: true,
      cooldownMinutes: 15,
      sensitivity: 'normal',
      doomscrollThreshold: 0.65
    },
    personalProfile: {
      isCalibrated: true,
      sessionsCount: 8,
      medianVelocity: 1.25,
      p75Velocity: 1.78,
      medianDurationMinutes: 16.5,
      sensitivityModifier: 1.0,
      customThresholds: {
        velocityWarning: 2.05,
        velocityCritical: 2.85,
        durationWarningMinutes: 26,
        durationCriticalMinutes: 42
      }
    }
  };
}

export async function updateSettings(newSettings) {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        data: newSettings
      });
      return Boolean(response && response.success);
    } catch (err) {
      console.error('[Extension Bridge] Error updating settings:', err);
      return false;
    }
  }
  return true;
}

export async function triggerTestNudge() {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_TEST_NUDGE' });
      return Boolean(response && response.success);
    } catch (err) {
      console.error('[Extension Bridge] Error triggering test nudge:', err);
      return false;
    }
  }
  alert('[Preview Mode] Test nudge dispatched to active browser tab in extension mode.');
  return true;
}

export async function deleteSession(sessionId) {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_SESSION',
        data: { sessionId }
      });
      return Boolean(response && response.success);
    } catch (err) {
      console.error('[Extension Bridge] Error deleting session:', err);
      return false;
    }
  }

  const history = await fetchHistoricalSessions();
  const filtered = history.filter((s) => s.sessionId !== sessionId);
  localStorage.setItem('nudge_preview_history', JSON.stringify(filtered));
  return true;
}

export async function clearAllHistoricalSessions() {
  if (isExtensionAvailable()) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CLEAR_SESSIONS' });
      return Boolean(response && response.success);
    } catch (err) {
      console.error('[Extension Bridge] Error clearing sessions:', err);
      return false;
    }
  }

  localStorage.removeItem('nudge_preview_history');
  return true;
}

export function exportDatasetAsJson(sessions) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessions, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `nudge_behavioral_dataset_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
