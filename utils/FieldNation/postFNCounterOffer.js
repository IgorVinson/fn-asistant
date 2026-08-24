import { CONFIG } from '../../config.js';
import { getCookieHeader } from '../cookieStore.js';

// FieldNation counter offers carry the proposed time in
// `schedule.service_window.start.local` as separate { date, time } wall-clock
// fields in the work order's timezone — NOT an `eta` ISO string, and NOT UTC.
// The availability engine builds slot Dates in local time, so we serialize the
// local components directly (matches the payload FN's own UI sends).
function toLocalDateTimeParts(date) {
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

const COUNTER_INTRO =
  "Hey! I'm a low-voltage and networking specialist based in NC, working with Granite Telecommunications — one of the largest telecom providers in the US. Most of my work comes through WorkMarket, where I've completed 500+ field service projects covering structured cabling, network infrastructure, and security systems. My FieldNation profile is lighter since I mainly operate on WorkMarket, but the experience and quality are the same. On-time, clean install, no callbacks. Looking forward to working together!";

// Pure builder for the FieldNation counter-offer request body. Kept separate
// from the network call so it can be unit-tested (mirrors the WorkMarket side).
export function buildFNCounterOfferRequestBody({
  payType,
  baseAmount,
  travelExpense = 0,
  baseHours,
  additionalHours = 0,
  additionalAmount = 0,
  counterDate = null,
  estLaborHours = null,
  payStructure = null,
  notes = null,
}) {
  let pay;
  // Blended ("combined") orders must be mirrored exactly so the counter keeps
  // the same pay shape the buyer posted (base + additional), per requirements.
  if (payType === 'blended' && payStructure?.base && payStructure?.additional) {
    pay = {
      type: 'blended',
      base: {
        units: parseInt(payStructure.base.units),
        amount: parseFloat(payStructure.base.amount),
      },
      additional: {
        units: parseInt(payStructure.additional.units),
        amount: parseFloat(payStructure.additional.amount),
      },
    };
  } else {
    pay = {
      type: payType,
      base: {
        units: parseInt(baseHours) || 0,
        amount: parseFloat(baseAmount),
      },
      additional: {
        units: parseInt(additionalHours) || 0,
        amount: parseFloat(additionalAmount) || 0,
      },
    };
  }

  const resolvedNotes =
    notes ||
    (counterDate?.start instanceof Date
      ? `${COUNTER_INTRO} I have a scheduling conflict with the requested time — would ${counterDate.start.toLocaleString()} work instead?`
      : `${COUNTER_INTRO} Looking forward to working on this!`);

  const requestBody = {
    technician: { id: CONFIG.PLATFORMS.FIELD_NATION.USER_ID },
    counter: true,
    active: true,
    expiryTime: 0,
    expenses: [],
    notes: resolvedNotes,
    pay,
  };

  if (counterDate?.start instanceof Date) {
    const { date, time } = toLocalDateTimeParts(counterDate.start);
    requestBody.schedule = {
      service_window: {
        mode: 'exact',
        start: {
          local: { date, time },
        },
      },
    };
  }

  if (travelExpense > 0) {
    requestBody.expenses.push({
      description: 'travel',
      amount: parseFloat(travelExpense),
      quantity: 1,
      category: {
        uid: 2,
        id: 2,
      },
    });
  }

  return requestBody;
}

export async function postFNCounterOffer(workOrderId, options = {}) {
  try {
    const cookies = getCookieHeader(
      'FieldNation',
      `https://app.fieldnation.com/v2/workorders/${workOrderId}/requests`
    );
    console.log('Starting counter offer with params:', {
      workOrderId,
      ...options,
    });

    const requestBody = buildFNCounterOfferRequestBody(options);

    console.log(
      'Counter offer request body:',
      JSON.stringify(requestBody, null, 2)
    );

    const response = await fetch(
      `https://app.fieldnation.com/v2/workorders/${workOrderId}/requests?acting_user_id=${CONFIG.PLATFORMS.FIELD_NATION.USER_ID}&clientPayTermsAccepted=true`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          cookie: cookies,
          Referer: `https://app.fieldnation.com/workorders/${workOrderId}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Counter offer error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error posting counter offer:', error);
    throw error;
  }
}
