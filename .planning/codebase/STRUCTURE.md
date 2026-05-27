# Codebase Structure
_Last updated: 2026-05-27_

## Summary

The project is a single-process Node.js agent (ES Modules, `"type": "module"`) with a flat `utils/` tree organized by concern (platform, availability, Gmail, Telegram). The React dashboard lives in a standalone `ui/` subdirectory with its own `package.json`. All runtime artifacts (cookies, logs, replay data) are written to well-known paths relative to the project root.

---

## Directory Layout

```
fn-asistant-ai/
├── index.js                        # Main entry: Express server + monitoring orchestrator
├── config.js                       # Global CONFIG object — single source of truth
├── package.json                    # Node.js manifest (ES Modules, no build step)
├── jobs-replay.json                # NDJSON replay archive (one evaluated order per line)
│
├── utils/
│   ├── isEligibleForApplication.js # Core eligibility + counter-offer decision engine
│   ├── normalizedDateFromWO.js     # Normalize raw platform data to canonical structure
│   ├── logger.js                   # Daily rotating file logger (logs/app-YYYY-MM-DD.log)
│   ├── saveReplay.js               # Append evaluated orders to jobs-replay.json
│   ├── playSound.js                # macOS afplay wrapper for audio notifications
│   ├── saveCookies.js              # (legacy stub) — session logic lives in index.js
│   │
│   ├── FieldNation/
│   │   ├── cookies.json            # Persisted FN session cookies (gitignored)
│   │   ├── getFNorderData.js       # Cookie-authenticated HTTP fetch + HTML parse
│   │   ├── loginFnAuto.js          # Puppeteer-based automated FN login (2FA-aware)
│   │   ├── loginToFieldNation.js   # (legacy) manual login helper
│   │   ├── postFNworkOrderRequest.js # REST POST: direct application
│   │   ├── postFNCounterOffer.js   # REST POST: counter-offer with rates + travel
│   │   └── sendWorkOrderMessage.js # REST POST: follow-up message after application
│   │
│   ├── WorkMarket/
│   │   ├── autoCookies.json        # Auto-saved WM session cookies (gitignored)
│   │   ├── cookies.json            # Manual WM session cookies fallback (gitignored)
│   │   ├── error-cookies.json      # Debug artifact from failed sessions
│   │   ├── getWMorderData.js       # Cookie-authenticated HTTP fetch + HTML parse
│   │   ├── getWMAssignments.js     # Puppeteer-scrape active WM assignments (5-min cache)
│   │   ├── loginWMAuto.js          # Puppeteer-based automated WM login (2FA-aware)
│   │   ├── loginToWorkMarket.js    # (legacy) manual login helper
│   │   ├── postWMworkOrderRequest.js # REST POST: direct application
│   │   ├── postWMCounterOffer.js   # REST POST: counter-offer with optional reschedule
│   │   ├── getWMcode.js            # Gmail 2FA code retrieval for WM login
│   │   └── testCounteroffer.js     # (dev script) manual counter-offer test
│   │
│   ├── availability/
│   │   ├── index.js                # Re-exports availability utilities
│   │   ├── getAvailableBlocks.js   # Merge Calendar + WM busy → free blocks
│   │   ├── fetchCalendarBusy.js    # Google Calendar API: all calendars busy blocks
│   │   ├── fetchWMBusy.js          # WM assignments → busy blocks (wraps getWMAssignments)
│   │   ├── findFitBlock.js         # Match job duration+travel into a free block
│   │   ├── decideFitAction.js      # APPLY / COUNTER_DATES / NO_FIT from fit results
│   │   └── testAvialibility.js     # (dev script) manual availability test runner
│   │
│   ├── gmail/
│   │   ├── login.js                # Google OAuth2 authorization (credentials + token)
│   │   ├── getLastUnreadEmail.js   # Gmail API: fetch + mark-read latest unread email
│   │   ├── getOrderLink.js         # Regex extract FN/WM URL from email body
│   │   ├── getFNcode.js            # Gmail search for FieldNation 2FA email
│   │   ├── googleCalendarEvents.js # (dev script) calendar event viewer
│   │   └── script.js               # (dev script) Gmail exploration utility
│   │
│   └── telegram/
│       └── telegramBot.js          # Dual-bot: outbound notifications + inbound commands
│
├── config/
│   ├── credentials.json            # Google OAuth2 client credentials (gitignored)
│   └── token.json                  # Google OAuth2 access+refresh tokens (gitignored)
│
├── logs/
│   ├── logs.json                   # Dashboard event history (max 50 events, JSON array)
│   ├── server-console.log          # (optional) redirected stdout
│   └── app-YYYY-MM-DD.log          # Daily rotating application logs
│
├── tests/
│   ├── replay-policy.test.js       # Policy + counter-offer tests using jobs-replay.json
│   ├── eligibility/                # (expanding) eligibility unit tests
│   ├── integration/                # (expanding) integration tests
│   ├── mocks/                      # Test mock data
│   └── utils/                      # Test helper utilities
│
├── scripts/
│   ├── check-gmail-auth.mjs        # One-shot OAuth2 auth verification
│   ├── view-calendar-events.js     # Debug script: print upcoming calendar events
│   └── view-wm-google-calendar-schedule.js  # Debug: compare WM schedule vs calendar
│
├── ui/                             # React dashboard (standalone Vite project)
│   ├── package.json                # UI dependencies (React, Tailwind, shadcn/ui, Lucide)
│   ├── vite.config.js              # Vite dev server config (proxies /api to :3001)
│   ├── src/
│   │   ├── main.jsx                # React entry point
│   │   ├── App.jsx                 # Root layout
│   │   ├── App.css                 # Global styles
│   │   ├── index.css               # Tailwind base imports
│   │   ├── lib/utils.js            # shadcn/ui cn() helper
│   │   └── components/
│   │       └── Dashboard.jsx       # Full dashboard: event log, config editor, controls
│   └── ...
│
├── .env                            # Runtime secrets (Telegram tokens, platform credentials)
├── .gitignore
└── CLAUDE.md                       # Project guidelines for AI assistants
```

