# FieldOps Automator: Autonomous Work Order Negotiation System

An intelligent, full-stack autonomous agent designed to monitor, analyze, and negotiate technical work orders across major contracting platforms. This system bridges the gap between real-time logistics and automated business logic.

## 🚀 Key Features

- **Multi-Platform Integration**: Seamlessly monitors FieldNation and WorkMarket for new opportunities.
- **Autonomous Negotiation Engine**: Implements complex business logic to evaluate work orders based on hourly rates, travel distance, and availability.
- **Geospatial Intelligence**: Automatically calculates travel surcharges and profitable counter-offers using distance-based algorithms.
- **Self-Healing Session Management**: Utilizes a headless browser (Puppeteer) with robust cookie rotation and auto-login capabilities for 24/7 reliability.
- **Real-Time Telemetry**: Integrated Telegram bot interface for live status updates, notifications, and remote manual override.

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Automation**: Puppeteer, Cheerio
- **Integrations**: Gmail API, Google Cloud Auth, Telegram Bot API
- **Utilities**: Dotenv, Express (Monitoring Server)

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/IgorVinson/fn-asistant.git
   cd fn-asistant
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (refer to `.env.example`):
   ```env
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHAT_ID=your_chat_id
   FIELD_NATION_USER_ID=your_user_id
   PORT=3001
   ```

4. **Authentication:**
   Ensure your `credentials.json` for Google Cloud is present in the root to authorize Gmail monitoring.

5. **Run the application:**
   ```bash
   npm start
   ```

## 🧠 Business Logic: The `isEligibleForApplication` Engine

The core value of this system lies in its decision-making algorithm. Unlike simple scrapers, this agent performs:
- **Financial Filtering**: Rejects jobs below minimum hourly or total pay thresholds.
- **Availability Checks**: Cross-references upcoming jobs to prevent scheduling conflicts.
- **Automatic Counter-Offers**: If a job is below the pay threshold but within travel distance, the bot calculates and submits a counter-offer including base pay adjustments and travel expenses.

---
*Developed as a technical solution to optimize field operations and logistics.*
