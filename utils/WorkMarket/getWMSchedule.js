import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { CONFIG } from "../../config.js";
import logger from "../logger.js";
import { loginWMAuto } from "./loginWMAuto.js";

const cookiesFilePath = path.resolve("utils", "WorkMarket", "cookies.json");

/**
 * Fetches the schedule from WorkMarket by capturing the dashboard API response.
 * Uses Puppeteer to navigate to the assignments page and intercept the API call.
 * @returns {Promise<Array>} Array of occupied time slots { start: Date, end: Date, title: string }
 */
export async function getWMSchedule() {
  let browser;
  try {
    logger.info("Fetching WorkMarket schedule...", "SCHEDULE_CHECK");

    browser = await puppeteer.launch({
      headless: CONFIG.BROWSER.HEADLESS,
      args: CONFIG.BROWSER.ARGS,
    });

    const page = await browser.newPage();

    // Load cookies if available
    if (fs.existsSync(cookiesFilePath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"));
        if (Array.isArray(cookies)) {
            await page.setCookie(...cookies);
        }
      } catch (e) {
        logger.error(`Error loading cookies: ${e.message}`, "SCHEDULE_CHECK");
      }
    }

    // Variable to store the captured data
    let capturedData = null;

    // Setup request interception/response listening
    // We listen for the response to the dashboard results API
    const responsePromise = new Promise((resolve) => {
        page.on('response', async response => {
            const url = response.url();
            // Match the API URL pattern we found in debugging
            if (url.includes("fetch_dashboard_results") && url.includes("status=active")) {
                try {
                    const text = await response.text();
                    // Basic check if it looks like JSON
                    if (text.startsWith("{") || text.startsWith("[")) {
                        const json = JSON.parse(text);
                        if (json.data && Array.isArray(json.data)) {
                             resolve(json.data);
                        }
                    }
                } catch (err) {
                    // Ignore parsing errors for non-JSON responses or if response body is unavailable
                }
            }
        });
    });

    // Navigate to the page that triggers the API call
    // We use a timeout for the navigation and the API capture
    // We attach a catch handler to prevent unhandled rejections if browser closes during navigation
    const navigationPromise = page.goto("https://www.workmarket.com/assignments#status/active/managing", {
      waitUntil: "networkidle2",
      timeout: 60000 
    }).catch(() => {});

    // Wait for either the API response or a timeout
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 45000));
    
    capturedData = await Promise.race([responsePromise, timeoutPromise]);
    
    // If we didn't get data, it might be because of login redirect
    if (!capturedData) {
        const currentUrl = page.url();
        if (currentUrl.includes("login")) {
            logger.info("Session expired, logging in...", "SCHEDULE_CHECK");
            try {
                await browser.close();
            } catch (e) { /* ignore */ }
            
            // Perform login
             browser = await puppeteer.launch({
                headless: CONFIG.BROWSER.HEADLESS,
                args: CONFIG.BROWSER.ARGS,
            });
            
            const loginResult = await loginWMAuto(browser, CONFIG.LOGIN.WORKMARKET.EMAIL, CONFIG.LOGIN.WORKMARKET.PASSWORD);
            if (!loginResult.success) {
                throw new Error("Failed to login to WorkMarket");
            }
            
            // Recursive call after successful login
            try {
                await browser.close();
            } catch (e) { /* ignore */ }
            return getWMSchedule();
        }
        
        logger.warn("Timed out waiting for WorkMarket API response", "SCHEDULE_CHECK");
        return [];
    }

    logger.info(`Captured ${capturedData.length} assignments from WorkMarket`, "SCHEDULE_CHECK");

    // Parse the data into occupied slots
    const occupiedSlots = capturedData.map(assignment => {
        let start, end;

        if (assignment.scheduled_date_from_in_millis) {
            start = new Date(assignment.scheduled_date_from_in_millis);
        } else if (assignment.scheduled_date) {
             start = new Date(assignment.scheduled_date); 
        }

        if (assignment.scheduled_date_through_in_millis) {
            end = new Date(assignment.scheduled_date_through_in_millis);
        } else {
            if (start) {
                 end = new Date(start.getTime() + (4 * 60 * 60 * 1000)); // Default 4 hours
            }
        }
        
        return {
            start,
            end,
            title: assignment.title || "WorkMarket Assignment",
            id: assignment.id
        };
    }).filter(slot => slot.start && slot.end && !isNaN(slot.start.getTime()) && !isNaN(slot.end.getTime()));

    return occupiedSlots;

  } catch (error) {
    logger.error(`Error fetching WorkMarket schedule: ${error.message}`, "SCHEDULE_CHECK");
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore errors when closing browser
      }
    }
  }
}
