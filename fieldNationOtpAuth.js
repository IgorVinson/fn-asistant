import { authorize } from './utils/gmail/login.js';
import { waitForFNcode } from './utils/gmail/getFNcode.js';

// Function to send the first request (generate OTP)
async function generateOtp() {
  console.log("🔄 Sending OTP generation request...");

  try {
    const response = await fetch("https://id.fieldnation.com/otp/generate", {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        cookie:
          "__cfruid=3def0175bd18a29c005f8f1e665841ac6a3f88d0-1748487669; connect.sid=s%3AZFtHKCBlPqTPTvA9aSf04fjj9l_sbb-V.8WPOLFCLbeFAAiQ%2BU2R92gHR2FcWcm9l61Z5E2M0WLc",
        Referer:
          "https://id.fieldnation.com/login?client_id=5PUz4s3nEwH3&redirect_uri=https%3A%2F%2Fapp.fieldnation.com%2F.ambassador%2Foauth2%2Fredirection-endpoint&response_type=code&scope=openid&state=27c6e0c609fdcc87698dd7038bd66012a1fbf6ae9b7e01f3b7eea2e7ea3a5c6f%3Ahttps%3A%2F%2Fapp.fieldnation.com%2F",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: JSON.stringify({
        source: "Login",
        deliveryType: "email",
        resend: false,
      }),
      method: "POST",
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ OTP generation response:", result);
      console.log("📧 Check your email for the verification code!");
      return true;
    } else {
      console.error(
        "❌ Failed to generate OTP:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("Error details:", errorText);
      return false;
    }
  } catch (error) {
    console.error("❌ Error generating OTP:", error);
    return false;
  }
}

// Function to verify the OTP code
async function verifyOtp(code) {
  console.log(`🔄 Verifying OTP code: ${code}...`);

  try {
    const response = await fetch("https://id.fieldnation.com/otp/verify", {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        cookie:
          "__cfruid=3def0175bd18a29c005f8f1e665841ac6a3f88d0-1748487669; connect.sid=s%3AZFtHKCBlPqTPTvA9aSf04fjj9l_sbb-V.8WPOLFCLbeFAAiQ%2BU2R92gHR2FcWcm9l61Z5E2M0WLc",
        Referer:
          "https://id.fieldnation.com/login?client_id=5PUz4s3nEwH3&redirect_uri=https%3A%2F%2Fapp.fieldnation.com%2F.ambassador%2Foauth2%2Fredirection-endpoint&response_type=code&scope=openid&state=27c6e0c609fdcc87698dd7038bd66012a1fbf6ae9b7e01f3b7eea2e7ea3a5c6f%3Ahttps%3A%2F%2Fapp.fieldnation.com%2F",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: JSON.stringify({
        code: code,
        trustBrowser: true,
        source: "Login",
      }),
      method: "POST",
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ OTP verification successful!");
      console.log("📋 Verification response:");
      console.log(JSON.stringify(result, null, 2));
      return result;
    } else {
      console.error(
        "❌ Failed to verify OTP:",
        response.status,
        response.statusText
      );
      console.error("Error details:", result);
      return null;
    }
  } catch (error) {
    console.error("❌ Error verifying OTP:", error);
    return null;
  }
}

// Main function to handle the complete OTP flow
async function main() {
  console.log("🚀 Field Nation OTP Authentication\n");

  // Initialize Gmail authentication
  let auth;
  try {
    auth = await authorize();
    console.log("✅ Gmail authentication successful");
  } catch (error) {
    console.error("❌ Failed to authenticate with Gmail:", error);
    return;
  }

  // Step 1: Generate OTP
  const otpGenerated = await generateOtp();

  if (!otpGenerated) {
    console.log("❌ Failed to generate OTP. Exiting...");
    return;
  }

  console.log("\n" + "=".repeat(50));

  // Step 2: Wait for verification email and extract code
  console.log("\n⏳ Waiting for verification email from Field Nation...");
  const code = await waitForFNcode(auth, 60000, 3000); // Wait up to 1 minute, check every 3 seconds

  if (!code) {
    console.log("❌ No verification code received. Exiting...");
    return;
  }

  console.log("\n" + "=".repeat(50));

  // Step 3: Verify the OTP
  const verificationResult = await verifyOtp(code);

  if (verificationResult) {
    console.log("\n🎉 Authentication completed successfully!");

    // If there are any important fields in the response, highlight them
    if (verificationResult.access_token) {
      console.log("🔑 Access token received");
    }
    if (verificationResult.redirect_url) {
      console.log("🔗 Redirect URL:", verificationResult.redirect_url);
    }
  } else {
    console.log("\n❌ Authentication failed.");
  }
}

// Run the main function
main().catch(console.error);
