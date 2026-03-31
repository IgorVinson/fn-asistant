import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const BOT_TOKEN1 = process.env.TELEGRAM_BOT_TOKEN;
const BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN2;

console.log("\n🔍 Chat ID Finder Tool\n");
console.log("=".repeat(50));
console.log("\nStep 1: Send a message to Bot1 (for notifications)");
console.log("Bot Token:", BOT_TOKEN1 ? `${BOT_TOKEN1.substring(0, 10)}...` : "NOT SET");
console.log("\nStep 2: Send a message to Bot2 (for receiving phone alerts)");
console.log("Bot Token:", BOT_TOKEN2 ? `${BOT_TOKEN2.substring(0, 10)}...` : "NOT SET");
console.log("\n" + "=".repeat(50));

const bot1 = new TelegramBot(BOT_TOKEN1, { polling: true });
const bot2 = BOT_TOKEN2 ? new TelegramBot(BOT_TOKEN2, { polling: true }) : null;

bot1.on("message", msg => {
  console.log("\n✅ Bot1 Message Received:");
  console.log("   Chat ID:", msg.chat?.id?.toString());
  console.log("   From ID:", msg.from?.id?.toString());
  console.log("   Username:", msg.from?.username || "N/A");
  console.log("   Text:", msg.text?.substring(0, 50));
  console.log("\n💡 Update your .env file:");
  console.log("   TELEGRAM_CHAT_ID=" + msg.chat?.id?.toString());
});

if (bot2) {
  bot2.on("message", msg => {
    console.log("\n✅ Bot2 Message Received:");
    console.log("   Chat ID:", msg.chat?.id?.toString());
    console.log("   From ID:", msg.from?.id?.toString());
    console.log("   Username:", msg.from?.username || "N/A");
    console.log("   Text:", msg.text?.substring(0, 50));
    console.log("\n💡 Update your .env file:");
    console.log("   TELEGRAM_CHAT_ID2=" + msg.chat?.id?.toString());
  });
}

console.log("\n📱 Send a message to each bot now...\n");
console.log("   Bot1: @your_bot1_username");
console.log("   Bot2: @your_bot2_username\n");
console.log("Press Ctrl+C when done.\n");