export const CONFIG = {
  // Payment and Rate Settings
  RATES: {
    BASE_HOURLY_RATE: 50, // Minimum desired hourly rate
    MIN_PAY_THRESHOLD: 200, // Minimum total pay for a job
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
    DEFAULT_LABOR_HOURS: 4, // Default estimated labor hours if not specified
    MIN_HOURS_BETWEEN_JOBS: 2, // Minimum hours required between jobs
    WORK_START_TIME: '08:00', // Earliest time to accept jobs
    WORK_END_TIME: '19:00', // Latest time to accept jobs
    BUFFER_MINUTES: 30, // Buffer time between jobs
  },

  // Platform-specific Settings
  PLATFORMS: {
    FIELD_NATION: {
      USER_ID: 983643, // Your Field Nation user ID
      API_ENDPOINTS: {
        REQUESTS: 'https://app.fieldnation.com/v2/workorders',
      },
    },
    WORK_MARKET: {
      // Add WorkMarket specific settings here
    },
  },

  // Telegram Bot Settings
  TELEGRAM: {
    BOT_TOKEN: '8018594226:AAFjb09j1uXwurHiABXNVWDWzmXJehUZsaA',
    CHAT_ID: '271352684',
    COMMANDS: {
      START_MONITORING: '/start',
      STOP_MONITORING: '/stop',
      STATUS: '/status',
      PROCESS_ORDER: '/process',
      HELP: '/help',
      RELOGIN: '/relogin'
    }
  },

  // Default Values
  DEFAULTS: {
    COMPANY_NAME: 'Unknown Company',
    PLATFORM_NAME: 'Unknown',
  },
};