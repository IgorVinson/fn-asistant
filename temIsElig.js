import currentMonth from "./schedule.js";

// Define working hours and buffer
const WORK_START_TIME = "10:30";
const WORK_END_TIME = "21:00";
const MIN_BUFFER_MINUTES = 30;

const SPEED = 50; // Average speed in miles per hour
const FREE_TRAVEL_LIMIT = 50 / 60; // Free travel time in hours
const TRAVEL_RATE = 30; // Rate per hour of travel
const MIN_PAY_THRESHOLD = 150; // Minimum pay for a trip

/**
 * Convert time in "hh:mm:ss" or "hh:mm AM/PM" format to minutes since midnight.
 */

function updTimeISO(startDateAndTime) {
    // Split the input into parts
    const parts = startDateAndTime.trim().split(" ");
    let time = null;
    let meridian = null;
    let hours = null;
    let minutes = null;

    if (!parts.includes('to')) {
        time = parts[parts.length - 4]; // Third-to-last part is the time
        meridian = parts[parts.length - 3]; // Second-to-last part is AM/PM
    }

    else {
        time = parts[parts.length - 7] + " - " + parts[parts.length - 4]; // Third-to-last part is the time
        meridian = parts[parts.length - 6] + " - " + parts[parts.length - 3]; // Second-to-last part is AM/PM
    }


    if(meridian.length === 2) {
       [hours, minutes] = time.includes(":") ? time.split(":").map(Number) : [Number(time), 0];

    } else {
        const [startTime, endTime] = time.split(" - ");
        const [startMeridian, endMeridian] = meridian.split(" - ");

        let [startHours, startMinutes] = startTime.includes(":")
            ? startTime.split(":").map(Number)
            : [Number(startTime), 0];
        let [endHours, endMinutes] = endTime.includes(":")
            ? endTime.split(":").map(Number)
            : [Number(endTime), 0];

        if (startMeridian.toUpperCase() === "PM" && startHours !== 12) {
            startHours += 12;
        } else if (startMeridian.toUpperCase() === "AM" && startHours === 12) {
            startHours = 0;
        }

        if (endMeridian.toUpperCase() === "PM" && endHours !== 12) {
            endHours += 12;
        } else if (endMeridian.toUpperCase() === "AM" && endHours === 12) {
            endHours = 0;
        }

        hours = `${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}:00 - ${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;
    }
    // Format to "hh:mm:ss"
    const normalizedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

    return meridian.length === 2 ?  normalizedTime : hours; // Return the time in 24-hour format
}

function convertDateISO(startDateAndTime) {
    // Split the input into parts
    const parts = startDateAndTime.trim().split(" ");

    // Extract the date part (MM/DD/YYYY)
    const datePart = parts[1]; // First part is the date
    const [month, day, year] = datePart.split("/").map(Number);

    // Format the date to YYYY-MM-DD
    const isoDate = `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return isoDate; // Return the date in ISO format
}

function convertToMinutes(timeStr) {
    const time = timeStr.trim(); // Ensure there are no leading/trailing spaces
    const [hours, minutes] = time.includes(":")
        ? time.split(":").map(Number)
        : [Number(time), 0]; // Handle cases like "10" or "10:30"

    return hours * 60 + (minutes || 0); // Convert to minutes
}


function isSlotAvailable(schedule, taskDate, taskStartTime, taskDuration) {
    const taskEndTime = taskStartTime + taskDuration;

    const daySchedule = Object.values(schedule).flatMap(week =>
        Object.values(week).flatMap(day => day.filter(event => event.date === taskDate))
    );

    // If the day has no events, check against work hours
    if (!daySchedule.length) {
        return taskStartTime >= convertToMinutes(WORK_START_TIME) &&
            taskEndTime <= convertToMinutes(WORK_END_TIME);
    }

    // Sort events for the day by start time
    const events = daySchedule[0].events
        .map(range => range.split(" - ").map(convertToMinutes))
        .sort((a, b) => a[0] - b[0]);

    // Check if task fits between events or at start/end of the workday
    for (let i = 0; i <= events.length; i++) {
        const prevEnd = i === 0 ? convertToMinutes(WORK_START_TIME) : events[i - 1][1];
        const nextStart = i === events.length ? convertToMinutes(WORK_END_TIME) : events[i][0];

        if (
            taskStartTime >= prevEnd + MIN_BUFFER_MINUTES &&
            taskEndTime <= nextStart - MIN_BUFFER_MINUTES
        ) {
            return true; // Task fits in this slot
        }
    }

    return false; // No suitable slot found
}

function isEligibleForApplication(data, schedule) {

    const travelTime = Math.max(0, (data.distance / SPEED) * 2 - FREE_TRAVEL_LIMIT);
    const minPay = data.distance < 20
        ? MIN_PAY_THRESHOLD
        : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;

    let estLaborHours = data.estLaborHours;
    if (!data.estLaborHours) estLaborHours = 4;

    const paymentEligible = data.payRange.max / estLaborHours >= 50 && data.payRange.max >= minPay;

    if (!paymentEligible) {
        return false;
    }

    // Parse task date and time
    const taskDate = data.startDateAndTime.local?.date || convertDateISO(data.startDateAndTime);

    const taskStartTime = convertToMinutes(
        data.startDateAndTime.local?.time || updTimeISO(data.startDateAndTime)
    );
    const taskDuration = estLaborHours * 60; // Convert labor hours to minutes

    return isSlotAvailable(schedule, taskDate, taskStartTime, taskDuration);
}


const FNnormilizedData = {
    title: 'Walgreens POS Logic unit / Printer / ELO Refresh (Assist)',
    startDateAndTime: {
        local: {date: '2025-01-17', time: '10:00:00'},
    },
    distance: 11.17511551089284,
    payRange: {min: 45, max: 100},
    estLaborHours: 0,
    platform: 'FieldNation'
}


const WMnormalizedData = {
    workOrderId: '5659140276',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    startDateAndTime: 'Mon, 01/20/2025 10 AM  EST',
    distance: 39.6,
    payRange: {min: 0, max: 300},
    estLaborHours: 0,
    platform: 'WorkMarket'
}

const WMnormalizedData2 = {
    workOrderId: '2297391795',
    title: '02738790 + HomeGoods / HomeSense - TJH0587 + EPIK Install, Cutover & Test - Work Market',
    startDateAndTime: 'Mon, 01/20/2025 to Mon, 01/20/2025 9:00 AM to 5:00 PM  EST',
    distance: 6.7,
    payRange: {min: 65, max: 195},
    estLaborHours: 3,
    platform: 'WorkMarket'
}

const WMnormalizedData3 = {
    workOrderId: '7637118552',
    title: 'Smart Hands | Priority 3 - Work Market',
    startDateAndTime: 'Mon, 01/20/2025 to Mon, 01/20/2025 9:00 AM to 5:00 PM  EST',
    distance: 56,
    payRange: {min: 50, max: 200},
    estLaborHours: 4,
    platform: 'WorkMarket'
}


// Example Usage
// console.log(isEligibleForApplication(FNnormilizedData, currentMonth)); // Check for FieldNation
console.log(isEligibleForApplication(WMnormalizedData, currentMonth)); // Check for WorkMarket
// console.log(isEligibleForApplication(WMnormalizedData2, currentMonth)); // Check for WorkMarket
// console.log(isEligibleForApplication(WMnormalizedData3, currentMonth)); // Check for WorkMarket





