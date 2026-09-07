import assert from "node:assert/strict";
import test from "node:test";
import { createLogThrottle } from "../utils/logThrottle.js";

test("log throttle allows one message per interval", () => {
  let currentTime = 0;
  const shouldLog = createLogThrottle(10 * 60 * 1000, () => currentTime);

  assert.equal(shouldLog(), true);
  currentTime = 9 * 60 * 1000;
  assert.equal(shouldLog(), false);
  currentTime = 10 * 60 * 1000;
  assert.equal(shouldLog(), true);
  currentTime = 19 * 60 * 1000;
  assert.equal(shouldLog(), false);
  currentTime = 20 * 60 * 1000;
  assert.equal(shouldLog(), true);
});
