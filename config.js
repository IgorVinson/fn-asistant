/**
 * Configuration file for FN Assistant
 * Load environment variables from .env file
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export const CONFIG = {
  // Platform configuration
  FIELDNATION_ENABLED: process.env.FIELDNATION_ENABLED === 'true',
  WORKMARKET_ENABLED: process.env.WORKMARKET_ENABLED === 'true',

  // Payment and Rate Settings
  RATES: {
    BASE_HOURLY_RATE: parseInt(process.env.BASE_HOURLY_RATE || '50'),
    MIN_PAY_THRESHOLD_WORKMARKET: parseInt(process.env.MIN_PAY_THRESHOLD_WORKMARKET || '100'),
    MIN_PAY_THRESHOLD_FIELDNATION: parseInt(process.env.MIN_PAY_THRESHOLD_FIELDNATION || '200'),
    TRAVEL_RATE: 30, // Rate per hour of travel
  },

  // Distance and Travel Settings
  DISTANCE: {
    TRAVEL_THRESHOLD_MILES: 30,
    TRAVEL_RATE_PER_MILE: parseFloat(process.env.TRAVEL_RATE_PER_MILE || '1.25'),
    FREE_TRAVEL_LIMIT: 50 / 60, // Free travel time in hours (50 minutes)
    AVERAGE_SPEED: 50, // Average travel speed in miles per hour
  },

  // Time and Schedule Settings
  TIME: {
    DEFAULT_LABOR_HOURS: 2,
    MIN_HOURS_BETWEEN_JOBS: 1,
    WORK_START_TIME: process.env.WORK_START_TIME || '09:00',
    WORK_END_TIME: process.env.WORK_END_TIME || '19:00',
    BUFFER_MINUTES: parseInt(process.env.BUFFER_MINUTES || '30'),
  },

  // Platform-specific Settings
  PLATFORMS: {
    FIELD_NATION: {
      USER_ID: parseInt(process.env.FIELDNATION_USER_ID || '0'),
      API_ENDPOINTS: {
        REQUESTS: 'https://app.fieldnation.com/v2/workorders',
      },
    },
    WORK_MARKET: {
      EMAIL: process.env.WM_EMAIL || '',
      PASSWORD: process.env.WM_PASSWORD || '',
    },
  },

  // Telegram Bot Settings
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
    COMMANDS: {
      START_MONITORING: '/start',
      STOP_MONITORING: '/stop',
      STATUS: '/status',
      PROCESS_ORDER: '/process',
      HELP: '/help',
      RELOGIN: '/relogin',
    },
  },

  // Default Values
  DEFAULTS: {
    COMPANY_NAME: 'Unknown Company',
    PLATFORM_NAME: 'Unknown',
  },
};
