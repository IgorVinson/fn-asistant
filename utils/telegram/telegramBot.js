import TelegramBot from "node-telegram-bot-api";
import { CONFIG } from "../../config.js";
import logger from "../logger.js";

class TelegramBotService {
  constructor() {
    this.bot = new TelegramBot(CONFIG.TELEGRAM.BOT_TOKEN, { polling: true });
    this.chatId = CONFIG.TELEGRAM.CHAT_ID;
    this.isMonitoring = false;
    this.setupCommands();
  }

  setupCommands() {
    // Start monitoring command
    this.bot.onText(/\/start/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
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
        const status = this.isMonitoring ? "🟢 Active" : "🔴 Stopped";
        this.sendMessage(`Monitoring Status: ${status}`);
      }
    });

    // Process order command
    this.bot.onText(/\/process (.+)/, (msg, match) => {
      if (msg.chat.id.toString() === this.chatId) {
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
        this.sendMessage("🔄 Initiating relogin process...");
        if (this.onRelogin) {
          this.onRelogin();
        }
      }
    });

    // Help command
    this.bot.onText(/\/help/, msg => {
      if (msg.chat.id.toString() === this.chatId) {
        const helpText = `
🤖 Available Commands:

/start - Start job monitoring
/stop - Stop job monitoring
/status - Check monitoring status
/process <order_link> - Process specific order
/relogin - Trigger relogin to platforms
/help - Show this help message

Example:
/process https://app.fieldnation.com/workorder/12345
        `;
        this.sendMessage(helpText);
      }
    });
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
