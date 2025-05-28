import { google } from "googleapis";
import { authorize } from "./utils/gmail/login.js";

async function checkCurrentAuth() {
  console.log("=== Checking Current Authentication ===\n");

  try {
    const auth = await authorize();
    console.log("✅ Authentication successful!");

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth });
    const userInfo = await oauth2.userinfo.get();

    console.log("Current authenticated user:");
    console.log(`  Email: ${userInfo.data.email}`);
    console.log(`  Name: ${userInfo.data.name}`);
    console.log(`  ID: ${userInfo.data.id}`);

    // Try to get Gmail profile to see what project this is using
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });

    console.log("\nGmail profile:");
    console.log(`  Email: ${profile.data.emailAddress}`);
    console.log(`  Messages Total: ${profile.data.messagesTotal}`);

    // Check if this matches your expected email
    if (profile.data.emailAddress === "fn24vinson@gmail.com") {
      console.log("\n✅ This matches your expected email account!");
      console.log("Now you just need to enable Calendar API for this project.");
    } else {
      console.log("\n⚠️  This is a different email account than expected.");
      console.log("Expected: fn24vinson@gmail.com");
      console.log(`Actual: ${profile.data.emailAddress}`);
    }
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);

    if (error.message.includes("invalid_grant")) {
      console.log("\n🔧 Solution: Delete token.json and re-authenticate");
      console.log("Run: rm token.json && node checkAuth.js");
    }
  }
}

checkCurrentAuth().catch(console.error);
