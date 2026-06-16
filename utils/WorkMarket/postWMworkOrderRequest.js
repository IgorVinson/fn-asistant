import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mirror the counter-offer cookie resolution: prefer fresh auto-login cookies,
// fall back to manually saved cookies.
const cookiesFilePaths = [
  path.join(__dirname, "autoCookies.json"),
  path.join(__dirname, "cookies.json"),
];

// Function to get cookies
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

// Function to post work order request
export async function postWMworkOrderRequest(url, date, hours, workOrderId) {
  try {
    // Get cookies
    const cookies = getCookies(); // Removed 'await' since getCookies is not async

    if (!cookies || typeof cookies !== "string") {
      throw new Error("Cookies is not defined or not a string");
    }

    const csrfCookie = cookies
      .split(";")
      .find(cookie => cookie.trim().startsWith("CSRFToken="));

    if (!csrfCookie) {
      throw new Error("CSRFToken cookie not found");
    }

    const CSRFToken = csrfCookie.split("=")[1];

    if (!CSRFToken) {
      throw new Error("CSRFToken value is undefined");
    }

    const response = await fetch(
      `https://www.workmarket.com/assignments/apply/${workOrderId}`,
      {
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-language":
            "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
          "cache-control": "max-age=0",
          "content-type": "application/x-www-form-urlencoded",
          "sec-ch-ua":
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "same-origin",
          "sec-fetch-user": "?1",
          "upgrade-insecure-requests": "1",
          cookie: cookies,
          Referer: `https://www.workmarket.com/assignments/details/${workOrderId}`,
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: `_tk=${CSRFToken}&note=&tieredPricingAccepted=false&isform=true`,
        method: "POST",
        // A successful apply responds with a 302 redirect to the assignment
        // details page. Without manual redirect handling, fetch silently
        // follows the redirect to a 200 page and we can never tell whether
        // the apply actually went through.
        redirect: "manual",
      }
    );

    const responseText = await response.text();
    const responseLocation = response.headers.get("location");

    // Anything that is not a 302 redirect means WorkMarket re-rendered the
    // apply form / login page (HTTP 200) instead of accepting the application.
    if (response.status !== 302) {
      throw new Error(
        `Apply request failed with status ${response.status}: ${responseText.slice(
          0,
          500
        )}`
      );
    }

    const location = responseLocation || "";
    const errorCode = location.match(/error=(\d+)/)?.[1] ?? null;
    const redirectedToDetails = location.includes(
      `/assignments/details/${workOrderId}`
    );

    // A 302 that carries an error code, or that redirects somewhere other than
    // the assignment details page (e.g. /login), is not a real application.
    if (errorCode || !redirectedToDetails) {
      throw new Error(
        `Apply POST returned 302 but WorkMarket did not confirm the application ` +
          `(location=${location || "(none)"}${errorCode ? `, error=${errorCode}` : ""})`
      );
    }

    console.log(
      `Work order request sent successfully for work order ${workOrderId} (redirect: ${location})`
    );
    return {
      ok: true,
      status: response.status,
      location: responseLocation,
    };
  } catch (error) {
    console.error("Error sending work order request:", error.message);
    throw error;
  }
}
