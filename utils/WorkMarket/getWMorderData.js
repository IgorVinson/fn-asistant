import logger from "../logger.js";
import { getCookieHeader } from "../cookieStore.js";
import { inspectWMBody, dumpWMBody } from "./wmSession.js";

function getCookies() {
  try {
    return getCookieHeader("WorkMarket", "https://www.workmarket.com/");
  } catch (error) {
    logger.error(`Error reading cookies: ${error.message}`, "WorkMarket");
    return null; // Return null if any error occurs
  }
}

// authExpired: true marks a genuine auth wall (no cookies / login redirect).
// Only these should trigger a cookie refresh + re-login. Any other invalid
// data (e.g. an unavailable ticket) must NOT re-login, to avoid a 2FA loop.
function getInvalidDataSkeleton(workOrderId = "unknown", authExpired = false) {
  return {
    id: workOrderId,
    platform: "WorkMarket",
    company: "Unknown Company",
    title: "No Title",
    hourlyRate: 0,
    hoursOfWork: 4,
    totalPayment: 0,
    originalAmount: 0,
    payType: "fixed",
    date: new Date().toISOString().split("T")[0],
    time: "09:00 AM EST",
    distance: 0,
    authExpired,
  };
}

function convert24HourClockTo12Hour(timeStr) {
  const [rawHours, rawMinutes = "00", rawSeconds = "00"] = timeStr.split(":");
  let hours = Number(rawHours);
  const minutes = rawMinutes.padStart(2, "0");
  const seconds = rawSeconds.padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes}:${seconds} ${period}`;
}

export async function getWMorderData(url) {
  try {
    let cookies = await getCookies();
    if (!cookies) {
      logger.debug("No cookies found, requesting new session via invalid data indicator...", "WorkMarket");
      return getInvalidDataSkeleton("unknown", true);
    }

    // First, follow the sendgrid link to get the actual WorkMarket URL
    const initialResponse = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });

    if (!initialResponse.ok) {
      throw new Error(`Initial HTTP error: ${initialResponse.status}`);
    }

    // Get the final URL after redirects
    const redirectUrl = initialResponse.url;
    logger.debug(`Redirected to: ${redirectUrl}`, "WorkMarket");

    // Extract work order ID from the redirect URL
    const workOrderIdMatch =
      redirectUrl.match(/\/assignments\/details\/(\d+)/) ||
      redirectUrl.match(/redirectTo=\/assignments\/details\/(\d+)/);

    if (!workOrderIdMatch) {
      throw new Error("Could not extract work order ID from redirect URL");
    }

    const workOrderId = workOrderIdMatch[1];
    const workMarketUrl = `https://www.workmarket.com/assignments/details/${workOrderId}`;
    logger.debug(`Fetching from: ${workMarketUrl}`, "WorkMarket");

    // Now fetch the actual WorkMarket page with proper headers
    let response = await fetch(workMarketUrl, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        cookie: cookies,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      method: "GET",
      credentials: "include",
      redirect: "follow",
    });

    let body = await response.text();

    // Ticket is no longer available (already assigned / cancelled / expired).
    // This is NOT an auth problem — return invalid data WITHOUT authExpired so
    // the caller skips it instead of triggering a pointless re-login loop.
    // Checked BEFORE the session check so a genuinely dead ticket can never
    // be mistaken for an expired session.
    if (
      body.includes("no longer available") ||
      body.includes("This assignment is not available") ||
      body.includes("assignment-unavailable") ||
      body.includes("Assignment Not Found") ||
      body.includes("has been cancelled")
    ) {
      logger.info(`WorkMarket ticket ${workOrderId} is no longer available, skipping`, "WorkMarket");
      return getInvalidDataSkeleton(workOrderId, false);
    }

    // Session check. WorkMarket answers an expired session with a contentless
    // SPA shell rather than a login page, so we require positive proof that
    // real assignment content came back instead of matching login strings.
    const session = inspectWMBody(body, workOrderId);
    if (!session.ok) {
      const dumped = dumpWMBody(body, workOrderId, session.reason);
      logger.warn(
        `WorkMarket session looks invalid (${session.reason}) — requesting re-login${dumped ? `; page saved to ${dumped}` : ""}`,
        "WorkMarket",
        workOrderId
      );
      return getInvalidDataSkeleton(workOrderId, true);
    }

    // Save response for debugging (only when WM_DEBUG_DUMP_ALL is on)
    dumpWMBody(body, workOrderId, "ok");

    // Extract title from page header
    const titleMatch =
      body.match(/<h2[^>]*class="assignment-header"[^>]*>\s*([^<]+)/i) ||
      body.match(/<title[^>]*>([^<]+)<\/title>/i);

    // Fix company name extraction - look for companyName in JavaScript config
    let companyName = "Unknown Company";

    // Look for companyName in the config object
    const configCompanyMatch = body.match(/companyName:\s*'([^']+)'/);
    if (configCompanyMatch) {
      companyName = configCompanyMatch[1];
    } else {
      // Fallback: look in the sidebar company link
      const sidebarCompanyMatch = body.match(
        /<a[^>]*href="\/profile\/company\/\d+"[^>]*>([^<]+)<\/a>/i
      );
      if (sidebarCompanyMatch) {
        companyName = sidebarCompanyMatch[1].trim();
        // Clean up common HTML artifacts
        companyName = companyName.replace(/Learn More &raquo;/gi, "").trim();
      }
    }

    // Fix pricing extraction - look for hourly rate and total budget
    const hourlyRateMatch = body.match(/\$\s*([\d.,]+)\/hr/i);
    const maxHoursMatch = body.match(/up to\s+(\d+)hr/i);
    const totalBudgetMatch = body.match(
      /<td[^>]*><strong[^>]*>Total budget<\/strong><\/td>\s*<td[^>]*>\s*<strong[^>]*>\s*\$\s*([\d.,]+)/i
    );

    // Fix distance extraction - look in the location section
    const distanceMatch = body.match(/\(([\d.,]+)\s*mi\)/i);

    // Fix date and time extraction - look for the specific format in the schedule section
    const scheduleMatch = body.match(
      /<strong[^>]*>(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}\/\d{1,2}\/\d{4}))?<\/strong><br\/>\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(?:to\s*(\d{1,2}:\d{2}\s*(?:AM|PM)))?\s*(\w{3})/i
    );

    // Parse the schedule data
    let formattedDate = null;
    let formattedTime = null;
    let latestStartTime = null;
    let isRequestedWindow = false;

    if (scheduleMatch) {
      const startDate = scheduleMatch[2]; // e.g., "05/30/2025"
      const startTime = scheduleMatch[5]; // e.g., "8:00 AM"
      const endTime = scheduleMatch[6]; // e.g., "5:00 PM"
      const timezone = scheduleMatch[7]; // e.g., "EDT"

      // Convert date to YYYY-MM-DD format
      const dateObj = new Date(startDate);
      formattedDate = dateObj.toISOString().split("T")[0];

      // Format time range
      if (endTime) {
        formattedTime = `${startTime} to ${endTime} ${timezone}`;
      } else {
        formattedTime = `${startTime} ${timezone}`;
      }
    }

    const titleWindowMatch = titleMatch?.[1]?.match(
      /\|\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})\s+([A-Z]{3})\s*\|\s*Requested Window/i
    );

    if (titleWindowMatch) {
      const [, startDate, startTime24, latestStart24, timezone] = titleWindowMatch;
      const dateObj = new Date(startDate);
      formattedDate = dateObj.toISOString().split("T")[0];
      formattedTime = `${convert24HourClockTo12Hour(startTime24)} to ${convert24HourClockTo12Hour(latestStart24)} ${timezone}`;
      latestStartTime = `${convert24HourClockTo12Hour(latestStart24)} ${timezone}`;
      isRequestedWindow = true;
    }

    // Extract marketplace fee and calculate pricing
    const marketplaceFeeMatch = body.match(
      /Marketplace Access Fee[^$]*-\s*\$\s*([\d.,]+)/i
    );

    let totalPayment = 0;
    let originalAmount = 0;
    
    // Attempt robust JSON parsing of "pricing" from the page config
    let jsonHourlyRate = 0;
    let jsonMaxHours = null;
    let jsonPayType = null;
    let jsonTotalPayment = 0;

    const pricingMatch = body.match(/"pricing"\s*:\s*({[^}]+})/);
    if (pricingMatch) {
      try {
        const pricingJSON = JSON.parse(pricingMatch[1]);
        if (pricingJSON.type === "PER_HOUR") {
          jsonPayType = "hourly";
          jsonHourlyRate = pricingJSON.perHourPrice || 0;
          jsonMaxHours = pricingJSON.maxNumberOfHours || null;
          // Use maxSpendLimit as total budget, or calculate from rate * hours 
          jsonTotalPayment = pricingJSON.maxSpendLimit || (jsonHourlyRate * (jsonMaxHours || 4));
        } else {
          jsonPayType = "fixed";
          jsonTotalPayment = pricingJSON.flatPrice || pricingJSON.maxSpendLimit || 0;
        }
      } catch (e) {
        logger.error(`Could not parse pricing JSON: ${e.message}`, "WorkMarket");
      }
    }

    if (jsonTotalPayment > 0) {
      totalPayment = jsonTotalPayment;
    } else if (totalBudgetMatch) {
      totalPayment = parseFloat(totalBudgetMatch[1].replace(",", ""));
    }
    
    originalAmount = totalPayment;

    if (marketplaceFeeMatch) {
      const marketplaceFee = parseFloat(
        marketplaceFeeMatch[1].replace(",", "")
      );
      originalAmount = totalPayment + marketplaceFee;
    }

    // Determine finalized hourly rate and max hours (prefer JSON, fallback to regex)
    const finalHourlyRate = jsonHourlyRate > 0 
      ? jsonHourlyRate 
      : (hourlyRateMatch ? parseFloat(hourlyRateMatch[1].replace(",", "")) : 0);
      
    const finalMaxHours = jsonMaxHours !== null 
      ? jsonMaxHours 
      : (maxHoursMatch ? parseInt(maxHoursMatch[1]) : 4);

    const data = {
      id: workOrderId,
      platform: "WorkMarket",
      company: companyName,
      title: titleMatch
        ? titleMatch[1].trim().replace(" - Work Market", "")
        : "No Title",
      hourlyRate: finalHourlyRate,
      hoursOfWork: finalMaxHours,
      totalPayment: totalPayment,
      originalAmount: originalAmount, // Original amount before fees
      payType: jsonPayType || (finalHourlyRate > 0 ? "hourly" : "fixed"),
      date: formattedDate || new Date().toISOString().split("T")[0], // Default to today
      time: formattedTime || "09:00 AM EST", // Default time
      latestStartTime,
      isRequestedWindow,
      distance: distanceMatch
        ? parseFloat(distanceMatch[1].replace(",", ""))
        : 0,
    };

    logger.debug(`Extracted data: ${JSON.stringify(data)}`, "WorkMarket");
    return data;
  } catch (error) {
    logger.error(`Error extracting WM order data: ${error.message}`, "WorkMarket");
    return null;
  }
}