---

## Module Organization Principles

**By platform:** Platform-specific scrapers, login, and submission code are co-located in `utils/FieldNation/` and `utils/WorkMarket/`. Each directory is self-contained for its platform.

**By concern (cross-platform):** Availability checking (`utils/availability/`), Gmail integration (`utils/gmail/`), and notifications (`utils/telegram/`) are separated by functional concern.

**Orchestration at the top:** `index.js` imports from all `utils/` subdirectories and owns the main event loop. It is the only file that calls `pushEvent()`, `applyForJob()`, and `saveReplay()` in sequence.

**Config as global singleton:** `config.js` exports `CONFIG` as a named export. All utility files import it directly. The object is mutated in place by `POST /api/config` — no config is passed as function arguments through the call stack.

---

## Key File Roles

| File | Role |
|------|------|
| `index.js` | Single entry point; owns Express routes, monitoring loop, cookie refresh orchestration, graceful shutdown |
| `config.js` | All configurable thresholds and feature flags; directly mutated at runtime |
| `utils/isEligibleForApplication.js` | All business logic; the only file to call `getAvailableBlocks`, `findFitBlock`, `decideFitAction`, `calculateCounterOffer` |
| `utils/normalizedDateFromWO.js` | Data normalization boundary; raw platform objects enter, canonical objects exit |
| `utils/availability/getAvailableBlocks.js` | Merges Google Calendar + WM assignments busy blocks into free slots |
| `utils/telegram/telegramBot.js` | Singleton service class; callback hooks (`onStartMonitoring`, `onProcessOrder`, etc.) set by `index.js` |
| `jobs-replay.json` | NDJSON test fixture; read by `tests/replay-policy.test.js` |
| `logs/logs.json` | JSON array of up to 50 recent events; polled by dashboard every few seconds |

