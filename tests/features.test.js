import { describe, it, expect } from 'vitest';
import { extractFeatures, toFeatureVector, FEATURE_NAMES } from '../extension/utils/features.js';

describe('Phase 5: Feature Engineering Module', () => {
  it('extracts standardized feature dictionary from session', () => {
    const mockSession = {
      sessionId: 'sess_feat_1',
      startTime: 1000,
      endTime: 1000 + 10 * 60 * 1000, // 10 minutes
      durationMs: 10 * 60 * 1000,
      scrollCount: 150,
      totalScrollDistance: 45000,
      averageScrollVelocity: 1.85,
      maxScrollVelocity: 3.4,
      activityCount: 220,
      tabSwitchCount: 5,
      videoPlayCount: 6,
      autoplayCount: 4,
      domains: ['youtube.com', 'reddit.com', 'wikipedia.org']
    };

    const features = extractFeatures(mockSession);

    expect(features).toBeDefined();
    expect(features.sessionDurationMinutes).toBe(10);
    expect(features.scrollFrequency).toBe(15); // 150 scrolls / 10 mins
    expect(features.averageScrollVelocity).toBe(1.85);
    expect(features.maxScrollVelocity).toBe(3.4);
    expect(features.activityDensity).toBe(22); // 220 / 10
    expect(features.tabSwitchFrequency).toBe(0.5); // 5 / 10
    expect(features.autoplayRatio).toBeCloseTo(0.667, 2); // 4 / 6
    expect(features.infiniteScrollDomainRatio).toBeCloseTo(0.667, 2); // 2 out of 3 domains
    expect(features.compulsionRepetitionIndex).toBeGreaterThan(0.5);
  });

  it('correctly tags late night sessions (23:00 to 05:00)', () => {
    // 01:30 AM
    const lateNightTime = new Date('2026-09-29T01:30:00').getTime();
    const lateSession = {
      startTime: lateNightTime,
      durationMs: 60000,
      domains: []
    };
    expect(extractFeatures(lateSession).isLateNight).toBe(1);

    // 02:00 PM
    const dayTime = new Date('2026-09-29T14:00:00').getTime();
    const daySession = {
      startTime: dayTime,
      durationMs: 60000,
      domains: []
    };
    expect(extractFeatures(daySession).isLateNight).toBe(0);
  });

  it('produces valid 12-dimensional numeric feature vector', () => {
    const session = {
      startTime: Date.now() - 5000,
      durationMs: 5000,
      domains: []
    };
    const features = extractFeatures(session);
    const vec = toFeatureVector(features);

    expect(Array.isArray(vec)).toBe(true);
    expect(vec).toHaveLength(12);
    expect(vec.every((v) => typeof v === 'number' && !isNaN(v))).toBe(true);
    expect(FEATURE_NAMES).toHaveLength(12);
  });
});
