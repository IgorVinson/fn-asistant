import assert from "node:assert/strict";
import test from "node:test";

import { classifyAvailabilityError } from "../utils/availability/availabilityError.js";

test("WorkMarket auth failures are retryable, not calendar conflicts", () => {
  const error = new Error("cookies expired");
  error.name = "WMAuthError";
  assert.equal(classifyAvailabilityError(error), "AVAILABILITY_AUTH_REQUIRED");
});

test("ordinary availability failures remain slot-unavailable", () => {
  assert.equal(
    classifyAvailabilityError(new Error("calendar request failed")),
    "SLOT_UNAVAILABLE"
  );
});
