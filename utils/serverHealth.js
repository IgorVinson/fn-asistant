// Operational state only: never include credentials or order contents.
export const serverHealth = {
  startedAt: Date.now(),
  startupComplete: false,
  monitoringRequestedAt: null,
  cookieRefreshStartedAt: null,
  emailCheckStartedAt: null,
  lastEmailCheckCompletedAt: null,
};

export function healthFailure(health, now = Date.now(), maxOperationMs = 15 * 60_000) {
  if (!health || !Number.isInteger(health.pid)) return "Invalid health response";
  if (!health.startupComplete && now - health.startedAt > maxOperationMs) {
    return "Startup has not completed within 15 minutes";
  }
  if (health.cookieRefreshStartedAt && now - health.cookieRefreshStartedAt > maxOperationMs) {
    return "Platform login has stalled for over 15 minutes";
  }
  if (health.monitoring && health.emailCheckStartedAt &&
      now - health.emailCheckStartedAt > maxOperationMs) {
    return "Email/order processing has stalled for over 15 minutes";
  }
  if (health.monitoringRequestedAt && !health.monitoringReady &&
      now - health.monitoringRequestedAt > maxOperationMs) {
    return "Requested monitoring has not started within 15 minutes";
  }
  return null;
}
