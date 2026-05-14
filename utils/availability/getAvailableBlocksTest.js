import { getAvailableBlocks } from "./getAvailableBlocks.js";
const blocks = await getAvailableBlocks({ date: new Date(), daysToCheck: 7 });
console.log(blocks);
