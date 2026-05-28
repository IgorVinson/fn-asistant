import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, "../.."));

const { getAvailableBlocks } = await import("./getAvailableBlocks.js");
const { fetchWMBusy } = await import("./fetchWMBusy.js");
const { fetchCalendarBusy } = await import("./fetchCalendarBusy.js");

const date = "2026-05-28";

const wmBusyBlocks = await fetchWMBusy();
const calendarBusyBlocks = await fetchCalendarBusy(date, 3);

console.log("Calendar Busy Blocks:", calendarBusyBlocks);
console.log("WM Busy Blocks:", wmBusyBlocks);

const blocks = await getAvailableBlocks({
  date: date,
  daysToCheck: 7,
});
console.log(JSON.stringify(blocks, null, 2));
