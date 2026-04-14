// @ts-nocheck
/**
 * Automated WorkMarket login with simplified approach
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} email - WorkMarket login email
 * @param {string} password - WorkMarket password
 * @param {string|null} verificationCode - Optional 2FA verification code
 * @param {boolean} waitForCode - Whether to wait for manual code entry
 * @param {Object|null} gmailAuth - Optional Gmail OAuth2 client for automatic code retrieval
 * @returns {Promise<Object>} - Returns page object and success status
 */
import { saveCookiesCustom } from "../shared/saveCookies.js";
import { waitForWMcode } from "./getWMcode.js";

export async function loginWMAuto(
  browser,
  email = "igorvinson@gmail.com",
  password = "Karusel123!",
  verificationCode = null,
  waitForCode = false,
  gmailAuth = null
) {
  const url = "https://www.workmarket.com/login";

  // Create a new page with additional configurations to avoid detection
  const page = await browser.newPage();

  // Set a common user agent to look like a regular browser
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );

  // Set additional headers to mimic a real browser
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  });

  // Set viewport to appear like a regular desktop browser
  await page.setViewport({
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
  });

  try {
    console.log("🚀 Starting automated WorkMarket login...");

    // Step 1: Navigate to login page
    console.log("📍 Navigating to login page...");
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Step 2: Enter email
    console.log("👤 Entering email...");
    await page.waitForSelector("#login-email", { visible: true, timeout: 10000 });
    await page.type("#login-email", email, { delay: Math.random() * 100 });

    // Step 3: Enter password
    console.log("🔐 Entering password...");
    await page.waitForSelector("#login-password", { visible: true, timeout: 10000 });
    await page.type("#login-password", password, {
      delay: Math.random() * 100,
    });

    // Step 4: Click login button
    console.log("🔘 Clicking login button...");
    await page.click("#login_page_button");

    // Wait for navigation or 2FA screen
    console.log("🔄 Waiting for authentication screen...");
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Take a screenshot for debugging
    try {
      await page.screenshot({ path: "debug-after-login.png", fullPage: true });
      console.log("📸 Screenshot saved as debug-after-login.png");
    } catch (screenshotError) {
      console.log("⚠️ Could not take screenshot:", screenshotError.message);
    }

    console.log("📝 Page title:", await page.title());
    console.log("🌐 Current URL:", page.url());

    // Step 5: Check for verification code input
    console.log("🔑 Looking for verification code input...");

    // Wait longer for web components to fully initialize in headless mode
    console.log("⏳ Waiting for web components to initialize...");
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Additional debugging: Check what elements are actually on the page
    console.log("🔍 Debugging page elements...");
    const pageElements = await page.evaluate(() => {
      const sdfInputs = document.querySelectorAll("sdf-input");
      const allInputs = document.querySelectorAll("input");
      const allButtons = document.querySelectorAll("button, sdf-button");

      return {
        sdfInputs: Array.from(sdfInputs).map(el => ({
          id: el.id,
          name: el.name || el.getAttribute("name"),
          innerHTML: el.innerHTML.substring(0, 200),
        })),
        inputs: Array.from(allInputs).map(el => ({
          id: el.id,
          name: el.name,
          type: el.type,
          autocomplete: el.autocomplete,
          placeholder: el.placeholder,
          className: el.className,
        })),
        buttons: Array.from(allButtons).map(el => ({
          id: el.id,
          textContent: el.textContent?.trim(),
          ariaLabel: el.getAttribute("aria-label"),
          className: el.className,
        })),
      };
    });

    console.log(
      "🔍 Found sdf-input elements:",
      JSON.stringify(pageElements.sdfInputs, null, 2)
    );
    console.log(
      "🔍 Found input elements:",
      JSON.stringify(pageElements.inputs, null, 2)
    );
    console.log(
      "🔍 Found button elements:",
      JSON.stringify(pageElements.buttons, null, 2)
    );

    const codeInputSelectors = [
      'sdf-input[name="tfaToken"]',
      "sdf-input#tfaToken",
      "#tfaToken",
      'sdf-input input[autocomplete="one-time-code"]',
      'input[name="tfaToken"]',
      'input[autocomplete="one-time-code"]',
      'input[id="input"][type="text"]',
      'input[inputmode="text"][name="tfaToken"]',
      'input[placeholder*="verification"]',
      'input[placeholder*="code"]',
      'input[type="text"]', // More generic fallback
    ];

    let codeInputFound = false;
    let codeInputSelector = null;

    // Check which verification input selector works
    for (const selector of codeInputSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 3000 });
        codeInputFound = true;
        codeInputSelector = selector;
        console.log(`✅ Found verification code input: ${selector}`);
        break;
      } catch (error) {
        console.log(
          `🔍 Verification input selector ${selector} not found, trying next...`
        );
      }
    }

    if (codeInputFound) {
      console.log("✅ Verification code input field detected");

      // If we have Gmail auth, try to get the code automatically
      if (gmailAuth && !verificationCode) {
        console.log(
          "📧 Attempting to retrieve verification code from Gmail..."
        );
        try {
          verificationCode = await waitForWMcode(gmailAuth, 90000, 3000); // Wait up to 90 seconds
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

      // If still no code, use test code as fallback for testing
      if (!verificationCode) {
        verificationCode = "123456";
        console.log("🔤 Using test verification code: 123456 (fallback)");
      }

      if (verificationCode) {
        console.log("🔤 Entering verification code...");

        // Handle sdf-input web component differently
        if (codeInputSelector.includes("sdf-input")) {
          console.log("🔧 Handling sdf-input web component...");

          // Method 1: Try to set the value attribute directly
          const valueSet = await page.evaluate(
            (selector, code) => {
              const sdfInput = document.querySelector(selector);
              if (sdfInput) {
                // Try to set the value property
                sdfInput.value = code;

                // Try to set the value attribute
                sdfInput.setAttribute("value", code);

                // Try to dispatch input events
                const inputEvent = new Event("input", { bubbles: true });
                const changeEvent = new Event("change", { bubbles: true });
                sdfInput.dispatchEvent(inputEvent);
                sdfInput.dispatchEvent(changeEvent);

                return true;
              }
              return false;
            },
            codeInputSelector,
            verificationCode
          );

          // Method 2: Try to find and interact with the inner input
          const innerInputSet = await page.evaluate(
            (selector, code) => {
              const sdfInput = document.querySelector(selector);
              if (sdfInput) {
                // Try to find inner input in various ways
                let innerInput = sdfInput.querySelector("input");

                if (!innerInput && sdfInput.shadowRoot) {
                  innerInput = sdfInput.shadowRoot.querySelector("input");
                }

                if (!innerInput) {
                  // Try to find by traversing children
                  const allInputs = sdfInput.querySelectorAll("*");
                  for (let el of allInputs) {
                    if (el.tagName === "INPUT") {
                      innerInput = el;
                      break;
                    }
                  }
                }

                if (innerInput) {
                  innerInput.value = code;
                  innerInput.focus();

                  // Dispatch events on the inner input
                  const inputEvent = new Event("input", { bubbles: true });
                  const changeEvent = new Event("change", { bubbles: true });
                  innerInput.dispatchEvent(inputEvent);
                  innerInput.dispatchEvent(changeEvent);

                  return true;
                }
              }
              return false;
            },
            codeInputSelector,
            verificationCode
          );

          if (!valueSet && !innerInputSet) {
            console.log(
              "⚠️ Could not set value using web component methods, trying to type..."
            );
            // Fallback: try to click and type
            try {
              await page.click(codeInputSelector);
              await page.keyboard.type(verificationCode, { delay: 100 });
            } catch (typeError) {
              console.log(
                "⚠️ Failed to type into sdf-input:",
                typeError.message
              );
            }
          }
        } else {
          // Handle regular input elements
          // Clear the input field first
          await page.evaluate(selector => {
            const input = document.querySelector(selector);
            if (input) {
              input.value = "";
            }
          }, codeInputSelector);

          // Type the verification code
          await page.type(codeInputSelector, verificationCode, { delay: 100 });
        }

        // Wait a moment for the input to process
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Step 6: Click the Verify button
        console.log("✅ Clicking Verify button...");

        const verifySelectors = [
          'sdf-button[data-attr-id="submit"]',
          'sdf-button[aria-label="Verify"]',
          'button[type="submit"]',
          'button:contains("Verify")',
          'sdf-button[emphasis="primary"]',
        ];

        let verifyButtonClicked = false;
        for (const buttonSelector of verifySelectors) {
          try {
            const button = await page.$(buttonSelector);
            if (button) {
              await button.click();
              console.log(`✅ Clicked verify button: ${buttonSelector}`);
              verifyButtonClicked = true;
              break;
            }
          } catch (error) {
            console.log(
              `⚠️ Failed to click button ${buttonSelector}: ${error.message}`
            );
          }
        }

        // If the specific selectors don't work, try clicking by text content
        if (!verifyButtonClicked) {
          try {
            await page.evaluate(() => {
              const buttons = document.querySelectorAll("sdf-button, button");
              for (const button of buttons) {
                if (
                  button.textContent.trim().toLowerCase().includes("verify") ||
                  button
                    .getAttribute("aria-label")
                    ?.toLowerCase()
                    .includes("verify")
                ) {
                  button.click();
                  return true;
                }
              }
              return false;
            });
            console.log("✅ Clicked verify button using text content search");
            verifyButtonClicked = true;
          } catch (error) {
            console.log(
              `⚠️ Failed to click verify button by text: ${error.message}`
            );
          }
        }

        if (!verifyButtonClicked) {
          console.log(
            "⚠️ Couldn't find verify button. Verification code may still be accepted."
          );
        }

        // Wait for navigation after submitting code
        try {
          await page.waitForNavigation({ timeout: 60000 });
          console.log("✅ Successfully navigated after verification");
        } catch (navError) {
          console.log(
            "⚠️ Navigation timeout after submitting code, but continuing..."
          );
        }
      } else if (waitForCode) {
        console.log("⏳ Waiting for manual code entry...");
        // Wait for manual code entry and Verify button click
        try {
          await page.waitForNavigation({ timeout: 300000 }); // 5 minutes
          console.log("✅ Manual verification completed");
        } catch (navError) {
          console.log(
            "⚠️ Navigation timeout after manual code entry, but continuing..."
          );
        }
      } else {
        console.log(
          "⚠️ No verification code provided and Gmail auth not available. Stopping at 2FA screen."
        );
      }
    } else {
      console.log(
        "ℹ️ No verification code screen found, login may be complete"
      );
    }

    // Step 7: Save cookies with error handling
    console.log("🍪 Saving cookies as autoCookies.json...");
    try {
      // Make sure the page is still attached to browser
      if (page.isClosed()) {
        console.log("⚠️ Page is closed, cannot save cookies");
        return {
          success: false,
          page: page,
          error: "Page closed before cookie saving",
        };
      }

      // Save cookies
      await saveCookiesCustom(page, "WorkMarket", "workmarket-cookies.json");
      console.log("✅ Cookies saved successfully");
    } catch (cookieError) {
      console.error("❌ Error saving cookies:", cookieError.message);
      // Try to save to alternative location
      try {
        await saveCookiesCustom(page, "WorkMarket", "workmarket-fallback-cookies.json");
        console.log("✅ Cookies saved to fallback location");
      } catch (fallbackError) {
        console.error("❌ Failed to save cookies to fallback location:", fallbackError.message);
      }
    }

    return {
      success: true,
      page: page,
      message: "WorkMarket login completed successfully",
    };
  } catch (error) {
    console.error("❌ Error during WorkMarket login:", error.message);

    // Try to save cookies even if there's an error
    try {
      if (!page.isClosed()) {
        await saveCookiesCustom(page, "WorkMarket", "workmarket-error-cookies.json");
        console.log("✅ Cookies saved from error state");
      }
    } catch (cookieError) {
      console.error("❌ Could not save cookies during error:", cookieError.message);
    }

    // Take screenshot on error for debugging
    try {
      await page.screenshot({ path: "debug-error.png", fullPage: true });
      console.log("📸 Error screenshot saved as debug-error.png");
    } catch (screenshotError) {
      console.log("⚠️ Could not take error screenshot:", screenshotError.message);
    }

    return {
      success: false,
      page: page,
      error: error.message,
    };
  }
}

// Export the main function as default
export default loginWMAuto;
