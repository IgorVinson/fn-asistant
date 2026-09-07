export const WATCHDOG_BASE_DELAY_MS = 5_000;
export const WATCHDOG_MAX_DELAY_MS = 60_000;
export const WATCHDOG_STABLE_RUN_MS = 5 * 60 * 1000;

export function calculateRestartDelay(
  consecutiveCrashes,
  {
    baseDelayMs = WATCHDOG_BASE_DELAY_MS,
    maxDelayMs = WATCHDOG_MAX_DELAY_MS,
  } = {}
) {
  const exponent = Math.max(0, Number(consecutiveCrashes) - 1);
  return Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
}

export function nextCrashCount(
  previousCrashes,
  runDurationMs,
  stableRunMs = WATCHDOG_STABLE_RUN_MS
) {
  return runDurationMs >= stableRunMs ? 1 : previousCrashes + 1;
}
