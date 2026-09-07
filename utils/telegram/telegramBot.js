import TelegramBot from "node-telegram-bot-api";
import { CONFIG } from "../../config.js";
import logger from "../logger.js";
import { persistLeadTimeTierMinPay } from "../configPersistence.js";
import {
  describeStrategy,
  formatLeadTimePolicy,
} from "../strategy/leadTimeStrategy.js";

class TelegramBotService {
  constructor() {
    this.bot = new TelegramBot(CONFIG.TELEGRAM.BOT_TOKEN, { polling: true });
    this.chatId = CONFIG.TELEGRAM.CHAT_ID;
    this.ingestBot = null;
    this.ingestChatId = CONFIG.TELEGRAM.CHAT_ID_2;
    this.isMonitoring = false;
    this.waitingForInput = null; // Track what input we're waiting for
    
    // Log all messages to help identify chat IDs
    this.bot.on("message", msg => {
      console.log("📱 Bot1 (MAIN) received message:", {
        chatId: msg.chat?.id?.toString(),
        fromId: msg.from?.id?.toString(),
        text: msg.text?.substring(0, 50),
      });
    });
    
    this.setupInboundPhoneBot();
    this.setupCommands();
    this.setupPersistentMenu();
  }

  setupInboundPhoneBot() {
    const secondaryToken = CONFIG.TELEGRAM.BOT_TOKEN_2;
    const primaryToken = CONFIG.TELEGRAM.BOT_TOKEN;

    console.log("🔧 Setting up inbound phone bot...", {
      hasToken2: !!secondaryToken,
      token2MatchesPrimary: secondaryToken === primaryToken,
      chatId2: CONFIG.TELEGRAM.CHAT_ID_2,
    });

    if (!secondaryToken || secondaryToken === primaryToken) {
      console.log("⚠️ No secondary token or matches primary - skipping inbound phone bot");
      return;
    }

    console.log("✅ Initializing inbound phone bot with token2");
    this.ingestBot = new TelegramBot(secondaryToken, { polling: true });
    
    this.ingestBot.on("message", msg => {
      this.handlePhoneMessage(msg, this.ingestChatId);
    });
    
    this.ingestBot.on("polling_error", error => {
      console.log("❌ Bot2 polling error:", error.message);
      logger.error(`Bot2 polling error: ${error.message}`);
    });
    
    this.ingestBot.on("error", error => {
      console.log("❌ Bot2 error:", error.message);
      logger.error(`Bot2 error: ${error.message}`);
    });
    
    console.log("✅ Inbound phone bot setup complete");
  }

  handlePhoneMessage(msg, expectedChatId) {
    console.log("\n📱 Phone message received:", {
      from: msg.chat?.id?.toString(),
      expected: expectedChatId,
      textPreview: msg.text?.substring(0, 100),
    });

    if (!msg.chat || msg.chat.id.toString() !== expectedChatId) {
      console.log("❌ Chat ID mismatch - ignoring message");
      return;
    }
    
    if (!msg.text || !msg.text.startsWith("FN_ALERT")) {
      console.log("❌ Message doesn't start with FN_ALERT");
      console.log("   Received text:", msg.text?.substring(0, 200));
      console.log("   First 10 chars:", JSON.stringify(msg.text?.substring(0, 10)));
      console.log("   Hex bytes:", Buffer.from(msg.text?.substring(0, 20) || "").toString('hex'));
      return;
    }

    console.log("✅ Valid FN_ALERT received, processing...");
    const alert = this.parsePhoneAlert(msg.text);
    if (this.onPhoneAlert) {
      this.onPhoneAlert(alert, msg);
    }
  }

