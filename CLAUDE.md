# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: FieldOps Automator (fn-asistant-ai)

An intelligent, autonomous agent that monitors FieldNation and WorkMarket platforms for work orders, extracts job data via Puppeteer web scraping, applies complex business logic to evaluate profitability, and automatically submits applications or counter-offers based on rates, travel distance, calendar availability, and company policy.

## Commands

### Development & Running
- **Start the agent**: `npm start` or `npm run dev`
  - Launches Express server on port 3001 with REST API
  - Auto-starts job monitoring via Gmail API polling
  - Initializes Telegram bot for notifications and remote control
  - Puppeteer browser instances auto-initialize on first cookie save

- **Run tests**: `npm test`
  - Uses Node.js native test runner (`node --test`)
  - Test file: `tests/replay-policy.test.js`
  - Tests evaluate application policy against replay job data

### UI Development
From `/ui` directory:
- `npm run dev` - Vite dev server for React dashboard (usually port 5173)
- `npm run build` - Optimize production build
- `npm run lint` - ESLint code quality checks
- `npm run preview` - Preview production build locally

### Debugging
- Check `/logs/logs.json` for recent events (streamed from Express API)
- Check `/logs/app-YYYY-MM-DD.log` for detailed application logs
- Dashboard at `http://localhost:3001` shows real-time event history with status indicators
- Use `CONFIG.TEST_MODE = true` in `config.js` to test logic without real submissions

## Architecture

### Core Application Flow

```
1. MONITORING LOOP (periodic email check every 1000ms via Gmail API)
   ↓
2. ORDER EXTRACTION (parse email → extract work order link)
   ↓
3. DATA COLLECTION (Puppeteer fetches order details from FieldNation/WorkMarket)
   ↓
4. ELIGIBILITY EVALUATION (isEligibleForApplication.js)
   ├─ Company policy check (granite_only / all_companies / disabled)
   ├─ Working hours validation (9-18 ET by default)
   ├─ Payment eligibility (minimum thresholds per platform)
   ├─ Calendar conflict detection (Google Calendar API)
   └─ Counter-offer generation (rates, travel, alternative dates)
   ↓
5. ACTION EXECUTION
   ├─ Direct application (if eligible)
   ├─ Counter-offer submission (if rates/dates don't match)
   └─ Rejection with logging (if policy prevents action)
   ↓
6. NOTIFICATION (Telegram bot updates + dashboard event log)
```

### Key Directory Structure

```
├── index.js                          # Main entry point: Express server + monitoring loop
├── config.js                         # Global CONFIG object (rates, thresholds, flags)
├── utils/
│   ├── isEligibleForApplication.js   # Core eligibility/counter-offer logic
│   ├── logger.js                     # File-based logging (logs/app-*.log)
│   ├── normalizedDateFromWO.js       # Normalize work order data structure
│   ├── saveReplay.js                 # Archive evaluated orders to jobs-replay.json
│   ├── FieldNation/
│   │   ├── loginFnAuto.js            # Automated FieldNation login (2FA-aware)
│   │   ├── getFNorderData.js         # Puppeteer scraper for FieldNation order details
│   │   ├── postFNworkOrderRequest.js # Submit direct application
│   │   └── postFNCounterOffer.js     # Submit counter-offer with custom rates/travel
│   ├── WorkMarket/
│   │   ├── loginWMAuto.js            # Automated WorkMarket login (2FA-aware)
│   │   ├── getWMorderData.js         # Puppeteer scraper for WorkMarket order details
│   │   ├── postWMworkOrderRequest.js # Submit direct application
│   │   └── postWMCounterOffer.js     # Submit counter-offer with rescheduling option
│   ├── availability/
│   │   ├── getAvailableBlocks.js     # Compute free time slots from Google Calendar
│   │   ├── findFitBlock.js           # Find next available slot matching duration
│   │   └── decideFitAction.js        # Determine if job fits without rescheduling
│   ├── gmail/
│   │   ├── login.js                  # Google OAuth2 authorization
│   │   ├── getLastUnreadEmail.js     # Poll Gmail for unread work order emails
│   │   ├── getOrderLink.js           # Extract FieldNation/WorkMarket link from email body
│   │   └── getFNcode.js              # Retrieve 2FA codes from Gmail for login
│   └── telegram/
│       └── telegramBot.js            # Telegram bot service (notifications + remote control)
├── ui/                               # React dashboard (Vite)
│   └── src/
│       ├── App.jsx                   # Main dashboard layout
│       └── components/Dashboard.jsx  # Event list, config editor, control buttons
└── config/credentials.json           # Google OAuth2 credentials (pre-authorized)
```

