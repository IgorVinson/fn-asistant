# Concerns
_Last updated: 2026-05-27_

## Summary

This codebase implements a fully autonomous job-application agent that submits real applications and counter-offers on the user's behalf. The most critical concerns are hardcoded platform credentials committed directly into source files (multiple files, real passwords), a completely unauthenticated REST API that controls the agent, and missing TEST_MODE guards inside platform submission functions themselves. There are also meaningful reliability risks from busy-polling at 1-second intervals, macOS-only sound dependencies, and very limited test coverage of the submission paths.

---

## Security

### [HIGH] Hardcoded Platform Credentials in Source Files

Real passwords are hardcoded as default parameter values in two login files that are committed to git.

- `utils/FieldNation/loginFnAuto.js` lines 16-17: `email = "igorvinson@gmail.com"`, `password = "N25z*D4eXiyuPM@"`
- `utils/FieldNation/loginToFieldNation.js` lines 15, 21: same email and password literals in `page.type()` calls
- `utils/WorkMarket/loginWMAuto.js` line 17: `password = "Karusel123!"`

Any collaborator, CI system, or git host that indexes this repository has these credentials. The legacy file `loginToFieldNation.js` is also not gated by `CONFIG.FIELDNATION_ENABLED` and appears to be an unused duplicate that still contains live credentials.

Fix: Move credentials to environment variables (`process.env.FN_EMAIL`, `process.env.FN_PASSWORD`, `process.env.WM_PASSWORD`). Remove `loginToFieldNation.js` if unused.

### [HIGH] No Authentication on Express API Endpoints

The REST API accepts unauthenticated requests from any local or network client. There is no middleware providing authentication or authorization.

- `index.js` line 30: `app.use(cors())` — allows all origins
- `index.js` line 86: `POST /api/config` — enables TEST_MODE to be disabled remotely
- `index.js` line 144: `POST /api/monitor/:action` — start/stop the agent
- `index.js` line 104: `POST /api/phone-alert` — triggers job processing
- `index.js` line 66: `GET /api/status` — exposes full CONFIG object including token/chat-id values

Anyone on the same network can: disable TEST_MODE, start/stop monitoring, or trigger order processing against arbitrary URLs. Exposing CONFIG via `/api/status` also leaks Telegram bot tokens stored in memory.

Fix: Add a shared-secret header check (Bearer token via env var) as middleware before all `/api/*` routes.

### [HIGH] Google OAuth Tokens Stored in Plaintext Files

- `config/token.json` — OAuth2 refresh token stored in plaintext on disk
- `config/credentials.json` — OAuth2 client credentials stored on disk
- Both are in `.gitignore` but are loaded at runtime via `utils/gmail/login.js` lines 12-13

These grant read/write access to Gmail and Google Calendar. If the local machine is compromised, these files provide persistent API access. There is no token rotation or expiry enforcement beyond what Google enforces.

### [MED] `afplay` Shell Command Uses Unsanitized `soundPath`

- `utils/playSound.js` line 44: `execSync(\`afplay ${soundPath}\`)`

`soundPath` is derived from a hardcoded lookup table so current risk is low, but the pattern is unsafe. If `soundPath` were ever user-influenced (e.g., a future config parameter for custom sound path), it would be a shell injection vector.

Fix: Use `execSync('afplay', [soundPath])` (array form) or validate `soundPath` against the known set before interpolation.

### [MED] Telegram Bot Token Exposed via /api/status

- `index.js` line 68-70: `res.json({ isMonitoring: ..., config: CONFIG })` — returns the full CONFIG object
- CONFIG includes `TELEGRAM.BOT_TOKEN`, `TELEGRAM.BOT_TOKEN_2`, `TELEGRAM.CHAT_ID`, `TELEGRAM.CHAT_ID_2`

Even though values come from `process.env`, they are in memory in CONFIG and returned verbatim by the status endpoint.

Fix: Strip sensitive fields before serializing CONFIG in the status response.

### [LOW] `.gitignore` Does Not Cover `config/config.js`

- `config/config.js` is a 137-line file present in the repo with hardcoded rate/threshold values
- The `/config` directory is in `.gitignore` only as `/config` (root-relative), not as a pattern covering all `config/` subdirectories
- `config.js` (root-level) and `config/config.js` are both tracked — verify `config/config.js` does not contain secrets

---

## Technical Debt

### Legacy Duplicate Login File (`loginToFieldNation.js`)

