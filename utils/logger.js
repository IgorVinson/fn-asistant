import fs from 'fs';
import path from 'path';

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

  log(message, type = 'INFO', platform = '', workOrderId = '') {
    const timestamp = new Date().toISOString();
    const platformInfo = platform ? `[${platform}]` : '';
    const orderInfo = workOrderId ? `[Order: ${workOrderId}]` : '';
    const logEntry = `[${timestamp}] [${type}] ${platformInfo} ${orderInfo} ${message}\n`;

    // Console output
    console.log(logEntry.trim());

    // File output
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message, platform = '', workOrderId = '') {
    this.log(message, 'ERROR', platform, workOrderId);
  }

  info(message, platform = '', workOrderId = '') {
    this.log(message, 'INFO', platform, workOrderId);
  }
}

const logger = new Logger();
export default logger;