### Data Flow: Work Order Evaluation

**Input** (normalized work order object):
```javascript
{
  id: "123456",
  platform: "FieldNation" | "WorkMarket",
  company: "Granite Telecommunications",
  title: "Fiber Installation",
  payType: "hourly" | "fixed",
  hourlyRate: 50,                    // for hourly jobs
  payRange: { min: 100, max: 200 }, // for fixed-rate jobs
  estLaborHours: 4,
  distance: 25,
  time: {
    start: "2025-05-20T14:00:00Z",
    end: "2025-05-20T18:00:00Z"
  }
}
```

**Decision Logic** (isEligibleForApplication.js):
1. **Policy Check**: Granite-only mode rejects non-Granite unless on override date
2. **Working Hours**: 9-18 ET (configurable). Outside hours → counter with available slot
3. **Payment Check**: Minimum threshold ($150 FN, $100 WM by default)
   - If below threshold and `IS_COUNTER_RATES=true` → counter with BASE_HOURLY_RATE
   - If below threshold and `IS_COUNTER_RATES=false` → apply with source rate (Granite priority)
4. **Calendar Conflict**: Check Google Calendar for time slot availability
   - Conflict → counter with next available date/time (unless `IS_COUNTER_DATES=false`)
   - No conflict → proceed with application
5. **Travel Expenses**: Always add `distance × $1.25/mile` (min $30) to any counter-offer

**Output**:
```javascript
{
  eligible: true | false,
  reason: "DIRECT_APPLY" | "COUNTER_RATES" | "COUNTER_DATES" | "REJECTED_POLICY" | ...,
  counterOffer: {
    payType: "hourly",
    counterRate: 65,      // adjusted hourly rate
    baseAmount: 260,      // hourly: rate × hours | fixed: recalculated amount
    estHours: 4,
    travelExpense: 32,    // distance × $1.25, minimum $30
    counterDate: {        // if date conflict, alternative slot
      start: Date,
      end: Date,
      durationMinutes: 240
    }
  }
}
```

### Configuration System (config.js)

The `CONFIG` object is the single source of truth for agent behavior:

**Feature Flags**:
- `TEST_MODE`: When true, all actions are logged but NOT executed (safe testing)
- `FIELDNATION_ENABLED` / `WORKMARKET_ENABLED`: Toggle platforms on/off
- `APPLICATION_MODE`: `"granite_only"` | `"all_companies"` | `"disabled"`
- `IS_COUNTER_DATES`: Enable/disable counter-offers for schedule conflicts
- `IS_COUNTER_RATES`: Enable/disable rate adjustment in counter-offers
- `ENFORCE_MIN_PAYMENT`: When false, accept any pay amount

**Dynamic Config**: The `/api/config` POST endpoint allows live runtime changes without restart (useful for dashboard override)

### Browser Automation & Session Management

**Puppeteer Setup** (index.js `saveCookies()` function):
- Launches headless Chrome with evasion flags to bypass anti-bot detection
- Incognito mode enabled to prevent stale cookie conflicts
- Shadow DOM support enabled (`--enable-experimental-web-platform-features`)
- Sandbox disabled for Linux/Docker compatibility

**Cookie Lifecycle**:
- Cookies auto-saved after successful login to platform-specific directories
- 4-hour strict rotation: `scheduleRelogin()` triggers full re-login every 4 hours
- On-demand refresh: If WorkMarket data looks corrupted (missing company/title/payment), trigger immediate re-login with retry
- Prevents concurrent refresh attempts via `isRefreshingCookies` flag

**Session Recovery**:
- Detects invalid WorkMarket data via `isInvalidWorkMarketData()` heuristic
- Waits up to 60 seconds for concurrent refresh to complete before retrying
- Falls back gracefully if refresh fails (logs error, notifies Telegram, skips job)

### Telegram Bot Integration

**Notifications Sent**:
- Order applied successfully (with pay/distance details)
- Counter-offer submitted (with rate/date adjustments)
- Job rejected (with reason: working hours, calendar conflict, policy, etc.)
- System errors (login failures, network issues)

**Remote Commands** (via `/` prefix):
- `/start` - Begin monitoring
- `/stop` - Pause monitoring
- `/status` - Show current config + monitoring state
- `/help` - List all commands
- `/relogin` - Force immediate cookie refresh
- `/process <link>` - Manually process a specific work order URL

