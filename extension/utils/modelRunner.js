/**
 * Phase 11: In-Browser Local Machine Learning Inference Engine
 *
 * Runs 100% on-device local inference on behavioral feature vectors
 * using calibrated model parameters derived from Phase 10 training.
 * Computes exact logistic activation and provides zero-dependency instant predictions.
 */

import { extractFeatures, toFeatureVector, FEATURE_NAMES } from './features.js';
import { evaluateSessionBehavior } from './detector.js';

// Embedded fallback weights directly in module if file loading is delayed
export const DEFAULT_MODEL_PARAMS = {
  featureNames: FEATURE_NAMES,
  scaler: {
    mean: [29.62, 14.86, 1.348, 2.766, 14328.4, 28.54, 4.02, 0.325, 0.68, 0.44, 0.456, 0.495],
    scale: [18.42, 12.65, 0.812, 1.624, 15840.1, 15.34, 3.42, 0.384, 0.82, 0.49, 0.382, 0.312]
  },
  coefficients: [
    0.34,   // sessionDurationMinutes
    1.48,   // scrollFrequency
    0.82,   // averageScrollVelocity
    0.54,   // maxScrollVelocity
    1.32,   // scrollDistanceRate
    0.41,   // activityDensity
    0.28,   // tabSwitchFrequency
    1.25,   // autoplayRatio
    1.10,   // videoConsumptionRate
    0.72,   // isLateNight
    1.38,   // infiniteScrollDomainRatio
    1.45    // compulsionRepetitionIndex
  ],
  intercept: -2.85,
  threshold: 0.50
};

let loadedModelParams = DEFAULT_MODEL_PARAMS;

/**
 * Loads custom weights JSON into the inference engine.
 */
export function setModelWeights(weights) {
  if (weights && weights.scaler && weights.coefficients) {
    loadedModelParams = weights;
  }
}

/**
 * Computes sigmoid activation: 1 / (1 + e^-z)
 */
function sigmoid(z) {
  if (z > 20) return 1.0;
  if (z < -20) return 0.0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Predicts doomscrolling probability from an engineered feature dictionary.
 *
 * @param {Object} features - Extracted feature dictionary
 * @returns {Object} Inference result
 */
export function predictDoomscrollProbability(features) {
  if (!features) {
    return { probability: 0, isDoomscroll: false, drivers: [] };
  }

  const vec = toFeatureVector(features);
  const { mean, scale } = loadedModelParams.scaler;
  const coefs = loadedModelParams.coefficients;

  let z = loadedModelParams.intercept;
  const contributions = [];

  for (let i = 0; i < vec.length; i++) {
    const val = Number(vec[i]) || 0;
    const m = mean[i] || 0;
    const s = scale[i] || 1;
    const zScore = (val - m) / s;
    const contribution = zScore * (coefs[i] || 0);
    z += contribution;

    if (contribution > 0.1) {
      contributions.push({
        feature: FEATURE_NAMES[i],
        rawVal: val,
        contribution: Number(contribution.toFixed(3))
      });
    }
  }

  const probability = Number(sigmoid(z).toFixed(3));
  contributions.sort((a, b) => b.contribution - a.contribution);

  return {
    probability,
    isDoomscroll: probability >= loadedModelParams.threshold,
    drivers: contributions.slice(0, 4)
  };
}

/**
 * Dual-Engine Hybrid Predictor:
 * Combines Rule-Based Heuristic Evaluation with Machine Learning Probability
 * for robust, explainable on-device detection.
 *
 * @param {Object} session
 * @param {Object|null} [personalProfile=null]
 * @returns {Object} Blended detection result
 */
export function evaluateSessionHybrid(session, personalProfile = null) {
  const features = extractFeatures(session);
  const ruleResult = evaluateSessionBehavior(features, personalProfile);
  const mlResult = predictDoomscrollProbability(features);

  // Blended score (50% ML probability, 50% Rule-based score)
  const blendedScore = Number(((mlResult.probability * 0.5) + (ruleResult.doomscrollScore * 0.5)).toFixed(2));

  let finalLevel = ruleResult.riskLevel;
  if (blendedScore >= 0.80) {
    finalLevel = 'SEVERE';
  } else if (blendedScore >= 0.60) {
    finalLevel = 'ELEVATED';
  } else if (blendedScore >= 0.30) {
    finalLevel = 'MODERATE';
  } else {
    finalLevel = 'HEALTHY';
  }

  return {
    score: blendedScore,
    riskLevel: finalLevel,
    isDoomscrolling: blendedScore >= 0.60,
    mlProbability: mlResult.probability,
    ruleScore: ruleResult.doomscrollScore,
    reasons: ruleResult.reasons,
    drivers: mlResult.drivers,
    recommendation: ruleResult.recommendation,
    features,
    timestamp: Date.now()
  };
}
