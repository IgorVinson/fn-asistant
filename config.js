export const CONFIG = {
  // Platform configuration
  FIELDNATION_ENABLED: false, // Set to false to disable FieldNation applications
  WORKMARKET_ENABLED: true, // Set to false to disable WorkMarket applications

  // Browser Settings
  BROWSER: {
    HEADLESS: true, // Set to false to see the browser window
    ARGS: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--enable-experimental-web-platform-features",
      "--force-device-scale-factor=1",
      "--disable-extensions-except",
      "--disable-plugins-discovery",
      "--enable-blink-features=ShadowDOMV0",
      "--incognito",
    ],
  },

  // Login Settings
  LOGIN: {
    WAIT_FOR_CODE: false, // Set to true to wait for manual 2FA code entry
    FIELDNATION: {
      EMAIL: "igorvinson@gmail.com",
      PASSWORD: "YOUR_PASSWORD_HERE",
    },
    WORKMARKET: {
      EMAIL: "igorvinson@gmail.com",
      PASSWORD: "YOUR_PASSWORD_HERE",
    },
  },

  // Server Settings
  SERVER: {
    PORT: 3012,
  },

  // Monitoring Settings
  MONITORING: {
    INTERVAL_MS: 1000, // Check for emails every 1 second
    SOUND_DELAY_MS: 3000, // Delay after processing to allow sounds to play
  },

  // Relogin Scheduler Settings
  RELOGIN: {
    ENABLED: true,
    INTERVAL_HOURS: 4,
    VARIANCE_MINUTES: 10,
  },

  // Cookie Refresh Settings
  COOKIE_REFRESH: {
    WAIT_AFTER_REFRESH_MS: 5000, // Wait time after refreshing cookies before retry (in milliseconds)
  },

  // Payment and Rate Settings
  RATES: {
    BASE_HOURLY_RATE: 50, // Minimum desired hourly rate
    MIN_PAY_THRESHOLD_WORKMARKET: 100, // Minimum total pay for WorkMarket jobs
    MIN_PAY_THRESHOLD_FIELDNATION: 200, // Minimum total pay for FieldNation jobs
    TRAVEL_RATE: 30, // Rate per hour of travel
  },

  // Distance and Travel Settings
  DISTANCE: {
    TRAVEL_THRESHOLD_MILES: 30, // Miles before charging travel expenses
    TRAVEL_RATE_PER_MILE: 1.25, // Amount to charge per mile over threshold
    FREE_TRAVEL_LIMIT: 50 / 60, // Free travel time in hours (50 minutes)
    AVERAGE_SPEED: 50, // Average travel speed in miles per hour
  },

  // Time and Schedule Settings
  TIME: {
    DEFAULT_LABOR_HOURS: 3, // Default estimated labor hours if not specified
    MIN_HOURS_BETWEEN_JOBS: 1, // Minimum hours required between jobs
    WORK_START_TIME: "09:00", // Earliest time to accept jobs
    WORK_END_TIME: "19:00", // Latest time to accept jobs
    BUFFER_MINUTES: 30, // Buffer time between jobs
  },

  // Availability Check Settings
  AVAILABILITY: {
    // Options: "GOOGLE_CALENDAR", "WORKMARKET"
    PROVIDER: "WORKMARKET",
  },

  // Platform-specific Settings
  PLATFORMS: {
    FIELD_NATION: {
      USER_ID: 983643, // Your Field Nation user ID
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
    BOT_TOKEN: "8018594226:AAFjb09j1uXwurHiABXNVWDWzmXJehUZsaA",
    CHAT_ID: "271352684",
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
