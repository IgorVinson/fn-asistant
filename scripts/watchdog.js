import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startSupervisor } from "../utils/processSupervisor.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supervisor = startSupervisor({
  entry: path.join(projectRoot, "index.js"),
  cwd: projectRoot,
  logDir: path.join(projectRoot, "logs"),
  async onRestart({ code, signal, restartReason, delayMs }) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ chat_id: chatId,
        text: `FN Assistant restarting in ${delayMs / 1000}s: ${restartReason || signal || `exit ${code}`}` }),
    });
  },
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await supervisor.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
