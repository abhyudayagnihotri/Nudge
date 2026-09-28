import { describe, it, expect } from 'vitest';
import { extractCleanDomain } from '../extension/utils/url.js';

describe('extractCleanDomain', () => {
  it('extracts clean domain from valid HTTPS URL', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s';
    expect(extractCleanDomain(url)).toBe('youtube.com');
  });

  it('strips www prefix correctly', () => {
    expect(extractCleanDomain('https://www.reddit.com/r/technology/')).toBe('reddit.com');
  });

  it('preserves subdomains other than www', () => {
    expect(extractCleanDomain('https://news.ycombinator.com/item?id=123')).toBe('news.ycombinator.com');
    expect(extractCleanDomain('https://m.facebook.com/profile')).toBe('m.facebook.com');
  });

  it('strips query parameters, hashes, and ports', () => {
    expect(extractCleanDomain('https://example.com:8080/path/to/resource?query=secret#heading')).toBe('example.com');
  });

  it('rejects internal and non-http/https protocols for privacy', () => {
    expect(extractCleanDomain('chrome://extensions/')).toBeNull();
    expect(extractCleanDomain('chrome-extension://abcdefghijklm/dashboard.html')).toBeNull();
    expect(extractCleanDomain('about:blank')).toBeNull();
    expect(extractCleanDomain('file:///C:/Users/test/doc.txt')).toBeNull();
  });

  it('handles null, undefined, empty, and malformed inputs gracefully', () => {
    expect(extractCleanDomain(null)).toBeNull();
    expect(extractCleanDomain(undefined)).toBeNull();
    expect(extractCleanDomain('')).toBeNull();
    expect(extractCleanDomain('not-a-valid-url')).toBeNull();
  });
});
