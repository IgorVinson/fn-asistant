import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { normalizeFieldNationReplayJob } from "../src/platforms/fieldnation/normalizeReplayJob.js";
import { decideJob } from "../src/domain/decideJob.js";
import { defaultPolicy } from "../src/config/policy.js";
import { importLiveFieldNationJob } from "../src/app/importLiveFieldNationJob.js";
import { openDatabase } from "../src/storage/database.js";

test("FieldNation replay job normalizes into the shared canonical shape", () => {
  const normalized = normalizeFieldNationReplayJob(
    {
      id: "18899424",
      platform: "FieldNation",
      company: "TPX Communications",
      title: "Turn up of previously tested circuits & installed & VELO & CRADLEPOINT.",
      time: {
        start: "2026-04-14T09:45",
        end: "2026-04-14T12:45"
      },
      payRange: {
        min: 65,
        max: 195
      },
      payType: "hourly",
      hourlyRate: 65,
      estLaborHours: 3,
      distance: 69
    },
    {
      sourceId: "18899424",
      receivedAt: "2026-04-08T00:00:00.000Z"
    }
  );

  assert.equal(normalized.id, "fn:18899424");
  assert.equal(normalized.platform, "FieldNation");
  assert.equal(normalized.tags.includes("fieldnation"), true);
  assert.equal(normalized.requestedWindow.durationHours, 3);
  assert.equal(normalized.compensation.totalBudget, 195);
  assert.equal(normalized.distanceMiles, 69);
});

test("FieldNation normalized job flows through the shared decision engine", () => {
  const normalized = normalizeFieldNationReplayJob(
    {
      id: "18899424",
      platform: "FieldNation",
      company: "TPX Communications",
      title: "Turn up of previously tested circuits & installed & VELO & CRADLEPOINT.",
      time: {
        start: "2026-04-14T09:45",
        end: "2026-04-14T12:45"
      },
      payRange: {
        min: 65,
        max: 195
      },
      payType: "hourly",
      hourlyRate: 65,
      estLaborHours: 3,
      distance: 69
    },
    {
      sourceId: "18899424",
      receivedAt: "2026-04-08T00:00:00.000Z"
    }
  );

  const decision = decideJob(
    normalized,
    {
      ...defaultPolicy,
      graniteOnly: false,
      fieldNationMinTotal: 165
    }
  );

  assert.equal(decision.type, "counter_rate");
  assert.equal(decision.reason, "TRAVEL_REQUIRED");
  assert.ok((decision.counterOffer?.travelExpense ?? 0) > 0);
});

test("FieldNation live import supports service_window start.local date/time object", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fn-v2-fn-import-"));
  const dbPath = path.join(tempDir, "test.sqlite");
  const cookiePath = path.join(tempDir, "fn-cookies.json");
  fs.writeFileSync(cookiePath, JSON.stringify([{ name: "session", value: "abc123" }]));

  const db = openDatabase(dbPath);
  const originalFetch = global.fetch;

  const html = `
    <html>
      <script type="text/javascript">
        window.work_order = {
          "id": 18955112,
          "company": { "name": "Pomeroy" },
          "title": "Unit reinstall",
          "schedule": {
            "service_window": {
              "start": { "local": { "date": "2026-04-13", "time": "10:00:00" } },
              "end": { "local": { "date": "", "time": "" } }
            },
            "est_labor_hours": 3
          },
          "pay": {
            "type": "hourly",
            "range": { "min": 120, "max": 360 }
          },
          "coords": { "distance": 12.5 }
        };
      </script>
    </html>
  `;

  global.fetch = (async () =>
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" }
    })) as typeof fetch;

  try {
    db.prepare(
      `
        INSERT INTO sessions (
          id, platform, status, session_json, last_refreshed_at, expires_at, created_at, updated_at
        ) VALUES (
          'session:fieldnation', 'FieldNation', 'active', ?, datetime('now'), datetime('now','+4 hour'), datetime('now'), datetime('now')
        )
      `
    ).run(JSON.stringify({ cookiePath }));

    const result = await importLiveFieldNationJob(
      db,
      {
        name: "noop",
        async getBusyIntervalsForDate() {
          return [];
        },
        async getBusyIntervalsForJob() {
          return [];
        }
      },
      "https://app.fieldnation.com/workorders/18955112"
    );

    assert.equal(result.normalized.platformWorkOrderId, "18955112");
    assert.equal(result.normalized.requestedWindow.requestedDate, "2026-04-13");
    assert.equal(result.normalized.requestedWindow.durationHours, 3);
  } finally {
    global.fetch = originalFetch;
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("FieldNation live import preserves Granite service metadata for policy checks", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fn-v2-fn-granite-"));
  const dbPath = path.join(tempDir, "test.sqlite");
  const cookiePath = path.join(tempDir, "fn-cookies.json");
  fs.writeFileSync(cookiePath, JSON.stringify([{ name: "session", value: "abc123" }]));

  const db = openDatabase(dbPath);
  const originalFetch = global.fetch;

  const html = `
    <html>
      <script type="text/javascript">
        window.work_order = {
          "id": 18959999,
          "company": { "name": "Pomeroy" },
          "title": "Router turn-up dispatch",
          "service_title": "Granite Telecommunications | Router turn-up dispatch",
          "description": "Dispatch for Granite Telecommunications site rollout.",
          "schedule": {
            "service_window": {
              "start": { "local": { "date": "2026-04-14", "time": "10:00:00" } },
              "end": { "local": { "date": "2026-04-14", "time": "13:00:00" } }
            },
            "est_labor_hours": 3
          },
          "pay": {
            "type": "hourly",
            "range": { "min": 120, "max": 360 }
          },
          "coords": { "distance": 12.5 }
        };
      </script>
    </html>
  `;

  global.fetch = (async () =>
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" }
    })) as typeof fetch;

  try {
    db.prepare(
      `
        INSERT INTO sessions (
          id, platform, status, session_json, last_refreshed_at, expires_at, created_at, updated_at
        ) VALUES (
          'session:fieldnation', 'FieldNation', 'active', ?, datetime('now'), datetime('now','+4 hour'), datetime('now'), datetime('now')
        )
      `
    ).run(JSON.stringify({ cookiePath }));

    const result = await importLiveFieldNationJob(
      db,
      {
        name: "noop",
        async getBusyIntervalsForDate() {
          return [];
        },
        async getBusyIntervalsForJob() {
          return [];
        }
      },
      "https://app.fieldnation.com/workorders/18959999"
    );

    assert.equal(result.normalized.company, "Pomeroy");
    assert.equal(result.normalized.tags.includes("granite"), true);
    assert.notEqual(result.decision.reason, "POLICY_REJECTED");
    assert.equal(result.decision.trace[0]?.detail, "Granite job");
  } finally {
    global.fetch = originalFetch;
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
