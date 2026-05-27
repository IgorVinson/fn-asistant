# External Integrations
_Last updated: 2026-05-27_

## Summary
The agent integrates with two freelance work platforms (FieldNation and WorkMarket) via Puppeteer browser automation and direct REST API calls using session cookies. Google APIs (Gmail + Calendar) provide email polling and availability checking. Telegram serves as the notification and remote-control channel.

## APIs & External Services

### FieldNation
- **Purpose:** Monitor and apply to field technician work orders
- **Base URL:** `https://app.fieldnation.com`
- **Auth:** Session cookies from Puppeteer login, stored at `utils/FieldNation/cookies.json` (gitignored)
- **2FA:** Email verification code retrieved from Gmail via `utils/gmail/getFNcode.js`
- **Key endpoints (direct fetch calls):**
  - `POST https://app.fieldnation.com/v2/workorders/{id}/requests` — submit application (`utils/FieldNation/postFNworkOrderRequest.js`)
  - Counter-offer endpoint — `utils/FieldNation/postFNCounterOffer.js`
  - Order data scraped via Puppeteer — `utils/FieldNation/getFNorderData.js`
- **SDK/client:** None — native `fetch` with spoofed browser headers (`sec-fetch-*`, `Referer`)
- **Cookie rotation:** Auto re-login every 4 hours via `scheduleRelogin()` in `index.js`

### WorkMarket
- **Purpose:** Monitor and apply to field technician work orders
- **Base URL:** `https://www.workmarket.com`
- **Auth:** Session cookies from Puppeteer login, stored at `utils/WorkMarket/cookies.json` and `utils/WorkMarket/autoCookies.json` (both gitignored)
- **2FA:** Email verification code retrieved from Gmail via `utils/WorkMarket/getWMcode.js`
- **Key endpoints:**
  - `POST https://www.workmarket.com/assignments/apply/{id}` — submit application (`utils/WorkMarket/postWMworkOrderRequest.js`)
  - Counter-offer endpoint — `utils/WorkMarket/postWMCounterOffer.js`
  - Order data and assignments scraped via Puppeteer — `utils/WorkMarket/getWMorderData.js`, `utils/WorkMarket/getWMAssignments.js`
- **SDK/client:** None — native `fetch` with spoofed browser headers
- **Session recovery:** If data quality check fails (missing company/title/payment), triggers immediate re-login via `isInvalidWorkMarketData()` in `index.js`

## Google APIs

### Gmail API
- **Purpose:** Poll for new work order notification emails; retrieve 2FA codes for platform logins
- **Package:** `googleapis` `^105.0.0`
- **Auth:** OAuth2 with pre-authorized `config/token.json` (gitignored); credentials in `config/credentials.json` (gitignored)
- **Scopes:** `gmail.readonly`, `gmail.modify`
- **Implementation:** `utils/gmail/login.js` (authorize), `utils/gmail/getLastUnreadEmail.js` (polling), `utils/gmail/getOrderLink.js` (link extraction), `utils/gmail/getFNcode.js` (2FA code retrieval)
- **Interactive re-auth:** Run `GMAIL_ALLOW_INTERACTIVE_AUTH=1 node utils/gmail/script.js` to refresh token
- **Polling interval:** 1000ms loop in `index.js`

### Google Calendar API
- **Purpose:** Check calendar availability before accepting or counter-offering work orders
- **Package:** `googleapis` `^105.0.0`
- **Auth:** Same OAuth2 client as Gmail
- **Scopes:** `calendar.readonly`, `calendar.events`
- **Implementation:** `utils/availability/fetchCalendarBusy.js` (fetch busy blocks), `utils/gmail/googleCalendarEvents.js` (event management)
- **Behavior:** Queries all calendars in the account, aggregates busy blocks, used by `utils/availability/getAvailableBlocks.js` to find free slots

## Telegram Bot

- **Purpose:** Push notifications for job decisions; remote control of the agent
- **Package:** `node-telegram-bot-api` `^0.66.0`
- **Auth:** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_TOKEN2` env vars; `TELEGRAM_CHAT_ID` and `TELEGRAM_CHAT_ID2` for target chats
- **Implementation:** `utils/telegram/telegramBot.js`
- **Notifications sent:** Job applied, counter-offer submitted, job rejected (with reason), system errors, login failures
- **Remote commands:**
  - `/start` — begin monitoring
  - `/stop` — pause monitoring
  - `/status` — show current config and state
  - `/relogin` — force cookie refresh
  - `/process <link>` — manually process a work order URL
  - `/help` — list commands

## Webhooks & Incoming Triggers

### Phone Alert Webhook
- **Endpoint:** `POST /api/phone-alert` on the Express server (port 3001)
- **Purpose:** Macrodroid (Android automation) sends phone notifications to trigger agent actions
- **Deduplication:** 5-minute window to prevent repeated processing of the same alert
- **Implementation:** `index.js`

## Data Storage

### File-based Storage (local filesystem)
- **Replay data:** `jobs-replay.json` — NDJSON archive of evaluated work orders; used for regression testing
- **Log files:** `logs/app-YYYY-MM-DD.log` — daily rotating application logs (gitignored)
- **Event log:** In-memory array in `index.js` served via `GET /api/logs`
- **Google tokens:** `config/token.json` — OAuth2 refresh token (gitignored)
- **Platform cookies:** `utils/FieldNation/cookies.json`, `utils/WorkMarket/cookies.json`, `utils/WorkMarket/autoCookies.json` (all gitignored)

**No database** — no SQL, NoSQL, or ORM dependency detected.

## Authentication Summary

| Service | Method | Storage | Rotation |
|---------|--------|---------|----------|
| FieldNation | Email/password + 2FA via Puppeteer | `utils/FieldNation/cookies.json` | Every 4 hours |
| WorkMarket | Email/password + 2FA via Puppeteer | `utils/WorkMarket/cookies.json` | Every 4 hours |
| Google (Gmail + Calendar) | OAuth2 with refresh token | `config/token.json` | On expiry |
| Telegram | Bot token (env var) | `process.env` | Static |

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Primary Telegram bot token |
| `TELEGRAM_CHAT_ID` | Primary Telegram chat ID |
| `TELEGRAM_BOT_TOKEN2` | Secondary Telegram bot token |
| `TELEGRAM_CHAT_ID2` | Secondary Telegram chat ID |
| `FIELD_NATION_USER_ID` | FieldNation account user ID (falls back to hardcoded `983643`) |
| `GMAIL_ALLOW_INTERACTIVE_AUTH` | Set to `"1"` to allow browser OAuth flow for token refresh |

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Datadog, etc.)
**Logs:** Custom file logger (`utils/logger.js`) + dashboard event stream via Express API
**Alerts:** Telegram notifications for critical errors and session failures
