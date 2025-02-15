export const CONFIG = {
  // Payment and Rate Settings
  RATES: {
    // Base rates
    BASE_RATE: 150, // Base rate for jobs up to 2 hours (FieldNation)
    BASE_HOURS: 2, // Number of hours covered by base rate (FieldNation)
    ADDITIONAL_HOURLY_RATE: 55, // Rate per additional hour after base hours (FieldNation)
    BASE_HOURLY_RATE: 50, // Standard hourly rate for WorkMarket

    // Travel related
    TRAVEL_THRESHOLD_MILES: 30, // Miles before charging travel expenses
    TRAVEL_RATE_PER_MILE: 1, // Amount to charge per mile over threshold
  },

  // Work Schedule Settings
  SCHEDULE: {
    WORK_START_TIME: '07:59', // Daily work start time
    WORK_END_TIME: '19:00', // Daily work end time
    MIN_BUFFER_MINUTES: 30, // Minimum buffer time between jobs
  },

  // Default Values
  DEFAULTS: {
    LABOR_HOURS: 4, // Default labor hours if not specified
    COMPANY_NAME: 'Unknown Company',
    PLATFORM_NAME: 'Unknown',
  },

  // Platform-specific Settings
  PLATFORMS: {
    FIELD_NATION: {
      USER_ID: 983643,
      COUNTER_OFFER: {
        NOTE: "Hi there! I hope you're doing well. I was wondering if it would be possible to add travel expenses and provide the total payment amount. Thank you so much!",
        TRAVEL_EXPENSE_CATEGORY: {
          uid: 2,
          id: 2,
        },
      },
    },
    WORK_MARKET: {
      COUNTER_OFFER: {
        NOTE: 'Hi! Could you please submit my counteroffer with travel expenses?',
      },
    },
  },
};
