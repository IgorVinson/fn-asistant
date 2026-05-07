import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { CONFIG } from "../../config.js";

const cookiesFilePath = path.resolve("utils", "WorkMarket", "autoCookies.json");
const ASSIGNMENTS_URL = "https://www.workmarket.com/assignments#status/active/managing";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedBusyBlocks = [];
let cacheTimestamp = 0;
let cachedApiUrl = null;

function getCookies() {
  try {
    if (!fs.existsSync(cookiesFilePath)) {
      throw new Error("Cookies file not found!");
    }
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"));
    if (!Array.isArray(cookiesJson)) {
      throw new Error("Invalid cookies format: Expected an array of cookie objects");
    }
    const cookies = cookiesJson
      .filter(cookie => typeof cookie.name === "string" && typeof cookie.value === "string")
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join("; ");
    if (!cookies) throw new Error("No valid cookies found in the file");
    return cookies;
  } catch (error) {
    console.error(`Error reading cookies: ${error.message}`);
    return null;
  }
}

export function estimateAssignmentEnd(startDate, assignment = {}) {
  const defaultHours = CONFIG.TIME?.DEFAULT_LABOR_HOURS ?? 2;
  const explicitEnd = assignment.endDate;
  const estimatedHours =
    Number.isFinite(assignment.estimatedHours) && assignment.estimatedHours > 0
      ? assignment.estimatedHours
      : defaultHours;

  if (
    explicitEnd instanceof Date &&
    !isNaN(explicitEnd.getTime()) &&
    explicitEnd.getTime() > startDate.getTime()
  ) {
    return explicitEnd;
  }

  return new Date(startDate.getTime() + estimatedHours * 60 * 60 * 1000);
}

function extractBalancedObject(source, label) {
  const labelIndex = source.indexOf(label);
  if (labelIndex === -1) return null;

  const start = source.indexOf("{", labelIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseAssignmentDetail(body) {
  const workEncodedJson = extractBalancedObject(body, "workEncoded:");
  if (!workEncodedJson) return {};

  try {
    const work = JSON.parse(workEncodedJson);
    const scheduleFrom = Number(work.schedule?.from || 0);
    const scheduleThrough = Number(work.schedule?.through || 0);
    const maxNumberOfHours = Number(work.pricing?.maxNumberOfHours || 0);

    return {
      detailStartDate: scheduleFrom > 0 ? new Date(scheduleFrom) : null,
      detailEndDate: scheduleThrough > 0 ? new Date(scheduleThrough) : null,
      estimatedHours: maxNumberOfHours > 0 ? maxNumberOfHours : null,
    };
  } catch {
    return {};
  }
}

async function fetchAssignmentDetail(id, cookies) {
  const response = await fetch(`https://www.workmarket.com/assignments/details/${id}`, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      cookie: cookies,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return parseAssignmentDetail(await response.text());
}

async function enrichAssignmentsWithDetails(assignments) {
  const cookies = getCookies();
  if (!cookies) return assignments;

  return Promise.all(
    assignments.map(async assignment => {
      try {
        const detail = await fetchAssignmentDetail(assignment.id, cookies);
        return {
          ...assignment,
          startDate: detail.detailStartDate || assignment.startDate,
          endDate: detail.detailEndDate || assignment.endDate,
          estimatedHours: detail.estimatedHours || assignment.estimatedHours,
        };
      } catch (error) {
        console.error(`fetchWMAssignments detail ${assignment.id}: ${error.message}`);
        return assignment;
      }
    })
  );
}

function extractAssignmentsFromHtml(html) {
  const assignments = [];
  const seenIds = new Set();

  const configMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});/);
  if (configMatch) {
    try {
      const state = JSON.parse(configMatch[1]);
      const items = state?.assignments?.list || state?.dashboard?.results || [];
      for (const item of items) {
        if (!item || !item.id || seenIds.has(String(item.id))) continue;
        seenIds.add(String(item.id));
        assignments.push({
          id: String(item.id),
          title: item.title || "",
          company: item.owner_company_name || item.buyer || "",
          status: item.status || "",
          startDate: item.scheduled_date_from_in_millis ? new Date(item.scheduled_date_from_in_millis) : null,
          endDate: item.scheduled_date_through_in_millis ? new Date(item.scheduled_date_through_in_millis) : null,
          pay: item.price || item.amount_earned || "",
          location: [item.location_name, item.city, item.state].filter(Boolean).join(", ") || item.address || "",
        });
      }
    } catch {}
  }

  return assignments;
}

