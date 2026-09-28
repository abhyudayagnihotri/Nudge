/**
 * Phase 12: Adaptive Baseline Personalization
 *
 * Derives personalized behavioral thresholds from the user's historical sessions.
 * Prevents false positives for fast readers or unique usage patterns
 * while maintaining sensitive protection against compulsive loops.
 */

const STORAGE_PROFILE_KEY = 'nudge_personal_profile';

function calculateQuantile(sortedArray, q) {
  if (!sortedArray || sortedArray.length === 0) return 0;
  const pos = (sortedArray.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArray[base + 1] !== undefined) {
    return sortedArray[base] + rest * (sortedArray[base + 1] - sortedArray[base]);
  }
  return sortedArray[base];
}

/**
 * Builds an adaptive personal profile from a list of historical sessions.
 *
 * @param {Array<Object>} historicalSessions
 * @returns {Object} Adaptive profile
 */
export function buildPersonalProfile(historicalSessions = []) {
  if (!Array.isArray(historicalSessions) || historicalSessions.length < 3) {
    return {
      isCalibrated: false,
      sessionsCount: historicalSessions.length,
      sensitivityModifier: 1.0,
      customThresholds: {},
      note: 'Need at least 3 historical sessions for personalized baseline calibration.'
    };
  }

  // Extract metrics
  const velocities = historicalSessions
    .map((s) => Number(s.averageScrollVelocity) || 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const durations = historicalSessions
    .map((s) => (Number(s.durationMs) || 0) / 60000)
    .filter((d) => d > 0.5)
    .sort((a, b) => a - b);

  const medianVelocity = calculateQuantile(velocities, 0.5) || 1.3;
  const p75Velocity = calculateQuantile(velocities, 0.75) || 1.8;
  const medianDuration = calculateQuantile(durations, 0.5) || 15;

  // Calibrate thresholds
  const calibratedVelocityWarning = Math.max(1.4, Number((p75Velocity * 1.15).toFixed(2)));
  const calibratedVelocityCritical = Math.max(2.2, Number((p75Velocity * 1.6).toFixed(2)));
  const calibratedDurationWarning = Math.max(20, Math.round(medianDuration * 1.6));
  const calibratedDurationCritical = Math.max(40, Math.round(medianDuration * 2.5));

  // Sensitivity modifier: if user naturally reads fast, soften sensitivity slightly
  let sensitivityModifier = 1.0;
  if (medianVelocity > 2.0) {
    sensitivityModifier = 0.85; // Less likely to trigger on velocity alone
  } else if (medianVelocity < 0.9) {
    sensitivityModifier = 1.15; // User normally browses slowly, so even modest velocity is unusual
  }

  return {
    isCalibrated: true,
    sessionsCount: historicalSessions.length,
    medianVelocity: Number(medianVelocity.toFixed(2)),
    p75Velocity: Number(p75Velocity.toFixed(2)),
    medianDurationMinutes: Number(medianDuration.toFixed(1)),
    sensitivityModifier: Number(sensitivityModifier.toFixed(2)),
    customThresholds: {
      velocityWarning: calibratedVelocityWarning,
      velocityCritical: calibratedVelocityCritical,
      durationWarningMinutes: calibratedDurationWarning,
      durationCriticalMinutes: calibratedDurationCritical
    },
    updatedAt: Date.now()
  };
}

/**
 * Loads the active personal profile from chrome.storage.local.
 */
export async function getStoredPersonalProfile() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(STORAGE_PROFILE_KEY);
      return data[STORAGE_PROFILE_KEY] || null;
    }
  } catch (err) {
    console.warn('[Personalization] Failed to load stored profile:', err);
  }
  return null;
}

/**
 * Persists the personal profile to chrome.storage.local.
 */
export async function savePersonalProfile(profile) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_PROFILE_KEY]: profile });
      return true;
    }
  } catch (err) {
    console.error('[Personalization] Failed to save profile:', err);
  }
  return false;
}
