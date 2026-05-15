import { fetchWMAssignments } from "../WorkMarket/getWMAssignments.js";
import logger from "../logger.js";

function roundToMinute(date) {
  return new Date(Math.round(date.getTime() / (60 * 1000)) * 60 * 1000);
}

export async function fetchWMBusy() {
  try {
    const wmAssignments = await fetchWMAssignments();

    if (!wmAssignments || wmAssignments.length === 0) {
      logger.info("fetchWMBusy: no WM assignments found");
      return [];
    }

    const busyBlocks = wmAssignments
      .filter(a => a.start instanceof Date && !isNaN(a.start.getTime()))
      .map(a => {
        const start = roundToMinute(a.start);
        const end = a.end instanceof Date && !isNaN(a.end.getTime())
          ? roundToMinute(a.end)
          : new Date(start.getTime() + 4 * 60 * 60 * 1000);
        return { start, end, summary: a.summary || "WM Assignment" };
      });

    logger.info(
      `fetchWMBusy: found ${busyBlocks.length} WM busy blocks`
    );

    return busyBlocks;
  } catch (error) {
    logger.error(`fetchWMBusy: error fetching WM assignments: ${error.message}`);
    return [];
  }
}