function extractAssignmentsFromApi(data) {
  const assignments = [];
  const seenIds = new Set();

  const items = data?.data || [];
  for (const item of items) {
    if (!item || !item.id || seenIds.has(String(item.id))) continue;
    seenIds.add(String(item.id));
    assignments.push({
      id: String(item.id),
      title: item.title || "",
      company: item.owner_company_name || item.buyer || "",
      status: item.status || "",
      startDate: item.scheduled_date_from_in_millis ? new Date(item.scheduled_date_from_in_millis) : null,
      endDate: item.scheduled_date_through_in_millis ? new Date(item.scheduled_date_through_in_millis) : null,
      pay: item.price || item.amount_earned || "",
      location: [item.location_name, item.city, item.state].filter(Boolean).join(", ") || item.address || "",
    });
  }

  return assignments;
}

async function tryDirectFetch() {
  const cookies = getCookies();
  if (!cookies) return null;

  if (cachedApiUrl) {
    try {
      const response = await fetch(cachedApiUrl, {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          pragma: "no-cache",
          cookie: cookies,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        method: "GET",
        redirect: "follow",
      });

      if (response.ok) {
        const data = await response.json();
        const assignments = extractAssignmentsFromApi(data);
        if (assignments.length > 0) return assignments;
      }
    } catch {}
  }

  try {
    const response = await fetch(ASSIGNMENTS_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        cookie: cookies,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      method: "GET",
      redirect: "follow",
    });

    if (response.ok) {
      const html = await response.text();
      const assignments = extractAssignmentsFromHtml(html);
      if (assignments.length > 0) return assignments;
    }
  } catch {}

  return null;
}

async function fetchViaPuppeteer() {
  const cookies = getCookies();
  if (!cookies) throw new Error("No WM cookies available");

  const cookieArray = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"))
    .filter(c => typeof c.name === "string" && typeof c.value === "string");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote",
      "--disable-gpu", "--disable-web-security", "--disable-features=VizDisplayCompositor",
      "--enable-experimental-web-platform-features", "--force-device-scale-factor=1",
      "--disable-extensions-except", "--disable-plugins-discovery",
      "--enable-blink-features=ShadowDOMV0", "--incognito",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setCookie(...cookieArray);

    const apiResponses = [];
    page.on("response", async resp => {
      if (resp.url().includes("fetch_dashboard_results")) {
        try {
          if ((resp.headers()["content-type"] || "").includes("json")) {
            cachedApiUrl = resp.url();
            apiResponses.push({ url: resp.url(), data: await resp.json() });
          }
        } catch {}
      }
    });

    await page.goto(ASSIGNMENTS_URL, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise(r => setTimeout(r, 5000));

    const dashboardResp = apiResponses.find(r => r.url.includes("fetch_dashboard_results"));
    const dashboardData = dashboardResp?.data;
    const assignments = extractAssignmentsFromApi(dashboardData);

    if (assignments.length === 0) {
      const body = await page.content();
      const htmlAssignments = extractAssignmentsFromHtml(body);
      if (htmlAssignments.length > 0) return htmlAssignments;
    }

    return assignments;
  } finally {
    await browser.close();
  }
}

export async function fetchWMAssignments() {
  if (Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedBusyBlocks;
  }

  let assignments;
  try {
    assignments = await tryDirectFetch();
  } catch {}

  if (!assignments || assignments.length === 0) {
    try {
      assignments = await fetchViaPuppeteer();
    } catch (error) {
      console.error(`fetchWMAssignments (Puppeteer): ${error.message}`);
    }
  }

  if (!assignments || assignments.length === 0) {
    console.error("fetchWMAssignments: no assignments found from any source");
    cachedBusyBlocks = [];
    cacheTimestamp = Date.now();
    return [];
  }

  assignments = await enrichAssignmentsWithDetails(assignments);

  const busyBlocks = assignments
    .map(a => {
      if (!a.startDate || !(a.startDate instanceof Date) || isNaN(a.startDate.getTime())) return null;
      return {
        start: a.startDate,
        end: estimateAssignmentEnd(a.startDate, a),
        summary: `🔧 ${a.title || "WM Assignment"} (WM)`,
      };
    })
    .filter(Boolean);

  cachedBusyBlocks = busyBlocks;
  cacheTimestamp = Date.now();

  return busyBlocks;
}

export function clearWmAssignmentsCache() {
  cachedBusyBlocks = [];
  cacheTimestamp = 0;
}
