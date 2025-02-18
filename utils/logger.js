import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

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

  formatOrderDetails(message) {
    if (message.includes('New Order')) {
      const [firstLine, ...otherLines] = message.split('\n');
      const formattedLines = otherLines.map(line => {
        if (line.includes('Time:')) {
          return chalk.yellow(line);
        }
        if (line.includes('Pay:')) {
          return chalk.green(line);
        }
        return line;
      });
      return [firstLine, ...formattedLines].join('\n');
    }
    
    if (message.includes('Decision') || message.includes('No Action')) {
      return chalk.cyan(message);
    }
    
    return message;
  }

  log(message, type = 'INFO', platform = '', workOrderId = '') {
    const timestamp = `[${new Date().toISOString()}]`;
    const typeStr = `[${type}]`;
    const platformInfo = platform ? `[${platform}]` : '';
    const orderInfo = workOrderId ? ` [Order: ${workOrderId}]` : '';
    
    const formattedMessage = this.formatOrderDetails(message);

    console.log(`${timestamp} ${typeStr} ${platformInfo} ${orderInfo} ${formattedMessage}`);

    const logEntry = `[${new Date().toISOString()}] [${type}] [${platform}] ${orderInfo} ${message}\n`;
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
