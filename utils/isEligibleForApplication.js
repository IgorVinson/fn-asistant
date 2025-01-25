import schedule from "../schedule.js";

function isPaymentEligible(workOrder) {

    const SPEED = 50; // Average speed in miles per hour
    const FREE_TRAVEL_LIMIT = 50 / 60; // Free travel time in hours
    const TRAVEL_RATE = 30; // Rate per hour of travel
    const MIN_PAY_THRESHOLD = 150; // Minimum pay for a trip

    const travelTime = Math.max(0, (workOrder.distance / SPEED) * 2 - FREE_TRAVEL_LIMIT);

    const minPay = workOrder.distance < 20
        ? MIN_PAY_THRESHOLD
        : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;

    let estLaborHours = workOrder.estLaborHours;
    if (!workOrder.estLaborHours) estLaborHours = 4;

    return workOrder.payRange.max / estLaborHours >= 50 && workOrder.payRange.max >= minPay;
}

function isSlotAvailable(schedule, workOrder) {
    const DAY_WORK_START_TIME = "07:59";
    const DAY_WORK_END_TIME = "23:00";
    const MIN_BUFFER_MINUTES = 30;

    const { start: startTime, end: endTime } = workOrder.time;
    const stampStartTime = new Date(startTime).getTime();
    const stampEndTime = new Date(endTime).getTime();

    const WORK_START = new Date(`${startTime.split('T')[0]}T${DAY_WORK_START_TIME}:00`).getTime();
    const WORK_END = new Date(`${startTime.split('T')[0]}T${DAY_WORK_END_TIME}:00`).getTime();

    if (stampStartTime < WORK_START || stampEndTime > WORK_END) {
        console.log("Time is not available: Outside work hours");
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

    const finalCheck = stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 && stampEndTime <= WORK_END;

    if (!finalCheck) {
        console.log("Time is not available: Conflicts with existing schedule");
    }

    return finalCheck;
}

function isEligibleForApplication(workOrder) {

    if (isPaymentEligible(workOrder)) {
        console.log('payment ok')
        return isSlotAvailable(schedule, workOrder);

    } else {
        console.log('payment not ok')
        return false
    }

}

export default isEligibleForApplication;


