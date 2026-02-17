# FN Assistant

Automation tool for FieldNation & WorkMarket — job scheduling, calendar sync, and Telegram notifications.

<!-- Add screenshot here -->

## Overview

FN Assistant is a production-ready automation platform that streamlines job workflows for field service contractors. It monitors job platforms, automatically applies to suitable opportunities, sends counter-offers for underpaid jobs, and keeps everything synchronized with Google Calendar — all controlled via a Telegram bot interface.

## Key Features

- **Dual Platform Support**: Automates both FieldNation and WorkMarket simultaneously
- **Smart Job Filtering**: Automatically evaluates jobs based on pay rate, distance, working hours, and calendar availability
- **Auto-Application**: Applies to jobs that meet your criteria without manual intervention
- **Intelligent Counter-Offers**: Automatically negotiates better rates for jobs below your threshold
- **Google Calendar Integration**: Syncs accepted jobs and checks for scheduling conflicts
- **Gmail Monitoring**: Watches for new job notifications and processes them instantly
- **Telegram Bot Control**: Start/stop monitoring, check status, and receive notifications on your phone
- **Automated Authentication**: Handles login with automatic 2FA code retrieval from Gmail
- **Session Management**: Automatically refreshes sessions every 4 hours with random variance

## Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)
![Google APIs](https://img.shields.io/badge/Google%20APIs-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Telegram Bot](https://img.shields.io/badge/Telegram%20Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)
![Cheerio](https://img.shields.io/badge/Cheerio-FF6C37?style=for-the-badge)

## Getting Started

### Prerequisites

- Node.js 18+
- A Gmail account (for notifications and 2FA)
- FieldNation and/or WorkMarket accounts
- Telegram bot token
- Google Cloud project with Gmail and Calendar APIs enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/IgorVinson/fn-asistant.git
cd fn-asistant

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start the server
npm run dev
```

## Environment Variables

Create a `.env` file with the following:

```env
# Platform Configuration
FIELDNATION_ENABLED=true
WORKMARKET_ENABLED=true

# WorkMarket Credentials
WM_EMAIL=your-email@example.com
WM_PASSWORD=your-password

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

# Rate Configuration
BASE_HOURLY_RATE=50
MIN_PAY_THRESHOLD_WORKMARKET=100
MIN_PAY_THRESHOLD_FIELDNATION=200
TRAVEL_RATE_PER_MILE=1.25

# Schedule Settings
WORK_START_TIME=09:00
WORK_END_TIME=19:00
BUFFER_MINUTES=30
```

## Project Structure

```
fn-asistant/
├── index.js                 # Main server and orchestration logic
├── config.js               # Configuration and constants
├── schedule.js             # Scheduling utilities
├── checkAuth.js            # Authentication checker
├── checkWeeklyCalendar.js  # Calendar integration
├── utils/
│   ├── FieldNation/        # FieldNation-specific automation
│   ├── WorkMarket/         # WorkMarket-specific automation
│   ├── gmail/              # Gmail API integration
│   └── telegram/           # Telegram bot interface
└── logs/                   # Application logs
```

## How It Works

1. **Monitoring Loop**: The system checks Gmail every second for new job notifications
2. **Job Parsing**: When a new email arrives, it extracts the job link and platform
3. **Data Extraction**: Uses Puppeteer to scrape detailed job information
4. **Eligibility Check**: Evaluates the job against your configured criteria:
   - Minimum pay thresholds
   - Working hours (9 AM - 7 PM default)
   - Distance and travel compensation
   - Calendar conflicts
5. **Auto-Action**: Applies to qualifying jobs or sends counter-offers
6. **Notifications**: Sends Telegram alerts for all actions taken

## Telegram Commands

- `/start` - Begin monitoring for new jobs
- `/stop` - Pause monitoring
- `/status` - Check current system status
- `/relogin` - Refresh platform authentication
- `/process <url>` - Manually process a specific job URL
- `/help` - Show available commands

## License

MIT
