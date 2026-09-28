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
    startTime: Date.now() - 1000 * 60 * 12,
    endTime: null,
    durationMs: 1000 * 60 * 12,
    scrollCount: 47,
    totalScrollDistance: 15420,
    totalScrollVelocity: 52.3,
    averageScrollVelocity: 1.11,
    maxScrollVelocity: 3.4,
    activityCount: 94,
    tabSwitchCount: 3,
    videoPlayCount: 3,
    autoplayCount: 2,
    idleDurationMs: 0,
    domains: ['youtube.com', 'news.ycombinator.com']
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

  // Standalone fallback from localStorage or defaults
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

  // Standalone fallback
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

  // Standalone fallback
  localStorage.removeItem('nudge_preview_history');
  return true;
}

/**
 * Exports current sessions as a JSON dataset (Phase 9 dataset preparation).
 */
export function exportDatasetAsJson(sessions) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessions, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `nudge_behavioral_dataset_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
