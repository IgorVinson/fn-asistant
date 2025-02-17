import { currentMonth as schedule } from '../schedule.js';
import logger from './logger.js';
import CONFIG from '../config.js';

function isPaymentEligible(workOrder) {
  // If no labor hours specified, use default
  let estLaborHours = workOrder.estLaborHours || CONFIG.DEFAULTS.LABOR_HOURS;
  const TRAVEL_THRESHOLD = CONFIG.RATES.TRAVEL_THRESHOLD_MILES;

  // Calculate required pay
  let requiredPay;
  let laborPay;

  if (workOrder.platform === 'WorkMarket') {
    // WorkMarket uses simple hourly rate calculation
    laborPay = estLaborHours * CONFIG.RATES.BASE_HOURLY_RATE;
    requiredPay = laborPay;
    console.log(
      `WorkMarket labor calculation: ${estLaborHours}hrs × $${CONFIG.RATES.BASE_HOURLY_RATE}/hr = $${laborPay}`
    );
  } else {
    // FieldNation uses base rate + additional hours calculation
    if (estLaborHours > CONFIG.RATES.BASE_HOURS) {
      laborPay =
        CONFIG.RATES.BASE_RATE +
        (estLaborHours - CONFIG.RATES.BASE_HOURS) *
          CONFIG.RATES.ADDITIONAL_HOURLY_RATE;
      requiredPay = laborPay;
      console.log(
        `FieldNation labor calculation: $${CONFIG.RATES.BASE_RATE} base + (${
          estLaborHours - CONFIG.RATES.BASE_HOURS
        }hrs × $${CONFIG.RATES.ADDITIONAL_HOURLY_RATE}) = $${laborPay}`
      );
    } else {
      laborPay = CONFIG.RATES.BASE_RATE;
      requiredPay = laborPay;
      console.log(
        `FieldNation labor calculation: Fixed rate $${CONFIG.RATES.BASE_RATE}`
      );
    }
  }

  // Add travel expense if distance > threshold
  if (workOrder.distance > TRAVEL_THRESHOLD) {
    requiredPay += workOrder.distance * CONFIG.RATES.TRAVEL_RATE_PER_MILE;
    console.log(
      `Added travel expense: ${workOrder.distance} miles = $${
        workOrder.distance * CONFIG.RATES.TRAVEL_RATE_PER_MILE
      }`
    );
  }

  console.log(
    `Total required pay: $${requiredPay} vs Offered pay: $${workOrder.payRange.max}`
  );

  return workOrder.payRange.max >= requiredPay;
}

function isSlotAvailable(schedule, workOrder) {
  const DAY_WORK_START_TIME = CONFIG.SCHEDULE.WORK_START_TIME;
  const DAY_WORK_END_TIME = CONFIG.SCHEDULE.WORK_END_TIME;
  const MIN_BUFFER_MINUTES = CONFIG.SCHEDULE.MIN_BUFFER_MINUTES;

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
  const travelExpense =
    workOrder.distance > CONFIG.RATES.TRAVEL_THRESHOLD_MILES
      ? Math.round(workOrder.distance * CONFIG.RATES.TRAVEL_RATE_PER_MILE)
      : 0;

  const isFixedRate = workOrder.estLaborHours <= CONFIG.RATES.BASE_HOURS;

  const additionalHours = isFixedRate
    ? 0
    : Math.max(1, workOrder.estLaborHours - CONFIG.RATES.BASE_HOURS);

  return {
    shouldCounterOffer: true,
    payType: isFixedRate ? 'fixed' : 'blended',
    baseHours: isFixedRate ? 0 : CONFIG.RATES.BASE_HOURS,
    baseAmount: CONFIG.RATES.BASE_RATE,
    additionalHours: additionalHours,
    additionalAmount: isFixedRate ? 0 : CONFIG.RATES.ADDITIONAL_HOURLY_RATE,
    travelExpense: travelExpense,
  };
}

export default function isEligibleForApplication(normalizedData) {
  // Remove console.log and unnecessary logging
  const paymentEligible = isPaymentEligible(normalizedData);
  const slotAvailable = isSlotAvailable(schedule, normalizedData);

  return {
    eligible: paymentEligible && slotAvailable,
    counterOffer: !paymentEligible
      ? calculateCounterOffer(normalizedData)
      : null,
  };
}
