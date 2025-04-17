import schedule from '../schedule.js';
import logger from './logger.js';
import { CONFIG } from '../config.js';

function isPaymentEligible(workOrder) {
  // If no labor hours specified, use default from config
  let estLaborHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;

  // Calculate required pay
  let requiredPay = workOrder.payRange.max; // Start with offered pay
  let decisionReason = '';

  // If offered pay is less than minimum threshold, check if we can add travel expenses
  if (workOrder.payRange.max < CONFIG.RATES.MIN_PAY_THRESHOLD) {
    // Only add travel expenses if distance exceeds threshold
    if (workOrder.distance > TRAVEL_THRESHOLD) {
      const travelExpense = (workOrder.distance - TRAVEL_THRESHOLD) * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE;
      requiredPay = CONFIG.RATES.MIN_PAY_THRESHOLD + travelExpense;
      decisionReason = `Base pay too low ($${workOrder.payRange.max} < $${CONFIG.RATES.MIN_PAY_THRESHOLD}), adding travel expenses: ${workOrder.distance - TRAVEL_THRESHOLD} miles × $${CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE}/mile = $${travelExpense}`;
    } else {
      requiredPay = CONFIG.RATES.MIN_PAY_THRESHOLD;
      decisionReason = `Base pay too low ($${workOrder.payRange.max} < $${CONFIG.RATES.MIN_PAY_THRESHOLD}) and distance (${workOrder.distance} miles) is within free travel limit (${TRAVEL_THRESHOLD} miles)`;
    }
  } else {
    decisionReason = `Base pay acceptable: $${workOrder.payRange.max} >= $${CONFIG.RATES.MIN_PAY_THRESHOLD}`;
  }

  // Log the decision
  logger.info(
    `Payment Analysis:
    - Offered Pay: $${workOrder.payRange.max}
    - Minimum Threshold: $${CONFIG.RATES.MIN_PAY_THRESHOLD}
    - Distance: ${workOrder.distance} miles
    - Travel Threshold: ${TRAVEL_THRESHOLD} miles
    - Required Pay: $${requiredPay}
    - Decision: ${workOrder.payRange.max >= requiredPay ? 'ACCEPT' : 'REJECT'}
    - Reason: ${decisionReason}`,
    workOrder.platform,
    workOrder.id
  );

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
  logger.info(
    `Schedule Check:
    - Date: ${orderMonth}/${orderDay}
    - Time: ${startTime} - ${endTime}
    - Work Hours: ${DAY_WORK_START_TIME} - ${DAY_WORK_END_TIME}
    - Buffer: ${MIN_BUFFER_MINUTES} minutes`,
    workOrder.platform,
    workOrder.id
  );

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
    logger.info(
      `Time is available: No other events scheduled for this day`,
      workOrder.platform,
      workOrder.id
    );
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
      logger.info(
        `Time is available: Slot found between ${new Date(prevEndTime).toLocaleTimeString()} and ${new Date(event.start).toLocaleTimeString()}`,
        workOrder.platform,
        workOrder.id
      );
      return true;
    }
    prevEndTime = event.end;
  }

  // Final check for end of day
  const isAvailable = stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 && stampEndTime <= WORK_END;
  
  logger.info(
    `Time ${isAvailable ? 'is' : 'is not'} available: ${isAvailable ? 'Slot found at end of day' : 'No available slots found'}`,
    workOrder.platform,
    workOrder.id
  );
  
  return isAvailable;
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

  // Check eligibility for both FieldNation and WorkMarket
  if (workOrder.platform === 'FieldNation' || workOrder.platform === 'WorkMarket') {
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

  // Unknown platform
  logger.info(
    `Unknown platform: ${workOrder.platform}`,
    workOrder.platform,
    workOrder.id
  );
  
  return {
    eligible: false,
    counterOffer: null,
  };
}

export default isEligibleForApplication;
