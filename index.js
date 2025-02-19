import express from 'express';
import { google } from 'googleapis';
import puppeteer from 'puppeteer';
import { getLastUnreadEmail } from './utils/gmail/getLastUnreadEmail.js';
import { authorize } from './utils/gmail/login.js';
import { getOrderLink } from './utils/gmail/getOrderLink.js';
import { loginToFieldNation } from './utils/FieldNation/loginToFieldNation.js';
import { getFNorderData } from './utils/FieldNation/getFNorderData.js';
import { postFNworkOrderRequest } from './utils/FieldNation/postFNworkOrderRequest.js';
import { postWMworkOrderRequest } from './utils/WorkMarket/postWMworkOrderRequest.js';
import { sendWorkOrderMessage } from './utils/FieldNation/sendWorkOrderMessage.js';
import { loginToWorkMarket } from './utils/WorkMarket/loginToWorkMarket.js';
import { getWMorderData } from './utils/WorkMarket/getWMorderData.js';
import normalizeDateFromWO from './utils/normalizedDateFromWO.js';
import isEligibleForApplication, {
  isSlotAvailable,
  isPaymentEligible,
} from './utils/isEligibleForApplication.js';
import { postFNCounterOffer } from './utils/FieldNation/postFNCounterOffer.js';
import logger from './utils/logger.js';
import { postWMCounterOffer } from './utils/WorkMarket/postWMCounterOffer.js';
import CONFIG from './config.js';
import { currentMonth as schedule } from './schedule.js';

// Configure the server
const app = express();
const port = 3001;

let browser; // Declare a browser instance

// Initialize Puppeteer and log in to FieldNation and WorkMarket
async function saveCookies() {
  browser = await puppeteer.launch({ headless: false }); // Set headless: false to see the browser
  await loginToFieldNation(browser);
  await loginToWorkMarket(browser);
}

// Periodically check for unread emails
async function periodicCheck() {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  setInterval(async () => {
    try {
      const lastEmailBody = await getLastUnreadEmail(auth, gmail);
      if (lastEmailBody) {
        console.log('Email body received.');
        const orderLink = extractOrderLink(lastEmailBody);
        if (orderLink) {
          console.log('Order link extracted:', orderLink);
          await processOrder(orderLink);
        } else {
          console.log('No valid order link found in email.');
        }
      } else {
        console.log('No unread emails found.');
      }
    } catch (error) {
      console.error('Error during email check:', error);
    }
  }, 1000); // Check every sec
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
  if (orderLink.includes('fieldnation')) {
    return 'FieldNation';
  } else if (orderLink.includes('workmarket')) {
    return 'WorkMarket';
  }
  return null;
}

// Apply for the job
async function applyForJob(orderLink, startDateAndTime, estLaborHours, id) {
  const platform = determinePlatform(orderLink);

  try {
    if (platform === 'FieldNation') {
      await postFNworkOrderRequest(orderLink, startDateAndTime, estLaborHours);
      await sendWorkOrderMessage(orderLink);
    }

    if (platform === 'WorkMarket') {
      await postWMworkOrderRequest(
        orderLink,
        startDateAndTime,
        estLaborHours,
        id
      );
    }
  } catch (error) {
    console.error('Error applying for the job:', error);
  }
}

// Process the order: check requirements and apply if valid
async function processOrder(orderLink) {
  try {
    const platform = determinePlatform(orderLink);
    let data = await (platform === 'FieldNation'
      ? getFNorderData(orderLink)
      : getWMorderData(orderLink));

    if (!data) {
      logger.error('Failed to retrieve order data');
      return null;
    }

    const normalizedData = normalizeDateFromWO(data);
    const { id, company, title, time, payRange, estLaborHours, distance } =
      normalizedData;

    // Log the order details
    logger.info(
      `New Order [${id}]: ${company} - ${title}
       Time: ${new Date(time.start).toLocaleString()} - ${new Date(
        time.end
      ).toLocaleString()}
       Pay: $${payRange.min}-$${
        payRange.max
      } | Hours: ${estLaborHours} | Distance: ${distance}mi`,
      platform
    );

    const slotAvailable = isSlotAvailable(schedule, normalizedData);
    if (!slotAvailable) {
      logger.info(
        `Decision [${id}]: No Action - Does not meet schedule criteria`,
        platform
      );
      return normalizedData;
    }

    const paymentEligible = isPaymentEligible(normalizedData);
    if (!paymentEligible) {
      logger.info(
        `Decision [${id}]: No Action - Does not meet minimum payment requirements`,
        platform
      );
      return normalizedData;
    }

    const eligibilityResult = isEligibleForApplication(normalizedData);

    if (
      platform === 'WorkMarket' &&
      distance > CONFIG.RATES.TRAVEL_THRESHOLD_MILES
    ) {
      const success = await postWMCounterOffer(
        id,
        payRange.min,
        estLaborHours,
        distance
      );

      if (success) {
        logger.info(
          `Decision [${id}]: Counter Offer with travel ($${Math.round(
            distance
          )}) - Accepted`,
          platform
        );
      } else {
        logger.error(
          `Decision [${id}]: Counter Offer with travel ($${Math.round(
            distance
          )}) - Rejected`,
          platform
        );
      }
    }

    // Process based on eligibility
    if (eligibilityResult.eligible) {
      logger.info(`Decision [${id}]: Direct Application`, platform);
      await applyForJob(orderLink, time, estLaborHours, id);
    }
    // Only attempt counter offer if we have one AND schedule is available
    else if (eligibilityResult.counterOffer) {
      if (platform === 'FieldNation') {
        const travelExpense = Math.round(
          distance * CONFIG.RATES.TRAVEL_RATE_PER_MILE
        );

        logger.info(
          `Decision [${id}]: Counter Offer with travel expenses ($${travelExpense})`,
          platform
        );

        try {
          const result = await postFNCounterOffer(id, travelExpense);

          if (result && result.id) {
            logger.info(
              `Result [${id}]: Counter offer accepted with $${travelExpense} travel expenses`,
              platform
            );
            // Send message after successful counter offer
            await sendWorkOrderMessage(
              `https://app.fieldnation.com/workorders/${id}`
            );
          } else {
            logger.error(
              `Result [${id}]: Counter offer failed - Server rejected`,
              platform
            );
          }
        } catch (error) {
          logger.error(
            `Result [${id}]: Counter offer failed - ${error.message}`,
            platform
          );
        }
      }
    } else {
      logger.info(
        `Decision [${id}]: No Action - Does not meet schedule criteria`,
        platform
      );
    }

    return normalizedData;
  } catch (error) {
    logger.error(`Error processing order: ${error.message}`);
    return null;
  }
}

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  // await saveCookies();
  await periodicCheck();
});
