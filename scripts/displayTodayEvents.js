import calendarEvents from "./utils/gmail/googleCalendarEvents.js";

async function displayTodayEvents() {
  try {
    console.log("📅 Fetching today's events from your calendar...\n");

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    console.log(
      `Date: ${todayStr} (${today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })})\n`
    );

    // Fetch events for today
    const events = await calendarEvents.getEventsForDate(todayStr);

    if (events.length === 0) {
      console.log("✅ No events scheduled for today - your calendar is free!");
    } else {
      console.log(`📋 Found ${events.length} event(s) today:\n`);

      events.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);

        const startStr = event.start.dateTime
          ? startTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "All day";
        const endStr = event.start.dateTime
          ? endTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        console.log(`${index + 1}. ${event.summary || "No title"}`);
        console.log(`   🕐 Time: ${startStr}${endStr ? ` - ${endStr}` : ""}`);
        if (event.location) {
          console.log(`   📍 Location: ${event.location}`);
        }
        if (event.description) {
          console.log(
            `   📝 Description: ${event.description.substring(0, 100)}${
              event.description.length > 100 ? "..." : ""
            }`
          );
        }
        console.log("");
      });
    }

    // Test the conflict checking function
    console.log("\n🔍 Testing conflict detection...");

    // Create a test time slot for this afternoon
    const testStart = new Date(today);
    testStart.setHours(14, 0, 0, 0); // 2:00 PM
    const testEnd = new Date(today);
    testEnd.setHours(16, 0, 0, 0); // 4:00 PM

    const hasConflict = await calendarEvents.hasTimeConflict(
      testStart.toISOString(),
      testEnd.toISOString(),
      30 // 30-minute buffer
    );

    console.log(`Test slot: 2:00 PM - 4:00 PM today`);
    console.log(`Conflict detected: ${hasConflict ? "❌ YES" : "✅ NO"}`);
  } catch (error) {
    console.error("❌ Error fetching calendar events:", error.message);

    if (error.message.includes("insufficient authentication scopes")) {
      console.log("\n🔧 Authentication issue detected. You may need to:");
      console.log("1. Delete token.json file");
      console.log("2. Re-authenticate with calendar permissions");
    } else if (error.message.includes("rate limit")) {
      console.log(
        "\n⏰ Rate limit reached. Please wait a moment and try again."
      );
    } else {
      console.log(
        "\n💡 Make sure your Google Calendar API is properly configured."
      );
    }
  }
}

// Run the script
displayTodayEvents();
