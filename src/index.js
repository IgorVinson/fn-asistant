import { startServer } from "./api/server.js";
import telegramBot from "./api/telegram.js";
import { startMonitoring, stopMonitoring } from "./jobs/monitoring.js";
import { saveCookies } from "./jobs/relogin.js";
import { processOrder } from "./services/orderProcessing.js";

// Set up Telegram bot event handlers
// Wiring the bot commands to the actual logic implementation
telegramBot.onStartMonitoring = startMonitoring;
telegramBot.onStopMonitoring = stopMonitoring;
telegramBot.onProcessOrder = processOrder;
telegramBot.onRelogin = () => saveCookies(true);

// Start the server (which initializes everything)
startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
