import { describe, it, expect } from 'vitest';
import { evaluateSessionBehavior, evaluateSession, RISK_LEVELS } from '../extension/utils/detector.js';

describe('Phase 6: Rule-Based Doomscrolling Detection Engine', () => {
  it('evaluates healthy, focused browsing session with low score', () => {
    const healthyFeatures = {
      sessionDurationMinutes: 12,
      scrollFrequency: 4.5,
      averageScrollVelocity: 0.55,
      maxScrollVelocity: 1.2,
      activityDensity: 10,
      tabSwitchFrequency: 0.5,
      videoPlayCount: 1,
      autoplayRatio: 0.0,
      isLateNight: 0,
      infiniteScrollDomainRatio: 0.0,
      compulsionRepetitionIndex: 0.15
    };

    const evaluation = evaluateSessionBehavior(healthyFeatures);
    expect(evaluation.doomscrollScore).toBeLessThan(0.30);
    expect(evaluation.riskLevel).toBe(RISK_LEVELS.HEALTHY);
    expect(evaluation.isDoomscrolling).toBe(false);
  });

  it('evaluates severe doomscrolling session with elevated score & explanation', () => {
    const severeFeatures = {
      sessionDurationMinutes: 52, // Over critical 45 mins
      scrollFrequency: 32,         // High repetition
      averageScrollVelocity: 3.1, // Over critical 2.8 px/ms
      maxScrollVelocity: 6.2,
      activityDensity: 45,
      tabSwitchFrequency: 4.2,
      videoPlayCount: 12,
      autoplayRatio: 0.85,        // High autoplay
      isLateNight: 1,             // Late night
      infiniteScrollDomainRatio: 1.0,
      compulsionRepetitionIndex: 0.95
    };

    const evaluation = evaluateSessionBehavior(severeFeatures);
    expect(evaluation.doomscrollScore).toBeGreaterThanOrEqual(0.75);
    expect([RISK_LEVELS.ELEVATED, RISK_LEVELS.SEVERE]).toContain(evaluation.riskLevel);
    expect(evaluation.isDoomscrolling).toBe(true);
    expect(evaluation.reasons.length).toBeGreaterThanOrEqual(3);
    expect(evaluation.recommendation).toContain('break');
  });

  it('evaluates raw session directly via evaluateSession()', () => {
    const session = {
      sessionId: 'sess_raw_test',
      startTime: Date.now() - 30 * 60 * 1000,
      durationMs: 30 * 60 * 1000,
      scrollCount: 200,
      totalScrollDistance: 60000,
      averageScrollVelocity: 2.1,
      maxScrollVelocity: 4.5,
      activityCount: 250,
      tabSwitchCount: 8,
      videoPlayCount: 5,
      autoplayCount: 4,
      domains: ['youtube.com', 'tiktok.com']
    };

    const evaluation = evaluateSession(session);
    expect(evaluation).toBeDefined();
    expect(typeof evaluation.doomscrollScore).toBe('number');
    expect(evaluation.doomscrollScore).toBeGreaterThan(0.40);
  });
});
