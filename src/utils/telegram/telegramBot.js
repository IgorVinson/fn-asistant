import TelegramBot from "node-telegram-bot-api";
import { CONFIG } from "../../../config/config.js";
import logger from "../logger.js";

class TelegramBotService {
  constructor() {
    // In production (Render), we should ideally use Webhooks, but Polling is easier to set up initially.
    // However, Render's free tier spins down, which kills polling.
    // For a paid service or continuous running, polling is fine.
    // If you have multiple instances, polling will cause conflicts (duplicate updates).

    const isProduction = process.env.NODE_ENV === "production";

    // Use polling for now as it's simplest, but be aware of limitations
    this.bot = new TelegramBot(CONFIG.TELEGRAM.BOT_TOKEN, { polling: true });

    this.chatId = CONFIG.TELEGRAM.CHAT_ID;
    this.isMonitoring = false;
    this.waitingForInput = null; // Track what input we're waiting for
    this.setupCommands();
    this.setupPersistentMenu();
  }

  async setupPersistentMenu() {
    try {
      // Set up the persistent bot menu (hamburger menu)
      await this.bot.setMyCommands([
        { command: "start", description: "🚀 Start job monitoring" },
        { command: "stop", description: "⏹️ Stop job monitoring" },
        { command: "status", description: "📊 Check monitoring status" },
        { command: "settings", description: "⚙️ View/update settings" },
        { command: "setrate", description: "💰 Set hourly rate" },
        { command: "setminpay", description: "💵 Set minimum pay" },
        { command: "settravel", description: "🚗 Set travel rate per mile" },
        { command: "relogin", description: "🔄 Trigger relogin to platforms" },
        { command: "process", description: "🔄 Process specific order link" },
        { command: "help", description: "❓ Show help information" },
      ]);
      console.log("✅ Persistent menu commands set successfully");
    } catch (error) {
      logger.error(`Failed to set bot commands: ${error.message}`);
    }
  }

