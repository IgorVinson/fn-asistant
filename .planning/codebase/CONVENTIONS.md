# Coding Conventions
_Last updated: 2026-05-27_

## Summary
This project uses ES Modules throughout (`"type": "module"` in `package.json`). Business logic is organized into pure synchronous functions for policy/calculation and async functions for I/O-bound work (Puppeteer, API calls, Google Calendar). All shared runtime configuration lives in a single mutable `CONFIG` object exported from `config.js`.

---

## Module System

**Standard:** ES Modules only. All files use `import`/`export` syntax.

**Critical rule:** Always include `.js` extension in all import paths. Node.js ESM requires explicit extensions.

```js
// Correct
import { CONFIG } from "../config.js";
import logger from "./logger.js";
import { findFitBlock } from "./availability/findFitBlock.js";

// Wrong — omitting extension breaks ESM resolution
import { CONFIG } from "../config";
```

**ESM `__dirname` workaround:** Files that need filesystem paths relative to their own location use the standard ESM workaround:
```js
import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```
See `utils/WorkMarket/postWMCounterOffer.js` for a reference example.

---

## Import Organization

Imports are grouped but not always consistently ordered. The preferred order observed in well-structured files like `index.js` is:

1. Node built-ins (`fs`, `path`, `url`)
2. Third-party packages (`express`, `puppeteer`, `googleapis`)
3. Internal imports starting from root (`./config.js`, `./utils/...`)

No path aliases are used — all imports use relative paths.

---

## Naming Conventions

**Files:**
- `camelCase.js` for all utility files: `isEligibleForApplication.js`, `normalizedDateFromWO.js`, `findFitBlock.js`
- `camelCase.js` for platform-action files: `postFNCounterOffer.js`, `loginFnAuto.js`, `getWMorderData.js`
- `PascalCase` abbreviations kept in file names: `FN` = FieldNation, `WM` = WorkMarket

**Functions:**
- `camelCase` for all functions: `isEligibleForApplication`, `calculateCounterOffer`, `findFitBlock`
- Boolean-returning functions prefixed with `is`/`has`: `isGraniteCompany`, `isWithinWorkingHours`, `isPaymentEligible`
- Getter functions prefixed with `get`: `getWorkOrderLocalDate`, `getBaseHourlyRate`, `getAvailableBlocks`
- Builder functions prefixed with `build`: `buildWMCounterOfferFormData`
- Fetcher functions prefixed with `fetch`: `fetchCalendarBusy`, `fetchWMBusy`
- Async action functions prefixed with `post`/`login`/`send`: `postWMCounterOffer`, `loginFnAuto`

**Variables:**
- `camelCase` throughout: `workOrder`, `counterOffer`, `travelExpense`, `busyBlocks`
- `SCREAMING_SNAKE_CASE` for derived constants within a function: `MIN_HOURLY_RATE`, `TRAVEL_THRESHOLD`, `BUFFER`
- `CONFIG` property access paths use nested SCREAMING_SNAKE_CASE: `CONFIG.RATES.BASE_HOURLY_RATE`, `CONFIG.TIME.WORK_START_TIME`

**Classes:**
- `PascalCase`: `Logger`, `TelegramBotService`

---

## Async Patterns

**Primary pattern:** `async/await` everywhere. All I/O-bound functions are `async`.

```js
// Standard async function pattern
async function isEligibleForApplication(workOrder) {
  try {
    availabilityFitResult = await checkAvailabilityNew(workOrder);
  } catch (err) {
    logger.info(`Availability fit check failed: ${err.message}`, workOrder.platform, workOrder.id);
    return { eligible: false, counterOffer: null, reason: "SLOT_UNAVAILABLE", rejectDetails: err.message };
  }
}
```

**`.catch()` for fire-and-forget notifications:**
Non-critical side-effects that should not crash the main flow use `.catch()` directly:
```js
this.bot.sendMessage(this.chatId, text).catch(error => {
  console.error("Failed to send Telegram message:", error);
});
```
See `utils/telegram/telegramBot.js` lines 509, 573, 590.

**Rule:** Any function that touches Google Calendar, Puppeteer, Telegram, or HTTP requests must be `async`. Pure calculation/policy functions (`evaluateApplicationPolicy`, `calculateCounterOffer`, `findFitBlock`, `decideFitAction`) are synchronous.

---

## Error Handling Patterns

**Pattern 1 — Return structured result objects (preferred for business logic):**
Functions return objects with `eligible`, `reason`, `rejectDetails` instead of throwing.
```js
return {
  eligible: false,
  counterOffer: null,
  reason: "PAYMENT_BELOW_MINIMUM",
  rejectDetails: paymentCheck.details,
};
```
Used throughout `utils/isEligibleForApplication.js`.

