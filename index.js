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
import isEligibleForApplication from './utils/isEligibleForApplication.js';
import { postFNCounterOffer } from './utils/FieldNation/postFNCounterOffer.js';
import logger from './utils/logger.js';
import { postWMCounterOffer } from './utils/WorkMarket/postWMCounterOffer.js';

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
    let data;

    if (platform === 'FieldNation') {
      data = await getFNorderData(orderLink);
    } else if (platform === 'WorkMarket') {
      data = await getWMorderData(orderLink);
    } else {
      throw new Error('Unsupported platform or invalid order link.');
    }

    if (!data) {
      console.error('Failed to retrieve order data.');
      return null;
    }

    const normalizedData = normalizeDateFromWO(data);
    console.log(normalizedData);

    const eligibilityResult = isEligibleForApplication(normalizedData);

    if (eligibilityResult.eligible) {
      await applyForJob(
        orderLink,
        normalizedData.time,
        normalizedData.estLaborHours,
        normalizedData.id
      );
    } else if (
      normalizedData.platform === 'WorkMarket' &&
      normalizedData.distance > 30
    ) {
      // Handle WorkMarket counter offer
      try {
        await postWMCounterOffer(
          normalizedData.id,
          50, // hourly rate
          normalizedData.estLaborHours,
          normalizedData.distance
        );

        logger.info(
          `Counter offer sent with travel expenses: $${Math.round(
            normalizedData.distance
          )}`,
          normalizedData.platform,
          normalizedData.id
        );
      } catch (error) {
        logger.error(
          `Failed to send counter offer: ${error.message}`,
          normalizedData.platform,
          normalizedData.id
        );
      }
    } else if (eligibilityResult.counterOffer) {
      logger.info(
        `Attempting counter offer for ${normalizedData.id}`,
        normalizedData.platform,
        normalizedData.id
      );

      if (normalizedData.platform === 'FieldNation') {
        try {
          await postFNCounterOffer(
            normalizedData.id,
            eligibilityResult.counterOffer.baseAmount,
            eligibilityResult.counterOffer.travelExpense,
            eligibilityResult.counterOffer.payType,
            eligibilityResult.counterOffer.baseHours,
            eligibilityResult.counterOffer.additionalHours,
            eligibilityResult.counterOffer.additionalAmount
          );

          logger.info(
            `Counter offer sent - Base: $${eligibilityResult.counterOffer.baseAmount} (${eligibilityResult.counterOffer.baseHours}hr), ` +
              `Additional: $${eligibilityResult.counterOffer.additionalAmount}/hr (${eligibilityResult.counterOffer.additionalHours}hr), ` +
              `Travel: $${eligibilityResult.counterOffer.travelExpense}`,
            normalizedData.platform,
            normalizedData.id
          );
        } catch (error) {
          logger.error(
            `Failed to send counter offer: ${error.message}`,
            normalizedData.platform,
            normalizedData.id
          );
        }
      }
    } else {
      logger.info(
        'Order does not meet application criteria.',
        normalizedData.platform,
        normalizedData.id
      );
    }

    return normalizedData;
  } catch (error) {
    console.error('Error processing order:', error);
    return null;
  }
}

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  // await saveCookies();
  // await periodicCheck();
});
