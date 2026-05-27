# Architecture
_Last updated: 2026-05-27_

## Summary

FieldOps Automator is a single-process Node.js automation agent that monitors Gmail for work order notifications from FieldNation and WorkMarket, scrapes order details via cookie-authenticated HTTP requests (with Puppeteer used only for session login), evaluates each order against configurable business rules (rates, travel, calendar availability), and submits applications or counter-offers. An Express server exposes a REST API and serves a React dashboard; a Telegram bot provides remote control and push notifications.

---

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                          index.js                                │
│             Express Server (port 3001) + Orchestrator            │
├────────────┬────────────────┬───────────────────────────────────┤
│  Gmail     │  Telegram Bot  │  Phone Webhook                    │
│  Poller    │  (remote ctrl) │  POST /api/phone-alert            │
│  1000ms    │                │                                    │
└─────┬──────┴────────────────┴──────────────────┬────────────────┘
      │ email body / alert                        │ order link
      ▼                                           │
┌─────────────────────────────────────────────────▼──────────────┐
│            processOrder(orderLink)                              │
│            Determine platform → Scrape → Normalize → Evaluate  │
└────┬───────────────────┬───────────────────────────────────────┘
     │                   │
     ▼                   ▼
┌─────────┐       ┌────────────┐
│ getFN   │       │ getWMorder │     ← cookie-authenticated HTTP
│ orderData│      │ Data.js    │       (no Puppeteer for scraping)
└────┬────┘       └─────┬──────┘
     │                  │
     └────────┬──────────┘
              ▼
┌────────────────────────────────────────────────────────────────┐
│       normalizeDateFromWO(data)                                │
│       Canonical work order object                              │
└────────────────────────┬───────────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────────┐
│       isEligibleForApplication(workOrder)                      │
│  1. Past-date guard                                            │
│  2. Policy check (granite_only / all_companies / disabled)     │
│  3. Working hours check                                        │
│  4. BELOW_MINIMUM payment → hard reject (no counter)          │
│  5. Calendar availability fit (Google Cal + WM assignments)    │
│  6. LOW_RATE → counter-offer with BASE_HOURLY_RATE             │
│  7. TRAVEL → counter-offer with distance expense               │
└────────────────────────┬───────────────────────────────────────┘
                         ▼
         ┌───────────────┼──────────────────┐
         ▼               ▼                  ▼
    APPLY           COUNTER             REJECT
postFNworkOrder  postFNCounter       log + notify
postWMworkOrder  postWMCounter       Telegram + Dashboard
                         │
                         ▼
              saveReplay(job, result)     ← NDJSON to jobs-replay.json
              pushEvent(...)             ← in-memory + logs/logs.json
              telegramBot.send*(...)     ← Telegram notification
