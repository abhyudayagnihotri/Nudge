/**
 * URL and Domain Normalization Utility for Nudge.
 *
 * Privacy Guarantees:
 * - Extracts ONLY the hostname/domain.
 * - Strips protocols, paths, query parameters, anchors, credentials, and ports.
 * - Filters out internal/restricted browser URLs (chrome://, chrome-extension://, about:, file://).
 */

/**
 * Extracts a clean domain from a URL string.
 *
 * @param {string} urlString - Full URL (e.g., "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
 * @returns {string|null} - Clean domain (e.g., "youtube.com") or null if invalid/restricted
 */
export function extractCleanDomain(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(urlString);

    // Only process standard web protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    let hostname = parsed.hostname.toLowerCase();

    // Strip leading "www." for consistency
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // Ignore localhost, local IPs, or empty hostnames if desired
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
      return hostname || null;
    }

    return hostname;
  } catch {
    // Malformed URL or inaccessible protocol
    return null;
  }
}
