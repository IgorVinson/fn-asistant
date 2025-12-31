import express from "express";
import { CONFIG } from "../../config/config.js";
import telegramBot from "../api/telegram.js";
import { saveCookies, scheduleRelogin } from "../jobs/relogin.js";

const app = express();
const port = CONFIG.SERVER.PORT;

export function startServer() {
  app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    telegramBot.sendMessage(
      `🚀 Server started on port ${port}\nUse /help for available commands or the menu button (☰) for quick access`
    );
    
    // Initial startup tasks
    await saveCookies();
    // Note: We don't auto-start monitoring anymore, we wait for Telegram command or explicit start
    scheduleRelogin();
  });
}

export default app;
