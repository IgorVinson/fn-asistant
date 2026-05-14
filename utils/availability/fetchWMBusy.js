import { fetchWMAssignments } from "../WorkMarket/getWMAssignments.js";
import logger from "../logger.js";

export async function fetchWMBusy() {
  try {
    const wmAssignments = await fetchWMAssignments();

    if (!wmAssignments || wmAssignments.length === 0) {
      logger.info("fetchWMBusy: no WM assignments found");
      return [];
    }

    const busyBlocks = wmAssignments
      .filter(a => a.start instanceof Date && !isNaN(a.start.getTime()))
      .map(a => ({
        start: a.start,
        end: a.end instanceof Date && !isNaN(a.end.getTime())
          ? a.end
          : new Date(a.start.getTime() + 4 * 60 * 60 * 1000),
        summary: a.summary || "WM Assignment",
      }));

    logger.info(
      `fetchWMBusy: found ${busyBlocks.length} WM busy blocks`
    );

    return busyBlocks;
  } catch (error) {
    logger.error(`fetchWMBusy: error fetching WM assignments: ${error.message}`);
    return [];
  }
}