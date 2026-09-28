/**
 * Phase 6: Rule-Based Doomscrolling Detection Engine
 *
 * Computes a normalized doomscroll score (0.0 to 1.0) by analyzing
 * behavioral signals, kinematics, circadian context, and platform patterns.
 * Supports personalized baseline adjustments when available.
 */

import { extractFeatures } from './features.js';

export const RISK_LEVELS = {
  HEALTHY: 'HEALTHY',     // 0.00 - 0.29
  MODERATE: 'MODERATE',   // 0.30 - 0.59
  ELEVATED: 'ELEVATED',   // 0.60 - 0.79
  SEVERE: 'SEVERE'        // 0.80 - 1.00
};

export const DEFAULT_THRESHOLDS = {
  durationWarningMinutes: 25,
  durationCriticalMinutes: 45,
  velocityWarning: 1.6,       // px/ms
  velocityCritical: 2.8,
  scrollFrequencyWarning: 12, // scrolls/min
  autoplayWarningRatio: 0.5,
  tabChurnWarningFrequency: 6 // switches/min
};

/**
 * Evaluates session features using rule-based behavioral heuristics.
 *
 * @param {Object} features - Extracted feature dictionary
 * @param {Object|null} [personalProfile=null] - Optional adaptive personal baseline
 * @returns {Object} Comprehensive evaluation result
 */
export function evaluateSessionBehavior(features, personalProfile = null) {
  if (!features) {
    return {
      doomscrollScore: 0,
      riskLevel: RISK_LEVELS.HEALTHY,
      isDoomscrolling: false,
      reasons: [],
      recommendation: null,
      subscores: {}
    };
  }

  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(personalProfile?.customThresholds || {})
  };

  let totalScore = 0;
  const reasons = [];
  const subscores = {};

  // 1. Duration Component (Weight: 25%)
  let durationSubscore = 0;
  if (features.sessionDurationMinutes >= thresholds.durationCriticalMinutes) {
    durationSubscore = 1.0;
    reasons.push(`Extended continuous session (${features.sessionDurationMinutes} mins)`);
  } else if (features.sessionDurationMinutes >= thresholds.durationWarningMinutes) {
    durationSubscore = (features.sessionDurationMinutes - thresholds.durationWarningMinutes) /
      (thresholds.durationCriticalMinutes - thresholds.durationWarningMinutes);
    reasons.push(`Session duration reaching elevated levels (${features.sessionDurationMinutes} mins)`);
  }
  subscores.duration = Number(durationSubscore.toFixed(2));
  totalScore += durationSubscore * 0.25;

  // 2. Scroll Kinematics & Velocity (Weight: 30%)
  let velocitySubscore = 0;
  if (features.averageScrollVelocity >= thresholds.velocityCritical) {
    velocitySubscore = 1.0;
    reasons.push(`High average scrolling speed (${features.averageScrollVelocity} px/ms)`);
  } else if (features.averageScrollVelocity >= thresholds.velocityWarning) {
    velocitySubscore = (features.averageScrollVelocity - thresholds.velocityWarning) /
      (thresholds.velocityCritical - thresholds.velocityWarning);
    reasons.push(`Rapid scrolling detected (${features.averageScrollVelocity} px/ms)`);
  }

  let frequencySubscore = 0;
  if (features.scrollFrequency >= thresholds.scrollFrequencyWarning) {
    frequencySubscore = Math.min(1.0, features.scrollFrequency / (thresholds.scrollFrequencyWarning * 1.8));
    reasons.push(`High scroll repetition (${features.scrollFrequency} scrolls/min)`);
  }
  const kinematicsSubscore = Math.min(1.0, velocitySubscore * 0.6 + frequencySubscore * 0.4);
  subscores.kinematics = Number(kinematicsSubscore.toFixed(2));
  totalScore += kinematicsSubscore * 0.30;

  // 3. Autoplay & Passive Video Consumption (Weight: 15%)
  let videoSubscore = 0;
  if (features.videoPlayCount > 1 && features.autoplayRatio >= thresholds.autoplayWarningRatio) {
    videoSubscore = Math.min(1.0, features.autoplayRatio * 1.1);
    reasons.push(`High passive autoplay consumption (${Math.round(features.autoplayRatio * 100)}% automated)`);
  }
  subscores.autoplay = Number(videoSubscore.toFixed(2));
  totalScore += videoSubscore * 0.15;

  // 4. Circadian & Nocturnal Timing (Weight: 15%)
  let circadianSubscore = 0;
  if (features.isLateNight === 1) {
    circadianSubscore = 0.9;
    reasons.push(`Late-night browsing between 11 PM and 5 AM (Hour: ${features.timeOfDayHour}:00)`);
  }
  subscores.circadian = Number(circadianSubscore.toFixed(2));
  totalScore += circadianSubscore * 0.15;

  // 5. Context & Infinite-Scroll Platform Ratio (Weight: 15%)
  let contextSubscore = 0;
  if (features.infiniteScrollDomainRatio >= 0.5) {
    contextSubscore = Math.min(1.0, features.infiniteScrollDomainRatio);
    reasons.push('Primary browsing focused on algorithmic infinite-scroll platforms');
  }
  subscores.context = Number(contextSubscore.toFixed(2));
  totalScore += contextSubscore * 0.15;

  // Personalization bias adjustment (if profile indicates user tends to be an active reader)
  if (personalProfile?.sensitivityModifier) {
    totalScore = Math.max(0, Math.min(1, totalScore * personalProfile.sensitivityModifier));
  }

  // Final normalization
  const finalScore = Number(Math.min(1.0, Math.max(0.0, totalScore)).toFixed(2));

  let riskLevel = RISK_LEVELS.HEALTHY;
  let isDoomscrolling = false;
  let recommendation = null;

  if (finalScore >= 0.80) {
    riskLevel = RISK_LEVELS.SEVERE;
    isDoomscrolling = true;
    recommendation = 'Your browsing behavior appears increasingly repetitive and compulsive. Consider taking a 5-minute break.';
  } else if (finalScore >= 0.60) {
    riskLevel = RISK_LEVELS.ELEVATED;
    isDoomscrolling = true;
    recommendation = 'Behavioral momentum is rising into a potential doomscrolling cycle. A short pause is recommended.';
  } else if (finalScore >= 0.30) {
    riskLevel = RISK_LEVELS.MODERATE;
    recommendation = 'Browsing pace is moderate. Stay mindful of your digital intentionality.';
  } else {
    riskLevel = RISK_LEVELS.HEALTHY;
    recommendation = 'Browsing patterns appear healthy and intentional.';
  }

  return {
    doomscrollScore: finalScore,
    riskLevel,
    isDoomscrolling,
    reasons,
    recommendation,
    subscores,
    timestamp: Date.now()
  };
}

/**
 * Helper to evaluate a raw session directly.
 */
export function evaluateSession(session, personalProfile = null) {
  const features = extractFeatures(session);
  return evaluateSessionBehavior(features, personalProfile);
}
