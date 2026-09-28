/**
 * Phase 5: Feature Engineering Foundation for Nudge.
 *
 * Transforms raw session telemetry into standardized behavioral features
 * suitable for both rule-based detection and machine learning inference.
 */

// Known infinite-scroll platforms associated with habitual loops
export const INFINITE_SCROLL_DOMAINS = [
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'pinterest.com',
  'threads.net',
  'tumblr.com'
];

/**
 * Extracts a standardized feature dictionary from a session object.
 *
 * @param {Object} session - The active or completed session object
 * @param {Object|null} [baseline=null] - Optional user personal baseline
 * @param {number} [currentTime=Date.now()]
 * @returns {Object} Engineered behavioral features
 */
export function extractFeatures(session, baseline = null, currentTime = Date.now()) {
  if (!session) {
    return null;
  }

  const durationMs = session.endTime
    ? Math.max(1000, session.durationMs || 0)
    : Math.max(1000, currentTime - session.startTime);

  const durationMinutes = durationMs / 60000;

  // Scroll kinematics
  const scrollCount = session.scrollCount || 0;
  const totalScrollDistance = session.totalScrollDistance || 0;
  const averageScrollVelocity = session.averageScrollVelocity || (scrollCount > 0 ? (session.totalScrollVelocity || 0) / scrollCount : 0);
  const maxScrollVelocity = session.maxScrollVelocity || 0;

  const scrollFrequency = scrollCount / Math.max(0.5, durationMinutes); // scrolls/min
  const scrollDistanceRate = totalScrollDistance / Math.max(0.5, durationMinutes); // px/min

  // Activity & Context switching
  const activityCount = session.activityCount || 0;
  const activityDensity = activityCount / Math.max(0.5, durationMinutes); // actions/min

  const tabSwitchCount = session.tabSwitchCount || 0;
  const tabSwitchFrequency = tabSwitchCount / Math.max(0.5, durationMinutes); // switches/min

  // Video & Autoplay
  const videoPlayCount = session.videoPlayCount || 0;
  const autoplayCount = session.autoplayCount || 0;
  const autoplayRatio = videoPlayCount > 0 ? (autoplayCount / videoPlayCount) : 0;
  const videoConsumptionRate = videoPlayCount / Math.max(1, durationMinutes); // videos/min

  // Circadian & Time of Day
  const startDate = new Date(session.startTime);
  const timeOfDayHour = startDate.getHours();
  // Late night defined as 23:00 to 05:00
  const isLateNight = (timeOfDayHour >= 23 || timeOfDayHour < 5) ? 1 : 0;

  // Context / Domain classification
  const domains = Array.isArray(session.domains) ? session.domains : [];
  let infiniteScrollDomainCount = 0;
  domains.forEach((dom) => {
    if (INFINITE_SCROLL_DOMAINS.some((target) => dom.includes(target))) {
      infiniteScrollDomainCount++;
    }
  });

  const infiniteScrollDomainRatio = domains.length > 0
    ? (infiniteScrollDomainCount / domains.length)
    : 0;

  // Repetition / Compulsion heuristic index:
  // Elevated when scrolling is rapid, velocity is high, and autoplay is prevalent
  const compulsionVelocityFactor = Math.min(2.5, averageScrollVelocity / 1.5);
  const compulsionFrequencyFactor = Math.min(2.5, scrollFrequency / 10);
  const compulsionRepetitionIndex = Number(
    (compulsionVelocityFactor * 0.4 + compulsionFrequencyFactor * 0.4 + autoplayRatio * 0.2).toFixed(3)
  );

  return {
    sessionDurationMinutes: Number(durationMinutes.toFixed(2)),
    scrollCount,
    scrollFrequency: Number(scrollFrequency.toFixed(2)),
    averageScrollVelocity: Number(averageScrollVelocity.toFixed(3)),
    maxScrollVelocity: Number(maxScrollVelocity.toFixed(3)),
    scrollDistanceRate: Number(scrollDistanceRate.toFixed(1)),
    totalScrollDistance: Math.round(totalScrollDistance),

    activityCount,
    activityDensity: Number(activityDensity.toFixed(2)),

    tabSwitchCount,
    tabSwitchFrequency: Number(tabSwitchFrequency.toFixed(2)),

    videoPlayCount,
    autoplayCount,
    autoplayRatio: Number(autoplayRatio.toFixed(3)),
    videoConsumptionRate: Number(videoConsumptionRate.toFixed(2)),

    timeOfDayHour,
    isLateNight,

    domainCount: domains.length,
    infiniteScrollDomainRatio: Number(infiniteScrollDomainRatio.toFixed(3)),
    compulsionRepetitionIndex
  };
}

/**
 * Returns an ordered numeric feature vector for machine learning model ingestion.
 *
 * @param {Object} features
 * @returns {Array<number>}
 */
export function toFeatureVector(features) {
  return [
    features.sessionDurationMinutes,
    features.scrollFrequency,
    features.averageScrollVelocity,
    features.maxScrollVelocity,
    features.scrollDistanceRate,
    features.activityDensity,
    features.tabSwitchFrequency,
    features.autoplayRatio,
    features.videoConsumptionRate,
    features.isLateNight,
    features.infiniteScrollDomainRatio,
    features.compulsionRepetitionIndex
  ];
}

export const FEATURE_NAMES = [
  'sessionDurationMinutes',
  'scrollFrequency',
  'averageScrollVelocity',
  'maxScrollVelocity',
  'scrollDistanceRate',
  'activityDensity',
  'tabSwitchFrequency',
  'autoplayRatio',
  'videoConsumptionRate',
  'isLateNight',
  'infiniteScrollDomainRatio',
  'compulsionRepetitionIndex'
];
