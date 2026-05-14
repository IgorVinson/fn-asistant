import { getAvailableBlocks } from "./getAvailableBlocks.js";

const date = "2026-05-15";

const blocks = await getAvailableBlocks({
  date: new Date(date),
  daysToCheck: 7,
});
console.log(JSON.stringify(blocks, null, 2));
