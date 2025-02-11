import { currentMonth as schedule } from '../schedule.js';
import logger from './logger.js';
import { CONFIG } from '../config.js';

function isPaymentEligible(workOrder) {
  // If no labor hours specified, assume 4 hours
  let estLaborHours = workOrder.estLaborHours || 4;

  // Calculate hourly rate from max pay
  const hourlyRate = workOrder.payRange.max / estLaborHours;

  // Check if hourly rate is at least $60/hr and total pay is at least $150
  return hourlyRate >= 60 && workOrder.payRange.max >= 150;
}

function isSlotAvailable(schedule, workOrder) {
  const DAY_WORK_START_TIME = '07:59';
  const DAY_WORK_END_TIME = '23:00';
  const MIN_BUFFER_MINUTES = 30;

  const { start: startTime, end: endTime } = workOrder.time;
  const stampStartTime = new Date(startTime).getTime();
  const stampEndTime = new Date(endTime).getTime();

  const WORK_START = new Date(
    `${startTime.split('T')[0]}T${DAY_WORK_START_TIME}:00`
  ).getTime();
  const WORK_END = new Date(
    `${startTime.split('T')[0]}T${DAY_WORK_END_TIME}:00`
  ).getTime();

  if (stampStartTime < WORK_START || stampEndTime > WORK_END) {
    logger.info(
      'Time is not available: Outside work hours',
      workOrder.platform,
      workOrder.id
    );
    return false;
  }

  const allEvents = Object.values(schedule).flatMap(week =>
    Object.entries(week).flatMap(([day, events]) => {
      return events.map(event => ({
        day,
        start: new Date(event.time.start).getTime(),
        end: new Date(event.time.end).getTime(),
      }));
    })
  );

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

  const finalCheck =
    stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
    stampEndTime <= WORK_END;

  if (!finalCheck) {
    logger.info(
      'Time is not available: Conflicts with existing schedule',
      workOrder.platform,
      workOrder.id
    );
  }

  return finalCheck;
}

function calculateCounterOffer(workOrder) {
  const BASE_HOURS = 2;
  const BASE_RATE = 150;
  const ADDITIONAL_HOURLY_RATE = 55;
  const TRAVEL_THRESHOLD = 30; // Only charge travel over 30 miles

  // Calculate travel expense ($1 per mile, but only if distance > 30)
  const travelExpense =
    workOrder.distance > TRAVEL_THRESHOLD ? Math.round(workOrder.distance) : 0;

  // Determine if this should be fixed rate (2 hours or less)
  const isFixedRate = workOrder.estLaborHours <= 2;

  // Calculate additional hours only if not fixed rate
  const additionalHours = isFixedRate
    ? 0
    : Math.max(1, workOrder.estLaborHours - BASE_HOURS);

  return {
    shouldCounterOffer: true,
    payType: isFixedRate ? 'fixed' : 'blended',
    baseHours: isFixedRate ? 0 : BASE_HOURS, // For fixed rate, we don't specify hours
    baseAmount: BASE_RATE,
    additionalHours: additionalHours,
    additionalAmount: isFixedRate ? 0 : ADDITIONAL_HOURLY_RATE,
    travelExpense: travelExpense,
  };
}

function isEligibleForApplication(workOrder) {
  logger.info(
    `Checking eligibility - Distance: ${workOrder.distance}mi, Est. Hours: ${workOrder.estLaborHours}`,
    workOrder.platform,
    workOrder.id
  );

  // For Field Nation orders
  if (workOrder.platform === 'FieldNation') {
    // First check if payment meets our criteria
    if (isPaymentEligible(workOrder)) {
      // If payment is good, check slot availability
      const slotAvailable = isSlotAvailable(schedule, workOrder);
      return {
        eligible: slotAvailable,
        counterOffer: null,
      };
    } else {
      // If payment is not good, generate counter offer
      const counterOffer = calculateCounterOffer(workOrder);
      return {
        eligible: false,
        counterOffer,
      };
    }
  }

  // For other platforms, keep existing logic
  return {
    eligible: false,
    counterOffer: null,
  };
}

export default isEligibleForApplication;
