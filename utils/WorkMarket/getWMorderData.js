import { log } from 'console';
import fs from 'fs';
import path from 'path';
import { loginToWorkMarket } from './loginToWorkMarket.js';

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
    let cookies = await getCookies();
    if (!cookies) {
      console.log('No cookies found, attempting to login...');
      await loginToWorkMarket();
      cookies = await getCookies();
      if (!cookies) {
        throw new Error('Failed to get cookies even after login attempt');
      }
    }

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
    console.log('Redirected to:', redirectUrl);

    // Extract work order ID from the redirect URL
    const workOrderIdMatch =
      redirectUrl.match(/\/assignments\/details\/(\d+)/) ||
      redirectUrl.match(/redirectTo=\/assignments\/details\/(\d+)/);

    if (!workOrderIdMatch) {
      throw new Error('Could not extract work order ID from redirect URL');
    }

    const workOrderId = workOrderIdMatch[1];
    const workMarketUrl = `https://www.workmarket.com/assignments/details/${workOrderId}`;
    console.log('Fetching from:', workMarketUrl);

    // Now fetch the actual WorkMarket page with proper headers
    let response = await fetch(workMarketUrl, {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        cookie: cookies,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
    });

    let body = await response.text();

    // If redirected to login, try to login and fetch again
    if (body.includes('login?redirectTo=') || body.includes('Please sign in')) {
      console.log('Session expired, attempting to login...');
      await loginToWorkMarket();
      cookies = await getCookies();

      // Retry the request with new cookies
      response = await fetch(workMarketUrl, {
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
          cookie: cookies,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        method: 'GET',
        credentials: 'include',
        redirect: 'follow',
      });

      body = await response.text();

      // If still getting login page, there's a problem
      if (
        body.includes('login?redirectTo=') ||
        body.includes('Please sign in')
      ) {
        throw new Error('Still getting login page after login attempt');
      }
    }

    // Save response for debugging
    fs.writeFileSync('debug_response.html', body);
    console.log('Response saved to debug_response.html');

    // Regular expressions to extract data
    const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
    const companyMatch = body.match(
      /<a[^>]*href="\/profile\/company\/\d+"[^>]*>([^<]+)<\/a>/i
    );
    const hourlyRateMatch =
      body.match(/\$\s*([\d.]+)(?:\/hr|\/hour)/i) ||
      body.match(/rate:\s*\$\s*([\d.]+)/i);
    const hoursOfWorkMatch =
      body.match(/(?:up to|estimated)\s*(\d+)\s*(?:hr|hours?)/i) ||
      body.match(/Duration:\s*(\d+)\s*(?:hr|hours?)/i);
    const totalPaymentMatch =
      body.match(/<td[^>]*>\s*<strong[^>]*>\s*\$\s*([\d.]+)/i) ||
      body.match(/total\s+payment:?\s*\$\s*([\d.]+)/i);
    const distanceMatch =
      body.match(/\(([\d.]+)\s*mi(?:les?)?\)/i) ||
      body.match(/Distance:\s*([\d.]+)\s*mi(?:les?)?/i);

    // Extract date and time with more flexible patterns
    const dateTimeMatch = body.match(
      /Start Date[^>]*>([^<]+)<.*?Time[^>]*>([^<]+)</is
    );
    const date = dateTimeMatch ? dateTimeMatch[1].trim() : null;
    const time = dateTimeMatch ? dateTimeMatch[2].trim() : null;

    const data = {
      id: workOrderId,
      platform: 'WorkMarket',
      company: companyMatch ? companyMatch[1].trim() : 'Unknown Company',
      title: titleMatch ? titleMatch[1].trim() : 'No Title',
      hourlyRate: hourlyRateMatch ? parseFloat(hourlyRateMatch[1]) : 0,
      hoursOfWork: hoursOfWorkMatch ? parseInt(hoursOfWorkMatch[1]) : 4, // Default to 4 hours
      totalPayment: totalPaymentMatch ? parseFloat(totalPaymentMatch[1]) : 0,
      date: date || new Date().toISOString().split('T')[0], // Default to today
      time: time || '09:00 AM EST', // Default time
      distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
    };

    console.log('Extracted data:', data);
    return data;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}
