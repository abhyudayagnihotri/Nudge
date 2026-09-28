import { describe, it, expect } from 'vitest';

/**
 * Message validation logic extracted to test input sanitization.
 */
function validateIncomingMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Malformed message' };
  }
  if (typeof message.type !== 'string' || message.type.trim() === '') {
    return { valid: false, error: 'Malformed message: missing type' };
  }

  const supportedTypes = [
    'SCROLL_EVENT',
    'USER_ACTIVITY',
    'VIDEO_EVENT',
    'GET_SESSION',
    'GET_SESSIONS',
    'DELETE_SESSION',
    'CLEAR_SESSIONS'
  ];

  if (!supportedTypes.includes(message.type)) {
    return { valid: false, error: `Unknown message type: ${message.type}` };
  }

  if (message.type === 'DELETE_SESSION' && (!message.data || !message.data.sessionId)) {
    return { valid: false, error: 'Missing sessionId' };
  }

  return { valid: true };
}

describe('Message Validation & Handling', () => {
  it('accepts valid message types', () => {
    expect(validateIncomingMessage({ type: 'SCROLL_EVENT', data: { scrollDistance: 100, velocity: 1.5 } })).toEqual({ valid: true });
    expect(validateIncomingMessage({ type: 'USER_ACTIVITY', data: { activityType: 'mouse' } })).toEqual({ valid: true });
    expect(validateIncomingMessage({ type: 'VIDEO_EVENT', data: { isAutoplay: true } })).toEqual({ valid: true });
    expect(validateIncomingMessage({ type: 'GET_SESSION' })).toEqual({ valid: true });
    expect(validateIncomingMessage({ type: 'GET_SESSIONS' })).toEqual({ valid: true });
    expect(validateIncomingMessage({ type: 'CLEAR_SESSIONS' })).toEqual({ valid: true });
    expect(validateIncomingMessage({ type: 'DELETE_SESSION', data: { sessionId: 'abc-123' } })).toEqual({ valid: true });
  });

  it('rejects null, non-objects, and missing types', () => {
    expect(validateIncomingMessage(null).valid).toBe(false);
    expect(validateIncomingMessage(undefined).valid).toBe(false);
    expect(validateIncomingMessage('string').valid).toBe(false);
    expect(validateIncomingMessage({}).valid).toBe(false);
    expect(validateIncomingMessage({ type: '' }).valid).toBe(false);
  });

  it('rejects unsupported message types', () => {
    const res = validateIncomingMessage({ type: 'INJECT_SCRIPT' });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Unknown message type');
  });

  it('rejects DELETE_SESSION without sessionId', () => {
    const res = validateIncomingMessage({ type: 'DELETE_SESSION' });
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Missing sessionId');
  });
});
