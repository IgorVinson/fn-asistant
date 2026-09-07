import { authorize } from "../gmail/login.js";
import { getWMcode } from "./getWMcode.js";

/**
 * Test script to debug WorkMarket email code retrieval
 */
async function testGetWMcode() {
  try {
    console.log("🧪 Testing WorkMarket email code retrieval...");

    // Get Gmail authentication
    console.log("📧 Setting up Gmail authentication...");
    const gmailAuth = await authorize();
    console.log("✅ Gmail authentication successful");

    // Test getting the code
    console.log("🔍 Attempting to get WorkMarket verification code...");
    const code = await getWMcode(gmailAuth);

    if (code) {
      console.log("✅ SUCCESS: Verification code extracted");
    } else {
      console.log("❌ FAILED: No verification code found");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("📊 Full error:", error);
  }
}

// Run the test
testGetWMcode().catch(console.error);
