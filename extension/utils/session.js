/**
 * Session Management Utilities for Nudge.
 *
 * Implements pure logic for:
 * - Session creation
 * - Inactive/Idle detection (60s threshold)
 * - Metric accumulation (scrolls, velocities, video/autoplay, tab switches, activities)
 * - Session finalization and summary generation
 */

export const IDLE_THRESHOLD_MS = 60 * 1000; // 60 seconds

/**
 * Generates a unique session ID.
 * @returns {string}
 */
export function generateSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Creates a new blank active session object.
 *
 * @param {Object} [overrides={}] - Optional initial values
 * @returns {Object} Fresh session object
 */
export function createSession(overrides = {}) {
  const now = overrides.startTime || Date.now();
  return {
    sessionId: overrides.sessionId || generateSessionId(),
    startTime: now,
    endTime: null,
    lastActivityTime: overrides.lastActivityTime || now,
    durationMs: 0,

    // Scroll metrics
    scrollCount: 0,
    totalScrollDistance: 0,
    totalScrollVelocity: 0,
    averageScrollVelocity: 0,
    maxScrollVelocity: 0,

    // General activity and tab metrics
    activityCount: 0,
    tabSwitchCount: 0,

    // Video metrics
    videoPlayCount: 0,
    autoplayCount: 0,

    // Idle metrics
    idleDurationMs: 0,

    // Clean domains visited (hostnames only)
    domains: [],

    ...overrides
  };
}

/**
 * Checks if a session is currently idle based on the inactivity threshold.
 *
 * @param {Object} session
 * @param {number} [thresholdMs=IDLE_THRESHOLD_MS]
 * @param {number} [currentTime=Date.now()]
 * @returns {boolean}
 */
export function isSessionIdle(session, thresholdMs = IDLE_THRESHOLD_MS, currentTime = Date.now()) {
  if (!session || !session.lastActivityTime) return true;
  return (currentTime - session.lastActivityTime) >= thresholdMs;
}

/**
 * Updates a session with a new scroll event.
 *
 * @param {Object} session - The mutable or cloned session object
 * @param {Object} scrollData - { scrollDistance, velocity, timestamp }
 * @returns {Object} Updated session
 */
export function updateSessionScroll(session, scrollData = {}) {
  const now = scrollData.timestamp || Date.now();
  const distance = Math.max(0, Number(scrollData.scrollDistance) || 0);
  const velocity = Math.max(0, Number(scrollData.velocity) || 0);

  session.scrollCount = (session.scrollCount || 0) + 1;
  session.totalScrollDistance = (session.totalScrollDistance || 0) + distance;
  session.totalScrollVelocity = (session.totalScrollVelocity || 0) + velocity;
  session.maxScrollVelocity = Math.max(session.maxScrollVelocity || 0, velocity);
  session.averageScrollVelocity = session.scrollCount > 0
    ? (session.totalScrollVelocity / session.scrollCount)
    : 0;

  session.lastActivityTime = now;
  session.activityCount = (session.activityCount || 0) + 1;

  return session;
}

/**
 * Updates a session with a generic user activity event.
 *
 * @param {Object} session
 * @param {Object} activityData - { activityType, timestamp }
 * @returns {Object} Updated session
 */
export function updateSessionActivity(session, activityData = {}) {
  const now = activityData.timestamp || Date.now();
  session.activityCount = (session.activityCount || 0) + 1;
  session.lastActivityTime = now;
  return session;
}

/**
 * Updates a session with a video playback event.
 *
 * @param {Object} session
 * @param {Object} videoData - { isAutoplay, timestamp }
 * @returns {Object} Updated session
 */
export function updateSessionVideo(session, videoData = {}) {
  const now = videoData.timestamp || Date.now();
  session.videoPlayCount = (session.videoPlayCount || 0) + 1;
  if (videoData.isAutoplay) {
    session.autoplayCount = (session.autoplayCount || 0) + 1;
  }
  session.activityCount = (session.activityCount || 0) + 1;
  session.lastActivityTime = now;
  return session;
}

/**
 * Updates a session with a tab switch event.
 *
 * @param {Object} session
 * @param {Object} tabData - { domain, timestamp }
 * @returns {Object} Updated session
 */
export function updateSessionTabSwitch(session, tabData = {}) {
  const now = tabData.timestamp || Date.now();
  session.tabSwitchCount = (session.tabSwitchCount || 0) + 1;
  session.activityCount = (session.activityCount || 0) + 1;

  if (tabData.domain && typeof tabData.domain === 'string') {
    if (!Array.isArray(session.domains)) {
      session.domains = [];
    }
    if (!session.domains.includes(tabData.domain)) {
      session.domains.push(tabData.domain);
    }
  }

  session.lastActivityTime = now;
  return session;
}

/**
 * Finalizes an active session for persistence to historical storage.
 *
 * @param {Object} session
 * @param {number} [currentTime=Date.now()]
 * @returns {Object} Finalized session
 */
export function finalizeSessionData(session, currentTime = Date.now()) {
  const finalTime = session.lastActivityTime || currentTime;
  session.endTime = finalTime;
  session.durationMs = Math.max(0, finalTime - session.startTime);

  // Recalculate average velocity cleanly
  session.averageScrollVelocity = session.scrollCount > 0
    ? (session.totalScrollVelocity / session.scrollCount)
    : 0;

  return session;
}

/**
 * Extracts a clean public summary of the session for UI / reporting.
 *
 * @param {Object} session
 * @param {number} [currentTime=Date.now()]
 * @returns {Object} Session summary
 */
export function getSessionSummary(session, currentTime = Date.now()) {
  if (!session) return null;

  const currentDuration = session.endTime
    ? session.durationMs
    : Math.max(0, currentTime - session.startTime);

  return {
    sessionId: session.sessionId,
    startTime: session.startTime,
    endTime: session.endTime,
    durationMs: currentDuration,
    scrollCount: session.scrollCount || 0,
    totalScrollDistance: Math.round(session.totalScrollDistance || 0),
    totalScrollVelocity: Number((session.totalScrollVelocity || 0).toFixed(2)),
    averageScrollVelocity: Number((session.averageScrollVelocity || 0).toFixed(2)),
    maxScrollVelocity: Number((session.maxScrollVelocity || 0).toFixed(2)),
    activityCount: session.activityCount || 0,
    tabSwitchCount: session.tabSwitchCount || 0,
    videoPlayCount: session.videoPlayCount || 0,
    autoplayCount: session.autoplayCount || 0,
    idleDurationMs: session.idleDurationMs || 0,
    domains: Array.isArray(session.domains) ? [...session.domains] : []
  };
}
