# ⚡ FieldOps Automator (`fn-asistant-ai`)

Autonomous field service dispatch bot for **FieldNation** and **WorkMarket**.

It listens for incoming work order emails via the Gmail API, checks schedule availability across multiple calendars, applies profitability and travel logic, and automatically submits applications or counter-offers.

---

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the bot**:
   ```bash
   npm start              # standard run
   npm run supervised     # watchdog supervisor with crash auto-recovery
   ```

3. **Open the Dashboard**:
   Open [http://localhost:3001](http://localhost:3001) in your browser to view live order events, logs, and status.

---

## 🎯 Key Features

* **Dual Platform Support**:
  * **FieldNation**: Direct JSON REST API v2 integration for instant order fetching, applications, and counter-offers.
  * **WorkMarket**: Web scraping and active session health probing with form-based application/counter submissions.
* **Smart Availability (3 Calendar Sources)**:
  * Google Calendar API (primary schedule)
  * FieldNation live iCal feed
  * WorkMarket assigned work orders
* **Lead-Time Booking Strategy**:
  * **Near-term (≤ 36h)**: $180 dispatch floor.
  * **Mid-range (36h–7d)**: $250 floor to keep days open for valuable projects.
  * **Advance (7+ days)**: $350 floor (reserves future weeks for full-day rollouts and major projects).
* **Granite Telecommunications Priority**:
  * Granite tickets with rate ≥ $65/hr or title matching 'epik' bypass advance lead-time floors. Duration ≥ 3 hours also qualifies when `IS_COUNTER_RATES` is enabled.
* **Automated Travel Compensation**:
  * Adds 10 miles to reported distance, then uses $1.25/mile when that distance exceeds 20 miles. The amount is rounded to whole dollars and then up to a $5 increment.
* **Telegram Remote Control**:
  * Ticket notifications for applications and counteroffers; rejected tickets go to Notion instead. Remote commands and operational alerts remain available.
  * Commands: `/start`, `/stop`, `/status`, `/relogin`, and `/process <link>`.
* **Notion Rejection Log**:
  * Set `NOTION_TOKEN` and `NOTION_PAGE_ID` in `.env`, and grant the integration access to that page with insert-content permission.
  * Each new rejection appends the existing Telegram message content, including the reason and ticket link. Test-mode rejections retain their TEST banner. Existing rejections are not backfilled.
  * Uses the [Notion append-block API](https://developers.notion.com/reference/patch-block-children). Rate limits are retried; failed writes retain the full message in local logs without sending a Telegram rejection. Restart the bot after changing environment variables or code.

---

## ⚙️ Quick Configuration (`config.js`)

Common settings you can adjust directly in `config.js`:

| Setting | Description | Default |
| :--- | :--- | :--- |
| `TEST_MODE` | Simulate applications/counters without submitting live data | `false` |
| `APPLICATION_MODE` | Target companies (`"all_companies"`, `"granite_only"`, or `"disabled"`) | `"all_companies"` |
| `RATES.BASE_HOURLY_RATE_WORKMARKET` | Desired base hourly rate for WorkMarket | `65` ($65/hr) |
| `RATES.BASE_HOURLY_RATE_FIELDNATION` | Desired base hourly rate for FieldNation | `60` ($60/hr) |
| `TIME.WORK_START_TIME` | Earliest time to accept/schedule jobs | `"9:00"` |
| `TIME.WORK_END_TIME` | Latest time to accept/schedule jobs | `"20:00"` |
| `DISTANCE.TRAVEL_THRESHOLD_MILES` | Distance before adding travel compensation | `20` miles |

---

## 🧪 Testing & Validation

Run the automated test suite (12+ test files covering policy, session health, counters, and persistence):
```bash
npm test
```

---

## 🤖 Developer & Agent Documentation

For deep technical architecture, anti-bot Puppeteer evasion flags, session recovery lifecycles, and mandatory AI coding rules, see [AGENTS.md](AGENTS.md).
