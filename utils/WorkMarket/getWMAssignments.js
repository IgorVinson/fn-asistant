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

export class WMAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "WMAuthError";
  }
}

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
  if (!cookies) {
    console.error("[WM] tryDirectFetch: no cookies available — session may be expired or cookies file missing");
    return null;
  }

  console.log("[WM] tryDirectFetch: cookies loaded, attempting API fetch…");

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
        if (assignments.length > 0) {
          console.log(`[WM] tryDirectFetch (cached API): found ${assignments.length} assignments`);
          return assignments;
        }
        console.log(`[WM] tryDirectFetch (cached API): response ok but 0 assignments extracted — session may be expired`);
      } else {
        console.log(`[WM] tryDirectFetch (cached API): HTTP ${response.status} ${response.statusText} — cookies likely expired`);
      }
    } catch (err) {
      console.error(`[WM] tryDirectFetch (cached API): request failed — ${err.message}`);
    }
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
      if (assignments.length > 0) {
        console.log(`[WM] tryDirectFetch (HTML): found ${assignments.length} assignments`);
        return assignments;
      }
      console.log(`[WM] tryDirectFetch (HTML): page fetched but 0 assignments extracted — session may be expired or page is login redirect`);
    } else {
      console.log(`[WM] tryDirectFetch (HTML): HTTP ${response.status} ${response.statusText} — cookies likely expired`);
    }
  } catch (err) {
    console.error(`[WM] tryDirectFetch (HTML): request failed — ${err.message}`);
  }

  console.log("[WM] tryDirectFetch: all methods failed — cookies are likely expired, need relogin");
  return null;
}

async function fetchAssignmentHours(assignmentIds) {
  const cookies = getCookies();
  if (!cookies) return {};

  const results = {};
  const batchSize = 3;

  for (let i = 0; i < assignmentIds.length; i += batchSize) {
    const batch = assignmentIds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        try {
          const url = `https://www.workmarket.com/assignments/details/${id}`;
          const response = await fetch(url, {
            headers: {
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "accept-language": "en-US,en;q=0.9",
              "cache-control": "no-cache",
              cookie: cookies,
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            method: "GET",
            redirect: "follow",
          });

          if (!response.ok) return null;

          const body = await response.text();

          if (body.includes("login?redirectTo=") || body.includes("Please sign in")) {
            return null;
          }

          let hoursOfWork = null;

          const pricingMatch = body.match(/"pricing"\s*:\s*({[^}]+})/);
          if (pricingMatch) {
            try {
              const pricingJSON = JSON.parse(pricingMatch[1]);
              if (pricingJSON.maxNumberOfHours) {
                hoursOfWork = pricingJSON.maxNumberOfHours;
              }
            } catch {}
          }

          if (hoursOfWork === null) {
            const maxHoursMatch = body.match(/up to\s+(\d+)\s*hr/i);
            if (maxHoursMatch) {
              hoursOfWork = parseInt(maxHoursMatch[1], 10);
            }
          }

          return { id: id, hoursOfWork: hoursOfWork };
        } catch (err) {
          console.error(`[WM] fetchAssignmentHours: failed for ${id} — ${err.message}`);
          return null;
        }
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results[result.value.id] = result.value.hoursOfWork;
      }
    }

    if (i + batchSize < assignmentIds.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
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
  } catch (err) {
    console.error(`[WM] fetchWMAssignments: tryDirectFetch threw — ${err.message}`);
  }

  if (!assignments || assignments.length === 0) {
    console.log("[WM] fetchWMAssignments: direct fetch empty, falling back to Puppeteer…");
    try {
      assignments = await fetchViaPuppeteer();
      if (assignments && assignments.length > 0) {
        console.log(`[WM] fetchWMAssignments: Puppeteer found ${assignments.length} assignments`);
      } else {
        console.log("[WM] fetchWMAssignments: Puppeteer also returned 0 assignments");
      }
    } catch (error) {
      console.error(`[WM] fetchWMAssignments (Puppeteer): ${error.message}`);
    }
  }

  if (!assignments || assignments.length === 0) {
    console.error("fetchWMAssignments: no assignments found from any source — cookies are likely expired, run relogin");
    throw new WMAuthError("WM assignments fetch returned empty from all sources — cookies likely expired");
  }

  console.log(`[WM] fetchWMAssignments: raw assignments received: ${JSON.stringify(assignments.map(a => ({ id: a.id, title: a.title, startDate: a.startDate, endDate: a.endDate, pay: a.pay })))}`);

  const assignmentIds = assignments.map(a => a.id);
  const hoursMap = await fetchAssignmentHours(assignmentIds);
  const hoursWithCount = Object.values(hoursMap).filter(v => v !== null).length;
  console.log(`[WM] fetchWMAssignments: fetched hoursOfWork for ${hoursWithCount}/${assignmentIds.length} assignments`);

  const busyBlocks = assignments
    .map(a => {
      if (!a.startDate || !(a.startDate instanceof Date) || isNaN(a.startDate.getTime())) {
        console.log(`[WM] fetchWMAssignments: skipping assignment "${a.title || a.id}" — missing or invalid startDate: ${a.startDate}`);
        return null;
      }
      // WM's scheduled_date_from/through is a START window (earliest start - latest start),
      // not the work duration. Actual commitment runs from earliestStart to latestStart + hoursOfWork.
      const earliestStart = a.startDate;
      const latestStart =
        a.endDate instanceof Date && !isNaN(a.endDate.getTime())
          ? a.endDate
          : earliestStart;
      const hours = hoursMap[a.id] || CONFIG.TIME.DEFAULT_LABOR_HOURS;
      const end = new Date(latestStart.getTime() + hours * 60 * 60 * 1000);
      console.log(`[WM] fetchWMAssignments: mapping "${a.title || a.id}" earliestStart=${earliestStart.toISOString()} latestStart=${latestStart.toISOString()} end=${end.toISOString()} (hours: ${hoursMap[a.id] ?? 'default'})`);
      return {
        start: earliestStart,
        end: end,
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