**Pattern 2 — try/catch with graceful return (for I/O utilities):**
```js
export function saveReplay(job, result) {
  try {
    fsSync.appendFileSync("./jobs-replay.json", JSON.stringify({...}) + "\n");
  } catch (e) {
    console.error("Replay save error:", e);
  }
}
```

**Pattern 3 — throw and re-throw (for platform POST actions):**
Functions in `utils/FieldNation/` and `utils/WorkMarket/` throw errors that propagate to `index.js`:
```js
} catch (error) {
  console.error("Error sending counter offer:", error.message);
  throw error;
}
```

**Rule:** Never swallow errors silently. Always log before returning gracefully or re-throwing.

---

## Logging Conventions

**Logger:** `utils/logger.js` — a singleton `Logger` class instance, exported as default.

```js
import logger from "./logger.js";

logger.info("Message text", platform, workOrderId);
logger.error("Error text", platform, workOrderId);
```

**Signature:** `logger.info(message, platform = '', workOrderId = '')`
- `platform`: `"FieldNation"` or `"WorkMarket"` string, or omit
- `workOrderId`: numeric or string order ID, or omit

**Output format:** `[ISO-timestamp] [INFO] [FieldNation] [Order: 123456] Message`

**File output:** `logs/app-YYYY-MM-DD.log` (daily rotation, appended)

**`console.log` usage:** Present in some files (availability debug output in `isEligibleForApplication.js` lines 269-279, Telegram bot, POST action confirmations). `console.log` is acceptable for operational debug output that does not require log file persistence. Avoid adding new `console.log` where `logger.info` is available.

**`pushEvent()` in `index.js`:** For dashboard-visible events, call `pushEvent({ type, message, ... })` instead of or in addition to `logger.info`. This writes to `logs/logs.json` and the in-memory `eventHistory` array.

---

## Configuration Management

**Single source of truth:** `config.js` exports one mutable `CONFIG` object. It is imported by reference everywhere — mutations made via `Object.assign(CONFIG, ...)` are seen by all importers immediately (no restart needed).

```js
import { CONFIG } from "../config.js";
// Always reference CONFIG directly — never cache a value from CONFIG
// Bad:  const mode = CONFIG.APPLICATION_MODE; // stale after /api/config update
// OK:   if (CONFIG.APPLICATION_MODE === "granite_only") { ... }
```

**Runtime config updates:** `/api/config` endpoint in `index.js` merges partial payloads into nested CONFIG sub-objects (`RATES`, `TIME`, `DISTANCE`) or top-level flags. This supports live override from the dashboard.

**Test overrides:** In tests, use the `withConfig(overrides, run)` pattern from `tests/replay-policy.test.js` to temporarily mutate CONFIG and restore it after:
```js
withConfig({ APPLICATION_MODE: "granite_only", ALLOW_ALL_COMPANIES_ON_DATES: [] }, () => {
  const result = evaluateApplicationPolicy(job);
  assert.equal(result.allowed, true);
});
```

**Environment variables:** Only sensitive values (Telegram tokens, FieldNation user ID) come from `process.env`. All business thresholds are hardcoded defaults in `config.js`.

---

## Code Style

**Formatting:** No Prettier or ESLint config exists at the root level. The UI (`ui/`) has its own ESLint config at `ui/eslint.config.js` for React. Main application code has no enforced formatter.

**Observed style:**
- 2-space indentation throughout
- Double quotes preferred (`"`) in newer files; single quotes (`'`) appear in some older files (e.g., `utils/normalizedDateFromWO.js`, `utils/FieldNation/postFNCounterOffer.js`)
- Arrow functions for short callbacks; named function declarations for exported/top-level logic
- Template literals for multi-line log messages with indented sub-lines

**Comments:**
- Block comments above logical sections using `// RULE 1:`, `// STEP 1:` style
- Inline comments on `CONFIG` property declarations explain intent
- No JSDoc annotations on any functions — parameters are self-documenting by convention

**Function size:** Core utility functions tend to be 15-50 lines. `isEligibleForApplication.js` and `loginFnAuto.js` contain long orchestrator functions (100-200 lines) that coordinate multiple steps.

---

## Export Patterns

**Default exports** for primary module exports (singletons and main functions):
```js
export default logger;            // utils/logger.js
export default isEligibleForApplication;  // utils/isEligibleForApplication.js
export default new TelegramBotService();  // utils/telegram/telegramBot.js
```

**Named exports** for helper functions and pure utilities:
```js
export { calculateCounterOffer, evaluateApplicationPolicy, findFreeSlots, getWorkOrderLocalDate };
export function findFitBlock(...) { ... }
export function decideFitAction(...) { ... }
```

**Barrel files:** `utils/availability/index.js` re-exports from three sub-modules. No other barrel files exist.

**Mixed default + named** in the same file is acceptable and used in `isEligibleForApplication.js`.
