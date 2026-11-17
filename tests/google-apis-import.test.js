import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("google client import", () => {
  it("loads gmail and calendar without the googleapis barrel", async () => {
    const started = Date.now();
    const { google } = await import("../utils/googleApis.js");
    const elapsed = Date.now() - started;

    assert.equal(typeof google.gmail, "function");
    assert.equal(typeof google.calendar, "function");
    assert.equal(typeof google.auth.fromJSON, "function");
    assert.ok(
      elapsed < 15000,
      `google client import took ${elapsed}ms; expected under 15s`
    );
  });
});
