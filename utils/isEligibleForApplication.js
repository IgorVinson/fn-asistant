import { currentMonth as schedule } from '../schedule.js';
import logger from './logger.js';

function isPaymentEligible(workOrder) {
  const SPEED = 50; // Average speed in miles per hour
  const FREE_TRAVEL_LIMIT = 50 / 60; // Free travel time in hours
  const TRAVEL_RATE = 30; // Rate per hour of travel
  const MIN_PAY_THRESHOLD = 150; // Minimum pay for a trip

  const travelTime = Math.max(
    0,
    (workOrder.distance / SPEED) * 2 - FREE_TRAVEL_LIMIT
  );

  const minPay =
    workOrder.distance < 20
      ? MIN_PAY_THRESHOLD
      : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;

  let estLaborHours = workOrder.estLaborHours;
  if (!workOrder.estLaborHours) estLaborHours = 4;

  return (
    workOrder.payRange.max / estLaborHours >= 50 &&
    workOrder.payRange.max >= minPay
  );
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
  const MIN_TOTAL_PAY = 150;
  const MIN_HOURLY_RATE = 50;
  const DISTANCE_THRESHOLD = 30;
  const TRAVEL_RATE_PER_MILE = 1;

  let shouldCounterOffer = false;
  let reason = [];
  let payType = workOrder.platform === 'WorkMarket' ? 'hourly' : 'fixed';
  let payAmount = workOrder.payRange.max;
  let travelExpense = 0;

  // Step 1: Check if total pay and hourly rate meet minimum requirements
  const hourlyRate = workOrder.payRange.max / workOrder.estLaborHours;

  if (workOrder.payRange.max < MIN_TOTAL_PAY || hourlyRate < MIN_HOURLY_RATE) {
    // If job doesn't meet minimum requirements, reject without counter
    return {
      shouldCounterOffer: false,
      payType: null,
      payAmount: 0,
      travelExpense: 0,
      reason: 'pay below minimum requirements',
      originalRate: hourlyRate,
    };
  }

  // Step 2: Calculate travel expense if distance is over threshold
  if (workOrder.distance > DISTANCE_THRESHOLD) {
    travelExpense = Math.round(workOrder.distance * TRAVEL_RATE_PER_MILE);
    shouldCounterOffer = true;
    reason.push('travel expense needed');
  }

  return {
    shouldCounterOffer,
    payType: workOrder.platform === 'WorkMarket' ? 'hourly' : 'fixed', // Keep hourly for WM
    payAmount: Math.round(payAmount),
    travelExpense,
    reason: reason.join(', '),
    originalRate: hourlyRate,
  };
}

function isEligibleForApplication(workOrder) {
  const hourlyRate = workOrder.payRange.max / workOrder.estLaborHours;

  // Log the initial values we're checking
  logger.info(
    `Checking eligibility - Total Pay: $${workOrder.payRange.max}, Hourly Rate: $${hourlyRate}, Distance: ${workOrder.distance}mi`,
    workOrder.platform,
    workOrder.id
  );

  const counterOffer = calculateCounterOffer(workOrder);

  if (counterOffer.shouldCounterOffer) {
    logger.info(
      `Counter offer triggered - Reason: ${counterOffer.reason} - Rate: $${counterOffer.payAmount}/hr, Travel: $${counterOffer.travelExpense}`,
      workOrder.platform,
      workOrder.id
    );

    return {
      eligible: false,
      counterOffer,
    };
  }

  // If no counter offer needed, check if eligible for direct application
  if (isPaymentEligible(workOrder)) {
    logger.info('Payment criteria met', workOrder.platform, workOrder.id);
    const slotAvailable = isSlotAvailable(schedule, workOrder);
    return {
      eligible: slotAvailable,
      counterOffer: null,
    };
  }

  logger.info('Payment criteria not met', workOrder.platform, workOrder.id);
  return {
    eligible: false,
    counterOffer: null,
  };
}

export default isEligibleForApplication;
