import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOrderFingerprint,
  PersistentOrderDeduper,
} from "../utils/orderDedup.js";

function order(overrides = {}) {
  return {
    platform: "FieldNation",
    id: 123,
    time: { start: "2026-08-25T09:00", end: "2026-08-25T11:00" },
    payType: "hourly",
    hourlyRate: 60,
    payRange: { min: 60, max: 120 },
    payStructure: null,
    estLaborHours: 2,
    distance: 10,
    ...overrides,
  };
}

test("fingerprint ignores scrape noise but changes for pay or schedule updates", () => {
  const original = order();
  assert.equal(
    buildOrderFingerprint(original),
    buildOrderFingerprint({ ...original, distance: 10.4, title: "Updated copy" })
  );
  assert.notEqual(
    buildOrderFingerprint(original),
    buildOrderFingerprint({
      ...original,
      payRange: { min: 65, max: 130 },
      hourlyRate: 65,
    })
  );
  assert.notEqual(
    buildOrderFingerprint(original),
    buildOrderFingerprint({
      ...original,
      time: { ...original.time, start: "2026-08-26T09:00" },
    })
  );
});

test("persistent dedup survives restart and expires entries", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fn-dedup-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "fingerprints.json");
  let current = 1_000;

  const first = new PersistentOrderDeduper({
    filePath,
    ttlMs: 500,
    now: () => current,
  });
  first.remember(order());
  assert.equal(first.has(order()), true);

  const restarted = new PersistentOrderDeduper({
    filePath,
    ttlMs: 500,
    now: () => current,
  });
  assert.equal(restarted.has(order()), true);

  current = 1_501;
  assert.equal(restarted.has(order()), false);
});
