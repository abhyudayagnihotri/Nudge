import { describe, it, expect } from 'vitest';
import { predictDoomscrollProbability, evaluateSessionHybrid } from '../extension/utils/modelRunner.js';

describe('Phase 11: In-Browser Machine Learning & Hybrid Inference', () => {
  it('computes low doomscroll probability for calm/work feature vector', () => {
    const calmFeatures = {
      sessionDurationMinutes: 15,
      scrollFrequency: 3.5,
      averageScrollVelocity: 0.5,
      maxScrollVelocity: 1.1,
      scrollDistanceRate: 300,
      activityDensity: 12,
      tabSwitchFrequency: 0.8,
      autoplayRatio: 0.0,
      videoConsumptionRate: 0.05,
      isLateNight: 0,
      infiniteScrollDomainRatio: 0.0,
      compulsionRepetitionIndex: 0.12
    };

    const result = predictDoomscrollProbability(calmFeatures);
    expect(result.probability).toBeLessThan(0.35);
    expect(result.isDoomscroll).toBe(false);
  });

  it('computes high doomscroll probability for compulsive browsing features', () => {
    const compulsiveFeatures = {
      sessionDurationMinutes: 48,
      scrollFrequency: 28,
      averageScrollVelocity: 2.8,
      maxScrollVelocity: 5.4,
      scrollDistanceRate: 14500,
      activityDensity: 38,
      tabSwitchFrequency: 4.5,
      autoplayRatio: 0.85,
      videoConsumptionRate: 1.4,
      isLateNight: 1,
      infiniteScrollDomainRatio: 0.9,
      compulsionRepetitionIndex: 0.88
    };

    const result = predictDoomscrollProbability(compulsiveFeatures);
    expect(result.probability).toBeGreaterThan(0.70);
    expect(result.isDoomscroll).toBe(true);
    expect(result.drivers.length).toBeGreaterThan(0);
  });

  it('runs dual-engine hybrid evaluation blending ML and rules', () => {
    const mockSession = {
      sessionId: 'sess_hybrid_test',
      startTime: Date.now() - 35 * 60 * 1000,
      durationMs: 35 * 60 * 1000,
      scrollCount: 300,
      totalScrollDistance: 80000,
      averageScrollVelocity: 2.3,
      maxScrollVelocity: 4.8,
      activityCount: 400,
      tabSwitchCount: 10,
      videoPlayCount: 8,
      autoplayCount: 6,
      domains: ['reddit.com', 'x.com']
    };

    const hybrid = evaluateSessionHybrid(mockSession);
    expect(hybrid).toBeDefined();
    expect(typeof hybrid.score).toBe('number');
    expect(typeof hybrid.mlProbability).toBe('number');
    expect(typeof hybrid.ruleScore).toBe('number');
    expect(hybrid.score).toBeGreaterThanOrEqual(0.60);
    expect(hybrid.isDoomscrolling).toBe(true);
    expect(hybrid.reasons).toBeDefined();
  });
});