- `utils/FieldNation/loginToFieldNation.js` appears to be an older version of `loginFnAuto.js`
- It is not imported anywhere in the main codebase (not in `index.js` or any active utility)
- Still contains hardcoded credentials (see Security section)
- File: `utils/FieldNation/loginToFieldNation.js`

Fix: Delete this file after confirming it is unreferenced.

### `main` Field Points to Dead File

- `package.json` line 5: `"main": "other/oldIndex.js"` — this directory/file does not exist
- No functional impact since the project uses `npm start` → `node index.js`, but it signals accumulated debt

### `config/config.js` Parallel to `config.js`

- Both `config.js` (root) and `config/config.js` exist
- Only `config.js` (root) is imported by the application
- `config/config.js` is a separate file that appears unused but still tracked
- Risk: future developers may edit the wrong file

### DEBUG Logs Left in Production Code

- `utils/playSound.js` lines 10, 39, 43, 45: four `console.log('DEBUG: ...')` calls fire on every sound invocation
- Every order evaluation triggers at least one sound and therefore four debug log lines
- No flag or environment variable gates these logs

### 264 Unstructured `console.log` Calls in `utils/`

Structured logging via `utils/logger.js` exists but is bypassed in favor of raw `console.log`/`console.error` in 264 locations across the utils directory. This makes log aggregation and log-level filtering impossible.

---

## Reliability Risks

### Gmail Polling at 1-Second Interval with No Backoff

- `index.js` line 526: `setInterval(..., 1000)` — polls Gmail API every second
- Gmail API has per-user rate limits (250 quota units/second). `getLastUnreadEmail` makes multiple API calls per invocation.
- No exponential backoff on transient failures — a single network blip will show an error every second until recovery
- `isCheckingEmail` flag prevents overlap but does not prevent the timer from running during startup before `saveCookies()` completes

### TEST_MODE Guard Lives Only in Callers, Not in Submission Functions

- `utils/FieldNation/postFNworkOrderRequest.js`: no TEST_MODE check — will execute real API calls if called directly
- `utils/WorkMarket/postWMworkOrderRequest.js`: no TEST_MODE check

The guard exists correctly in `index.js` (`applyForJob` at line 568) and before counter-offer calls (lines 964, 1028), but the submission functions themselves are unguarded. Any future caller, script, or test that invokes `postFNworkOrderRequest` or `postWMworkOrderRequest` directly will submit real applications without any test gate.

Fix: Add `if (CONFIG.TEST_MODE) { console.log('TEST_MODE: skipping'); return; }` at the top of both post functions.

### Cookie Refresh Race Condition: `isRefreshingCookies` Is Never Reset on the Wait Path

- `index.js` lines 706-731: when a second concurrent call detects `isRefreshingCookies === true`, it waits up to 60 seconds and then retries
- If the first caller's `saveCookies()` crashes before reaching the `finally` block (line 807-810), `isRefreshingCookies` remains `true` indefinitely
- The saveCookies wrapper (`index.js` line 353-381) does reset browser to null on failure but does NOT reset `isRefreshingCookies`, because that flag is managed in `processOrder`, not in `saveCookies`
- Result: agent freezes permanently; all subsequent WorkMarket orders are silently dropped

### Hardcoded Magic Sleeps

- `index.js` line 513: `await new Promise(resolve => setTimeout(resolve, 3000))` — waits 3s after sound to "ensure sounds finish"
- `index.js` line 758: `await new Promise(resolve => setTimeout(resolve, 2000))` — waits 2s after cookie refresh "for cookies to be saved"
- These are arbitrary delays, not condition-based waits. Sound playback uses `execSync` (blocking) so the 3s wait is redundant. The 2s cookie wait masks a real timing dependency.

### `playSound()` Blocks the Event Loop on macOS

- `utils/playSound.js` line 44: `execSync('afplay ...')` — synchronous shell call
- `afplay` plays audio in real time. A 1-second notification sound blocks the Node event loop for 1 second.
- No try/catch around just the `execSync` — failure propagates to the outer catch but still interrupts the monitoring loop

### FieldNation Counter-Offer Date Branch Has No Submission Implementation

- `index.js` lines 1060-1160: `COUNTER_DATES` handling for FieldNation
- There is no `postFNCounterOffer` call with a `counterDate` — only WorkMarket counter-dates are submitted
- FieldNation counter-dates are logged and notified but never actually sent, with no log message indicating the skip

---

## Testing Gaps

### No Tests for Core Submission Paths