**Phone Alert Webhook** (`/api/phone-alert` POST):
- Macrodroid can send phone notifications to trigger agent actions
- Deduplicates alerts within 5-minute window to prevent repeat processing

### Test & Replay System

**Test Mode** (`CONFIG.TEST_MODE = true`):
- All POST requests are blocked (applications/counter-offers not submitted)
- Logic still executes completely (evaluation, eligibility checks)
- Events logged to dashboard with "TEST:" prefix
- Allows safe validation of new rules without real-world impact

**Replay Data** (`jobs-replay.json`):
- NDJSON file (one job per line) of evaluated work orders
- Used by `tests/replay-policy.test.js` to validate policy logic
- Captured from real orders via `saveReplay()` in `index.js`
- Useful for regression testing after config changes

## Important Guidelines for Future Development

### Business Logic Rules (from user-stories.md)

1. **Rate Handling**:
   - Hourly jobs: If `IS_COUNTER_RATES=true`, counter to `BASE_HOURLY_RATE`. Otherwise, apply with source rate.
   - Fixed-rate jobs: If `IS_COUNTER_RATES=true`, counter to `BASE_HOURLY_RATE × estLaborHours`. Otherwise, apply with source rate.
   - For Granite jobs, rate adjustment is always preferred over rejection.

2. **Travel Expenses**:
   - Always calculate: `distance × $1.25/mile`, minimum $30
   - Add to counter-offer regardless of `IS_COUNTER_RATES` setting
   - Distance is a first-class counter reason (can counter on travel alone)

3. **Calendar Conflict Handling**:
   - Never reject Granite due to calendar conflict if `IS_COUNTER_DATES=true`
   - Counter with next available date/time in 9-18 ET window
   - Counter date must be >= original requested date (never suggest earlier time)
   - Still apply rate/travel adjustments in the counter-offer

4. **Company Policy**:
   - `granite_only` mode (default): Only apply to "Granite Telecommunications" (case-insensitive)
   - `all_companies` mode: Apply to any company
   - `ALLOW_ALL_COMPANIES_ON_DATES`: Array of YYYY-MM-DD dates that override granite_only for specific days
   - Stop-word filtering: Check job title/description against platform-specific lists (not yet implemented)

### Error Handling & Self-Healing

- **No crash on bad data**: If Puppeteer scraping fails or returns incomplete data, gracefully skip the job
- **Retry with fresh cookies**: On WorkMarket, detect auth loss via data quality (missing company/title/payment) and auto-retry
- **Prevent cascade failures**: Use timeouts and flags to ensure only one cookie refresh at a time
- **Graceful shutdown**: Cleanup zombie Chrome processes via `cleanupChromeProcesses()` on SIGINT/SIGTERM

### Code Standards

- **ES Modules**: Project uses `"type": "module"` in package.json. Always use `.js` extensions in imports.
- **Async/await**: Consistent use across the codebase. Use `.catch()` for non-critical failures.
- **Logging**: Use `logger.info()`, `logger.error()` for application logs. Use `pushEvent()` in index.js for dashboard events.
- **Config consistency**: Never hardcode thresholds. Always reference `CONFIG` object.
- **Test mode safety**: All platform mutations (POST requests) must check `if (CONFIG.TEST_MODE)` before execution.

### When Modifying Core Logic

1. **Eligibility changes**: Edit `utils/isEligibleForApplication.js`
2. **Platform-specific actions**: Edit respective `utils/FieldNation/` or `utils/WorkMarket/` files
3. **New notifications**: Extend `utils/telegram/telegramBot.js`
4. **Rate/threshold changes**: Update `config.js` and re-run `npm test`
5. **Dashboard changes**: Modify `ui/src/components/Dashboard.jsx`

### Security Considerations

- Credentials are pre-stored (`config/credentials.json` for Google OAuth2, env vars for Telegram/platform accounts)
- `TEST_MODE` should be the default to prevent accidental real submissions during development
- Cookie storage is platform-specific in local directories (check `.gitignore`)
- Email/password are hardcoded in login functions (should be moved to env vars in production)

## Related Documentation

See also:
- `README.md` - High-level feature overview
- `user-stories.md` - Acceptance criteria and decision matrix for Granite-only mode
- `AGENTS.md` - Additional agent-focused development guidelines
- `config.js` - Complete configuration reference with inline documentation
