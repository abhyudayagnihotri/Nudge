import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDatabase,
  saveSession,
  getAllSessions,
  getSession,
  deleteSession,
  clearSessions
} from '../extension/db.js';

describe('IndexedDB Storage (nudgeDB)', () => {
  beforeEach(async () => {
    await clearSessions();
  });

  it('initializes and opens nudgeDB successfully', async () => {
    const db = await openDatabase();
    expect(db).toBeDefined();
    expect(db.name).toBe('nudgeDB');
    expect(db.objectStoreNames.contains('sessions')).toBe(true);
  });

  it('saves and retrieves a session by sessionId', async () => {
    const mockSession = {
      sessionId: 'sess_test_1',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      durationMs: 5000,
      scrollCount: 25,
      totalScrollDistance: 3400,
      averageScrollVelocity: 1.15,
      maxScrollVelocity: 3.2,
      activityCount: 40,
      tabSwitchCount: 2,
      videoPlayCount: 1,
      autoplayCount: 0,
      domains: ['youtube.com']
    };

    const savedId = await saveSession(mockSession);
    expect(savedId).toBe('sess_test_1');

    const retrieved = await getSession('sess_test_1');
    expect(retrieved).toBeDefined();
    expect(retrieved.sessionId).toBe('sess_test_1');
    expect(retrieved.scrollCount).toBe(25);
    expect(retrieved.domains).toEqual(['youtube.com']);
  });

  it('retrieves all sessions sorted newest first', async () => {
    const sessionOld = {
      sessionId: 'sess_old',
      startTime: 1000,
      durationMs: 500
    };
    const sessionNew = {
      sessionId: 'sess_new',
      startTime: 9000,
      durationMs: 1500
    };

    await saveSession(sessionOld);
    await saveSession(sessionNew);

    const all = await getAllSessions();
    expect(all).toHaveLength(2);
    expect(all[0].sessionId).toBe('sess_new'); // newest first
    expect(all[1].sessionId).toBe('sess_old');
  });

  it('deletes a specific session by sessionId', async () => {
    await saveSession({ sessionId: 'to_delete', startTime: 1000 });
    await saveSession({ sessionId: 'to_keep', startTime: 2000 });

    const deleted = await deleteSession('to_delete');
    expect(deleted).toBe(true);

    const check = await getSession('to_delete');
    expect(check).toBeNull();

    const remaining = await getAllSessions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sessionId).toBe('to_keep');
  });

  it('clears all completed sessions from database', async () => {
    await saveSession({ sessionId: 'sess_1', startTime: 1000 });
    await saveSession({ sessionId: 'sess_2', startTime: 2000 });

    await clearSessions();

    const all = await getAllSessions();
    expect(all).toEqual([]);
  });

  it('throws an error if saving a session without a sessionId', async () => {
    await expect(saveSession({})).rejects.toThrow('sessionId is required');
  });
});
