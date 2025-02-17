import { log } from 'console';
import fs from 'fs';
import path from 'path';

const cookiesFilePath = path.resolve('utils', 'WorkMarket', 'cookies.json');

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

    // Filter valid cookies with name and value, and join them into a cookie string
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
    return null; // Return null if any error occurs
  }
}

export async function getWMorderData(url) {
  try {
    const cookies = await getCookies();

    // First, follow the sendgrid link to get the actual WorkMarket URL
    const initialResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!initialResponse.ok) {
      throw new Error(`Initial HTTP error: ${initialResponse.status}`);
    }

    // Get the final URL after redirects
    const redirectUrl = initialResponse.url;

    // Extract work order ID from the redirect URL
    const workOrderIdMatch =
      redirectUrl.match(/\/assignments\/details\/(\d+)/) ||
      redirectUrl.match(/redirectTo=\/assignments\/details\/(\d+)/);

    if (!workOrderIdMatch) {
      throw new Error('Could not extract work order ID from redirect URL');
    }

    const workOrderId = workOrderIdMatch[1];
    const workMarketUrl = `https://www.workmarket.com/assignments/details/${workOrderId}`;

    // Now fetch the actual WorkMarket page with cookies
    const response = await fetch(workMarketUrl, {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        cookie: cookies,
        Referer: 'https://www.workmarket.com/login',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const body = await response.text();

    // Regular expressions to extract data
    const titleMatch = body.match(/<title>(.*?)<\/title>/);
    const companyMatch = body.match(
      /<a href="\/profile\/company\/\d+">(.*?)<\/a>/
    );
    const hourlyRateMatch = body.match(/\$([0-9.]+)\/hr/);
    const hoursOfWorkMatch = body.match(/\(up to ([0-9]+)hr\)/);
    const totalPaymentMatch = body.match(/<td>\s*<strong>\s*\$([0-9.]+)/);
    const distanceMatch = body.match(/\(([\d.]+ mi)\)/);
    let date = null;
    let time = null;

    const ddMatches = body.match(/<dd>.*?<\/dd>/gs);

    if (ddMatches && ddMatches[1]) {
      const secondDd = ddMatches[1];
      const dateRangeMatch = secondDd.match(/<strong>([\s\S]*?)<\/strong>/);
      const timeMatch = secondDd.match(
        /<br\/>\s*([0-9:AMP ]+)\s*(?:to\s*([0-9:AMP ]+))?/
      );

      const dateRange = dateRangeMatch
        ? dateRangeMatch[1].trim().replace(/\s+/g, ' ')
        : null;
      const startTime = timeMatch ? timeMatch[1] : null;
      const endTime = timeMatch && timeMatch[2] ? timeMatch[2] : null;

      date = dateRange || null;
      time = endTime ? `${startTime} to ${endTime} EST` : `${startTime} EST`;
    }

    return {
      id: workOrderId,
      platform: 'WorkMarket',
      company: companyMatch ? companyMatch[1].trim() : null,
      title: titleMatch ? titleMatch[1].trim() : null,
      hourlyRate: hourlyRateMatch ? hourlyRateMatch[1] : null,
      hoursOfWork: hoursOfWorkMatch ? hoursOfWorkMatch[1] : null,
      totalPayment: totalPaymentMatch ? totalPaymentMatch[1] : null,
      date,
      time,
      distance: distanceMatch ? distanceMatch[1] : null,
    };
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}
