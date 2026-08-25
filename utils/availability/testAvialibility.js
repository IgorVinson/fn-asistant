import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, "../.."));

const { getAvailableBlocks } = await import("./getAvailableBlocks.js");
// Silence the app logger's console spam — it still writes to the log file.
const { default: logger } = await import("../logger.js");
logger.log = () => {};

const localIsoDate = value => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const date = process.argv[2] || localIsoDate(new Date());
const isLiveCheck = !process.argv[2];
const parsedDays = Number.parseInt(process.argv[3] || "7", 10);
const daysToCheck =
  Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 7;

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
let result;
try {
  result = await getAvailableBlocks({ date, daysToCheck, withBusy: true });
} catch (error) {
  console.log = realLog;
  if (error?.name === "WMAuthError") {
    console.error(
      "\n❌ WorkMarket session expired. Run /relogin, then repeat this check.\n"
    );
    process.exitCode = 2;
  } else {
    console.error(`\n❌ Availability check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
} finally {
  console.log = realLog;
}

if (!result) process.exit();

const freeBlocks = result.free;
const [year, month, day] = date.split("-").map(Number);
const rangeStart = new Date(year, month - 1, day);
const rangeEnd = new Date(year, month - 1, day + daysToCheck + 1);
const inRequestedRange = block =>
  block.start < rangeEnd && block.end > rangeStart;
const visibleBusy = blocks => blocks.filter(inRequestedRange);
const now = new Date();
const visibleFreeBlocks = freeBlocks
  .filter(block => !isLiveCheck || block.end > now)
  .map(block =>
    isLiveCheck && block.start < now
      ? { ...block, start: new Date(now) }
      : block
  );
const calendarBusyBlocks = visibleBusy(result.sources.calendar);
const wmBusyBlocks = visibleBusy(result.sources.workMarket);
const fnBusyBlocks = visibleBusy(result.sources.fieldNation);

printSection("📅 BUSY — Calendar", calendarBusyBlocks, "✗");
printSection("🔧 BUSY — WorkMarket", wmBusyBlocks, "✗");
printSection("🛠️  BUSY — FieldNation", fnBusyBlocks, "✗");
printSection(
  isLiveCheck ? "✅ AVAILABLE — NOW/FUTURE" : "✅ AVAILABLE",
  visibleFreeBlocks,
  "✓"
);

console.log("\n=== Done ===\n");
