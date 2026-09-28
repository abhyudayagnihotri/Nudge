import { describe, it, expect } from 'vitest';
import { buildPersonalProfile } from '../extension/utils/personalization.js';

describe('Phase 12: Adaptive Baseline Personalization Module', () => {
  it('returns uncalibrated baseline when fewer than 3 sessions provided', () => {
    const profile = buildPersonalProfile([{ averageScrollVelocity: 1.2, durationMs: 60000 }]);
    expect(profile.isCalibrated).toBe(false);
    expect(profile.sessionsCount).toBe(1);
  });

  it('calibrates personalized velocity and duration thresholds from history', () => {
    const historicalSessions = [
      { averageScrollVelocity: 1.0, durationMs: 10 * 60000 },
      { averageScrollVelocity: 1.4, durationMs: 15 * 60000 },
      { averageScrollVelocity: 1.6, durationMs: 20 * 60000 },
      { averageScrollVelocity: 1.8, durationMs: 25 * 60000 },
      { averageScrollVelocity: 2.2, durationMs: 30 * 60000 }
    ];

    const profile = buildPersonalProfile(historicalSessions);

    expect(profile.isCalibrated).toBe(true);
    expect(profile.sessionsCount).toBe(5);
    expect(profile.medianVelocity).toBeCloseTo(1.6, 1);
    expect(profile.customThresholds.velocityWarning).toBeGreaterThanOrEqual(1.8);
    expect(profile.customThresholds.durationWarningMinutes).toBeGreaterThanOrEqual(25);
  });

  it('adjusts sensitivity modifier for naturally fast browsers', () => {
    const fastUserSessions = [
      { averageScrollVelocity: 2.5, durationMs: 15 * 60000 },
      { averageScrollVelocity: 2.8, durationMs: 18 * 60000 },
      { averageScrollVelocity: 3.0, durationMs: 20 * 60000 }
    ];

    const profile = buildPersonalProfile(fastUserSessions);
    expect(profile.isCalibrated).toBe(true);
    expect(profile.sensitivityModifier).toBeLessThan(1.0); // Softened to avoid false alarms
  });
});
