export const CONFIG = {
  // Platform configuration
  TEST_MODE: true, // Manual validation branch: do not perform destructive/real actions
  FIELDNATION_ENABLED: true, // Set to false to disable FieldNation applications
  WORKMARKET_ENABLED: true, // Set to false to disable WorkMarket applications
  APPLICATION_MODE: "all_companies", // "granite_only" | "all_companies" | "disabled"
  ALLOW_ALL_COMPANIES_ON_DATES: [], // YYYY-MM-DD dates where non-Granite jobs are allowed
  IS_COUNTER_DATES: true, // If true, counter-offer with free calendar slots when job time conflicts; if false, just reject on conflict
  IS_COUNTER_DAYS: true, // If true, counter-offer with free calendar slots when job time conflicts; if false, just reject on conflict
  IS_COUNTER_RATES: true,
  ENFORCE_MIN_PAYMENT: true, // If true, reject jobs below platform minimum threshold
  WORKMARKET_SCHEDULE_CHECK_ENABLED: true, // Include WorkMarket assignments as busy blocks during schedule checks.

  // WorkMarket session handling.
  // The WM session dies in roughly an hour, but scheduleRelogin() only rotates
  // cookies every 4 hours — so the agent used to spend ~3 hours of every cycle
  // logged out, silently dropping every order that arrived in that window.
  // The probe closes that gap by noticing the expiry between orders instead of
  // during one.
  WM_SESSION_PROBE_MINUTES: 10, // 0 disables the probe
  WM_DEBUG_DUMP_ALL: false, // true = keep every fetched WM page under logs/ (failures are always kept)

  // Strategy configuration for lead-time booking and Granite premium logic
  STRATEGY: {
    ENABLED: true, // Master switch. false = current manual behavior.
    // Minimum total pay by booking horizon, sorted ascending by maxLeadHours.
    // Last entry (maxLeadHours: null) = "everything else / far in advance".
    LEAD_TIME_TIERS: [
      { maxLeadHours: 36, minPay: 150 }, // same-day + tomorrow: take (almost) all
      { maxLeadHours: 168, minPay: 200 }, // this week (7 days): $200+
      { maxLeadHours: null, minPay: 260 }, // 7+ days out: $260+
    ],
    BIG_TICKET_MIN: 210, // "big" ticket — used for same-day morning reserve
    SAME_DAY_SMALL_EARLIEST_START: "12:00", // small same-day jobs only from this time
    GRANITE_PREMIUM_MIN_RATE: 65, // Granite at/above this hourly rate = premium
    GRANITE_PREMIUM_TITLE_RE: "epik", // ...or title contains this (case-insensitive)
    TECHNICIAN_COUNT: 1, // >=2 → allow a parallel slot for Granite-Epik tickets
  },

  // Manual Override Settings

  // Payment and Rate Settings
  RATES: {
    BASE_HOURLY_RATE: 50, // Minimum desired hourly rate
    BASE_HOURLY_RATE_WORKMARKET: 50, // Minimum desired hourly rate
    BASE_HOURLY_RATE_FIELDNATION: 60, // Minimum desired hourly rate
    MIN_PAY_THRESHOLD_WORKMARKET: 100, // Minimum total pay for WorkMarket jobs
    MIN_PAY_THRESHOLD_FIELDNATION: 100, // Minimum total pay for FieldNation jobs
    TRAVEL_RATE: 30, // Rate per hour of travel
  },

  // Distance and Travel Settings
  DISTANCE: {
    TRAVEL_THRESHOLD_MILES: 20, // Miles before charging travel expenses (applied to padded distance)
    TRAVEL_RATE_PER_MILE: 1.2, // Amount to charge per mile over threshold
    FREE_TRAVEL_LIMIT: 30 / 60, // Free travel time in hours (30 minutes)
    AVERAGE_SPEED: 50, // Average travel speed in miles per hour
    DISTANCE_PADDING_MILES: 10, // Padding added to reported distance for pricing + standalone-travel trigger (city-traffic offset; not used for scheduling)
    TRAVEL_ROUND_TO: 5, // Round final travel $ up to nearest multiple
  },
  FLAT_TRAVEL: 0, // Flat travel fee added to all counter offers

  // Lead-time booking strategy (see utils/strategy/leadTimeStrategy.js).
  // Master switch: when ENABLED is false the agent behaves exactly as before
  // (single platform min threshold, no lead-time / Granite-premium logic).

  // Time and Schedule Settings
  TIME: {
    DEFAULT_LABOR_HOURS: 2, // Default estimated labor hours if not specified
    MIN_HOURS_BETWEEN_JOBS: 0, // Minimum hours required between jobs
    WORK_START_TIME: "9:00", // Earliest time to accept jobs
    WORK_END_TIME: "20:00", // Latest time to accept jobs
    BUFFER_MINUTES: 0, // Buffer time between jobs
    LATEST_COUNTER_START_TIME: "15:00", // Latest same-day counter slot start time
    PREFERRED_SLOTS: [
      { start: "10:00", end: "12:00", label: "Morning" },
      { start: "12:00", end: "14:00", label: "Early Afternoon" },
      { start: "14:00", end: "15:00", label: "Afternoon" },
    ],
  },

  // Platform-specific Settings
  PLATFORMS: {
    FIELD_NATION: {
      USER_ID: process.env.FIELD_NATION_USER_ID || 983643, // Your Field Nation user ID
      // Public iCal feed of accepted/assigned FN work orders. Used as a busy source for availability.
      // webcal:// is auto-normalized to https://. The id encodes the FN user ID (base64 "FN_<id>_CAL").
      CALENDAR_FEED_URL:
        process.env.FIELD_NATION_CALENDAR_FEED_URL ||
        "webcal://app.fieldnation.com/marketplace/calendar.php?id=Rk5fOTgzNjQzX0NBTA==",
      API_ENDPOINTS: {
        REQUESTS: "https://app.fieldnation.com/v2/workorders",
      },
    },
    WORK_MARKET: {
      // Add WorkMarket specific settings here
    },
  },

  // Telegram Bot Settings
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    BOT_TOKEN_2: process.env.TELEGRAM_BOT_TOKEN2,
    CHAT_ID_2: process.env.TELEGRAM_CHAT_ID2,
    COMMANDS: {
      START_MONITORING: "/start",
      STOP_MONITORING: "/stop",
      STATUS: "/status",
      PROCESS_ORDER: "/process",
      HELP: "/help",
      RELOGIN: "/relogin",
    },
  },

  // Default Values
  DEFAULTS: {
    COMPANY_NAME: "Unknown Company",
    PLATFORM_NAME: "Unknown",
  },
};

// Logging: controls how much is printed to the CONSOLE.
// "error" | "warn" | "info" | "debug" — anything at or above the level prints.
// The log FILE always receives every level regardless of this setting.
// Set to "debug" to see the verbose scraping/session chatter; "info" (default)
// keeps the console focused on order decisions; "warn" for near-silent.
LOG_LEVEL: process.env.LOG_LEVEL || "info";
