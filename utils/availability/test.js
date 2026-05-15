import { getAvailableBlocks } from "./getAvailableBlocks.js";
import { fetchWMBusy } from "./fetchWMBusy.js";
import { fetchCalendarBusy } from "./fetchCalendarBusy.js";

const date = "2026-05-15";

const wmBusyBlocks = await fetchWMBusy();
const calendarBusyBlocks = await fetchCalendarBusy(date, 7);

console.log("Calendar Busy Blocks:", calendarBusyBlocks);
console.log("WM Busy Blocks:", wmBusyBlocks);

const blocks = await getAvailableBlocks({
  date: new Date(date),
  daysToCheck: 7,
});
console.log(JSON.stringify(blocks, null, 2));
