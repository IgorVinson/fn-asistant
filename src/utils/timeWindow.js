function toMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    return null;
  }

  if (timeStr === "24:00") {
    return 24 * 60;
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

export function isWithinWindow(now, startTime, endTime) {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return true;
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes();

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return minutesNow >= startMinutes && minutesNow < endMinutes;
  }

  return minutesNow >= startMinutes || minutesNow < endMinutes;
}
