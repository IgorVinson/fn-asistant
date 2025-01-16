import express from 'express';
import {google} from "googleapis";
import puppeteer from "puppeteer";
import {getLastUnreadEmail} from "./utils/gmail/getLastUnreadEmail.js";
import {authorize} from "./utils/gmail/login.js";
import {getOrderLink} from "./utils/gmail/getOrderLink.js";
import {loginToFieldNation} from "./utils/FieldNation/loginToFieldNation.js";
import {getFNorderData} from "./utils/FieldNation/getFNorderData.js";
import {postFNworkOrderRequest} from "./utils/FieldNation/postFNworkOrderRequest.js";
import {postWMworkOrderRequest} from "./utils/WorkMarket/postWMworkOrderRequest.js";
import {sendWorkOrderMessage} from "./utils/FieldNation/sendWorkOrderMessage.js";
import {loginToWorkMarket} from "./utils/WorkMarket/loginToWorkMarket.js";
import {getWMorderData} from "./utils/WorkMarket/getWMorderData.js";

// Configure the server
const app = express();
const port = 3000;

let browser; // Declare a browser instance

// Initialize Puppeteer and log in to FieldNation and WorkMarket
async function initialize() {
    browser = await puppeteer.launch({headless: false}); // Set headless: false to see the browser
    await loginToFieldNation(browser);
    await loginToWorkMarket(browser);
}

// Periodically check for unread emails
async function periodicCheck() {
    const auth = await authorize();
    const gmail = google.gmail({version: 'v1', auth});

    setInterval(async () => {
        try {
            const lastEmailBody = await getLastUnreadEmail(auth, gmail);
            if (lastEmailBody) {
                console.log("Email body received.");
                const orderLink = extractOrderLink(lastEmailBody);
                if (orderLink) {
                    console.log("Order link extracted:", orderLink);
                    await processOrder(orderLink);
                } else {
                    console.log("No valid order link found in email.");
                }
            } else {
                console.log("No unread emails found.");
            }
        } catch (error) {
            console.error('Error during email check:', error);
        }
    }, 60000); // Check every minute
}

// Extract order link from email
function extractOrderLink(emailBody) {
    try {
        return getOrderLink(emailBody);
    } catch (error) {
        console.error('Error extracting order link:', error);
        return null;
    }
}

function determinePlatform(orderLink) {
    if (orderLink.includes("fieldnation")) {
        return "FieldNation";
    } else if (orderLink.includes("workmarket")) {
        return "WorkMarket";
    }
    return null;
}

function normalizeData(data, platform) {

    console.log(data, 'DATA')

    if (platform === "FieldNation") {
        return {
            title: data.title,
            startDateAndTime: data.startDateAndTime,
            distance: data.distance,
            payRange: data.payRange,
            estLaborHours: data.estLaborHours,
            platform: "FieldNation",
        };
    } else if (platform === "WorkMarket") {
        return {
            title: data.title,
            startDateAndTime: `${data.date} ${data.time}`, // Combine date and time
            distance: parseFloat(data.distance?.replace(" mi", "")) || null,
            payRange: {
                min: parseFloat(data.hourlyRate || 0) * parseFloat(data.hoursOfWork || 0),
                max: parseFloat(data.totalPayment || 0),
            },
            estLaborHours: parseFloat(data.hoursOfWork || 0),
            platform: "WorkMarket",
        };
    }
    throw new Error("Unsupported platform for normalization.");
}

function isEligibleForApplication(data) {
    const SPEED = 50; // Average speed in miles per hour
    const FREE_TRAVEL_LIMIT = 50 / 60; // Free travel time in hours
    const TRAVEL_RATE = 30; // Rate per hour of travel
    const MIN_PAY_THRESHOLD = 150; // Minimum pay for a trip

    const travelTime = Math.max(0, (data.distance / SPEED) * 2 - FREE_TRAVEL_LIMIT);
    const minPay = data.distance < 20
        ? MIN_PAY_THRESHOLD
        : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;

    return data.payRange.max / data.estLaborHours >= 50 && data.payRange.max >= minPay;
}

// Apply for the job
async function applyForJob(orderLink, startDateAndTime, estLaborHours) {

    const platform = determinePlatform(orderLink);

    try {

        if (platform === "FieldNation") {
            await postFNworkOrderRequest(orderLink, startDateAndTime, estLaborHours);
            console.log('Successfully applied for the job on FieldNation.');
        }

        if (platform === "WorkMarket") {
            await postWMworkOrderRequest(orderLink);
            console.log('Successfully applied for the job on WorkMarket.');
        }

    } catch (error) {
        console.error('Error applying for the job:', error);
    }
}

// Process the order: check requirements and apply if valid
async function processOrder(orderLink) {

    try {
        const platform = determinePlatform(orderLink);
        let data = null;

        if (platform === "FieldNation") {
            data = await getFNorderData(orderLink);
        } else if (platform === "WorkMarket") {
            data = await getWMorderData(orderLink);
        } else {
            throw new Error("Unsupported platform or invalid order link.");
        }

        if (!data) {
            console.error("Failed to retrieve order data.");
            return null;
        }

        const normalizedData = normalizeData(data, platform);

        console.log("Normalized Data:", normalizedData);

        // Proceed with the application process
        if (isEligibleForApplication(normalizedData)) {
            await applyForJob(orderLink, normalizedData.startDateAndTime, normalizedData.estLaborHours);
        } else {
            console.log("Order does not meet application criteria.");
        }

        return normalizedData;

    } catch (error) {
        console.error('Error processing order:', error);
        return null;
    }
}

// Start the server
// app.listen(port, async () => {
//     console.log(`Server running on port ${port}`);
//     // await initialize();
//     // periodicCheck();
// });

(async () => {
    const exampleFieldNationLink = "https://www.fieldnation.com/workorders/12345";
    const exampleWorkMarketLink = "https://www.workmarket.com/assignments/details/4512278753";

    // console.log("Processing FieldNation Order:");
    // await processOrder(exampleFieldNationLink);

    console.log("\nProcessing WorkMarket Order:");
    await processOrder(exampleWorkMarketLink);
})();