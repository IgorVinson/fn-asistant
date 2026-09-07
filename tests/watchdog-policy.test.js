import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRestartDelay,
  nextCrashCount,
} from "../utils/watchdogPolicy.js";

test("watchdog restart delay backs off and caps", () => {
  assert.equal(calculateRestartDelay(1), 5_000);
  assert.equal(calculateRestartDelay(2), 10_000);
  assert.equal(calculateRestartDelay(5), 60_000);
  assert.equal(calculateRestartDelay(20), 60_000);
});

test("a stable run resets the crash loop", () => {
  assert.equal(nextCrashCount(3, 30_000), 4);
  assert.equal(nextCrashCount(3, 5 * 60 * 1000), 1);
});
