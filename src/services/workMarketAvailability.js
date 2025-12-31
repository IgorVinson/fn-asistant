import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";
import { isSlotAvailableStatic } from "./calendarAvailability.js";
import { getWMSchedule } from "./platforms/workmarket/getWMSchedule.js";

export async function isSlotAvailableWorkMarket(workOrder) {
  const MIN_BUFFER_MINUTES = CONFIG.TIME.BUFFER_MINUTES;
  const { start: startTime, end: endTime } = workOrder.time;

  try {
    const occupiedSlots = await getWMSchedule();

    const workOrderStart = new Date(startTime);
    const workOrderEnd = new Date(endTime);

    occupiedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    logger.info(
      `WorkMarket Schedule Check:
      - Work Order: ${workOrderStart.toLocaleString()} - ${workOrderEnd.toLocaleString()}
      - Found ${occupiedSlots.length} existing assignments`,
      workOrder.platform,
      workOrder.id
    );

    const bufferMs = MIN_BUFFER_MINUTES * 60 * 1000;
    const windowStartMs = workOrderStart.getTime();
    const windowEndMs = workOrderEnd.getTime();

    for (const slot of occupiedSlots) {
      const slotStartBuffered = slot.start.getTime() - bufferMs;
      const slotEndBuffered = slot.end.getTime() + bufferMs;

      if (windowStartMs < slotEndBuffered && windowEndMs > slotStartBuffered) {
        logger.info(
          `WorkMarket schedule conflict detected within arrival window`,
          workOrder.platform,
          workOrder.id
        );
        return false;
      }
    }

    logger.info(
      `No WorkMarket schedule conflict detected within arrival window`,
      workOrder.platform,
      workOrder.id
    );
    return true;
  } catch (error) {
    logger.error(
      `Error checking WorkMarket availability: ${error.message}. Fallback to static check.`,
      workOrder.platform,
      workOrder.id
    );
    return isSlotAvailableStatic(workOrder);
  }
}