- `tests/replay-policy.test.js` only tests `evaluateApplicationPolicy` and `getWorkOrderLocalDate` from `isEligibleForApplication.js`
- The full `isEligibleForApplication` function (calendar checks, rate calculation, counter-offer generation) has no automated tests
- `postFNworkOrderRequest`, `postWMworkOrderRequest`, `postFNCounterOffer`, `postWMCounterOffer` have zero test coverage
- `processOrder` (the main orchestration function, 350+ lines) has zero test coverage

### No Tests for Cookie Refresh Logic

- The `isInvalidWorkMarketData` heuristic and the retry/refresh flow in `processOrder` (lines 700-812) are not tested
- Edge cases like simultaneous refresh attempts, partial data, or timeout scenarios are unverified

### Replay Test Depends on External File State

- `tests/replay-policy.test.js` line 13 reads `jobs-replay.json` at test startup
- If `jobs-replay.json` is empty or missing a required fixture (Granite job, non-Granite job), multiple tests will fail with unhelpful `AssertionError: Expected replay job fixture to exist`
- No seeded/stable fixture file — test suite relies on production replay data

### Only One Test File

- `npm test` runs `tests/*.test.js` — currently only one file matches
- No integration tests, no Puppeteer flow tests, no API endpoint tests

---

## Scalability Limitations

### Single-Process, Single Browser Instance

- One global `browser` variable shared across all requests
- Concurrent FieldNation and WorkMarket scrapes share the same browser, sequenced by async/await
- If a page hangs, the 4-minute `saveCookies` timeout is the only circuit breaker
- No worker pool or parallel processing

### In-Memory Event History Capped at 50

- `index.js` line 57: `if (eventHistory.length > 50) eventHistory.pop()` — only 50 events in memory
- All events are also written to `logs/logs.json` but the file is rewritten in full on every event (`writeEventsToFile`)
- At 1-second polling with active monitoring, the logs.json can be written many times per minute (high I/O amplification)

---

## Missing Observability

### No Metrics or Alerting on Application Success Rate

- No tracking of: applications submitted per day, counter-offers accepted, rejection rates per reason
- Only the Telegram notifications provide operational visibility; if Telegram is unreachable, there is no fallback alert channel

### No Health Endpoint

- `/api/status` returns config but no health indicators: last successful email check time, last cookie refresh time, browser alive status, Gmail API quota remaining

---

## Dependency Risks

### `googleapis` Pinned to `^105.0.0` (Current: ~144)

- `package.json`: `"googleapis": "^105.0.0"` — installed at a version roughly 39 major versions behind current
- Google periodically deprecates older SDK versions; this may break calendar or Gmail API calls without notice

### `node-telegram-bot-api` at `^0.66.0`

- Latest stable is 0.66.0 — no immediate risk but this library has a history of breaking changes on minor bumps
- Uses `polling: true` mode which is less reliable than webhooks for production use

### `imap` Package at `^0.8.19` (Unmaintained)

- The `imap` package appears in `package.json` but is not used in any active import — the codebase uses Gmail API instead
- Last published in 2019, no active maintenance
- Should be removed from dependencies

---

## Recommendations

1. **Rotate and externalize credentials immediately.** Move FieldNation and WorkMarket passwords to environment variables (`FN_EMAIL`, `FN_PASSWORD`, `WM_PASSWORD`). Consider the current passwords compromised if the repository has ever been pushed to a remote. Delete `utils/FieldNation/loginToFieldNation.js`.

2. **Add authentication to the Express API.** A simple shared-secret middleware (compare `Authorization: Bearer <env-var>` header) before all `/api/*` routes would prevent unauthorized TEST_MODE toggle and agent hijacking. Also strip Telegram tokens from the `/api/status` response.

3. **Add TEST_MODE guards inside submission functions.** Both `utils/FieldNation/postFNworkOrderRequest.js` and `utils/WorkMarket/postWMworkOrderRequest.js` should check `CONFIG.TEST_MODE` at the top of their exported functions. This is a safety-net against any future direct caller bypassing the index.js guard.

4. **Fix the `isRefreshingCookies` permanent-freeze bug.** The flag must be reset in a `finally` block that is reachable even when `saveCookies()` throws. Currently if saveCookies crashes, the flag stays `true` forever and all subsequent WorkMarket orders are silently dropped.

5. **Expand test coverage to cover the full eligibility and counter-offer pipeline.** The replay test infrastructure is a good foundation — extend it to run `isEligibleForApplication` end-to-end with mocked Google Calendar responses, and add at least smoke tests that verify `postFN*` / `postWM*` functions respect TEST_MODE and throw on missing cookies.
