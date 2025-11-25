# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Node.js automation system that monitors FieldNation and WorkMarket job platforms via email notifications, automatically evaluates job opportunities, and submits applications or counter-offers based on configured criteria. The system includes a Telegram bot interface for remote monitoring and control.

## Development Commands

- `npm run dev` - Start the application with nodemon for development
- `node index.js` - Run the application directly
- `npm test` - Run tests (currently placeholder)

## Architecture

### Core Components

**Main Application (`index.js`)**
- Express server running on port 3001
- Automated login scheduler with 4-hour intervals
- Email monitoring system that checks for new job notifications every second
- Order processing pipeline with eligibility checking and automated responses

**Configuration (`config.js`)**
- Centralized configuration for rates, thresholds, working hours
- Platform enable/disable flags for FieldNation and WorkMarket
- Telegram bot credentials and API endpoints

**Core Processing Flow:**
1. Email monitoring detects new job notifications
2. Order data extraction using platform-specific scrapers
3. Eligibility evaluation based on pay rates, schedule availability, and working hours
4. Automated application submission or counter-offer generation
5. Telegram notifications and logging

### Platform Integrations

**FieldNation (`utils/FieldNation/`)**
- `loginFnAuto.js` - Automated login with 2FA support via Gmail
- `getFNorderData.js` - Web scraping for job details extraction
- `postFNworkOrderRequest.js` - Job application submission
- `postFNCounterOffer.js` - Counter-offer submission with travel expenses
- `sendWorkOrderMessage.js` - Automated messaging to clients

**WorkMarket (`utils/WorkMarket/`)**
- `loginWMAuto.js` - Automated login with cookie management
- `getWMorderData.js` - Job data extraction with expired session detection
- `postWMworkOrderRequest.js` - Application submission
- `postWMCounterOffer.js` - Counter-offer with hourly rate calculations

**Gmail Integration (`utils/gmail/`)**
- `login.js` - Google OAuth authentication
- `getLastUnreadEmail.js` - Email monitoring for job notifications
- `getOrderLink.js` - URL extraction from job notification emails
- `getFNcode.js` - 2FA code retrieval for platform logins

### Business Logic

**Eligibility System (`utils/isEligibleForApplication.js`)**
- Payment threshold validation against configured minimum rates
- Working hours overlap checking (9:00-19:00 by default)
- Calendar conflict detection using `schedule.js`
- Travel expense calculations for jobs beyond 30 miles
- Counter-offer generation with base rates and travel compensation

**Schedule Management (`schedule.js`)**
- Static monthly calendar structure for availability tracking
- Conflict detection for overlapping job times
- Buffer time management between appointments

### Notification System

**Telegram Bot (`utils/telegram/telegramBot.js`)**
- Real-time job notifications with application status
- Remote monitoring controls (start/stop/status)
- Configuration management (rate updates, settings changes)
- Manual order processing via link submission
- Persistent command menu for easy access

**Logging (`utils/logger.js`)**
- Structured logging with platform and job ID context
- Daily log rotation in `logs/` directory
- Action tracking for applications, counter-offers, and rejections

## Key Configuration Areas

### Rate Settings
- `BASE_HOURLY_RATE`: Minimum acceptable hourly rate
- `MIN_PAY_THRESHOLD_*`: Platform-specific minimum total pay requirements
- `TRAVEL_RATE` and `TRAVEL_RATE_PER_MILE`: Travel compensation calculations

### Platform Controls
- `FIELDNATION_ENABLED`/`WORKMARKET_ENABLED`: Toggle platform processing
- Platform-specific API endpoints and user IDs in `PLATFORMS` config

### Working Hours and Scheduling
- `WORK_START_TIME`/`WORK_END_TIME`: Acceptable job time windows
- `MIN_HOURS_BETWEEN_JOBS`: Buffer time for scheduling conflicts
- `DEFAULT_LABOR_HOURS`: Fallback duration for jobs without specified hours

## Testing Structure

- `tests/unit/` - Unit tests (currently empty structure)
- `tests/integration/` - Integration tests
- `tests/mocks/` - Mock data for testing

## Security Considerations

- Platform cookies stored in `utils/*/cookies.json` files
- OAuth credentials in `credentials.json` and `token.json`
- Telegram bot tokens configured in `config.js`
- Automated 2FA handling via Gmail API access

## Important Notes

- The system uses Puppeteer for web automation with specific Chrome flags for stability
- Cookie refresh logic automatically handles expired sessions
- Email monitoring runs continuously once started via Telegram commands
- Sound notifications for different application states (success/error/applied)
- Persistent state management for monitoring status across restarts