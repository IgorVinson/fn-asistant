# Technology Stack
_Last updated: 2026-05-27_

## Summary
FieldOps Automator is a Node.js autonomous agent with a React dashboard. The backend runs on Node.js 22 using native ES Modules, Express for its REST API, and Puppeteer for browser automation. The frontend is a Vite + React 19 + Tailwind CSS SPA served from the same Express server.

## Languages

**Primary:**
- JavaScript (ES2022+) - All backend and frontend code
- JSX - React UI components in `ui/src/`

**Module System:**
- ES Modules (`"type": "module"` in both `package.json` and `ui/package.json`)
- All imports use explicit `.js` extensions

## Runtime

**Environment:**
- Node.js 22.18.0 (active runtime; no `.nvmrc` pinning)

**Package Manager:**
- npm (backend: `package-lock.json` present; UI: `ui/package-lock.json` present)

## Frameworks

**Backend API:**
- Express `^4.21.1` — REST API server on port 3001, serves dashboard static assets

**Frontend:**
- React `^19.2.0` — dashboard SPA
- React DOM `^19.2.0`
- Vite `^7.2.4` — dev server and production build (`ui/vite.config.js`)
- `@vitejs/plugin-react` `^5.1.1` — React fast refresh

**Styling:**
- Tailwind CSS `^3.4.19` — utility-first CSS (`ui/tailwind.config.js`)
- PostCSS `^8.5.6` + Autoprefixer `^10.4.24`
- `tailwind-merge` `^3.4.0` — conditional class merging
- `clsx` `^2.1.1` — conditional className helper

**UI Components:**
- `lucide-react` `^0.563.0` — icon library

## Key Dependencies

**Browser Automation:**
- `puppeteer` `^23.11.1` — headless Chrome for scraping FieldNation and WorkMarket. Launches with incognito mode, sandbox disabled, shadow DOM features enabled. Sessions stored as `cookies.json` per platform.

**Google APIs:**
- `googleapis` `^105.0.0` — Gmail API (email polling) and Google Calendar API (availability checks)
- `@google-cloud/local-auth` `^2.1.1` — OAuth2 desktop flow for initial Google auth

**Messaging:**
- `node-telegram-bot-api` `^0.66.0` — Telegram bot for notifications and remote control commands

**HTML Parsing:**
- `cheerio` `^1.0.0` — server-side HTML parsing for work order data extraction

**Utilities:**
- `dotenv` `^16.4.5` — loads `.env` into `process.env` via `import "dotenv/config"`
- `cors` `^2.8.6` — CORS middleware for Express API (used by Vite dev server proxy)
- `imap` `^0.8.19` — IMAP client (installed but Gmail API is used instead; legacy)

## Build / Dev Tooling

**Frontend Build:**
- `vite build` — production bundle output to `ui/dist/`
- `vite dev` — dev server with HMR (typically port 5173)
- Path alias `@` → `ui/src/` configured in `ui/vite.config.js`

**Backend:**
- No transpilation — Node.js runs source directly (`node index.js`)
- `npm start` / `npm run dev` both run `node index.js`

## Testing

**Runner:**
- Node.js native test runner (`node --test`) — no external test framework
- Command: `npm test` → `node --test tests/*.test.js`
- Test file: `tests/replay-policy.test.js`
- Uses `node:test` and `node:assert/strict` built-in modules

## Linting / Formatting

**Frontend:**
- ESLint `^9.39.1` — flat config (`ui/eslint.config.js`)
- `eslint-plugin-react-hooks` `^7.0.1`
- `eslint-plugin-react-refresh` `^0.4.24`
- Command: `npm run lint` from `ui/`

**Backend:**
- No ESLint or Prettier config detected in root

## Logging

**Custom file logger:** `utils/logger.js`
- Writes to `logs/app-YYYY-MM-DD.log` (daily rotation, file-append)
- Also outputs to `console.log`
- Methods: `logger.info()`, `logger.error()`
- Log directory: `logs/` (gitignored)

## Configuration

**Environment:**
- `.env` file (gitignored) loaded via `dotenv`
- Required vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_TOKEN2`, `TELEGRAM_CHAT_ID2`, `FIELD_NATION_USER_ID`, `GMAIL_ALLOW_INTERACTIVE_AUTH`
- Runtime config object: `config.js` exports `CONFIG` — single source of truth for all thresholds, flags, and platform settings

**Google OAuth2:**
- Credentials: `config/credentials.json` (gitignored)
- Token cache: `config/token.json` (gitignored)

## Platform Requirements

**Development:**
- Node.js 22+
- Chromium/Chrome (bundled with Puppeteer)
- Google OAuth2 credentials pre-configured in `config/`

**Production:**
- Single-process Node.js server (no clustering)
- Runs on the developer's local machine or a Linux server
- No containerization detected (no Dockerfile/docker-compose)
- No CI/CD pipeline detected
