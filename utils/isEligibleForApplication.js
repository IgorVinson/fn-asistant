import { currentMonth as schedule } from '../schedule.js';
import logger from './logger.js';
import CONFIG from '../config.js';
import chalk from 'chalk';

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
      `${chalk.cyan('WorkMarket')} labor calculation: ${estLaborHours}hrs × ${chalk.green('$' + CONFIG.RATES.BASE_HOURLY_RATE)}/hr = ${chalk.yellow('$' + laborPay)}`
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
        `${chalk.cyan('FieldNation')} labor calculation: ${chalk.green('$' + CONFIG.RATES.BASE_RATE)} base + (${
          estLaborHours - CONFIG.RATES.BASE_HOURS
        }hrs × ${chalk.green('$' + CONFIG.RATES.ADDITIONAL_HOURLY_RATE)}) = ${chalk.yellow('$' + laborPay)}`
      );
    } else {
      laborPay = CONFIG.RATES.BASE_RATE;
      requiredPay = laborPay;
      console.log(
        `${chalk.cyan('FieldNation')} labor calculation: Fixed rate ${chalk.green('$' + CONFIG.RATES.BASE_RATE)}`
      );
    }
  }

  // Add travel expense if distance > threshold
  if (workOrder.distance > TRAVEL_THRESHOLD) {
    const travelExpense = workOrder.distance * CONFIG.RATES.TRAVEL_RATE_PER_MILE;
    requiredPay += travelExpense;
    console.log(
      `Added travel expense: ${chalk.yellow(workOrder.distance)} miles = ${chalk.green('$' + travelExpense)}`
    );
  }

  console.log(
    `Total ${chalk.yellow('required pay')}: ${chalk.green('$' + requiredPay)} vs ${chalk.yellow('Offered pay')}: ${chalk.green('$' + workOrder.payRange.max)}`
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
  const paymentEligible = isPaymentEligible(normalizedData);
  const slotAvailable = isSlotAvailable(schedule, normalizedData);

  return {
    eligible: paymentEligible && slotAvailable,
    // Only return counter offer if payment is not eligible BUT schedule is available
    counterOffer:
      !paymentEligible && slotAvailable
        ? calculateCounterOffer(normalizedData)
        : null,
  };
}