  async setupPersistentMenu() {
    try {
      // Set up the persistent bot menu (hamburger menu)
      await this.bot.setMyCommands([
        { command: "start", description: "🚀 Start job monitoring" },
        { command: "stop", description: "⏹️ Stop job monitoring" },
        { command: "status", description: "📊 Check monitoring status" },
        { command: "settings", description: "⚙️ View/update settings" },
        { command: "policy", description: "🎯 Change minimum payment policy" },
        { command: "mode", description: "🧭 Show application mode" },
        { command: "setmode", description: "🧭 Set application mode" },
        { command: "dates", description: "📅 Show override dates" },
        { command: "adddate", description: "📅 Add override date" },
        { command: "deldate", description: "🗑️ Remove override date" },
        { command: "cleardates", description: "🧹 Clear override dates" },
        { command: "setrate", description: "💰 Set hourly rate" },
        { command: "setminpayfn", description: "💵 Set FN min pay" },
        { command: "setminpaywm", description: "💵 Set WM min pay" },
        { command: "setworkhours", description: "⏰ Set work hours" },
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
    const formatOverrideDates = () =>
      CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.length > 0
        ? CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.join(", ")
        : "None";

    const isValidIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value);

    // Handle all text messages (for interactive input)
    this.bot.on("message", msg => {
      if (!msg.chat || msg.chat.id.toString() !== this.chatId) return;

      // Skip if it's a command (starts with /)
      if (msg.text && msg.text.startsWith("/")) return;

      if (msg.text && msg.text.startsWith("FN_ALERT")) {
        this.handlePhoneMessage(msg, this.chatId);
        return;
      }

      // Handle waiting for input
      if (this.waitingForInput && msg.text) {
        void this.handleUserInput(msg.text);
        return;
      }
    });

    this.bot.on("callback_query", query => {
      if (
        !query.message?.chat ||
        query.message.chat.id.toString() !== this.chatId
      ) {
        return;
      }

      const match = query.data?.match(/^policy_tier:(\d)$/);
      if (!match) return;

      const tierIndex = Number(match[1]);
      const tier = CONFIG.STRATEGY?.LEAD_TIME_TIERS?.[tierIndex];
      if (!tier) return;

      this.waitingForInput = `policy:${tierIndex}`;
      void this.bot.answerCallbackQuery(query.id);
      const labels = [
        "Same day / urgent (≤36h)",
        "Mid-range (36h–7 days)",
        "7+ days",
      ];
      this.sendMessage(
        `💵 Enter the new minimum for ${labels[tierIndex]}\nCurrent: $${tier.minPay}\n\nExample: 150`
      );
    });

    // Start monitoring command
    this.bot.onText(/\/start/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.isMonitoring = true;
        if (this.onStartMonitoring) {
          this.onStartMonitoring();
        }
      }
    });

    // Stop monitoring command
    this.bot.onText(/\/stop/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.isMonitoring = false;
        if (this.onStopMonitoring) {
          this.onStopMonitoring();
        }
      }
    });

    // Status command
    this.bot.onText(/\/status/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const status = this.isMonitoring ? "🟢 Active" : "🔴 Stopped";
        const mode = CONFIG.TEST_MODE ? "🧪 TEST MODE (No applications)" : "🚀 REAL MODE (Live applications)";
        const strategy = CONFIG.STRATEGY?.ENABLED
          ? "🎯 Lead-time strategy ON"
          : "🔧 Manual (single threshold)";
        this.sendMessage(
          `Monitoring Status: ${status}\nMode: ${mode}\nStrategy: ${strategy}\nApplication Policy: ${CONFIG.APPLICATION_MODE}\nOverride Dates: ${formatOverrideDates()}`
        );
      }
    });

    // Process order command
    this.bot.onText(/\/process (.+)/, (msg, match) => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const orderLink = match[1];
        this.sendMessage(`🔄 Processing order: ${orderLink}`);
        if (this.onProcessOrder) {
          this.onProcessOrder(orderLink);
        }
      }
    });

    // Relogin command
    this.bot.onText(/\/relogin/, async msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.sendMessage("🔄 Initiating relogin process...");
        if (this.onRelogin) {
          try {
            await this.onRelogin();
            this.sendMessage("✅ Platform sessions refreshed successfully");
          } catch (error) {
            this.sendMessage(`❌ Platform session refresh failed: ${error.message}`);
          }
        }
      }
    });

    // Settings command - show current settings
    this.bot.onText(/\/settings/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const settingsText = `
⚙️ *Current Settings*

🧪 *Test Mode:* ${CONFIG.TEST_MODE ? "ON" : "OFF"}
🧭 *Application Mode:* ${CONFIG.APPLICATION_MODE}
🎯 *Lead-time Strategy:* ${CONFIG.STRATEGY?.ENABLED ? "ON" : "OFF"}${
          CONFIG.STRATEGY?.ENABLED
            ? `\n   ↳ Tiers: ${CONFIG.STRATEGY.LEAD_TIME_TIERS.map(
                t => `${t.maxLeadHours ? `≤${t.maxLeadHours}h` : "7d+"}=$${t.minPay}`
              ).join(", ")}\n   ↳ Granite premium: ≥$${CONFIG.STRATEGY.GRANITE_PREMIUM_MIN_RATE}/hr or "${CONFIG.STRATEGY.GRANITE_PREMIUM_TITLE_RE}" · Techs: ${CONFIG.STRATEGY.TECHNICIAN_COUNT}`
            : ""
        }
📅 *All-Company Override Dates:* ${formatOverrideDates()}

💰 *Base Hourly Rate:* $${CONFIG.RATES.BASE_HOURLY_RATE}/hr
💵 *Min Pay (FN):* $${CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION}
💵 *Min Pay (WM):* $${CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET}
🚗 *Travel Rate:* $${CONFIG.RATES.TRAVEL_RATE}/hr
📏 *Radius Threshold:* ${CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES} miles
⏰ *Work Hours:* ${CONFIG.TIME.WORK_START_TIME} - ${CONFIG.TIME.WORK_END_TIME}
⏳ *Buffer:* ${CONFIG.BUFFER_MINUTES || CONFIG.TIME.BUFFER_MINUTES} min

*Quick Update Commands:*
/mode - Show current mode
/setmode granite_only|all_companies|disabled
/policy - View/change lead-time minimums
/dates - Show override dates
/adddate YYYY-MM-DD
/deldate YYYY-MM-DD
/cleardates
/setrate - Set hourly rate
/setminpayfn - Set FN min pay
/setminpaywm - Set WM min pay
/setworkhours - Set work hours (e.g., 08:00-20:00)

💡 *Tip:* Changes take effect immediately!
        `;
        this.bot.sendMessage(this.chatId, settingsText, {
          parse_mode: "Markdown",
        });
      }
    });

    this.bot.onText(/\/policy$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.bot.sendMessage(
          this.chatId,
          `🎯 Current minimum payment policy\n\n${formatLeadTimePolicy()}\n\nChoose a tier to change:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `⚡ Same day / urgent — $${CONFIG.STRATEGY.LEAD_TIME_TIERS[0].minPay}`,
                    callback_data: "policy_tier:0",
                  },
                ],
                [
                  {
                    text: `📆 Mid-range — $${CONFIG.STRATEGY.LEAD_TIME_TIERS[1].minPay}`,
                    callback_data: "policy_tier:1",
                  },
                ],
                [
                  {
                    text: `🗓️ 7+ days — $${CONFIG.STRATEGY.LEAD_TIME_TIERS[2].minPay}`,
                    callback_data: "policy_tier:2",
                  },
                ],
              ],
            },
          }
        );
      }
    });

    this.bot.onText(/\/mode$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.sendMessage(
          `🧭 Application mode: ${CONFIG.APPLICATION_MODE}\n📅 Override dates: ${formatOverrideDates()}`
        );
      }
    });

    this.bot.onText(/\/setmode(?:\s+(.+))?$/, (msg, match) => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const nextMode = (match?.[1] || "").trim();
        const validModes = ["granite_only", "all_companies", "disabled"];

        if (!validModes.includes(nextMode)) {
          this.sendMessage(
            "❌ Invalid mode. Use: /setmode granite_only|all_companies|disabled"
          );
          return;
        }

        CONFIG.APPLICATION_MODE = nextMode;
        this.sendMessage(`✅ Application mode updated to ${nextMode}`);
        logger.info(`Settings updated: Application mode set to ${nextMode}`);
      }
    });

    this.bot.onText(/\/dates$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        this.sendMessage(`📅 Override dates: ${formatOverrideDates()}`);
      }
    });

    this.bot.onText(/\/adddate(?:\s+(.+))?$/, (msg, match) => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const nextDate = (match?.[1] || "").trim();

        if (!isValidIsoDate(nextDate)) {
          this.sendMessage("❌ Invalid date. Use: /adddate YYYY-MM-DD");
          return;
        }

        if (CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.includes(nextDate)) {
          this.sendMessage(`ℹ️ Override date already exists: ${nextDate}`);
          return;
        }

        CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.push(nextDate);
        CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.sort();
        this.sendMessage(`✅ Added override date: ${nextDate}`);
        logger.info(`Settings updated: Added override date ${nextDate}`);
      }
    });

    this.bot.onText(/\/deldate(?:\s+(.+))?$/, (msg, match) => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        const targetDate = (match?.[1] || "").trim();

        if (!isValidIsoDate(targetDate)) {
          this.sendMessage("❌ Invalid date. Use: /deldate YYYY-MM-DD");
          return;
        }

        const nextDates = CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.filter(
          date => date !== targetDate
        );

        if (nextDates.length === CONFIG.ALLOW_ALL_COMPANIES_ON_DATES.length) {
          this.sendMessage(`ℹ️ Override date not found: ${targetDate}`);
          return;
        }

        CONFIG.ALLOW_ALL_COMPANIES_ON_DATES = nextDates;
        this.sendMessage(`✅ Removed override date: ${targetDate}`);
        logger.info(`Settings updated: Removed override date ${targetDate}`);
      }
    });

    this.bot.onText(/\/cleardates$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.clearWaitingState();
        CONFIG.ALLOW_ALL_COMPANIES_ON_DATES = [];
        this.sendMessage("✅ Cleared all override dates");
        logger.info("Settings updated: Cleared all override dates");
      }
    });

    // Set hourly rate command (interactive)
    this.bot.onText(/\/setrate$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "rate";
        this.sendMessage(
          `💰 Please enter the new hourly rate (current: $${CONFIG.RATES.BASE_HOURLY_RATE}/hr):\n\nExample: 55`
        );
      }
    });

    // Set FN minimum pay command (interactive)
    this.bot.onText(/\/setminpayfn$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "minpayfn";
        this.sendMessage(
          `💵 Please enter the new FieldNation minimum pay threshold (current: $${CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION}):\n\nExample: 200`
        );
      }
    });

    // Set WM minimum pay command (interactive)
    this.bot.onText(/\/setminpaywm$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "minpaywm";
        this.sendMessage(
          `💵 Please enter the new WorkMarket minimum pay threshold (current: $${CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET}):\n\nExample: 100`
        );
      }
    });

    // Set work hours command (interactive)
    this.bot.onText(/\/setworkhours$/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
        this.waitingForInput = "workhours";
        this.sendMessage(
          `⏰ Please enter new work hours in HH:MM-HH:MM format (current: ${CONFIG.TIME.WORK_START_TIME}-${CONFIG.TIME.WORK_END_TIME}):\n\nExample: 08:30-21:00`
        );
      }
    });

    // Help command
    this.bot.onText(/\/help/, msg => {
      if (msg.chat && msg.chat.id.toString() === this.chatId) {
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
/mode - Show application mode
/setmode - Update application mode
/policy - View/change lead-time minimums
/dates - Show override dates
/adddate - Add override date
/deldate - Remove override date
/cleardates - Clear override dates
/settings - View current settings
/setrate - Update hourly rate
/setminpayfn - Update FN min pay
/setminpaywm - Update WM min pay
/setworkhours - Update work hours

*Other Commands:*
/process <link> - Process specific order
/help - Show this help

💡 *Tip:* Use the menu button (☰) for quick access!
        `;
        this.bot.sendMessage(this.chatId, helpText, {
          parse_mode: "Markdown",
        });
      }
    });
  }

  async handleUserInput(input) {
    if (this.waitingForInput === "workhours") {
      const hoursRegex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
      if (!hoursRegex.test(input)) {
        this.sendMessage("❌ Invalid format. Please use HH:MM-HH:MM (e.g., 09:00-18:00).");
        return;
      }
      const [start, end] = input.split("-");
      CONFIG.TIME.WORK_START_TIME = start;
      CONFIG.TIME.WORK_END_TIME = end;
      this.sendMessage(`✅ Work hours updated to ${start} - ${end}`);
      logger.info(`Settings updated: Work hours set to ${start}-${end}`);
      this.clearWaitingState();
      return;
    }

    const value = parseFloat(input);

    if (isNaN(value) || value <= 0) {
      this.sendMessage("❌ Please enter a valid positive number.");
      return;
    }

    if (this.waitingForInput?.startsWith("policy:")) {
      if (value > 2000) {
        this.sendMessage(
          "❌ Amount too high. Please enter a value between $1-$2000"
        );
        return;
      }

      const tierIndex = Number(this.waitingForInput.split(":")[1]);
      try {
        await persistLeadTimeTierMinPay(tierIndex, value);
        CONFIG.STRATEGY.LEAD_TIME_TIERS[tierIndex].minPay = value;
        this.sendMessage(
          `✅ Policy updated and saved to config.js\n\n${formatLeadTimePolicy()}`
        );
        logger.info(
          `Settings updated: Lead-time tier ${tierIndex + 1} minimum set to $${value} and persisted`
        );
        this.clearWaitingState();
      } catch (error) {
        logger.error(`Failed to persist payment policy: ${error.message}`);
        this.sendMessage(
          `❌ Policy was not changed because config.js could not be saved: ${error.message}`
        );
      }
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

      case "minpayfn":
        if (value > 2000) {
          this.sendMessage(
            "❌ Amount too high. Please enter a value between $1-$2000"
          );
          return;
        }
        CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION = value;
        this.sendMessage(`✅ FieldNation minimum pay threshold updated to $${value}`);
        logger.info(`Settings updated: FN min pay set to $${value}`);
        break;

      case "minpaywm":
        if (value > 2000) {
          this.sendMessage(
            "❌ Amount too high. Please enter a value between $1-$2000"
          );
          return;
        }
        CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET = value;
        this.sendMessage(`✅ WorkMarket minimum pay threshold updated to $${value}`);
        logger.info(`Settings updated: WM min pay set to $${value}`);
        break;
    }

    this.clearWaitingState();
  }

  clearWaitingState() {
    this.waitingForInput = null;
  }

  parsePhoneAlert(text) {
    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);
    const alert = {
      raw: text,
      type: lines[0] || "FN_ALERT",
    };

    for (const line of lines.slice(1)) {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) {
        alert[key] = value;
      }
    }

    return alert;
  }

  sendMessage(text) {
    this.bot.sendMessage(this.chatId, text).catch(error => {
      logger.error(`Failed to send Telegram message: ${error.message}`);
    });
  }

  escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  sendOrderNotification(orderData, action, details = "", orderLink = "") {
    const strategyLine = describeStrategy(orderData);
    const escapeHTML = value => this.escapeHTML(value);
    const modeBanner = CONFIG.TEST_MODE
      ? "<b>🧪 TEST MODE — no application will be submitted</b>"
      : "";
    const orderIdText = orderLink
      ? `<a href="${escapeHTML(orderLink)}">#${escapeHTML(orderData.id)}</a>`
      : `#${escapeHTML(orderData.id)}`;
    const payMin = orderData.payRange.min;
    const payMax = orderData.payRange.max;
    const payText =
      payMin === payMax ? `$${payMin}` : `$${payMin}–$${payMax}`;
    const message = [
      modeBanner,
      `<b>${escapeHTML(action)}</b> · ${escapeHTML(orderData.platform)} ${orderIdText}`,
      `<b>${escapeHTML(orderData.company)}</b> — ${escapeHTML(orderData.title)}`,
      `⏱ ${escapeHTML(orderData.estLaborHours)}h labor`,
      `💵 ${escapeHTML(payText)} · 📍 ${escapeHTML(orderData.distance)} mi`,
      `📅 ${escapeHTML(new Date(orderData.time.start).toLocaleString())}`,
      strategyLine ? `🎯 ${escapeHTML(strategyLine)}` : "",
      details ? escapeHTML(details) : "",
    ]
      .filter(Boolean)
      .join("\n");

    this.bot
      .sendMessage(this.chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      })
      .catch(error => {
        // If Markdown fails, send as plain text
        const plainMessage = `
${CONFIG.TEST_MODE ? "🧪 TEST MODE — no application will be submitted\n" : ""}
🔔 New Job Alert

Platform: ${orderData.platform}
Order ID: ${orderData.id} (${orderLink || "No link"})
Company: ${orderData.company}
Title: ${orderData.title}
Labor: ${orderData.estLaborHours}h
Pay: $${orderData.payRange.min}-$${orderData.payRange.max}
Distance: ${orderData.distance}mi
Time: ${new Date(orderData.time.start).toLocaleString()}
${strategyLine ? `Strategy: ${strategyLine}\n` : ""}
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
  onPhoneAlert = null;
}

export default new TelegramBotService();
