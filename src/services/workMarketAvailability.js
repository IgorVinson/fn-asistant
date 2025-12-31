import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";
import { isSlotAvailableStatic } from "./calendarAvailability.js";
import { getWMSchedule } from "./platforms/workmarket/getWMSchedule.js";

export async function isSlotAvailableWorkMarket(workOrder) {
  const MIN_BUFFER_MINUTES = CONFIG.TIME.BUFFER_MINUTES;
  const actualLaborHours =
    workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
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

    const workDurationMs = actualLaborHours * 60 * 60 * 1000;
    const bufferMs = MIN_BUFFER_MINUTES * 60 * 1000;

    for (
      let testStart = workOrderStart.getTime();
      testStart + workDurationMs <= workOrderEnd.getTime();
      testStart += 15 * 60 * 1000
    ) {
      const testEnd = testStart + workDurationMs;

      let hasConflict = false;
      for (const slot of occupiedSlots) {
        const slotStartBuffered = slot.start.getTime() - bufferMs;
        const slotEndBuffered = slot.end.getTime() + bufferMs;

        if (testStart < slotEndBuffered && testEnd > slotStartBuffered) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        logger.info(
          `Available slot found in WorkMarket schedule: ${new Date(
            testStart
          ).toLocaleString()}`,
          workOrder.platform,
          workOrder.id
        );
        return true;
      }
    }

    logger.info(
      `No available slot found in WorkMarket schedule for ${actualLaborHours} hours`,
      workOrder.platform,
      workOrder.id
    );
    return false;
  } catch (error) {
    logger.error(
      `Error checking WorkMarket availability: ${error.message}. Fallback to static check.`,
      workOrder.platform,
      workOrder.id
    );
    return isSlotAvailableStatic(workOrder);
  }
}
