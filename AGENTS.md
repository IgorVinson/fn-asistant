# Agent Instructions for FieldOps Automator (fn-asistant-ai)

## Project Overview
This project is an autonomous bot built using Node.js and Puppeteer to monitor, analyze, and apply to/counter work orders on contracting platforms (FieldNation and WorkMarket). It utilizes the Gmail API to listen for new work order emails, parses the links, extracts data via Puppeteer, applies business logic (distance, rates, schedules), and submits applications or counter-offers accordingly.

## Tech Stack
*   **Runtime**: Node.js
*   **Browser Automation**: Puppeteer (stealthy headless mode)
*   **Web Scraping**: Cheerio
*   **Server**: Express (for exposing a dashboard/API endpoint on port 3001)
*   **APIs**: Google Gmail API, Node Telegram Bot API

## Key Components
*   `index.js`: The main entry point. Sets up Express, handles global state, configures Puppeteer instances, triggers Gmail API polling, and runs the evaluation logic.
*   `utils/isEligibleForApplication.js`: Core business logic predicting profitability, travel distance, assessing calendar slots, and generating counter-offers if the pay doesn't meet minimum thresholds.
*   `utils/FieldNation/` & `utils/WorkMarket/`: Platform-specific scripts for logging in (`loginFnAuto.js`, `loginWMAuto.js`), scraping data, applying, and countering.
*   `config.js`: Global configuration state containing limits, thresholds, rates, user overrides, and `TEST_MODE`.
*   `utils/telegram/telegramBot.js`: Handles system communication, notifications, and remote overrides.

## Important Guidelines for AI Agents

1. **State Management & Browser Resilience**:
   - The app relies on persistent and automated Puppeteer browser sessions with built-in cookie lifecycle management indicating a 4-hour strict rotation (`scheduleRelogin`). Ensure `cleanupChromeProcesses` is used during graceful shutdowns to prevent zombie chrome processes.
   - Puppeteer is launched with specific configuration flags for incognito, evasion, and canvas/shadow DOM support. Do NOT modify or remove these evasion flags without deep understanding.

2. **Business Logic Rules (from `user-stories.md`)**:
   - **Hourly**: If WO is hourly and `is_counter_rates` = true, counter with hourly rate. If false, counter with the source rate.
   - **Fixed Rate**: Counter with source fixed rate. However, if `is_counter_rates` = true, the counter should be computed as (`BASE_HOURLY_RATE` * labor hours). Platform base rates may differ.
   - **Travel Expenses**: Always verify and apply travel expenses regardless of the `is_counter_rates` setting.
   - **Time & Scheduling**: Check for slot availability using time blocks rather than direct conflict checks to optimize for multiple short jobs in a day (e.g., 9-13, 14-18). Never counter with a date earlier than what is in the original WO.

3. **Data Fetching & Error Handling**:
   - The app is designed to "self-heal". For example, if WorkMarket returns heavily corrupted data indicative of session loss (`isInvalidWorkMarketData`), there is a retry mechanism to force a relogin and fetch again. Maintain and extend these recovery loops.
   - Do NOT throw unhandled exceptions in the processing pipeline if an order is scraped incorrectly—gracefully skip or retry the order to prevent crashing the global monitoring loop.

4. **Testing & Test Mode**:
   - The system uses a global `CONFIG.TEST_MODE`. When modifying any file that POSTs data to WorkMarket or FieldNation, always ensure `TEST_MODE` blocks the final execution and outputs a `test` telemetry response instead.
   - Example pattern: `if (CONFIG.TEST_MODE) { pushEvent({status:'info', message:'TEST...'}); return; }`

5. **Code Standards**:
   - ES Modules (`"type": "module"`). Remember to include the `.js` extension in all imports.
   - Keep asynchronous flows organized; utilize timeouts locally to wait for elements when using Puppeteer.

6. **Git Workflow**:
   - For every user task that requires repository changes, create a new, dedicated branch from `dev` before editing. Use a short descriptive branch name with the `codex/` prefix, and do not reuse the branch for unrelated work.
   - Check the worktree before creating the branch. Preserve all existing user changes and never stage, commit, discard, or otherwise modify unrelated files.
   - Test every change carefully and in proportion to its risk. Run the relevant automated tests, linting, or focused checks before presenting the work; use `CONFIG.TEST_MODE` whenever a test could submit data to FieldNation or WorkMarket. Report what was tested and any validation that could not be completed.
   - Create a focused commit when the task has reached a coherent, validated state and a commit is useful. Stage only files belonging to the current task and use a descriptive commit message.
   - Present the completed changes and test results for user review. Do not push the branch or create a pull request until the user explicitly approves the changes.
   - After approval, push the task branch and create a pull request with `dev` as the base branch. Do not target another base branch unless the user explicitly requests it.
   - Never merge branches locally and never merge a pull request. Stop after creating or updating the pull request and leave all merge decisions to the user.

## Commands
*   **Run**: `npm start` or `npm run dev`
