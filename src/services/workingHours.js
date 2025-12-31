import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";

// Check if a job window overlaps enough with working hours
export function isWithinWorkingHours(startTime, endTime, workOrder = {}) {
  const workStartTime = CONFIG.TIME.WORK_START_TIME;
  const workEndTime = CONFIG.TIME.WORK_END_TIME;

  const jobStart = new Date(startTime);
  const jobEnd = new Date(endTime);
  const jobDate = jobStart.toISOString().split("T")[0];

  const dayWorkStart = new Date(`${jobDate}T${workStartTime}:00`);
  const dayWorkEnd = new Date(`${jobDate}T${workEndTime}:00`);

  const hasOverlap = jobStart < dayWorkEnd && jobEnd > dayWorkStart;

  const actualLaborHours =
    workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const overlapStart = new Date(
    Math.max(jobStart.getTime(), dayWorkStart.getTime())
  );
  const overlapEnd = new Date(Math.min(jobEnd.getTime(), dayWorkEnd.getTime()));
  const overlapHours =
    (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
  const hasEnoughOverlap = overlapHours >= actualLaborHours;

  logger.info(
    `Working Hours Check:
    - Job Date: ${jobDate}
    - Job Window: ${jobStart.toLocaleTimeString()} - ${jobEnd.toLocaleTimeString()}
    - Work Hours: ${workStartTime} - ${workEndTime}
    - Required Labor Hours: ${actualLaborHours}
    - Overlap Hours: ${overlapHours.toFixed(1)}
    - Has Overlap: ${hasOverlap}
    - Enough Overlap: ${hasEnoughOverlap}
    - Decision: ${hasOverlap && hasEnoughOverlap}`,
    "SCHEDULE_CHECK"
  );

  return hasOverlap && hasEnoughOverlap;
}
