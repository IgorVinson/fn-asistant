import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { authorize } from "../utils/gmail/login.js";
import { CONFIG } from "../config.js";
import { findFreeSlots } from "../utils/isEligibleForApplication.js";

const cookiesFilePath = path.resolve("utils", "WorkMarket", "autoCookies.json");

function getCookies() {
  try {
    if (!fs.existsSync(cookiesFilePath)) {
      console.error("Cookies file not found at:", cookiesFilePath);
      return null;
    }
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"));
    if (!Array.isArray(cookiesJson)) {
      throw new Error("Invalid cookies format: Expected an array");
    }
    return cookiesJson.filter(
      c => typeof c.name === "string" && typeof c.value === "string"
    );
  } catch (error) {
    console.error(`Error reading cookies: ${error.message}`);
    return null;
  }
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function estimateEndTime(startDate, assignment = {}) {
  const defaultHours = CONFIG.TIME?.DEFAULT_LABOR_HOURS ?? 2;
  if (
    assignment.endDate instanceof Date &&
    !isNaN(assignment.endDate.getTime()) &&
    assignment.endDate.getTime() > startDate.getTime()
  ) {
    return assignment.endDate;
  }

  return new Date(startDate.getTime() + defaultHours * 60 * 60 * 1000);
}

async function fetchGoogleCalEvents(timeMin, timeMax) {
  try {
    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });
    const calendarList = await calendar.calendarList.list();
    const allCalendars = calendarList.data.items || [];
    const busyBlocks = [];

    for (const cal of allCalendars) {
      try {
        const events = await calendar.events.list({
          calendarId: cal.id,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });

        for (const event of (events.data.items || [])) {
          if (event.status === "cancelled" || event.transparency === "transparent") continue;

          let eventStart, eventEnd;
          if (event.start.dateTime) {
            eventStart = new Date(event.start.dateTime);
          } else if (event.start.date) {
            eventStart = new Date(event.start.date + "T00:00:00");
          } else continue;

          if (event.end.dateTime) {
            eventEnd = new Date(event.end.dateTime);
          } else if (event.end.date) {
            eventEnd = new Date(event.end.date + "T00:00:00");
          } else continue;

          // For all-day events, block 00:00-23:59 for each day
          if (!event.start.dateTime) {
            const allDayEnd = new Date(event.end.date);
            allDayEnd.setDate(allDayEnd.getDate() - 1);
            for (let d = new Date(eventStart); d <= allDayEnd; d.setDate(d.getDate() + 1)) {
              busyBlocks.push({
                start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0),
                end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59),
                summary: `📅 ${event.summary || "All-day event"} (Google)`,
              });
            }
          } else {
            busyBlocks.push({
              start: eventStart,
              end: eventEnd,
              summary: `📅 ${event.summary || "Busy"} (Google)`,
            });
          }
        }
      } catch {
        // skip calendar errors
      }
    }

    return busyBlocks;
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(a => a.startsWith("--url="))?.split("=")[1] ||
    "https://www.workmarket.com/assignments#status/active/managing";
  const debugMode = args.includes("--debug");
  const skipGcal = args.includes("--no-gcal");

  console.log("=".repeat(70));
  console.log("  WORKMARKET SCHEDULE VIEWER");
  console.log("  URL:", url);
  console.log("=".repeat(70));
  console.log("");

  const cookies = getCookies();
  if (!cookies) {
    console.error("❌ No WorkMarket cookies found.");
    process.exit(1);
  }
  console.log(`✅ Loaded ${cookies.length} WorkMarket cookies`);

  console.log("🚀 Launching browser...");
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

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setCookie(...cookies);

    // Intercept API response for assignment data
    const apiResponses = [];
    page.on("response", async resp => {
      if (resp.url().includes("fetch_dashboard_results")) {
        try {
          if ((resp.headers()["content-type"] || "").includes("json")) {
            apiResponses.push({ url: resp.url(), data: await resp.json() });
          }
        } catch {}
      }
    });

    console.log("🌐 Fetching WorkMarket schedule...");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: "testscripts/wm-schedule-screenshot.png", fullPage: true });
    console.log("📸 Screenshot saved\n");

    // Extract assignments
    const dashboardResp = apiResponses.find(r => r.url.includes("fetch_dashboard_results"));
    const dashboardData = dashboardResp?.data;
    const wmAssignments = [];
    const seenIds = new Set();

    if (dashboardData?.data) {
      for (const item of dashboardData.data) {
        if (!item || !item.id || seenIds.has(String(item.id))) continue;
        seenIds.add(String(item.id));

        let startDate = item.scheduled_date_from_in_millis ? new Date(item.scheduled_date_from_in_millis) : null;
        const locationParts = [item.location_name?.trim(), item.city, item.state].filter(Boolean);

        wmAssignments.push({
          id: String(item.id),
          title: item.title || "",
          company: item.owner_company_name || item.buyer || "",
          status: item.status || "",
          scheduledDate: item.scheduled_date || "",
          startDate,
          endDate: item.scheduled_date_through_in_millis ? new Date(item.scheduled_date_through_in_millis) : null,
          pay: item.price || item.amount_earned || "",
          location: locationParts.join(", ") || item.address || "",
          href: `https://www.workmarket.com/assignments/details/${item.id}`,
        });
      }
    }

    if (wmAssignments.length === 0) {
      console.log("❌ No WorkMarket assignments found.");
      await browser.close();
      return;
    }

    wmAssignments.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate - b.startDate;
    });

    // Print assignments
    console.log("=".repeat(70));
    console.log(`  WORKMARKET — ${wmAssignments.length} ACTIVE`);
    console.log("=".repeat(70));
    console.log("");

    const byDate = {};
    for (const a of wmAssignments) {
      const dateKey = a.startDate ? a.startDate.toISOString().split("T")[0] : "unscheduled";
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(a);
    }

    // Convert to busy blocks for free slot calculation
    const wmBusyByDate = {};
    for (const a of wmAssignments) {
      if (!a.startDate) continue;
      const dateKey = a.startDate.toISOString().split("T")[0];
      if (!wmBusyByDate[dateKey]) wmBusyByDate[dateKey] = [];

      const endDate = estimateEndTime(a.startDate, a);
      wmBusyByDate[dateKey].push({
        start: a.startDate,
        end: endDate,
        summary: `🔧 ${a.title}`,
      });
    }

    // Optionally fetch Google Calendar events for same dates
    let gcalBusyByDate = {};
    if (!skipGcal) {
      console.log("📅 Fetching Google Calendar events...");
      const sortedDates = Object.keys(byDate).filter(d => d !== "unscheduled").sort();
      if (sortedDates.length > 0) {
        const timeMin = new Date(sortedDates[0] + "T00:00:00").toISOString();
        const lastDate = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00");
        lastDate.setDate(lastDate.getDate() + 1);
        const timeMax = lastDate.toISOString();

        const gcalBlocks = await fetchGoogleCalEvents(timeMin, timeMax);
        for (const block of gcalBlocks) {
          const key = block.start.toISOString().split("T")[0];
          if (!gcalBusyByDate[key]) gcalBusyByDate[key] = [];
          gcalBusyByDate[key].push(block);
        }
        console.log(`✅ Fetched ${gcalBlocks.length} Google Calendar events\n`);
      }
    }

    // Display schedule with free slots
    const allDates = Object.keys(byDate).filter(d => d !== "unscheduled").sort();
    const gcalOnlyDates = Object.keys(gcalBusyByDate).filter(d => !byDate[d]);

    for (const dateKey of [...allDates, ...gcalOnlyDates]) {
      const dt = new Date(dateKey + "T00:00:00");
      const dow = dt.getDay();
      const isWeekend = dow === 0 || dow === 6;

      const wmBlocks = wmBusyByDate[dateKey] || [];
      const gcalBlocks = gcalBusyByDate[dateKey] || [];
      const allBlocks = [...wmBlocks, ...gcalBlocks];
      allBlocks.sort((a, b) => a.start - b.start);

      // Also add assignments without explicit calendar blocks
      const wmItems = byDate[dateKey] || [];

      console.log(`📆 ${formatDate(dt)}${isWeekend ? " (WEEKEND)" : ""}`);

      // Show WorkMarket items
      for (const a of wmItems) {
        const t = a.startDate ? formatTime(a.startDate) : "??";
        console.log(`     🔧 ${t}  ${a.title}  [${a.company}]  ${a.pay}`);
        if (a.location) console.log(`         ${a.location}`);
      }

      // Show Google Calendar events (non-WM days or additional events)
      for (const block of gcalBlocks) {
        const isDuplicate = wmBlocks.some(w =>
          Math.abs(w.start.getTime() - block.start.getTime()) < 60000
        );
        if (!isDuplicate) {
          console.log(`     📅 ${formatTime(block.start)} - ${formatTime(block.end)}  ${block.summary}`);
        }
      }

      if (isWeekend) {
        console.log("");
        continue;
      }

      // Calculate and show free slots (suppress logger noise from findFreeSlots)
      const mergeDate = new Date(parseInt(dateKey.split("-")[0]), parseInt(dateKey.split("-")[1]) - 1, parseInt(dateKey.split("-")[2]));
      const origLog = console.log;
      console.log = () => {};
      const freeSlots = findFreeSlots(mergeDate, allBlocks, 60);
      console.log = origLog;

      if (freeSlots.length > 0) {
        console.log(`     Free slots:`);
        for (const slot of freeSlots) {
          console.log(`       ✓ ${formatTime(slot.start)} - ${formatTime(slot.end)}  (${slot.durationMinutes} min)`);
        }
      } else {
        console.log(`     Free slots: (none ≥60 min)`);
      }
      console.log("");
    }

    // Handle unscheduled assignments
    if (byDate.unscheduled) {
      console.log(`📆 No date set (${byDate.unscheduled.length}):`);
      for (const a of byDate.unscheduled) {
        console.log(`     - ${a.title}  ${a.pay}`);
      }
      console.log("");
    }

    // Summary
    console.log("=".repeat(70));
    const totalGcal = Object.values(gcalBusyByDate).flat().length;
    console.log(`  SUMMARY: ${wmAssignments.length} WM jobs + ${totalGcal} Google events across ${allDates.length + gcalOnlyDates.length} days`);
    console.log("=".repeat(70));

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (page) {
      try {
        fs.writeFileSync("testscripts/wm-schedule-error.html", await page.content());
      } catch {}
    }
  } finally {
    await browser.close();
    console.log("🔒 Browser closed.");
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
