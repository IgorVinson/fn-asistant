/**
 * Detect transient network errors (timeouts, DNS hiccups, dropped connections)
 * that are expected during brief connectivity loss — e.g. a VPN stall causing
 * the Gmail OAuth token refresh (POST https://oauth2.googleapis.com/token) to
 * time out. These should be retried with backoff, not treated as fatal.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isTransientNetworkError(error) {
  if (!error) return false;

  const TRANSIENT_CODES = new Set([
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ECONNABORTED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "EPIPE",
    "ETIMEOUT",
  ]);

  // Walk the error and any nested cause chain (node-fetch / gaxios wrap the
  // original socket error, and googleapis may re-wrap that again).
  let current = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = current.code || current.errno;
    if (code && TRANSIENT_CODES.has(code)) return true;
    if (current.name === "FetchError" && current.type === "system") return true;
    const message = typeof current.message === "string" ? current.message : "";
    if (
      /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|network timeout|request to .* failed/i.test(
        message
      )
    ) {
      return true;
    }
    current = current.cause;
  }

  return false;
}
