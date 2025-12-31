import fs from "fs";
import path from "path";
import { loginToWorkMarket } from "./loginToWorkMarket.js";

const cookiesFilePath = path.resolve(process.cwd(), "src", "services", "platforms", "workmarket", "cookies.json");

function getCookies() {
  try {
    if (!fs.existsSync(cookiesFilePath)) {
      throw new Error("Cookies file not found!");
    }

    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"));

    if (!Array.isArray(cookiesJson)) {
      throw new Error(
        "Invalid cookies format: Expected an array of cookie objects"
      );
    }

    // Filter valid cookies with name and value, and join them into a cookie string
    const cookies = cookiesJson
      .filter(
        cookie =>
          typeof cookie.name === "string" && typeof cookie.value === "string"
      )
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (!cookies) {
      throw new Error("No valid cookies found in the file");
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
      console.log("No cookies found, attempting to login...");
      await loginToWorkMarket();
      cookies = await getCookies();
      if (!cookies) {
        throw new Error("Failed to get cookies even after login attempt");
      }
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
    console.log("Redirected to:", redirectUrl);

    // Extract work order ID from the redirect URL
    const workOrderIdMatch =
      redirectUrl.match(/\/assignments\/details\/(\d+)/) ||
      redirectUrl.match(/redirectTo=\/assignments\/details\/(\d+)/);

    if (!workOrderIdMatch) {
      throw new Error("Could not extract work order ID from redirect URL");
    }

    const workOrderId = workOrderIdMatch[1];
    const workMarketUrl = `https://www.workmarket.com/assignments/details/${workOrderId}`;
    console.log("Fetching from:", workMarketUrl);

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

    // If redirected to login, try to login and fetch again
    if (body.includes("login?redirectTo=") || body.includes("Please sign in")) {
      console.log("Session expired, attempting to login...");
      await loginToWorkMarket();
      cookies = await getCookies();

      // Retry the request with new cookies
      response = await fetch(workMarketUrl, {
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

      body = await response.text();

      // If still getting login page, there's a problem
      if (
        body.includes("login?redirectTo=") ||
        body.includes("Please sign in")
      ) {
        throw new Error("Still getting login page after login attempt");
      }
    }

    // Save response for debugging
    fs.writeFileSync("debug_response.html", body);
    console.log("Response saved to debug_response.html");

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

    // Extract marketplace fee and calculate pricing
    const marketplaceFeeMatch = body.match(
      /Marketplace Access Fee[^$]*-\s*\$\s*([\d.,]+)/i
    );

    let totalPayment = 0;
    let originalAmount = 0;

    if (totalBudgetMatch) {
      totalPayment = parseFloat(totalBudgetMatch[1].replace(",", ""));
      originalAmount = totalPayment;
    }

    if (marketplaceFeeMatch) {
      const marketplaceFee = parseFloat(
        marketplaceFeeMatch[1].replace(",", "")
      );
      originalAmount = totalPayment + marketplaceFee;
    }

    const data = {
      id: workOrderId,
      platform: "WorkMarket",
      company: companyName,
      title: titleMatch
        ? titleMatch[1].trim().replace(" - Work Market", "")
        : "No Title",
      hourlyRate: hourlyRateMatch
        ? parseFloat(hourlyRateMatch[1].replace(",", ""))
        : 0,
      hoursOfWork: maxHoursMatch ? parseInt(maxHoursMatch[1]) : 4, // Default to 4 hours
      totalPayment: totalPayment,
      originalAmount: originalAmount, // Original amount before fees
      date: formattedDate || new Date().toISOString().split("T")[0], // Default to today
      time: formattedTime || "09:00 AM EST", // Default time
      distance: distanceMatch
        ? parseFloat(distanceMatch[1].replace(",", ""))
        : 0,
      description: body, // Pass full HTML body for AI analysis
    };

    console.log("Extracted data:", data);
    return data;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}
