import fs from 'fs';
import path from 'path';
import { CONFIG } from '../../config.js';

function getCookies() {
  const cookiesFilePath = path.resolve('utils', 'FieldNation', 'cookies.json');
  if (!fs.existsSync(cookiesFilePath)) {
    throw new Error('Cookies file not found!');
  }
  const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
  return cookiesJson.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

export async function postFNCounterOffer(
  workOrderId,
  baseAmount,
  travelExpense,
  payType,
  baseHours,
  additionalHours,
  additionalAmount
) {
  try {
    const cookies = getCookies();
    console.log('Starting counter offer with params:', {
      workOrderId,
      baseAmount,
      travelExpense,
      payType,
      baseHours,
      additionalHours,
      additionalAmount,
    });

    const requestBody = {
      technician: { id: CONFIG.PLATFORMS.FIELD_NATION.USER_ID },
      counter: true,
      active: true,
      expiryTime: 0,
      expenses: [],
      notes:
        "Hi there! I hope you're doing well. I was wondering if it would be possible to add travel expenses and provide the total payment amount. Thank you so much!",
      pay: {
        type: payType,
        base: {
          units: parseInt(baseHours),
          amount: parseFloat(baseAmount),
        },
        additional: {
          units: parseInt(additionalHours),
          amount: parseFloat(additionalAmount),
        },
      },
    };

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
