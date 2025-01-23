import schedule from "./schedule.js";

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
        start: '2025-01-18T13:29:00',
        end: '2025-01-18T15:30:00'
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

    const WORK_START_TIME = "10:30";
    const WORK_END_TIME = "21:00";
    const MIN_BUFFER_MINUTES = 30;

    const { start: startTime, end: endTime } = workOrderTime.time;
    const stampStartTime = new Date(startTime).getTime();
    const stampEndTime = new Date(endTime).getTime();

    function toESTTimestamp(dateStr) {
        const date = new Date(dateStr);
        const utcTimestamp = date.getTime();
        const estOffset = -5 * 60 * 60 * 1000; // EST is UTC-5
        return utcTimestamp + estOffset;
    }

    const WORK_START = new Date(`${startTime.split('T')[0]}T${WORK_START_TIME}:00`).getTime();

    const WORK_END = new Date(`${startTime.split('T')[0]}T${WORK_END_TIME}:00`).getTime();

    if (stampStartTime < WORK_START || stampEndTime > WORK_END) {
        return false;
    }

    const allEvents = Object.values(schedule)
        .flatMap(week => Object.entries(week).flatMap(([day, events]) => {
            return events.map(event => ({
                day,
                start: new Date(event.time.start).getTime(),
                end: new Date(event.time.end).getTime(),
            }));
        }));

    const sameDayEvents = allEvents.filter(event => {
        const eventDay = event.day.split(' ')[1];
        const workOrderDay = new Date(startTime).getDate();
        return parseInt(eventDay, 10) === workOrderDay;
    });

    const sortedEvents = sameDayEvents.sort((a, b) => a.start - b.start);

    let prevEndTime = WORK_START;

    for (const event of sortedEvents) {
        if (
            stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
            stampEndTime <= event.start - MIN_BUFFER_MINUTES * 60 * 1000
        ) {
            return true;
        }
        prevEndTime = event.end;
    }

    return stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 && stampEndTime <= WORK_END;
}

// console.log(isEligibleForApplication(normalizedWO, schedule)); // Check for FieldNation
// console.log(isPaymentEligible(normalizedWO))
console.log(isSlotAvailable(schedule, normalizedWO));

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




