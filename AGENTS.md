# Agent Instructions for FieldOps Automator (fn-asistant-ai)

## Project Overview
FieldOps Automator is an autonomous bot built using Node.js to monitor, analyze, apply to, and counter work orders on contracting platforms (**FieldNation** and **WorkMarket**). It listens for new work order emails via the Gmail API (or phone alert webhooks), extracts order data, applies business logic (distance, rates, schedule availability across multiple calendars, lead-time horizon tiers), and automatically submits applications or counter-offers.

## Tech Stack
*   **Runtime**: Node.js (ES Modules, `"type": "module"`)
*   **FieldNation Integration**: Direct JSON REST API v2 (`/v2/workorders/:id`) using session cookies for fetching order data, applying, and countering; Puppeteer with evasion flags used for automated 2FA browser logins.
*   **WorkMarket Integration**: Web scraping / DOM extraction with active session health probing; form-based HTTP POST submissions for applications and counter-offers; Puppeteer for automated 2FA browser logins.
*   **Server**: Express (dashboard & API endpoints on port 3001)
*   **APIs**: Google Gmail API (order email polling and 2FA extraction), Google Calendar API (primary schedule busy checks), FieldNation iCal Feed, Node Telegram Bot API
*   **UI Dashboard**: React + Vite in `/ui`

## Commands
*   **Start Agent**: `npm start` or `npm run dev`
*   **Run Process Supervisor (Watchdog)**: `npm run supervised` (runs `scripts/watchdog.js` with crash-recovery backoff loop)
*   **Run Automated Test Suite**: `npm test` (executes all 12+ test files via Node native test runner: `node --test tests/*.test.js`)
*   **UI Development**:
    *   `cd ui && npm run dev` - Vite dev server (port 5173)
    *   `cd ui && npm run build` - Production bundle build

## Key Architecture & Components
*   `index.js`: Main entry point. Initializes Express server, global state, Gmail polling loop, WorkMarket session probe, order dispatcher, and event stream.
*   `config.js`: Global `CONFIG` object containing rates, thresholds, lead-time strategy tiers, distance formulas, platform toggles, and `TEST_MODE`.
*   `utils/isEligibleForApplication.js`: Core business logic evaluating company policy, working hours, payment eligibility, distance/travel, calendar fit, and counter-offer generation.
*   `utils/strategy/leadTimeStrategy.js`: Lead-time horizon tiers (`LEAD_TIME_TIERS`), Granite priority exemption (`isGranitePremium`), and advance counter date-slippage guards (`shouldSkipAdvanceCounter`).
*   `utils/cookieStore.js`: Atomic, thread-safe cookie persistence, session URL scoping, and validation.
*   `utils/FieldNation/`:
    *   `getFNorderData.js`: Direct JSON API v2 fetch with cookie authentication.
    *   `postFNworkOrderRequest.js`: Direct application submission via API.
    *   `postFNCounterOffer.js`: Counter-offer submission (hourly, fixed, or blended shape with local wall-clock service windows).
    *   `loginFnAuto.js`: Automated Puppeteer login with Gmail 2FA code extraction.
*   `utils/WorkMarket/`:
    *   `getWMorderData.js`: Scrapes order data while verifying authenticated page vs dead/bare SPA shell.
    *   `postWMworkOrderRequest.js`: WorkMarket application submission.
    *   `postWMCounterOffer.js`: Counter-offer submission with rate, hours, travel expenses, and schedule negotiation.
    *   `loginWMAuto.js`: Automated Puppeteer login with 2FA handling.
*   `utils/availability/`: Multi-source calendar aggregator:
    *   `getAvailableBlocks.js`: Computes free blocks within configured working hours.
    *   `fetchCalendarBusy.js`: Google Calendar API busy events.
    *   `fetchFNBusy.js`: FieldNation live iCal feed busy events (`CALENDAR_FEED_URL`).
    *   `fetchWMBusy.js`: WorkMarket assigned tickets (`WORKMARKET_SCHEDULE_CHECK_ENABLED`).
    *   `findFitBlock.js`: Fits job duration + travel time into free windows.
    *   `decideFitAction.js`: Proposes exact fit or shifted counter start interval.
*   `utils/telegram/telegramBot.js`: Telegram service for notifications and remote commands (`/start`, `/stop`, `/status`, `/relogin`, `/process`).
*   `scripts/watchdog.js`: Supervised process runner handling automatic restarts with exponential backoff.

## Business Logic & Evaluation Rules

### 1. Application Policy
*   `CONFIG.APPLICATION_MODE`:
    *   `"all_companies"` (default): Accepts orders from any company.
    *   `"granite_only"`: Only accepts "Granite Telecommunications", unless date is in `ALLOW_ALL_COMPANIES_ON_DATES`.
    *   `"disabled"`: Blocks all applications.

### 2. Working Hours
*   `CONFIG.TIME.WORK_START_TIME` (default `"9:00"`) to `CONFIG.TIME.WORK_END_TIME` (default `"20:00"`).
*   Work order start times must overlap the working hours window; if outside and `IS_COUNTER_DATES: true`, the bot proposes an in-hours counter slot.

