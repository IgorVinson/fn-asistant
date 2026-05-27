export const CONFIG = {
  // Platform configuration
  TEST_MODE: true, // If true, agent will not perform destructive/real actions
  FIELDNATION_ENABLED: true, // Set to false to disable FieldNation applications
  WORKMARKET_ENABLED: true, // Set to false to disable WorkMarket applications
  APPLICATION_MODE: "all_companies", // "granite_only" | "all_companies" | "disabled"
  ALLOW_ALL_COMPANIES_ON_DATES: [], // YYYY-MM-DD dates where non-Granite jobs are allowed
  IS_COUNTER_DATES: true, // If true, counter-offer with free calendar slots when job time conflicts; if false, just reject on conflict
  IS_COUNTER_DAYS: true,
  IS_COUNTER_RATES: true, // If true, counter-offer with free calendar slots when job time conflicts; if false, just reject on conflict
  ENFORCE_MIN_PAYMENT: true, // If true, reject jobs below platform minimum threshold
  // Payment and Rate Settings
  RATES: {
    BASE_HOURLY_RATE: 50, // Minimum desired hourly rate
    BASE_HOURLY_RATE_WORKMARKET: 65, // Minimum desired hourly rate
    BASE_HOURLY_RATE_FIELDNATION: 50, // Minimum desired hourly rate
    MIN_PAY_THRESHOLD_WORKMARKET: 150, // Minimum total pay for WorkMarket jobs
    MIN_PAY_THRESHOLD_FIELDNATION: 150, // Minimum total pay for FieldNation jobs
    TRAVEL_RATE: 30, // Rate per hour of travel
  },

  // Distance and Travel Sesttings
  DISTANCE: {
    TRAVEL_THRESHOLD_MILES: 10, // Miles before charging travel expenses (applied to padded distance)
    TRAVEL_RATE_PER_MILE: 1.3, // Amount to charge per mile over threshold
    FREE_TRAVEL_LIMIT: 30 / 60, // Free travel time in hours (30 minutes)
    AVERAGE_SPEED: 50, // Average travel speed in miles per hour
    DISTANCE_PADDING_MILES: 10, // Padding added to reported distance for pricing + standalone-travel trigger (city-traffic offset; not used for scheduling)
    TRAVEL_ROUND_TO: 5, // Round final travel $ up to nearest multiple
  },
  FLAT_TRAVEL: 0, // Flat travel fee added to all counter offers

  // Time and Schedule Settings
  TIME: {
    DEFAULT_LABOR_HOURS: 2, // Default estimated labor hours if not specified
    MIN_HOURS_BETWEEN_JOBS: 1, // Minimum hours required between jobs
    WORK_START_TIME: "10:00", // Earliest time to accept jobs
    WORK_END_TIME: "20:00", // Latest time to accept jobs
    BUFFER_MINUTES: 0, // Buffer time between jobs
    LATEST_COUNTER_START_TIME: "14:00", // Latest same-day counter slot start time
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
