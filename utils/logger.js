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
          return line.replace(/(\d{1,2}\/\d{1,2}\/\d{4})/g, chalk.red('$1'));
        }
        if (line.includes('Pay:')) {
          return line.replace(/\$\d+(-\$\d+)?/g, match => chalk.green(match));
        }
        return line;
      });
      return [firstLine, ...formattedLines].join('\n');
    }
    return message;
  }

  log(message, type = 'INFO', platform = '', workOrderId = '') {
    const timestamp = chalk.yellow(`[${new Date().toISOString()}]`);
    const typeStr = chalk.yellow(`[${type}]`);
    const platformInfo = platform ? chalk.cyan(`[${platform}]`) : '';
    const orderInfo = workOrderId ? ` [Order: ${chalk.yellow(workOrderId)}]` : '';
    
    // Format the message with colors
    const formattedMessage = this.formatOrderDetails(message);

    // Console output with colors
    console.log(`${timestamp} ${typeStr} ${platformInfo} ${orderInfo} ${formattedMessage}`);

    // File output without colors
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
