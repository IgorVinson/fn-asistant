import puppeteer from "puppeteer";
import { loginWMAuto } from "./utils/WorkMarket/loginWMAuto.js";
import { authorize } from "./utils/gmail/login.js"; // Import Gmail auth

/**
 * Test the automated WorkMarket login with automatic code retrieval
 */
async function testLoginWMAuto() {
  let browser;

  try {
    console.log("🧪 Starting WorkMarket login test...");

    // Setup browser with visible window for testing
    console.log("🌐 Launching browser...");
    browser = await puppeteer.launch({
      headless: false, // Keep visible for testing
      defaultViewport: null,
      args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Run the automated login
    console.log("🚀 Starting automated WorkMarket login process...");

    // Get Gmail authentication for automatic code retrieval
    console.log("📧 Setting up Gmail authentication...");
    let gmailAuth = null;
    try {
      gmailAuth = await authorize();
      console.log("✅ Gmail authentication successful");
    } catch (error) {
      console.log("⚠️ Gmail authentication failed:", error.message);
      console.log("📝 Will proceed with manual code entry");
    }

    // Option 1: Automatic code retrieval with Gmail (recommended)
    const result = await loginWMAuto(
      browser,
      "igorvinson@gmail.com",
      "YOUR_PASSWORD_HERE",
      null, // No code provided - will get automatically from Gmail
      true, // Wait for manual code entry as fallback
      gmailAuth // Gmail auth for automatic code retrieval
    );

    /* 
    // Option 2: Wait for manual code entry only (no automatic retrieval)
    const result = await loginWMAuto(
      browser,
      "igorvinson@gmail.com",
      "YOUR_PASSWORD_HERE",
      null, // No code provided
      true, // Wait for manual code entry
      null // No Gmail auth
    );
    */

    /* 
    // Option 3: Provide verification code programmatically
    // Uncomment this block and comment out Option 1 if you have the code
    const verificationCode = "123456"; // Replace with actual code
    const result = await loginWMAuto(
      browser,
      "igorvinson@gmail.com",
      "YOUR_PASSWORD_HERE",
      verificationCode, // Provide the 2FA code
      false, // Don't wait for manual entry
      null // No Gmail auth needed when providing code directly
    );
    */

    // Check results
    if (result.success) {
      console.log("🎉 TEST PASSED: WorkMarket login completed successfully!");
      console.log("📄 Result:", result.message);

      // Keep browser open for a moment to see the result
      console.log("⏰ Keeping browser open for 10 seconds to verify...");
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      console.log("❌ TEST FAILED: WorkMarket login unsuccessful");
      console.log("🔍 Error:", result.error);

      // Keep browser open longer for debugging
      console.log("🐛 Keeping browser open for 30 seconds for debugging...");
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
    console.error("📊 Full error:", error);

    // Keep browser open for debugging
    if (browser) {
      console.log("🐛 Keeping browser open for debugging...");
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  } finally {
    // Close browser
    if (browser) {
      console.log("🔚 Closing browser...");
      await browser.close();
    }

    console.log("✅ Test completed");
  }
}

// Run the test
testLoginWMAuto().catch(console.error);
