import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(
      this.logDir,
      `app-${new Date().toISOString().split('T')[0]}.log`
    );
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }
  }

  // Console prints only if the message level is at or above the configured
  // threshold. The file always receives every level.
  shouldPrint(type) {
    const configured = LEVELS[(CONFIG.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;
    const msgLevel = LEVELS[type.toLowerCase()] ?? LEVELS.info;
    return msgLevel <= configured;
  }

  log(message, type = 'INFO', platform = '', workOrderId = '') {
    const timestamp = new Date().toISOString();
    const platformInfo = platform ? `[${platform}]` : '';
    const orderInfo = workOrderId ? `[Order: ${workOrderId}]` : '';
    const logEntry = `[${timestamp}] [${type}] ${platformInfo} ${orderInfo} ${message}\n`;

    // Console output (gated by LOG_LEVEL)
    if (this.shouldPrint(type)) {
      console.log(logEntry.trim());
    }

    // File output (always, regardless of level)
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message, platform = '', workOrderId = '') {
    this.log(message, 'ERROR', platform, workOrderId);
  }

  warn(message, platform = '', workOrderId = '') {
    this.log(message, 'WARN', platform, workOrderId);
  }

  info(message, platform = '', workOrderId = '') {
    this.log(message, 'INFO', platform, workOrderId);
  }

  // Verbose diagnostics (scraping/session chatter). Hidden from console unless
  // LOG_LEVEL is "debug"; still written to the log file.
  debug(message, platform = '', workOrderId = '') {
    this.log(message, 'DEBUG', platform, workOrderId);
  }
}

const logger = new Logger();
export default logger;
