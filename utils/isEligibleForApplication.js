import { currentMonth as schedule } from '../schedule.js';
import logger from './logger.js';
import CONFIG from '../config.js';
import chalk from 'chalk';

export function isPaymentEligible(workOrder) {
  const TRAVEL_THRESHOLD = CONFIG.RATES.TRAVEL_THRESHOLD_MILES;

  // Calculate hourly rate from max payment
  const hourlyRate = workOrder.payRange.max / workOrder.estLaborHours;

  // Check minimum hourly rate based on platform
  const minHourlyRate =
    workOrder.platform === 'FieldNation'
      ? CONFIG.RATES.BASE_RATE / 2 // $120/2 = $60 per hour for FN
      : CONFIG.RATES.BASE_HOURLY_RATE; // $50 per hour for WM

  // Log the calculation
  console.log(
    `Hourly rate check: ${chalk.green(
      '$' + hourlyRate
    )} per hour vs minimum ${chalk.yellow('$' + minHourlyRate)}`
  );

  // Check if hourly rate meets minimum
  if (hourlyRate < minHourlyRate) {
    return false;
  }

  return true;
}

export function isSlotAvailable(schedule, workOrder) {
  const DAY_WORK_START_TIME = CONFIG.SCHEDULE.WORK_START_TIME;
  const DAY_WORK_END_TIME = CONFIG.SCHEDULE.WORK_END_TIME;
  const MIN_BUFFER_MINUTES = CONFIG.SCHEDULE.MIN_BUFFER_MINUTES;

  const { start: startTime, end: endTime } = workOrder.time;
  const orderDate = new Date(startTime);
  const orderDay = orderDate.getDate();
  const orderMonth = orderDate.getMonth() + 1;

  const stampStartTime = new Date(startTime).getTime();
  const stampEndTime = new Date(endTime).getTime();

  const WORK_START = new Date(
    `${startTime.split('T')[0]}T${DAY_WORK_START_TIME}:00`
  ).getTime();
  const WORK_END = new Date(
    `${startTime.split('T')[0]}T${DAY_WORK_END_TIME}:00`
  ).getTime();

  // Different time validation based on platform
  if (workOrder.platform === 'WorkMarket') {
    // For WorkMarket, check if any part of the time window overlaps with our work hours
    const hasValidTimeWindow =
      (stampStartTime <= WORK_END && stampEndTime >= WORK_START) || // Window overlaps work hours
      (stampStartTime >= WORK_START && stampStartTime <= WORK_END); // Start time is within work hours

    if (!hasValidTimeWindow) {
      logger.info(
        `Time is not available: No overlap with work hours (${DAY_WORK_START_TIME}-${DAY_WORK_END_TIME})`,
        workOrder.platform,
        workOrder.id
      );
      return false;
    }
  } else {
    // For FieldNation, be strict with start and end times
    if (stampStartTime < WORK_START || stampEndTime > WORK_END) {
      logger.info(
        `Time is not available: Outside work hours (${DAY_WORK_START_TIME}-${DAY_WORK_END_TIME})`,
        workOrder.platform,
        workOrder.id
      );
      return false;
    }
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

export function calculateCounterOffer(workOrder) {
  const travelExpense =
    workOrder.distance > CONFIG.RATES.TRAVEL_THRESHOLD_MILES
      ? Math.round(workOrder.distance * CONFIG.RATES.TRAVEL_RATE_PER_MILE)
      : 0;

  if (workOrder.platform === 'WorkMarket') {
    return {
      shouldCounterOffer: travelExpense > 0,
      hourlyRate: workOrder.payRange.max / workOrder.estLaborHours, // Keep original hourly rate
      hours: workOrder.estLaborHours,
      travelExpense: travelExpense,
    };
  } else {
    // For FieldNation
    return {
      shouldCounterOffer: travelExpense > 0,
      payType: 'blended',
      baseHours: Math.min(workOrder.estLaborHours, 2), // First 2 hours
      baseAmount: workOrder.payRange.max, // Keep original amount
      additionalHours: Math.max(0, workOrder.estLaborHours - 2), // Any hours over 2
      additionalAmount: workOrder.payRange.max / workOrder.estLaborHours, // Keep original hourly rate
      travelExpense: travelExpense,
    };
  }
}

export default function isEligibleForApplication(normalizedData) {
  const slotAvailable = isSlotAvailable(schedule, normalizedData);
  if (!slotAvailable) {
    return { eligible: false, counterOffer: null };
  }

  const paymentEligible = isPaymentEligible(normalizedData);
  if (!paymentEligible) {
    return { eligible: false, counterOffer: null };
  }

  // If we get here, schedule and payment are OK
  // Check if we need to add travel expenses
  const needsTravel =
    normalizedData.distance > CONFIG.RATES.TRAVEL_THRESHOLD_MILES;

  return {
    eligible: !needsTravel, // Direct apply if no travel needed
    counterOffer: needsTravel ? calculateCounterOffer(normalizedData) : null,
  };
}
