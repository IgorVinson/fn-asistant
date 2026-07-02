import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, "../.."));

const { getAvailableBlocks } = await import("./getAvailableBlocks.js");
const { fetchWMBusy } = await import("./fetchWMBusy.js");
const { fetchCalendarBusy } = await import("./fetchCalendarBusy.js");
const { fetchFNBusy } = await import("./fetchFNBusy.js");

// Silence the app logger's console spam — it still writes to the log file.
const { default: logger } = await import("../logger.js");
logger.log = () => {};

const date = "2026-06-30";
const daysToCheck = 5;

// ── helpers ─────────────────────────────────────────────────────────────
const fmtTime = d =>
  d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const fmtDay = d =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
const dayKey = d => d.toLocaleDateString("en-US");
const dur = (a, b) => {
  const mins = Math.round((b.getTime() - a.getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (
    [h ? `${h}h` : null, m ? `${m}m` : null].filter(Boolean).join(" ") || "0m"
  );
};

function groupByDay(blocks) {
  const groups = new Map();
  for (const b of blocks) {
    const key = dayKey(b.start);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.start - b.start);
  }
  return groups;
}

function printSection(title, blocks, mark) {
  console.log(`\n${title}  (${blocks.length})`);
  console.log("─".repeat(50));
  if (blocks.length === 0) {
    console.log("  (none)");
    return;
  }
  const groups = groupByDay(blocks);
  for (const [, list] of groups) {
    console.log(`\n  ${fmtDay(list[0].start)}`);
    for (const b of list) {
      const label = b.summary ? `  ${b.summary}` : "";
      console.log(
        `    ${mark} ${fmtTime(b.start)} – ${fmtTime(b.end)}  (${dur(b.start, b.end)})${label}`
      );
    }
  }
}

// ── run ─────────────────────────────────────────────────────────────────
console.log(`\n=== Availability check from ${date} (${daysToCheck} days) ===`);
console.log("Fetching calendar + WorkMarket + FieldNation data…");

// Mute the noisy technical console output while fetching, then restore.
const realLog = console.log;
console.log = () => {};
const calendarBusyBlocks = await fetchCalendarBusy(date, daysToCheck);
const wmBusyBlocks = await fetchWMBusy();
const fnBusyBlocks = await fetchFNBusy();
const freeBlocks = await getAvailableBlocks({ date, daysToCheck });
console.log = realLog;

printSection("📅 BUSY — Calendar", calendarBusyBlocks, "✗");
printSection("🔧 BUSY — WorkMarket", wmBusyBlocks, "✗");
printSection("🛠️  BUSY — FieldNation", fnBusyBlocks, "✗");
printSection("✅ AVAILABLE", freeBlocks, "✓");

console.log("\n=== Done ===\n");
