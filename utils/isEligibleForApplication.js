import { currentMonth as schedule } from '../schedule.js';
import logger from './logger.js';
import { CONFIG } from '../config.js';

function isPaymentEligible(workOrder) {
  // If no labor hours specified, assume 4 hours
  let estLaborHours = workOrder.estLaborHours || 4;
  const TRAVEL_THRESHOLD = 30;

  // Calculate required pay
  let requiredPay;
  let laborPay;

  // For jobs over 2 hours
  if (estLaborHours > 2) {
    laborPay = 150 + (estLaborHours - 2) * 55;
    requiredPay = laborPay;
    console.log(
      `Labor calculation: $150 base + (${
        estLaborHours - 2
      }hrs × $55) = $${laborPay}`
    );
  } else {
    // For jobs 2 hours or less
    laborPay = 150;
    requiredPay = laborPay;
    console.log(`Labor calculation: Fixed rate $150`);
  }

  // Add travel expense if distance > 30 miles
  if (workOrder.distance > TRAVEL_THRESHOLD) {
    requiredPay += workOrder.distance; // $1 per mile
    console.log(
      `Added travel expense: ${workOrder.distance} miles = $${workOrder.distance}`
    );
  }

  console.log(
    `Total required pay: $${requiredPay} vs Offered pay: $${workOrder.payRange.max}`
  );

  // Return true only if offered pay meets or exceeds required pay
  return workOrder.payRange.max >= requiredPay;
}

function isSlotAvailable(schedule, workOrder) {
  const DAY_WORK_START_TIME = '07:59';
  const DAY_WORK_END_TIME = '19:00';
  const MIN_BUFFER_MINUTES = 30;

  const { start: startTime, end: endTime } = workOrder.time;
  const orderDate = new Date(startTime);
  const orderDay = orderDate.getDate();
  const orderMonth = orderDate.getMonth() + 1;

  // Debug logging
  console.log('Checking availability for:', {
    date: `${orderMonth}/${orderDay}`,
    startTime,
    endTime,
    existingEvents: Object.values(schedule).flatMap(week =>
      Object.entries(week).map(([day, events]) => ({ day, events }))
    ),
  });

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
      `Time is not available: Outside work hours (${DAY_WORK_START_TIME}-${DAY_WORK_END_TIME})`,
      workOrder.platform,
      workOrder.id
    );
    return false;
  }

  // Get all events for comparison
  const allEvents = Object.values(schedule).flatMap(week =>
    Object.entries(week).flatMap(([day, events]) => {
      return events.map(event => ({
        day,
        start: new Date(event.time.start).getTime(),
        end: new Date(event.time.end).getTime(),
      }));
    })
  );

  // Filter events for the same day AND month
  const sameDayEvents = allEvents.filter(event => {
    const eventDate = new Date(event.start);
    return (
      eventDate.getDate() === orderDay &&
      eventDate.getMonth() === orderDate.getMonth()
    );
  });

  // If no events on this day, the slot is available
  if (sameDayEvents.length === 0) {
    return true;
  }

  // Sort events by start time
  const sortedEvents = sameDayEvents.sort((a, b) => a.start - b.start);

  let prevEndTime = WORK_START;

  // Check for conflicts with existing events
  for (const event of sortedEvents) {
    if (
      stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
      stampEndTime <= event.start - MIN_BUFFER_MINUTES * 60 * 1000
    ) {
      return true;
    }
    prevEndTime = event.end;
  }

  // Final check for end of day
  return (
    stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
    stampEndTime <= WORK_END
  );
}

function calculateCounterOffer(workOrder) {
  const BASE_HOURS = 2;
  const BASE_RATE = 150;
  const ADDITIONAL_HOURLY_RATE = 55;
  const TRAVEL_THRESHOLD = 30;

  const travelExpense =
    workOrder.distance > TRAVEL_THRESHOLD ? Math.round(workOrder.distance) : 0;

  const isFixedRate = workOrder.estLaborHours <= 2;

  const additionalHours = isFixedRate
    ? 0
    : Math.max(1, workOrder.estLaborHours - BASE_HOURS);

  return {
    shouldCounterOffer: true,
    payType: isFixedRate ? 'fixed' : 'blended',
    baseHours: isFixedRate ? 0 : BASE_HOURS,
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

  if (workOrder.platform === 'FieldNation') {
    if (isPaymentEligible(workOrder)) {
      const slotAvailable = isSlotAvailable(schedule, workOrder);
      return {
        eligible: slotAvailable,
        counterOffer: null,
      };
    } else {
      // If payment is not good, generate counter offer
      return {
        eligible: false,
        counterOffer: calculateCounterOffer(workOrder),
      };
    }
  }

  return {
    eligible: false,
    counterOffer: null,
  };
}

export default isEligibleForApplication;
