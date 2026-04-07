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
    .replace(/\s/g, "");
}

function buildWMCounterOfferFormData({
  csrfToken,
  hourlyRate,
  hours,
  distance,
  options = {},
}) {
  const travelExpenses =
    distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
      ? Math.round(distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE)
      : 0;

  const formData = new URLSearchParams({
    _tk: csrfToken,
    is_internal_pricing: "false",
    has_tiered_pricing: "false",
    priceType: "2",
    price_negotiation: "on",
    pricing: "2",
    per_hour_price: hourlyRate.toString(),
    max_number_of_hours: hours.toString(),
    additional_expenses: travelExpenses.toString(),
    note: "Travel expenses added based on distance",
    isform: "true",
    submit: "",
  });

  if (options.note) {
    formData.set("note", options.note);
  }

  if (options.counterDate?.start instanceof Date) {
    formData.set("schedule_negotiation", "on");
    formData.set("reschedule_option", "time");
    formData.set("from", formatWorkMarketDate(options.counterDate.start));
    formData.set("fromtime", formatWorkMarketTime(options.counterDate.start));
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

    const response = await fetch(
      `https://www.workmarket.com/assignments/negotiate/${workOrderId}`,
      {
        method: "POST",
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "max-age=0",
          "content-type": "application/x-www-form-urlencoded",
          "x-requested-with": "XMLHttpRequest",
          cookie: cookies,
          Referer: `https://www.workmarket.com/assignments/details/${workOrderId}`,
          "Referrer-Policy": "strict-origin-when-cross-origin",
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
    console.error("Error sending counter offer:", error.message);
    throw error;
  }
}

export { buildWMCounterOfferFormData, formatWorkMarketDate, formatWorkMarketTime };
