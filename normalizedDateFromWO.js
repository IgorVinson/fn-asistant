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
        return `${hours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`;
    }

    const startDate = data.time?.start?.date || data.date?.split(' to ')[0] || "Unknown";
    const startTimeRaw = data.time?.start?.time || (typeof data.time === 'string' && data.time.split(' to ')[0]) || "00:00:00";
    const startTime = convertTo24Hour(startTimeRaw);

    // Calculate end time
    let endDate, endTime;
    if (data.time?.end?.date || data.time?.end?.time) {
        // If end date/time is explicitly provided
        endDate = data.time?.end?.date || data.date?.split(' to ')[1] || startDate;
        endTime = convertTo24Hour(data.time?.end?.time || (typeof data.time === 'string' && data.time.split(' to ')[1]));
    } else {
        // If no end time, calculate based on estLaborHours or default to 3 hours
        endDate = startDate;
        const estHours = data.estLaborHours || parseFloat(data.hoursOfWork || 3);

        // Parse start time and add estimated hours
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const endHours = startHours + Math.floor(estHours);
        const endMinutes = startMinutes + Math.round((estHours % 1) * 60);

        // Adjust for overflow minutes
        const finalEndHours = endHours + Math.floor(endMinutes / 60);
        const finalEndMinutes = endMinutes % 60;

        endTime = `${finalEndHours.toString().padStart(2, '0')}:${finalEndMinutes.toString().padStart(2, '0')}`;
    }

    let distanceValue;
    if (typeof data.distance === "string" && data.distance.includes(" mi")) {
        distanceValue = parseFloat(data.distance.replace(" mi", ""));
    } else if (typeof data.distance === "number") {
        distanceValue = data.distance;
    } else {
        distanceValue = 0; // Default for missing or invalid distance
    }

    return {
        id: data.id || data.workOrderId || null,
        platform: data.platform || "Unknown",
        company: data.company || "Unknown Company",
        title: data.title || "No Title Provided",
        time: {
            start: `${startDate}T${startTime}`,
            end: `${endDate}T${endTime}`,
        },
        payRange: {
            min: data.payRange?.min || parseFloat(data.hourlyRate || 0),
            max: data.payRange?.max || parseFloat(data.totalPayment || 0),
        },
        estLaborHours: data.estLaborHours || parseFloat(data.hoursOfWork || 0) || 0,
        distance: distanceValue,
    };
}