---

## Naming Conventions

**Files:**
- camelCase for utility modules: `getLastUnreadEmail.js`, `normalizedDateFromWO.js`
- camelCase for platform modules: `getFNorderData.js`, `postWMCounterOffer.js`
- PascalCase for class modules: `telegramBot.js` (exports a class instance)
- `test*.js` prefix for standalone dev/debug scripts (not picked up by test runner)
- `*.test.js` suffix for test runner files

**Directories:**
- PascalCase for platform namespaces: `FieldNation/`, `WorkMarket/`
- lowercase for concern namespaces: `availability/`, `gmail/`, `telegram/`

**Functions:**
- `get*` prefix for data fetching: `getFNorderData`, `getLastUnreadEmail`, `getAvailableBlocks`
- `post*` prefix for mutations: `postFNCounterOffer`, `postWMworkOrderRequest`
- `login*Auto` for automated login: `loginFnAuto`, `loginWMAuto`
- `fetch*` for external API calls: `fetchCalendarBusy`, `fetchWMBusy`
- `is*` / `has*` for boolean checks: `isEligibleForApplication`, `isInvalidWorkMarketData`

---

## Where to Add New Code

**New eligibility rule:**
- Edit: `utils/isEligibleForApplication.js` — add check in `isEligibleForApplication()` function
- Add new rejection reason string to the switch in `index.js:1181`
- Add test case in `tests/replay-policy.test.js`

**New platform support:**
- Create: `utils/NewPlatform/` directory with `getOrderData.js`, `login.js`, `postWorkOrderRequest.js`, `postCounterOffer.js`
- Add `cookies.json` path constant in each file
- Register in `index.js`: `determinePlatform()`, `processOrder()`, `applyForJob()`
- Add `NEW_PLATFORM_ENABLED` flag to `config.js`

**New REST API endpoint:**
- Add route in `index.js` after line 156 (existing API routes section)
- Use `pushEvent()` to surface results to the dashboard

**New Telegram command:**
- Add to `utils/telegram/telegramBot.js` in the `setupCommands()` method
- If it needs orchestrator functions, add a callback hook like `telegramBot.onNewCommand = handler` and wire it in `index.js:1243`

**New availability data source (busy blocks):**
- Create: `utils/availability/fetchXyzBusy.js` returning `Array<{ start: Date, end: Date }>`
- Import in `utils/availability/getAvailableBlocks.js` and merge into `allBusyBlocks`

**New test:**
- Place in `tests/` with `.test.js` suffix
- Use `jobs-replay.json` entries via `findReplayJob()` helper pattern from `tests/replay-policy.test.js`
- Run with `npm test` (Node.js native test runner)

**Dashboard UI change:**
- Edit: `ui/src/components/Dashboard.jsx` (single component file for the entire dashboard)
- API calls use `API_BASE = http://{hostname}:3001/api`

---

## Special Directories

**`config/`:**
- Purpose: Google OAuth2 credentials and tokens
- Generated: `token.json` is generated on first `authorize()` call
- Committed: No — both files are gitignored (contain secrets)

**`logs/`:**
- Purpose: Runtime log output and dashboard event cache
- Generated: Yes — created automatically by `Logger` constructor
- Committed: No — gitignored

**`utils/FieldNation/` and `utils/WorkMarket/` (cookie files):**
- Purpose: Persisted Puppeteer session cookies
- Generated: Yes — written by login automation
- Committed: No — gitignored

**`.planning/codebase/`:**
- Purpose: Architecture and convention reference documents for AI-assisted development
- Generated: Yes — written by codebase mapping agent
- Committed: Yes

**`ui/node_modules/`:**
- Purpose: React dashboard dependencies (separate from backend)
- Committed: No
