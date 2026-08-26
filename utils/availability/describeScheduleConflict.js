import { CONFIG } from "../../config.js";

export const AVAILABILITY_LOOKAHEAD_DAYS = 4;

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWorkTime(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getCheckedWeekdays(requestedStart, daysToCheck = AVAILABILITY_LOOKAHEAD_DAYS) {
  const start = new Date(requestedStart);
  const dates = [];

  for (let offset = 0; offset <= daysToCheck; offset += 1) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + offset
    );
    const day = date.getDay();
    if (day !== 0 && day !== 6) dates.push(date);
  }

  return dates;
}

export function describeScheduleConflict(
  workOrder,
  {
    error = null,
    daysToCheck = AVAILABILITY_LOOKAHEAD_DAYS,
    outsideWorkingHours = false,
  } = {}
) {
  const requestedStart = new Date(workOrder.time.start);

  if (error) {
    return [
      "⚠️ Schedule check failed",
      `Requested: ${formatDateTime(requestedStart)}`,
      `Reason: ${error}`,
    ].join("\n");
  }

  const checkedDates = getCheckedWeekdays(requestedStart, daysToCheck)
    .map(formatDate)
    .join(", ");
  const laborHours =
    workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const travelMinutes = Math.round(
    ((workOrder.distance || 0) / CONFIG.DISTANCE.AVERAGE_SPEED) * 60
  );
  const travelText =
    travelMinutes > 0 ? ` + ${travelMinutes} min travel each way` : "";
  const workWindow = `${formatWorkTime(CONFIG.TIME.WORK_START_TIME)}–${formatWorkTime(CONFIG.TIME.WORK_END_TIME)}`;

  return [
    outsideWorkingHours
      ? "📅 No in-hours counter slot available"
      : "📅 No available schedule slot",
    `Requested: ${formatDateTime(requestedStart)}`,
    outsideWorkingHours
      ? `Original start is outside working hours (${workWindow}).`
      : null,
    `Checked: ${checkedDates} · ${workWindow}`,
    `Needed: ${laborHours}h labor${travelText}`,
    "No block long enough was found.",
  ]
    .filter(Boolean)
    .join("\n");
}
