# Testing Patterns
_Last updated: 2026-05-27_

## Summary
The project uses Node.js's built-in test runner (`node:test`) with no external test framework. A single test file (`tests/replay-policy.test.js`) covers application policy logic and WorkMarket counter-offer payload construction. Real job data captured from production runs is stored in `jobs-replay.json` as NDJSON and used as test fixtures.

---

## Test Framework

**Runner:** Node.js native (`node:test`, available since Node 18)

**Assertion library:** `node:assert/strict` — all assertions use strict equality

**No third-party test libraries** (no Jest, Vitest, Mocha, Chai, etc.)

**Run command:**
```bash
npm test
# Expands to: node --test tests/*.test.js
```

No watch mode, no coverage command defined.

---

## Test File Organization

**Location:** `tests/` directory at project root

**Naming:** `*.test.js` suffix — the `npm test` script globs `tests/*.test.js`

**Current files:**
- `tests/replay-policy.test.js` — 201 lines, covers policy evaluation and WM counter-offer form data

```
fn-asistant-ai/
├── tests/
│   └── replay-policy.test.js
└── jobs-replay.json          ← NDJSON fixture data (177.7K, ~real production jobs)
```

---

## Test Structure

**Suite organization:** Flat — each test is a top-level `test()` call, no nesting with `describe()`.

```js
import test from "node:test";
import assert from "node:assert/strict";

test("granite_only allows Granite jobs by default", () => {
  // ...
});

test("granite_only rejects non-Granite jobs outside override dates", () => {
  // ...
});
```

**No beforeEach/afterEach lifecycle hooks.** Setup is done inline or via helper functions.

---

## CONFIG Override Pattern

Tests that need to test different config states use the `withConfig` helper defined at the top of the test file:

```js
function withConfig(overrides, run) {
  const snapshot = {
    APPLICATION_MODE: CONFIG.APPLICATION_MODE,
    ALLOW_ALL_COMPANIES_ON_DATES: [...CONFIG.ALLOW_ALL_COMPANIES_ON_DATES],
    ENFORCE_MIN_PAYMENT: CONFIG.ENFORCE_MIN_PAYMENT,
  };
  Object.assign(CONFIG, overrides);
  try {
    return run();
  } finally {
    // Always restore original values
    CONFIG.APPLICATION_MODE = snapshot.APPLICATION_MODE;
    CONFIG.ALLOW_ALL_COMPANIES_ON_DATES = snapshot.ALLOW_ALL_COMPANIES_ON_DATES;
    CONFIG.ENFORCE_MIN_PAYMENT = snapshot.ENFORCE_MIN_PAYMENT;
  }
}
```

**Usage pattern:**
```js
withConfig({ APPLICATION_MODE: "granite_only", ALLOW_ALL_COMPANIES_ON_DATES: [] }, () => {
  const result = evaluateApplicationPolicy(graniteJob);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "POLICY_ALLOWED_GRANITE");
});
```

When adding tests that need different CONFIG state, always use `withConfig` — never mutate CONFIG directly without restoring it.

---

## Fixtures and Replay Data

**Replay data file:** `jobs-replay.json` at project root

**Format:** NDJSON — one JSON object per line, each with shape:
```json
{"job": {...normalized work order...}, "result": {...eligibility result...}, "action": "APPLY|COUNTER|SKIP", "ts": 1234567890}
```

**How replay data is generated:** `utils/saveReplay.js` appends to `jobs-replay.json` every time `isEligibleForApplication` is called in production. This means fixture data comes from real observed work orders.

**Loading in tests:**
```js
const replayEntries = fs
  .readFileSync(new URL("../jobs-replay.json", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map(line => JSON.parse(line));
```

**`findReplayJob` helper:** Used to select a fixture matching a predicate:
```js
function findReplayJob(predicate) {
  const entry = replayEntries.find(item => predicate(item.job));
  assert.ok(entry, "Expected replay job fixture to exist");
  return entry.job;
}

// Usage
const graniteJob = findReplayJob(job => job.company === "Granite Telecommunications");
const nonGraniteJob = findReplayJob(job => job.company !== "Granite Telecommunications");
```

