import { waitForFNcode } from "../gmail/getFNcode.js";
import { saveCookiesCustom } from "../saveCookies.js";

/**
 * Automated Field Nation login with simplified approach
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} email - Field Nation login email
 * @param {string} password - Field Nation password
 * @param {string|null} verificationCode - Optional 2FA verification code
 * @param {boolean} waitForCode - Whether to wait for manual code entry
 * @param {Object|null} gmailAuth - Optional Gmail OAuth2 client for automatic code retrieval
 * @returns {Promise<Object>} - Returns page object and success status
 */
export async function loginFnAuto(
  browser,
  email = "igorvinson@gmail.com",
  password = "YOUR_PASSWORD_HERE",
  verificationCode = null,
  waitForCode = false,
  gmailAuth = null
) {
  const url = "https://app.fieldnation.com/";
  const page = await browser.newPage();

  try {
    console.log("🚀 Starting automated Field Nation login...");

    // Step 1: Navigate to login page
    console.log("📍 Navigating to login page...");
    await page.goto(url, { waitUntil: "load" });

    // Step 2: Enter username/email
    console.log("👤 Entering username/email...");
    await page.waitForSelector("#username"); // Wait for username field
    await page.type("#username", email, { delay: Math.random() * 100 });
    await page.click('button[type="submit"]'); // Click Submit after username

    // Step 3: Enter password
    console.log("🔐 Entering password...");
    await page.waitForSelector("#password", { visible: true }); // Wait for password field
    await page.type("#password", password, { delay: Math.random() * 100 });
    await page.click('button[type="submit"]'); // Click Submit after password

    // Wait for either the 2FA method selection or the verification code screen
    console.log("🔄 Waiting for authentication screen...");

    // Define a function to check if we're on a specific screen
    const isElementVisible = async (selector, timeout = 5000) => {
      try {
        await page.waitForSelector(selector, { visible: true, timeout });
        return true;
      } catch (error) {
        return false;
      }
    };

    // Give the page time to load and check for multiple possible selectors
    await new Promise(resolve => setTimeout(resolve, 3000));

    // First, let's see what's actually on the page
    console.log("🔍 Taking screenshot for debugging...");
    await page.screenshot({
      path: "./utils/FieldNation/current_page_debug.png",
    });

    // Get page content to help debug
    console.log("📄 Getting page content for debugging...");
    const pageContent = await page.content();
    console.log("📝 Page title:", await page.title());
    console.log("🌐 Current URL:", page.url());

    // Look for any elements that might contain "email" text
    const emailElementsInfo = await page.evaluate(() => {
      const elements = [];

      // Look for radio buttons
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach((radio, index) => {
        elements.push({
          type: "radio",
          index: index,
          value: radio.value,
          name: radio.name,
          id: radio.id,
          checked: radio.checked,
          parentText: radio.parentElement
            ? radio.parentElement.textContent.trim()
            : "",
          selector: `input[type="radio"]:nth-of-type(${index + 1})`,
        });
      });

      // Look for labels containing "email"
      const labels = document.querySelectorAll("label");
      labels.forEach((label, index) => {
        if (label.textContent.toLowerCase().includes("email")) {
          elements.push({
            type: "label",
            index: index,
            text: label.textContent.trim(),
            for: label.getAttribute("for"),
            selector: `label:nth-of-type(${index + 1})`,
          });
        }
      });

      // Look for any elements with "email" in text
      const allElements = document.querySelectorAll("*");
      allElements.forEach((element, index) => {
        if (
          element.textContent &&
          element.textContent.toLowerCase().includes("email") &&
          element.children.length === 0
        ) {
          elements.push({
            type: "text_element",
            tagName: element.tagName,
            text: element.textContent.trim(),
            className: element.className,
            id: element.id,
          });
        }
      });

      return elements;
    });

    console.log(
      "🔍 Found elements with 'email':",
      JSON.stringify(emailElementsInfo, null, 2)
    );

    // Try multiple selectors for the email option to be more robust
    const emailSelectors = [
      'input[value="email"]',
      'input[name="factor"][value="email"]',
      'input[type="radio"][value="email"]',
      'label[for*="email"]',
      '.radio-container input[value="email"]',
      // Add more generic selectors based on common patterns
      'input[type="radio"]:first-of-type', // Sometimes it's the first radio button
      'input[type="radio"]:nth-of-type(1)', // Alternative first radio button selector
    ];

    // Check each selector to find the email option
    let emailSelectorFound = null;
    for (const selector of emailSelectors) {
      console.log(`🔍 Checking for email selector: ${selector}`);
      if (await isElementVisible(selector, 2000)) {
        emailSelectorFound = selector;
        console.log(`✅ Found email selector: ${selector}`);
        break;
      }
    }

    // If we still haven't found it, try clicking the first radio button we can find
    if (!emailSelectorFound) {
      console.log(
        "🔍 No specific email selector found, trying first radio button..."
      );
      const radioButtons = await page.$$('input[type="radio"]');
      if (radioButtons.length > 0) {
        emailSelectorFound = 'input[type="radio"]:first-of-type';
        console.log(`✅ Found first radio button, will try that`);
      }
    }

    if (emailSelectorFound) {
      // Step 4: Click on email radio button for 2FA method selection
      console.log("📧 Selecting email verification method...");
      try {
        // First ensure the element is visible and clickable
        await page.waitForSelector(emailSelectorFound, {
          visible: true,
          timeout: 5000,
        });

        // Try clicking with force
        await page.evaluate(selector => {
          const element = document.querySelector(selector);
          if (element) {
            element.click();
            return true;
          }
          return false;
        }, emailSelectorFound);

        console.log("👆 Clicked on email option using JavaScript");

        // Also try regular click as backup
        try {
          await page.click(emailSelectorFound);
          console.log("👆 Also clicked using Puppeteer click");
        } catch (clickError) {
          console.log(
            "⚠️ Puppeteer click failed, but JavaScript click should have worked"
          );
        }

        // Look for and click any confirm/continue button that might appear
        const continueSelectors = [
          'button[type="submit"]',
          'button:contains("Continue")',
          'button:contains("Next")',
          'button:contains("Send Code")',
          "button.continue-button",
          'input[type="submit"]',
        ];

        // Wait a moment for any transitions after selection
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to find and click a continue button if one exists
        let continueButtonFound = false;
        for (const buttonSelector of continueSelectors) {
          if (await isElementVisible(buttonSelector, 2000)) {
            try {
              await page.click(buttonSelector);
              console.log(`👆 Clicked continue button: ${buttonSelector}`);
              continueButtonFound = true;
              break;
            } catch (buttonClickError) {
              console.log(
                `⚠️ Failed to click button ${buttonSelector}: ${buttonClickError.message}`
              );
            }
          }
        }

        if (!continueButtonFound) {
          console.log(
            "🔍 No continue button found, maybe email selection automatically continues..."
          );
        }

        // Wait for the page to process after clicking continue
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.log(`⚠️ Error clicking email option: ${error.message}`);
        // Take a screenshot to debug the issue
        await page.screenshot({
          path: "./utils/FieldNation/email_selection_error.png",
        });
      }
    } else {
      console.log(
        "ℹ️ Email selection screen not found, we may already be at verification code screen"
      );
      // Take a screenshot to see what we're actually looking at
      await page.screenshot({
        path: "./utils/FieldNation/no_email_selector_found.png",
      });
    }

    // Step 5: Handle verification code
    console.log("🔑 Waiting for verification code screen...");

    // Try different verification code input selectors
    const codeInputSelectors = [
      // MUI OTP Input pattern (specific to Field Nation's implementation)
      '.MuiOtpInput-TextField input[type="tel"]',
      'input[autocomplete="one-time-code"]',
      'input[aria-label="Please enter verification code. Digit 1"]',
      'input[placeholder*="verification"]',
      'input[placeholder*="code"]',
      'input[name*="verification"]',
      'input[name*="code"]',
      'input[type="text"]:not([name="username"]):not([name="password"])',
      'input[type="number"]',
    ];

    let codeInputFound = false;
    let codeInputSelector = null;
    let isMuiOtpInput = false;

    // Check which verification input selector works
    for (const selector of codeInputSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        codeInputFound = true;
        codeInputSelector = selector;

        // Check if it's the MUI OTP input pattern
        if (
          selector.includes("MuiOtpInput") ||
          selector.includes("one-time-code")
        ) {
          isMuiOtpInput = true;
        }

        console.log(`✅ Found verification code input: ${selector}`);
        break;
      } catch (error) {
        console.log(
          `🔍 Verification input selector ${selector} not found, trying next...`
        );
      }
    }

    if (codeInputFound) {
      console.log("✅ Verification code input fields detected");

      // If we have Gmail auth, try to get the code automatically
      if (gmailAuth && !verificationCode) {
        console.log(
          "📧 Attempting to retrieve verification code from Gmail..."
        );
        try {
          verificationCode = await waitForFNcode(gmailAuth, 90000, 3000); // Wait up to 90 seconds
          if (verificationCode) {
            console.log(
              `✅ Retrieved verification code from Gmail: ${verificationCode}`
            );
          } else {
            console.log(
              "⚠️ Could not retrieve verification code from Gmail, falling back to manual entry"
            );
          }
        } catch (error) {
          console.log(`⚠️ Error retrieving code from Gmail: ${error.message}`);
        }
      }

      if (verificationCode) {
        console.log("🔤 Entering verification code...");

        if (isMuiOtpInput) {
          // Handle MUI OTP Input component - get all individual input fields
          console.log(
            "🎯 Detected MUI OTP Input, handling individual digit inputs..."
          );

          // Get all the OTP input fields
          const otpInputs = await page.$$(
            '.MuiOtpInput-TextField input[type="tel"]'
          );
          console.log(`📋 Found ${otpInputs.length} OTP input fields`);

          if (otpInputs.length >= 6 && verificationCode.length >= 6) {
            // Split the verification code into individual digits
            const codeDigits = verificationCode.split("");

            // Enter each digit into the corresponding input field
            for (
              let i = 0;
              i < Math.min(otpInputs.length, codeDigits.length);
              i++
            ) {
              try {
                // Clear the input first and then type the digit
                await otpInputs[i].click();
                await otpInputs[i].evaluate(input => (input.value = ""));
                await otpInputs[i].type(codeDigits[i], { delay: 100 });
                console.log(`✅ Entered digit ${i + 1}: ${codeDigits[i]}`);
              } catch (error) {
                console.log(
                  `⚠️ Error entering digit ${i + 1}: ${error.message}`
                );
              }
            }
          } else {
            console.log(
              `⚠️ Code length (${verificationCode.length}) or input count (${otpInputs.length}) mismatch`
            );
          }
        } else {
          // Check if it's individual digit inputs (legacy pattern)
          const isIndividualDigits = codeInputSelector.includes("Digit 1");

          if (isIndividualDigits) {
            // Split the verification code into individual digits
            const codeDigits = verificationCode.split("");

            // Enter each digit into the corresponding input field
            for (let i = 0; i < codeDigits.length; i++) {
              await page.type(
                `input[aria-label="Please enter verification code. Digit ${
                  i + 1
                }"]`,
                codeDigits[i]
              );
            }
          } else {
            // Single input field - enter the whole code
            await page.type(codeInputSelector, verificationCode);
          }
        }

        // Wait a moment for the inputs to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click the Continue button - using a more flexible selector
        const continueSelectors = [
          'button[type="submit"]',
          'button:contains("Continue")',
          'button:contains("Verify")',
          'button:contains("Submit")',
          "button.continue-button",
        ];

        let continueButtonClicked = false;
        for (const buttonSelector of continueSelectors) {
          try {
            const button = await page.$(buttonSelector);
            if (button) {
              await button.click();
              console.log(`👆 Clicked continue button: ${buttonSelector}`);
              continueButtonClicked = true;
              break;
            }
          } catch (error) {
            console.log(
              `⚠️ Failed to click button ${buttonSelector}: ${error.message}`
            );
          }
        }

        if (!continueButtonClicked) {
          console.log(
            "⚠️ Couldn't find continue button. Verification code may still be accepted."
          );
        }

        // Wait for navigation after submitting code
        try {
          await page.waitForNavigation({ timeout: 60000 }); // Wait longer for final navigation
        } catch (navError) {
          console.log(
            "⚠️ Navigation timeout after submitting code, but continuing..."
          );
        }
      } else if (waitForCode) {
        console.log("⏳ Waiting for manual code entry...");
        // Wait for manual code entry and Continue button click
        // This will pause automation until navigation occurs after code is entered
        try {
          await page.waitForNavigation({ timeout: 300000 }); // 5-minute timeout for manual entry
        } catch (navError) {
          console.log(
            "⚠️ Navigation timeout after manual code entry, but continuing..."
          );
          // Let's wait for a clear sign we're logged in
          try {
            await page.waitForSelector(".user-info, .dashboard, .home-page", {
              timeout: 10000,
            });
            console.log("✅ Detected post-login elements, proceeding...");
          } catch (error) {
            console.log(
              "⚠️ Could not confirm successful login, but continuing..."
            );
          }
        }
      } else {
        console.log(
          "⚠️ No verification code provided and Gmail auth not available. Stopping at 2FA screen."
        );
        // Just save cookies at this point
      }
    } else {
      console.log("⚠️ Verification code input fields not found");
      // Take a screenshot to see what happened
      await page.screenshot({
        path: "./utils/FieldNation/verification_screen_issue.png",
      });
    }

    // Step 6: Save cookies as autoCookies.json
    console.log("🍪 Saving cookies as autoCookies.json...");
    await saveCookiesCustom(page, "FieldNation", "autoCookies.json");

    return {
      success: true,
      page: page,
      message: "Login completed successfully",
    };
  } catch (error) {
    console.error("❌ Error during login:", error.message);

    // Take screenshot on error for debugging
    try {
      await page.screenshot({
        path: "./utils/FieldNation/login_error_screenshot.png",
      });
      console.log("📸 Error screenshot saved to login_error_screenshot.png");
    } catch (screenshotError) {
      console.error(
        "Failed to take error screenshot:",
        screenshotError.message
      );
    }

    return {
      success: false,
      page: page,
      error: error.message,
    };
  }
}

// Export the main function as default
export default loginFnAuto;
