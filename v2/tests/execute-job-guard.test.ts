import test from "node:test";
import assert from "node:assert/strict";

import { shouldBlockLiveExecution } from "../src/app/executeJob.js";

test("blocks duplicate live execution when a submitted attempt already exists", () => {
  assert.equal(
    shouldBlockLiveExecution({
      dryRun: false,
      hasSuccessfulAttempt: true
    }),
    true
  );
});

test("allows dry-run even if a submitted attempt already exists", () => {
  assert.equal(
    shouldBlockLiveExecution({
      dryRun: true,
      hasSuccessfulAttempt: true
    }),
    false
  );
});

test("allows live execution when no submitted attempt exists", () => {
  assert.equal(
    shouldBlockLiveExecution({
      dryRun: false,
      hasSuccessfulAttempt: false
    }),
    false
  );
});