**Dependency:** Tests will fail if `jobs-replay.json` does not contain at least one Granite job and one non-Granite job. The file must stay committed to the repo and must not be cleared.

---

## What Is Currently Tested

| Area | Coverage |
|------|----------|
| `evaluateApplicationPolicy` — all 5 modes | Covered (5 tests) |
| `buildWMCounterOfferFormData` — fixed-rate with date | Covered |
| `buildWMCounterOfferFormData` — hourly with window | Covered |
| `getWorkOrderLocalDate` (used in date override test) | Indirectly covered |

---

## What Is NOT Tested

**No tests exist for:**

- `isEligibleForApplication` (the full async orchestration function in `utils/isEligibleForApplication.js`)
- `calculateCounterOffer` — rate and travel expense calculations
- `isPaymentEligible` — all three payment rules (BELOW_MINIMUM, LOW_RATE, TRAVEL)
- `isWithinWorkingHours` — ET-based schedule validation
- `checkAvailabilityNew` — calendar integration and fit logic
- `findFitBlock` — the core slot-fitting algorithm in `utils/availability/findFitBlock.js`
- `decideFitAction` — the APPLY / COUNTER_DATES / NO_FIT decision
- `computeFreeBlocks` / `getAvailableBlocks` — free slot computation
- `normalizeDateFromWO` — date/time normalization from raw scraper output
- `postFNworkOrderRequest` / `postFNCounterOffer` — FieldNation submission
- `postWMworkOrderRequest` — WorkMarket application submission
- `loginFnAuto` / `loginWMAuto` — Puppeteer login flows
- All Gmail/Google Calendar API wrappers
- All Telegram bot functionality
- `index.js` — Express API endpoints and monitoring loop

**Highest-risk untested areas:**
1. `calculateCounterOffer` — financial calculations that directly affect submitted bids
2. `isPaymentEligible` — rate/threshold logic with many edge cases
3. `findFitBlock` — complex time arithmetic for scheduling
4. `normalizeDateFromWO` — format conversion that bridges scraped data to business logic

---

## Adding New Tests

**New test file naming:** Create `tests/<feature>.test.js` — the glob `tests/*.test.js` will pick it up automatically.

**For synchronous pure functions** (policy, calculations, formatting helpers):
```js
import test from "node:test";
import assert from "node:assert/strict";
import { calculateCounterOffer } from "../utils/isEligibleForApplication.js";
import { CONFIG } from "../config.js";

test("calculateCounterOffer adds travel for padded distance over threshold", () => {
  withConfig({ DISTANCE: { ...CONFIG.DISTANCE, TRAVEL_THRESHOLD_MILES: 10 } }, () => {
    const result = calculateCounterOffer({ platform: "WorkMarket", distance: 5, estLaborHours: 2, payType: "hourly", hourlyRate: 40, payRange: { min: 40, max: 80 } });
    assert.ok(result.travelExpense > 0);
  });
});
```

**For async functions** that call Google Calendar or Puppeteer: mock the external dependency by replacing the imported module behavior or by testing the pure sub-functions separately rather than the full async orchestrator.

**Snapshot tests for form payloads:** The existing `buildWMCounterOfferFormData` tests are the pattern to follow for testing HTTP form construction — pass explicit inputs, assert exact `formData.get(field)` values.

---

## Test Mode (Not Tests)

`CONFIG.TEST_MODE = true` (the default in `config.js`) is a runtime flag that prevents real HTTP submissions, not a test framework concept. It does not affect `npm test` execution. When `TEST_MODE` is true, all `postFN*` and `postWM*` calls are blocked and logged with a `"TEST:"` prefix — but the business logic (eligibility, counter-offer calculation) still executes fully. This makes it useful for validating live data manually but is distinct from the automated test suite.