```

---

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Orchestrator | Express server, monitoring loop, `processOrder()` | `index.js` |
| Config | Single source of truth for all thresholds and flags | `config.js` |
| Gmail Poller | Poll inbox every 1000ms for unread work order emails | `utils/gmail/getLastUnreadEmail.js` |
| Link Extractor | Regex-extract FN/WM URL from email body | `utils/gmail/getOrderLink.js` |
| FN Scraper | Cookie-authenticated GET + regex parse `window.work_order` | `utils/FieldNation/getFNorderData.js` |
| WM Scraper | Cookie-authenticated GET + HTML/JSON parse | `utils/WorkMarket/getWMorderData.js` |
| Date Normalizer | Unify platform-specific date/time formats to ISO strings | `utils/normalizedDateFromWO.js` |
| Eligibility Engine | Business logic: policy, hours, payment, availability | `utils/isEligibleForApplication.js` |
| Calendar Fetcher | Google Calendar API busy blocks (all calendars) | `utils/availability/fetchCalendarBusy.js` |
| WM Assignments Fetcher | Puppeteer-scraped WM active assignments as busy blocks | `utils/WorkMarket/getWMAssignments.js` |
| Free Block Compiler | Subtract busy blocks from work hours to get free slots | `utils/availability/getAvailableBlocks.js` |
| Fit Finder | Match job duration + travel into a free block | `utils/availability/findFitBlock.js` |
| Fit Decision | Decide APPLY / COUNTER_DATES / NO_FIT from fit results | `utils/availability/decideFitAction.js` |
| FN Login | Puppeteer-based automated login with 2FA support | `utils/FieldNation/loginFnAuto.js` |
| WM Login | Puppeteer-based automated login with 2FA support | `utils/WorkMarket/loginWMAuto.js` |
| FN Apply | REST API POST to submit direct application | `utils/FieldNation/postFNworkOrderRequest.js` |
| FN Counter | REST API POST with custom rates and travel expense | `utils/FieldNation/postFNCounterOffer.js` |
| WM Apply | REST API POST to submit direct application | `utils/WorkMarket/postWMworkOrderRequest.js` |
| WM Counter | REST API POST with optional reschedule | `utils/WorkMarket/postWMCounterOffer.js` |
| Telegram Bot | Dual-bot: outbound notifications + inbound commands | `utils/telegram/telegramBot.js` |
| Logger | File-based daily rotating log (`logs/app-YYYY-MM-DD.log`) | `utils/logger.js` |
| Replay Store | Append evaluated orders to NDJSON for test replay | `utils/saveReplay.js` |

---

## Layers

**Transport (Inbound):**
- Purpose: Detect new work orders from multiple sources
- Location: `utils/gmail/`, `index.js` (`/api/phone-alert`)
- Contains: Gmail API polling, email body parsing, Telegram ingest bot, Macrodroid webhook
- Depends on: Google OAuth2 (`config/credentials.json`, `config/token.json`)

**Scraping (Data Retrieval):**
- Purpose: Fetch full work order details from platform websites
- Location: `utils/FieldNation/getFNorderData.js`, `utils/WorkMarket/getWMorderData.js`
- Contains: Cookie-authenticated `fetch()` calls, HTML/JSON parsing
- Depends on: Session cookies persisted to `utils/FieldNation/cookies.json`, `utils/WorkMarket/autoCookies.json`
- Note: Puppeteer is only used for login (cookie acquisition), not for scraping

**Session Management:**
- Purpose: Maintain valid platform sessions via cookie rotation
- Location: `index.js` (`saveCookies()`, `isRefreshingCookies` flag), `utils/FieldNation/loginFnAuto.js`, `utils/WorkMarket/loginWMAuto.js`
- Contains: Headless Chrome launch, automated login, 2FA code retrieval from Gmail
- Constraint: Single concurrent refresh enforced via `isRefreshingCookies` boolean flag

**Business Logic (Eligibility):**
- Purpose: Determine whether to apply, counter, or reject each order
- Location: `utils/isEligibleForApplication.js` (orchestrates), `utils/availability/`
- Contains: Policy evaluation, working hours check, payment evaluation, calendar conflict detection
- Depends on: `config.js` (all thresholds), Google Calendar API, WM Assignments API

**Action Execution:**
- Purpose: Submit applications or counter-offers to platforms
- Location: `utils/FieldNation/post*.js`, `utils/WorkMarket/post*.js`
- Contains: REST API calls with cookie authentication
- Guard: All mutation calls check `CONFIG.TEST_MODE` before execution

**Notification & Observability:**
- Purpose: Push outcomes to operator and log to disk
- Location: `utils/telegram/telegramBot.js`, `utils/logger.js`, `index.js` (`pushEvent()`)
- Contains: Telegram HTML messages, daily log files, in-memory + file-backed event history (max 50 events)

---

## Data Flow

### Primary Monitoring Path

1. `periodicCheck()` fires every 1000ms (`index.js:486`)
2. `getLastUnreadEmail()` polls Gmail, marks email read (`utils/gmail/getLastUnreadEmail.js`)
3. `getOrderLink()` regex-extracts FN or WM URL (`utils/gmail/getOrderLink.js`)
4. `processOrder(orderLink)` — main orchestrator (`index.js:653`)
5. Platform detection via `determinePlatform()` — URL substring check (`index.js:555`)
6. `getFNorderData(url)` or `getWMorderData(url)` — cookie HTTP fetch + HTML parse
7. `normalizeDateFromWO(data)` — canonical object with ISO times (`utils/normalizedDateFromWO.js`)
8. `isEligibleForApplication(normalizedData)` — full eligibility evaluation (`utils/isEligibleForApplication.js`)
9. Outcome branch: `applyForJob()` / `postFNCounterOffer()` / `postWMCounterOffer()` / reject
10. `saveReplay(normalizedData, eligibilityResult)` — append to `jobs-replay.json`
11. `pushEvent(...)` — update in-memory + `logs/logs.json`
12. `telegramBot.sendOrderNotification(...)` — push to operator

### Availability Check Sub-Flow (inside `isEligibleForApplication`)

1. `getAvailableBlocks({ date, daysToCheck: 4 })` (`utils/availability/getAvailableBlocks.js`)
2. `fetchCalendarBusy(startDate, daysToCheck)` — all Google Calendar events (`utils/availability/fetchCalendarBusy.js`)
3. `fetchWMBusy()` — active WM assignments via Puppeteer scrape + 5-min cache (`utils/availability/fetchWMBusy.js`)
4. Merge and subtract busy blocks from work hours → free blocks
5. `findFitBlock(sameDayBlocks, woTimeWindow, travelMin)` — exact fit check
6. `findFitBlock(sameDayBlocks, shiftedWindow, travelMin)` — shifted same-day fit
7. `findFitBlock(nextDayBlocks, ...)` — next-day fit if `IS_COUNTER_DAYS=true`
8. `decideFitAction({ exactFit, shiftedFit })` → `APPLY` / `COUNTER_DATES` / `NO_FIT`

### Phone Alert Path

1. Macrodroid (Android) POSTs `FN_ALERT...` text to `POST /api/phone-alert`
2. Or Telegram Bot2 (ingest bot) receives same-format message
3. `handlePhoneAlert(alert)` → `extractFieldNationOrderLinkFromAlert(alert)`
4. If link found: `processOrder(orderLink)` — same path as email
5. Deduplication via `phoneAlertDedup` Map with 5-minute TTL

### Cookie Refresh Path

1. Triggered when `isInvalidWorkMarketData(data)` returns true (≥2 of: missing company, title, payment, id)
2. Or manually via Telegram `/relogin` or `POST /api/monitor/relogin`
3. `saveCookies()` — hard 4-minute timeout wrapper around `saveCookiesImpl()`
4. `saveCookiesImpl()` — launches Puppeteer, calls `loginFnAuto()` + `loginWMAuto()`
5. Gmail OAuth2 used to retrieve 2FA codes during login
6. `isRefreshingCookies` flag prevents concurrent refresh; waiters poll for up to 60s

---

## Entry Points

**Server start:** `index.js` — runs `app.listen(port)` which calls `startMonitoring()` and initializes Telegram bot

**Manual order processing:** `POST /api/monitor/start|stop`, Telegram `/process <link>`, `POST /api/phone-alert`

**Config live update:** `POST /api/config` — patches `CONFIG` object in place, no restart needed

**Dashboard:** React SPA in `ui/` polling `GET /api/events` and `GET /api/status`

---

## State Management

All state lives in `index.js` as module-level variables:

| Variable | Type | Purpose |
|----------|------|---------|
| `eventHistory` | `Array` (max 50) | Dashboard event log, mirrored to `logs/logs.json` |
| `browser` | Puppeteer Browser | Shared browser instance for login only |
| `monitoringInterval` | `setInterval` handle | Email polling loop |
| `reloginTimeout` | `setTimeout` handle | Scheduled re-login (4h) — currently unused at startup |
| `isRefreshingCookies` | `boolean` | Mutex flag for cookie refresh |
| `phoneAlertDedup` | `Map<string, number>` | Dedup cache for phone alerts (5-min TTL) |

`CONFIG` in `config.js` is a plain exported object mutated in place by `POST /api/config`. It is the single source of truth for all business logic thresholds. No database, no persistence across restarts.

---

## Error Handling

**Strategy:** Try-catch with graceful skip — failures log and skip the current order without crashing the process.

**Patterns:**
- `processOrder()` wraps entire flow in try-catch; errors notify Telegram and return `null`
- `saveCookies()` wraps `saveCookiesImpl()` in `Promise.race` with 4-minute hard timeout; resets browser on failure
- WorkMarket data quality: `isInvalidWorkMarketData()` heuristic triggers auto-refresh instead of throwing
- Availability check failure returns `SLOT_UNAVAILABLE` rather than propagating the error
- `fetchCalendarBusy` catches per-calendar errors and continues to remaining calendars
- `fetchWMBusy` returns `[]` on any error (non-fatal)
- All platform POST functions check `CONFIG.TEST_MODE` — in test mode, no mutations happen
- Graceful shutdown: `SIGINT`/`SIGTERM` handlers close browser and kill zombie Chrome processes
- Periodic cleanup: `setInterval` every 30 minutes calls `cleanupChromeProcesses()`

**Rejection reasons** (returned by `isEligibleForApplication`):
- `WO_IN_PAST` — start time already passed
- `MODE_DISABLED` — application mode is disabled
- `POLICY_REJECTED` — company not allowed under current mode
- `OUTSIDE_WORKING_HOURS` — job outside configured 10:00–20:00 ET window
- `PAYMENT_BELOW_MINIMUM` — hard reject, no counter offered
- `PAYMENT_INSUFFICIENT` — rate too low, counter offered if `IS_COUNTER_RATES=true`
- `TRAVEL_REQUIRED` — distance exceeds threshold, counter with travel expense
- `COUNTER_DATES` — calendar conflict, counter with alternative slot
- `SLOT_UNAVAILABLE` — no fit found and counter dates disabled
- `UNKNOWN_PLATFORM` — unrecognized platform string

---

## Anti-Patterns

### Hardcoded Credentials in Login Files

**What happens:** Email/password for FieldNation and WorkMarket are stored directly in `utils/FieldNation/loginFnAuto.js` and `utils/WorkMarket/loginWMAuto.js` rather than read from env vars.
**Why it's wrong:** Credentials get committed to git; changing them requires code edits.
**Do this instead:** Read from `process.env.FN_EMAIL`, `process.env.FN_PASSWORD`, etc., matching the pattern used for `TELEGRAM_BOT_TOKEN`.

### Synchronous Cookie File Reads in Hot Path

**What happens:** `getFNorderData.js` and `postFNCounterOffer.js` use `fs.readFileSync()` inside every request to read cookies.
**Why it's wrong:** Blocks the event loop on every order processed.
**Do this instead:** Cache the parsed cookie string in module scope, invalidating on cookie refresh.

### Polling at 1000ms with No Backoff

**What happens:** `periodicCheck()` fires every 1 second unconditionally regardless of Gmail API quota.
**Why it's wrong:** Will exhaust Gmail API quota; no exponential backoff on errors.
**Do this instead:** Use a minimum 5-second interval with exponential backoff on API errors.
