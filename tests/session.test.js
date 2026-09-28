import { describe, it, expect } from 'vitest';
import {
  createSession,
  isSessionIdle,
  updateSessionScroll,
  updateSessionActivity,
  updateSessionVideo,
  updateSessionTabSwitch,
  finalizeSessionData,
  getSessionSummary,
  IDLE_THRESHOLD_MS
} from '../extension/utils/session.js';

describe('Session Management & Behavioral Metrics', () => {
  it('creates a fresh session with default schema', () => {
    const session = createSession();
    expect(session.sessionId).toBeDefined();
    expect(typeof session.sessionId).toBe('string');
    expect(session.startTime).toBeGreaterThan(0);
    expect(session.endTime).toBeNull();
    expect(session.scrollCount).toBe(0);
    expect(session.totalScrollDistance).toBe(0);
    expect(session.averageScrollVelocity).toBe(0);
    expect(session.maxScrollVelocity).toBe(0);
    expect(session.activityCount).toBe(0);
    expect(session.tabSwitchCount).toBe(0);
    expect(session.videoPlayCount).toBe(0);
    expect(session.autoplayCount).toBe(0);
    expect(session.domains).toEqual([]);
  });

  it('correctly tracks scroll events and recalculates kinematics', () => {
    const session = createSession({ startTime: 1000, lastActivityTime: 1000 });

    // First scroll: 500px, velocity 1.2
    updateSessionScroll(session, {
      scrollDistance: 500,
      velocity: 1.2,
      timestamp: 2000
    });

    expect(session.scrollCount).toBe(1);
    expect(session.totalScrollDistance).toBe(500);
    expect(session.totalScrollVelocity).toBe(1.2);
    expect(session.averageScrollVelocity).toBe(1.2);
    expect(session.maxScrollVelocity).toBe(1.2);
    expect(session.lastActivityTime).toBe(2000);
    expect(session.activityCount).toBe(1);

    // Second scroll: 300px, velocity 2.4
    updateSessionScroll(session, {
      scrollDistance: 300,
      velocity: 2.4,
      timestamp: 3000
    });

    expect(session.scrollCount).toBe(2);
    expect(session.totalScrollDistance).toBe(800);
    expect(session.totalScrollVelocity).toBeCloseTo(3.6);
    expect(session.averageScrollVelocity).toBeCloseTo(1.8);
    expect(session.maxScrollVelocity).toBe(2.4);
    expect(session.lastActivityTime).toBe(3000);
    expect(session.activityCount).toBe(2);
  });

  it('tracks generic user activity without sensitive data', () => {
    const session = createSession({ startTime: 1000, lastActivityTime: 1000 });

    updateSessionActivity(session, { activityType: 'keyboard', timestamp: 1500 });
    expect(session.activityCount).toBe(1);
    expect(session.lastActivityTime).toBe(1500);
    // Ensure no key data attached
    expect(session.key).toBeUndefined();
    expect(session.text).toBeUndefined();

    updateSessionActivity(session, { activityType: 'mouse', timestamp: 2000 });
    expect(session.activityCount).toBe(2);
    expect(session.lastActivityTime).toBe(2000);
  });

  it('tracks video playback and distinguishes autoplay', () => {
    const session = createSession({ startTime: 1000 });

    // User initiated play
    updateSessionVideo(session, { isAutoplay: false, timestamp: 1500 });
    expect(session.videoPlayCount).toBe(1);
    expect(session.autoplayCount).toBe(0);

    // Autoplay video
    updateSessionVideo(session, { isAutoplay: true, timestamp: 2500 });
    expect(session.videoPlayCount).toBe(2);
    expect(session.autoplayCount).toBe(1);
  });

  it('tracks tab switches and deduplicates visited domains', () => {
    const session = createSession({ startTime: 1000 });

    updateSessionTabSwitch(session, { domain: 'youtube.com', timestamp: 1500 });
    updateSessionTabSwitch(session, { domain: 'reddit.com', timestamp: 2000 });
    // Switch back to youtube
    updateSessionTabSwitch(session, { domain: 'youtube.com', timestamp: 2500 });

    expect(session.tabSwitchCount).toBe(3);
    expect(session.domains).toEqual(['youtube.com', 'reddit.com']);
  });

  it('detects idle sessions based on threshold (60s)', () => {
    const session = createSession({
      startTime: 1000,
      lastActivityTime: 1000
    });

    // 59 seconds: not idle
    expect(isSessionIdle(session, IDLE_THRESHOLD_MS, 1000 + 59000)).toBe(false);

    // Exactly 60 seconds: idle
    expect(isSessionIdle(session, IDLE_THRESHOLD_MS, 1000 + 60000)).toBe(true);

    // 120 seconds: idle
    expect(isSessionIdle(session, IDLE_THRESHOLD_MS, 1000 + 120000)).toBe(true);
  });

  it('finalizes session and computes duration and clean averages', () => {
    const session = createSession({ startTime: 1000 });
    updateSessionScroll(session, { scrollDistance: 1000, velocity: 2.0, timestamp: 5000 });

    const finalized = finalizeSessionData(session, 10000);
    expect(finalized.endTime).toBe(5000); // Last activity time
    expect(finalized.durationMs).toBe(4000); // 5000 - 1000
    expect(finalized.averageScrollVelocity).toBe(2.0);
  });

  it('generates a clean session summary', () => {
    const session = createSession({ startTime: 1000, lastActivityTime: 6000 });
    updateSessionScroll(session, { scrollDistance: 450, velocity: 1.5, timestamp: 3000 });
    updateSessionTabSwitch(session, { domain: 'x.com', timestamp: 5000 });

    const summary = getSessionSummary(session, 6000);
    expect(summary).toMatchObject({
      sessionId: session.sessionId,
      startTime: 1000,
      durationMs: 5000,
      scrollCount: 1,
      totalScrollDistance: 450,
      tabSwitchCount: 1,
      domains: ['x.com']
    });
  });
});
