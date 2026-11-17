import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../config.js";
import isEligibleForApplication, {
  isBeyondMaxApplicationDistance,
} from "../utils/isEligibleForApplication.js";
import { parseFNWorkOrder } from "../utils/FieldNation/getFNorderData.js";
import normalizeDateFromWO from "../utils/normalizedDateFromWO.js";

test("distance cutoff uses reported one-way miles without travel padding", () => {
  assert.equal(CONFIG.DISTANCE.MAX_APPLICATION_DISTANCE_MILES, 100);
  assert.equal(isBeyondMaxApplicationDistance(100), false);
  assert.equal(isBeyondMaxApplicationDistance(100.01), true);
  assert.equal(isBeyondMaxApplicationDistance(101), true);
  assert.equal(isBeyondMaxApplicationDistance("100.5"), true);
});

test("both platforms reject distant tickets before payment or schedule checks", async () => {
  for (const platform of ["FieldNation", "WorkMarket"]) {
    // Missing schedule deliberately proves no availability or counter path runs.
    const result = await isEligibleForApplication({
      platform,
      distance: 100.1,
      title: "Network repair",
    });
    assert.equal(result.eligible, false);
    assert.equal(result.counterOffer, null);
    assert.equal(result.reason, "DISTANCE_TOO_FAR");
    assert.match(result.rejectDetails, /100\.1mi exceeds 100mi/);
  }
});

test("FieldNation fractional distance survives parsing and normalization", async () => {
  const parsed = parseFNWorkOrder({
    id: 123,
    coords: { distance: "100.9" },
    schedule: { service_window: { start: { local: { date: "2026-10-03", time: "10:00:00" } } } },
  });
  assert.equal(parsed.distance, 100.9);
  const normalized = normalizeDateFromWO(parsed);
  assert.equal(normalized.distance, 100.9);
  assert.equal((await isEligibleForApplication(normalized)).reason, "DISTANCE_TOO_FAR");
});