### 3. Payment & Counter Logic (Rule 1 & Rule 2)
*   **Rule 1 (Minimum Pay Floor)**:
    *   When `IS_COUNTER_RATES` is enabled on hourly jobs, Rule 1 checks the order's **potential total at our base rate** (`Math.max(theirRate, baseRate) * estHours`).
    *   If `potentialTotal < minTotal`, the job is **auto-rejected without counter** (avoids wasting counters on sub-$100 low-ball junk that never converts).
    *   If `potentialTotal >= minTotal` (e.g. Granite 3h @ $50/hr = $150 offered, but at our $65/hr rate = $195 >= $180), Rule 1 passes!
*   **Rule 2 (Rate Counter)**:
    *   If offered rate is below base rate ($60/hr FN, $65/hr WM), Rule 2 triggers a counter offer at base rate.
*   **Blended Work Orders**:
    *   Evaluates base and additional rates separately against base rate. Counter offers preserve the buyer's blended shape (base units + additional units) while adjusting component rates.
*   **Granite Priority**:
    *   Granite orders with rate >= $65/hr or title containing "epik" qualify as Granite priority (`isGranitePremium`) and bypass advance lead-time minimums. Duration >= 3 hours also qualifies when `IS_COUNTER_RATES` is enabled.

### 4. Lead-Time Booking Strategy
*   Controlled by `CONFIG.STRATEGY.ENABLED` and `LEAD_TIME_TIERS`:
    *   **Near-term (\(\le\) 36h)**: Minimum pay floor (e.g. $180).
    *   **Mid-range (36h to 168h / 7 days)**: Higher floor (e.g. $250) to keep days open for valuable work.
    *   **Far advance (7+ days)**: High project threshold (e.g. $350) to keep future weeks 100% open for full-day rollouts and multi-day projects.
*   **Date-Slippage Guard (`shouldSkipAdvanceCounter`)**:
    *   If a schedule conflict counters a near-term job to a later calendar day, re-evaluates effective pay against the counter date's lead-time tier. Blocks small jobs from slipping into advance days.

### 5. Distance & Travel Fees
*   `effectiveDistance = reportedDistance + CONFIG.DISTANCE.DISTANCE_PADDING_MILES` (10 mi traffic padding).
*   If `effectiveDistance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES` (20 mi), travel compensation is required:
    $$\text{travelExpense} = \lceil (\text{effectiveDistance} \times \$1.25) / 5 \rceil \times 5$$
*   Travel expense is attached as an explicit expense line on FieldNation or additional expenses on WorkMarket.

## State Management & Browser Resilience
*   **4-Hour Cookie Rotation**: `scheduleRelogin()` triggers automated re-login every 4 hours.
*   **WorkMarket Session Health Probe**: `WM_SESSION_PROBE_MINUTES: 10` probes WM session validity between orders, triggering proactive re-logins before orders arrive.
*   **Anti-Bot Evasion**: Puppeteer launches with incognito mode, experimental web platform features, and stealth arguments. Do NOT remove evasion flags.
*   **Process Cleanup**: `cleanupChromeProcesses()` runs on shutdown to terminate zombie Chrome instances.

## Testing & Test Mode (`CONFIG.TEST_MODE`)
*   When `CONFIG.TEST_MODE === true`, all mutations (POST requests to FN and WM) are intercepted and simulated with `pushEvent({ status: 'info', message: 'TEST...' })`.
*   Always ensure `TEST_MODE` safety when running automated or manual tests that trigger application or counter pipelines.

## Git Workflow (Mandatory Rules for AI Agents)
1.  **Dedicated Branch**: For every user task requiring repository changes, create a new, dedicated branch from the current working branch (`HEAD`) before editing. Preserve its commits and all uncommitted changes. Do not switch to or branch from `dev` unless the user explicitly requests it. Use a short descriptive branch name with the `codex/` prefix (e.g., `codex/feature-name`), and do not reuse the branch for unrelated work. If the user explicitly asks to consolidate changes into the current branch, stay on that branch.
2.  **No Extra Worktrees**: Never create or use an additional Git worktree unless explicitly requested. Work in the main checkout so local dependencies and credentials remain available.
3.  **Preserve Working Changes**: Inspect the worktree before creating the branch. Preserve all existing user changes and never stage, commit, or discard unrelated files.
4.  **Rigorous Testing**: Test every change in proportion to its risk. Run `npm test` before presenting work; use `CONFIG.TEST_MODE` whenever a test could submit data.
5.  **No commit**: Do not do commit until user ask you about it
6.  **User Review Before Push**: Present completed changes and test results for user review. Do NOT push the branch or create a pull request until the user explicitly approves.
7.  **PR Targets `dev`**: After approval, push the task branch and create a PR targeting `dev` as the base branch.
8.  **No Merging**: Never merge branches locally and never merge a pull request. Leave all merge decisions to the repository owner.
