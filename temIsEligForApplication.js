import schedule from "./schedule.js";

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

const normalizedWO = {
    id: '5659140276',
    platform: 'FieldNation',
    company: 'Endeavor Managed Services',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    time: {
        start: '2025-02-11T09:00:00',
        end: '2025-02-11T14:00:00'
    },
    payRange: {min: 45, max: 300},
    estLaborHours: 6,
    distance: 11,
}

function isPaymentEligible(workOrder) {

    const travelTime = Math.max(0, (workOrder.distance / SPEED) * 2 - FREE_TRAVEL_LIMIT);

    const minPay = workOrder.distance < 20
        ? MIN_PAY_THRESHOLD
        : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;

    let estLaborHours = workOrder.estLaborHours;
    if (!workOrder.estLaborHours) estLaborHours = 4;

    return workOrder.payRange.max / estLaborHours >= 50 && workOrder.payRange.max >= minPay;
}

function isEligibleForApplication(workOrder, schedule) {

    if (isPaymentEligible(workOrder)) {

        return isSlotAvailable(schedule, workOrder.time);

    } else return false

}

function isSlotAvailable(schedule, workOrderTime) {
    const { start: startTime, end: endTime } = workOrderTime;
    const stampStartTime = new Date(startTime).getTime();
    const stampEndTime = new Date(endTime).getTime();

    const dayEvents = Object.values(schedule)
        .flatMap(week => Object.values(week))
        .flat()
        .filter(event => event.date === taskDate);

    // If no events, validate against work hours
    if (dayEvents.length === 0) {
        const workStartTime = new Date(`${taskDate}T${WORK_START_TIME}:00`).getTime();
        const workEndTime = new Date(`${taskDate}T${WORK_END_TIME}:00`).getTime();

        return stampStartTime >= workStartTime && stampEndTime <= workEndTime;
    }

    // Flatten and sort events by their start time
    const events = dayEvents[0].events
        .map(range => range.split(" - ").map(time => new Date(`${taskDate}T${time.trim()}:00`).getTime()))
        .sort((a, b) => a[0] - b[0]);

    let prevEndTime = new Date(`${taskDate}T${WORK_START_TIME}:00`).getTime();

    for (const [startTime, endTime] of events) {
        if (
            stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
            stampEndTime <= startTime - MIN_BUFFER_MINUTES * 60 * 1000
        ) {
            return true;
        }
        prevEndTime = endTime;
    }

    // Check if the task fits after the last event
    const workEndTime = new Date(`${taskDate}T${WORK_END_TIME}:00`).getTime();
    return (
        stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
        stampEndTime <= workEndTime
    );
}



console.log(isEligibleForApplication(normalizedWO, schedule)); // Check for FieldNation
console.log(isPaymentEligible(normalizedWO))


// function isSlotAvailable(schedule, orderTime) {
//     const taskEndTime = taskStartTime + taskDuration;
//
//     const daySchedule = Object.values(schedule).flatMap(week =>
//         Object.values(week).flatMap(day => day.filter(event => event.date === taskDate))
//     );
//
//     // If the day has no events, check against work hours
//     if (!daySchedule.length) {
//         return taskStartTime >= convertToMinutes(WORK_START_TIME) &&
//             taskEndTime <= convertToMinutes(WORK_END_TIME);
//     }
//
//     // Sort events for the day by start time
//     const events = daySchedule[0].events
//         .map(range => range.split(" - ").map(convertToMinutes))
//         .sort((a, b) => a[0] - b[0]);
//
//     // Check if task fits between events or at start/end of the workday
//     for (let i = 0; i <= events.length; i++) {
//         const prevEnd = i === 0 ? convertToMinutes(WORK_START_TIME) : events[i - 1][1];
//         const nextStart = i === events.length ? convertToMinutes(WORK_END_TIME) : events[i][0];
//
//         if (
//             taskStartTime >= prevEnd + MIN_BUFFER_MINUTES &&
//             taskEndTime <= nextStart - MIN_BUFFER_MINUTES
//         ) {
//             return true; // Task fits in this slot
//         }
//     }
//
//     return false; // No suitable slot found
// }