  setupCommands() {
    // Handle all text messages (for interactive input)
    this.bot.on("message", msg => {
      if (msg.chat.id.toString() !== this.chatId) return;

      // Skip if it's a command (starts with /)
      if (msg.text && msg.text.startsWith("/")) return;

      // Handle waiting for input
      if (this.waitingForInput && msg.text) {
        this.handleUserInput(msg.text);
        return;
      }
    });

    // Start monitoring command
    this.bot.onText(/\/start/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.sendMessage("🚀 Starting job monitoring...");
        this.isMonitoring = true;
        if (this.onStartMonitoring) {
          this.onStartMonitoring();
        }
      }
    });

    // Stop monitoring command
    this.bot.onText(/\/stop/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.sendMessage("⏹️ Stopping job monitoring...");
        this.isMonitoring = false;
        if (this.onStopMonitoring) {
          this.onStopMonitoring();
        }
      }
    });

    // Status command
    this.bot.onText(/\/status/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const status = this.isMonitoring ? "🟢 Active" : "🔴 Stopped";
        this.sendMessage(`Monitoring Status: ${status}`);
      }
    });

    // Process order command
    this.bot.onText(/\/process (.+)/, (msg, match) => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const orderLink = match[1];
        this.sendMessage(`🔄 Processing order: ${orderLink}`);
        if (this.onProcessOrder) {
          this.onProcessOrder(orderLink);
        }
      }
    });

    // Relogin command
    this.bot.onText(/\/relogin/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.sendMessage("🔄 Initiating relogin process...");
        if (this.onRelogin) {
          this.onRelogin();
        }
      }
    });

    // Settings command - show current settings
    this.bot.onText(/\/settings/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const settingsText = `
⚙️ *Current Settings*

💰 *Base Hourly Rate:* $${CONFIG.RATES.BASE_HOURLY_RATE}/hr
💵 *Minimum Pay Threshold:* $${CONFIG.RATES.MIN_PAY_THRESHOLD}
🚗 *Travel Rate:* $${CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE}/mile
📏 *Travel Threshold:* ${CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES} miles
⏰ *Working Hours:* ${CONFIG.TIME.WORK_START_TIME} - ${CONFIG.TIME.WORK_END_TIME}

*Quick Update Commands:*
\`/setrate\` - Set hourly rate
\`/setminpay\` - Set minimum pay  
\`/settravel\` - Set travel rate per mile

💡 *Tip:* Changes take effect immediately!
        `;
        this.bot.sendMessage(this.chatId, settingsText, {
          parse_mode: "Markdown",
        });
      }
    });

    // Set hourly rate command (interactive)
    this.bot.onText(/\/setrate$/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "rate";
        this.sendMessage(
          `💰 Please enter the new hourly rate (current: $${CONFIG.RATES.BASE_HOURLY_RATE}/hr):\n\nExample: 55`
        );
      }
    });

    // Set minimum pay command (interactive)
    this.bot.onText(/\/setminpay$/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "minpay";
        this.sendMessage(
          `💵 Please enter the new minimum pay threshold (current: $${CONFIG.RATES.MIN_PAY_THRESHOLD}):\n\nExample: 200`
        );
      }
    });

    // Set travel rate command (interactive)
    this.bot.onText(/\/settravel$/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "travel";
        this.sendMessage(
          `🚗 Please enter the new travel rate per mile (current: $${CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE}/mile):\n\nExample: 1.50`
        );
      }
    });

    // Help command
    this.bot.onText(/\/help/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const status = this.isMonitoring ? "🟢 Active" : "🔴 Stopped";
        const helpText = `
🤖 *Job Monitoring Bot*

*Current Status:* ${status}

*Control Commands:*
/start - Start job monitoring
/stop - Stop job monitoring  
/status - Check monitoring status
/relogin - Trigger relogin to platforms

*Settings Commands:*
/settings - View current settings
/setrate - Update hourly rate (interactive)
/setminpay - Update minimum pay (interactive)
/settravel - Update travel rate per mile (interactive)

*Other Commands:*
/process <link> - Process specific order
/help - Show this help

*Example:*
\`/process https://app.fieldnation.com/workorder/12345\`

💡 *Tip:* Use the menu button (☰) for quick access!
        `;
        this.bot.sendMessage(this.chatId, helpText, {
          parse_mode: "Markdown",
        });
      }
    });
  }

  handleUserInput(input) {
    const value = parseFloat(input);

    if (isNaN(value) || value <= 0) {
      this.sendMessage("❌ Please enter a valid positive number.");
      return;
    }

    switch (this.waitingForInput) {
      case "rate":
        if (value > 200) {
          this.sendMessage(
            "❌ Rate too high. Please enter a value between $1-$200"
          );
          return;
        }
        CONFIG.RATES.BASE_HOURLY_RATE = value;
        this.sendMessage(`✅ Hourly rate updated to $${value}/hr`);
        logger.info(`Settings updated: Base hourly rate set to $${value}`);
        break;

      case "minpay":
        if (value > 2000) {
          this.sendMessage(
            "❌ Amount too high. Please enter a value between $1-$2000"
          );
          return;
        }
        CONFIG.RATES.MIN_PAY_THRESHOLD = value;
        this.sendMessage(`✅ Minimum pay threshold updated to $${value}`);
        logger.info(`Settings updated: Minimum pay threshold set to $${value}`);
        break;

      case "travel":
        if (value > 10) {
          this.sendMessage(
            "❌ Rate too high. Please enter a value between $0.01-$10.00"
          );
          return;
        }
        CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE = value;
        this.sendMessage(`✅ Travel rate updated to $${value}/mile`);
        logger.info(`Settings updated: Travel rate set to $${value}/mile`);
        break;
    }

    this.clearWaitingState();
  }

  clearWaitingState() {
    this.waitingForInput = null;
  }

  sendMessage(text) {
    this.bot.sendMessage(this.chatId, text).catch(error => {
      logger.error(`Failed to send Telegram message: ${error.message}`);
    });
  }

  sendOrderNotification(orderData, action, details = "", orderLink = "") {
    // Escape special characters for Markdown
    const escapeMarkdown = text => {
      return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
    };

    let orderIdText;
    if (orderLink) {
      // Create clickable link with escaped text
      orderIdText = `[${orderData.id}](${orderLink})`;
    } else {
      orderIdText = escapeMarkdown(orderData.id.toString());
    }

    const message = `
🔔 *New Job Alert*

*Platform:* ${escapeMarkdown(orderData.platform)}
*Order ID:* ${orderIdText}
*Company:* ${escapeMarkdown(orderData.company)}
*Title:* ${escapeMarkdown(orderData.title)}
*Pay:* $${orderData.payRange.min}-$${orderData.payRange.max}
*Distance:* ${orderData.distance}mi
*Time:* ${escapeMarkdown(new Date(orderData.time.start).toLocaleString())}

*Action:* ${action}
${details ? escapeMarkdown(details) : ""}
    `;

    this.bot
      .sendMessage(this.chatId, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      })
      .catch(error => {
        // If Markdown fails, send as plain text
        const plainMessage = `
🔔 New Job Alert

Platform: ${orderData.platform}
Order ID: ${orderData.id} (${orderLink || "No link"})
Company: ${orderData.company}
Title: ${orderData.title}
Pay: $${orderData.payRange.min}-$${orderData.payRange.max}
Distance: ${orderData.distance}mi
Time: ${new Date(orderData.time.start).toLocaleString()}

Action: ${action}
${details}
      `;

        this.bot.sendMessage(this.chatId, plainMessage).catch(fallbackError => {
          logger.error(
            `Failed to send Telegram message (both formats): ${fallbackError.message}`
          );
        });
      });
  }

  // Event handlers (to be set by main application)
  onStartMonitoring = null;
  onStopMonitoring = null;
  onProcessOrder = null;
  onRelogin = null;
}

export default new TelegramBotService();
