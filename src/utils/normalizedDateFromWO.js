export default function normalizeDateFromWO(data) {
  // Helper function to convert AM/PM time to 24-hour format
  function convertTo24Hour(timeStr) {
    if (!timeStr) return timeStr;

    // Remove EST or any timezone indicator
    timeStr = timeStr.replace(/\s*EST/i, '').trim();

    // Parse the time
    const [time, period] = timeStr.split(/\s*([AP]M)/i);
    let [hours, minutes] = time.split(':').map(Number);

    // Adjust hours for 12-hour format
    if (period && period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (period && period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    // Pad with zero if needed
    return `${hours.toString().padStart(2, '0')}:${(minutes || 0)
      .toString()
      .padStart(2, '0')}`;
  }

  function standardizeDate(dateStr) {
    if (!dateStr || dateStr === "Unknown") {
      return new Date().toISOString().split("T")[0];
    }

    // If date is already in ISO format (YYYY-MM-DD), extract it
    const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    // Handle string date format like "Mon, 02/17/2025"
    let cleanDate = dateStr;
    if (cleanDate.includes(",")) {
      cleanDate = cleanDate.split(", ")[1];
    }

    // Convert MM/DD/YYYY to YYYY-MM-DD
    const parts = cleanDate.split("/");
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Fallback to today if format is unrecognizable
    return new Date().toISOString().split("T")[0];
  }

  let startDateRaw = "Unknown";
  let startTimeRaw = "00:00:00";

  if (data.time?.start?.date) {
    startDateRaw = data.time.start.date;
    startTimeRaw = data.time.start.time || "00:00:00";
  } else if (typeof data.time?.start === "string") {
    const parts = data.time.start.split(" ");
    startDateRaw = parts[0];
    startTimeRaw = parts[1] || "00:00:00";
  } else if (data.date) {
    startDateRaw = data.date.split(" to ")[0];
    startTimeRaw =
      typeof data.time === "string" ? data.time.split(" to ")[0] : "00:00:00";
  }

  const startDate = standardizeDate(startDateRaw);
  const startTime = convertTo24Hour(startTimeRaw);

  // Calculate end time
  let endDate, endTime;
  if (data.time?.end) {
    let endDateRaw = startDate;
    let endTimeRaw = "00:00:00";

    if (data.time.end.date) {
      endDateRaw = data.time.end.date;
      endTimeRaw = data.time.end.time || "00:00:00";
    } else if (typeof data.time.end === "string") {
      const parts = data.time.end.split(" ");
      endDateRaw = parts[0];
      endTimeRaw = parts[1] || "00:00:00";
    }

    endDate = standardizeDate(endDateRaw);
    endTime = convertTo24Hour(endTimeRaw);
  } else if (data.date?.includes(" to ")) {
    endDate = standardizeDate(data.date.split(" to ")[1]);
    endTime = convertTo24Hour(
      typeof data.time === "string" ? data.time.split(" to ")[1] : "00:00:00"
    );
  } else {
    endDate = startDate;
    const estHours = data.estLaborHours || parseFloat(data.hoursOfWork || 3);

    // Parse start time and add estimated hours
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const endHours = startHours + Math.floor(estHours);
    const endMinutes = startMinutes + Math.round((estHours % 1) * 60);

    // Adjust for overflow minutes
    const finalEndHours = endHours + Math.floor(endMinutes / 60);
    const finalEndMinutes = endMinutes % 60;

    endTime = `${finalEndHours.toString().padStart(2, '0')}:${finalEndMinutes
      .toString()
      .padStart(2, '0')}`;
  }

  let distanceValue;
  if (typeof data.distance === 'string' && data.distance.includes(' mi')) {
    distanceValue = parseFloat(data.distance.replace(' mi', ''));
  } else if (typeof data.distance === 'number') {
    distanceValue = data.distance;
  } else {
    distanceValue = 0; // Default for missing or invalid distance
  }

  return {
    id: data.id || data.workOrderId || null,
    platform: data.platform || 'Unknown',
    company: data.company || 'Unknown Company',
    title: data.title || 'No Title Provided',
    time: {
      start: `${startDate}T${startTime}`,
      end: `${endDate}T${endTime}`,
    },
    payRange: {
      min: data.payRange?.min || parseFloat(data.hourlyRate || 0),
      max: data.payRange?.max || parseFloat(data.totalPayment || 0),
    },
    estLaborHours: data.estLaborHours || parseFloat(data.hoursOfWork || 0) || 3, // Default to 3 hours if not specified
    distance: distanceValue,
  };
}
