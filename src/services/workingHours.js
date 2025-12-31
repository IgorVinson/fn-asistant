import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";

// Check if a job window overlaps enough with working hours
export function isWithinWorkingHours(startTime, endTime, workOrder = {}) {
  const workStartTime = CONFIG.TIME.WORK_START_TIME;
  const workEndTime = CONFIG.TIME.WORK_END_TIME;

  const jobStart = new Date(startTime);
  const jobEnd = new Date(endTime);
  const jobDate = `${jobStart.getFullYear()}-${String(
    jobStart.getMonth() + 1
  ).padStart(2, "0")}-${String(jobStart.getDate()).padStart(2, "0")}`;

  const dayWorkStart = new Date(`${jobDate}T${workStartTime}:00`);
  const dayWorkEnd = new Date(`${jobDate}T${workEndTime}:00`);

  const isStartWithinHours = jobStart >= dayWorkStart && jobStart <= dayWorkEnd;

  logger.info(
    `Working Hours Check:
    - Job Date: ${jobDate}
    - Job Window: ${jobStart.toLocaleTimeString()} - ${jobEnd.toLocaleTimeString()}
    - Work Hours: ${workStartTime} - ${workEndTime}
    - Start Within Hours: ${isStartWithinHours}
    - Decision: ${isStartWithinHours}`,
    "SCHEDULE_CHECK"
  );

  return isStartWithinHours;
}
