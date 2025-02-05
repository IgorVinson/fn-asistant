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
  payAmount,
  travelExpense = 0,
  payType = 'fixed', // default to fixed rate
  laborHours = 1 // Add labor hours parameter
) {
  try {
    const cookies = getCookies();

    const requestBody = {
      technician: { id: CONFIG.PLATFORMS.FIELD_NATION.USER_ID },
      counter: true,
      active: true,
      expiryTime: 0,
      expenses: [],
      notes: '',
      pay: {
        type: payType,
        base: {
          units: payType === 'hourly' ? laborHours : 0, // Use actual labor hours
          amount: payAmount,
        },
        additional: {
          units: 0,
          amount: 0,
        },
      },
    };

    // Add travel expenses if needed
    if (travelExpense > 0) {
      requestBody.expenses.push({
        description: 'travel',
        amount: travelExpense,
        quantity: 1,
        category: {
          uid: 2,
          id: 2,
        },
      });
      requestBody.notes = 'Including travel expenses';
    }

    const response = await fetch(
      `https://app.fieldnation.com/v2/workorders/${workOrderId}/requests?acting_user_id=983643&clientPayTermsAccepted=true`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-language':
            'en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5',
          'content-type': 'application/json',
          priority: 'u=1, i',
          'sec-ch-ua':
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          cookie: cookies,
          Referer: `https://app.fieldnation.com/workorders/${workOrderId}`,
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error posting counter offer:', error);
    throw error;
  }
}
