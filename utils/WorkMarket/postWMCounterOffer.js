import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CONFIG from '../../config.js';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update the cookies path to be relative to this file
const cookiesFilePath = path.join(__dirname, 'cookies.json');

function getCookies() {
  try {
    if (!fs.existsSync(cookiesFilePath)) {
      throw new Error('Cookies file not found!');
    }

    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
    if (!Array.isArray(cookiesJson)) {
      throw new Error(
        'Invalid cookies format: Expected an array of cookie objects'
      );
    }

    const cookies = cookiesJson
      .filter(
        cookie =>
          typeof cookie.name === 'string' && typeof cookie.value === 'string'
      )
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    if (!cookies) {
      throw new Error('No valid cookies found in the file');
    }

    return cookies;
  } catch (error) {
    console.error(`Error reading cookies: ${error.message}`);
    return null;
  }
}

export async function postWMCounterOffer(
  workOrderId,
  hourlyRate,
  hours,
  distance
) {
  try {
    const cookies = await getCookies();

    if (!cookies) {
      throw new Error('Failed to retrieve cookies');
    }

    const csrfCookie = cookies
      .split(';')
      .find(cookie => cookie.trim().startsWith('CSRFToken='));
    if (!csrfCookie) {
      throw new Error('CSRFToken cookie not found');
    }
    const CSRFToken = csrfCookie.split('=')[1];

    // Calculate travel expenses if distance > 30 miles
    const travelExpenses = distance > 30 ? Math.round(distance) : 0;

    const formData = new URLSearchParams({
      _tk: CSRFToken,
      is_internal_pricing: 'false',
      has_tiered_pricing: 'false',
      priceType: '2', // Hourly rate
      price_negotiation: 'on',
      pricing: '2',
      per_hour_price: hourlyRate.toString(),
      max_number_of_hours: hours.toString(),
      additional_expenses: travelExpenses.toString(),
      note: 'Travel expenses added based on distance',
      isform: 'true',
      submit: '',
    });

    const response = await fetch(
      `https://www.workmarket.com/assignments/negotiate/${workOrderId}`,
      {
        method: 'POST',
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'max-age=0',
          'content-type': 'application/x-www-form-urlencoded',
          cookie: cookies,
          Referer: `https://www.workmarket.com/assignments/details/${workOrderId}`,
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Counter offer request failed with status ${response.status}: ${errorText}`
      );
    }

    console.log(
      `Counter offer sent successfully for work order ${workOrderId}`
    );
    return true;
  } catch (error) {
    console.error('Error sending counter offer:', error.message);
    throw error;
  }
}
