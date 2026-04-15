import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../../config.js";

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cookiesFilePaths = [
  path.join(__dirname, "autoCookies.json"),
  path.join(__dirname, "cookies.json"),
];

function getCookies() {
  try {
    const cookiesFilePath = cookiesFilePaths.find(filePath =>
      fs.existsSync(filePath)
    );

    if (!cookiesFilePath) throw new Error("Cookies file not found!");

    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"));
    if (!Array.isArray(cookiesJson)) {
      throw new Error(
        "Invalid cookies format: Expected an array of cookie objects"
      );
    }

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
    return null;
  }
}

function formatWorkMarketDate(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatWorkMarketTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  })
    .format(date)
    .replace(/\s/g, "")
    .toLowerCase();
}

function extractAssignmentStatusCode(html) {
  const match = html.match(/"status"\s*:\s*{\s*"code"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function buildWMCounterOfferFormData({
  csrfToken,
  hourlyRate,
  hours,
  distance,
  options = {},
}) {
  const travelExpenses =
    options.travelExpense ??
    (distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
      ? Math.round(distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE)
      : 0);
  const isHourlyCounter = options.payType !== "fixed";
  const priceType = options.priceType ?? (isHourlyCounter ? "2" : "1");
  const rescheduleOption =
    options.rescheduleOption ??
    (options.isRequestedWindow ? "window" : "time");

  const formData = new URLSearchParams({
    _tk: csrfToken,
    is_internal_pricing: "false",
    has_tiered_pricing: "false",
    priceType,
    price_negotiation: "on",
    pricing: "2",
    initial_per_hour_price: "",
    initial_number_of_hours: "",
    additional_per_hour_price: "",
    max_blended_number_of_hours: "",
    per_unit_price: "",
    max_number_of_units: "",
    per_hour_price: hourlyRate.toString(),
    max_number_of_hours: hours.toString(),
    flat_price:
      options.flatPrice ??
      (isHourlyCounter ? "" : Number(options.baseAmount ?? 0).toFixed(2)),
    additional_expenses: travelExpenses.toString(),
    expires_on: "",
    expires_on_time: "",
    note: "",
    isform: "true",
    submit: "",
  });

  if (options.note) {
    formData.set("note", options.note);
  }

  if (options.counterDate?.start instanceof Date) {
    formData.set("schedule_negotiation", "on");
    const hasWindowEnd =
      rescheduleOption === "window" &&
      options.counterDate.end instanceof Date;
    formData.set("reschedule_option", rescheduleOption);
    formData.set("from", formatWorkMarketDate(options.counterDate.start));
    formData.set("fromtime", formatWorkMarketTime(options.counterDate.start));

    if (hasWindowEnd) {
      formData.set("to", formatWorkMarketDate(options.counterDate.end));
      formData.set("totime", formatWorkMarketTime(options.counterDate.end));
    }
  }

  return formData;
}

export async function postWMCounterOffer(
  workOrderId,
  hourlyRate,
  hours,
  distance,
  options = {}
) {
  try {
    const cookies = await getCookies();

    if (!cookies) {
      throw new Error("Failed to retrieve cookies");
    }

    const csrfCookie = cookies
      .split(";")
      .find(cookie => cookie.trim().startsWith("CSRFToken="));
    if (!csrfCookie) {
      throw new Error("CSRFToken cookie not found");
    }
    const CSRFToken = csrfCookie.split("=")[1];

    const formData = buildWMCounterOfferFormData({
      csrfToken: CSRFToken,
      hourlyRate,
      hours,
      distance,
      options,
    });
    const requestUrl = `https://www.workmarket.com/assignments/negotiate/${workOrderId}`;
    const headers = {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookies,
      Referer: `https://www.workmarket.com/assignments/details/${workOrderId}`,
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    const requestBody = formData.toString();

    const response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: requestBody,
      redirect: "manual",
    });

    const responseText = await response.text();
    const responseLocation = response.headers.get("location");

    if (!response.ok && response.status !== 302) {
      throw new Error(
        `Counter offer request failed with status ${response.status}: ${responseText}`
      );
    }

    if (response.status === 302) {
      console.log(
        `Counter offer redirect received for work order ${workOrderId}: ${responseLocation || "(no location header)"}`
      );
      return {
        ok: true,
        status: response.status,
        location: responseLocation,
        responseUrl: response.url,
      };
    }

    if (
      responseText.includes("Page Not Found") ||
      responseText.includes('class="negotiate_action button"') ||
      extractAssignmentStatusCode(responseText) === "sent"
    ) {
      const errorCode = responseLocation?.match(/error=(\d+)/)?.[1] ?? null;
      throw new Error(
        `Counter offer POST returned ${response.status} but WorkMarket appears to have kept the assignment in the original state${errorCode ? ` (error=${errorCode})` : ""}`
      );
    }

    console.log(
      `Counter offer sent successfully for work order ${workOrderId}`
    );
    return {
      ok: true,
      status: response.status,
      location: responseLocation,
      responseUrl: response.url,
    };
  } catch (error) {
    console.error("Error sending counter offer:", error.message);
    throw error;
  }
}

export { buildWMCounterOfferFormData, formatWorkMarketDate, formatWorkMarketTime };
