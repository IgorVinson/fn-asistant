import calendarEvents from "./utils/gmail/googleCalendarEvents.js";
import logger from "./utils/logger.js";

async function showTodayEvents() {
  console.log("=== Today's Calendar Events ===\n");

  try {
    // Get calendar info first
    console.log("🔍 Getting calendar information...");
    const calendarInfo = await calendarEvents.getCalendarInfo();
    console.log(`📅 Calendar: ${calendarInfo.summary} (${calendarInfo.id})`);
    console.log(`🌍 Timezone: ${calendarInfo.timeZone}`);
    console.log(`⭐ Primary: ${calendarInfo.primary ? "Yes" : "No"}\n`);

    // Get today's date
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`📆 Checking events for: ${todayStr}\n`);

    // Get events for today
    const todayEvents = await calendarEvents.getEventsForDate(today);

    if (todayEvents.length === 0) {
      console.log("📭 No events found for today.");
      console.log("   Your calendar is free! 🎉\n");
    } else {
      console.log(`📋 Found ${todayEvents.length} event(s) for today:\n`);

      todayEvents.forEach((event, index) => {
        const startTime = new Date(event.start);
        const endTime = new Date(event.end);

        console.log(`${index + 1}. 📌 ${event.summary}`);
        console.log(
          `   ⏰ Time: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`
        );
        console.log(
          `   📍 Location: ${event.location || "No location specified"}`
        );
        console.log(
          `   📝 Description: ${event.description || "No description"}`
        );
        console.log(`   📊 Status: ${event.status}`);
        console.log(
          `   👁️ Transparency: ${event.transparency} (${
            event.transparency === "opaque" ? "Busy" : "Free"
          })`
        );

        if (event.attendees && event.attendees.length > 0) {
          console.log(`   👥 Attendees: ${event.attendees.length}`);
        }

        console.log(""); // Empty line for spacing
      });
    }

    // Show detailed breakdown of the entire day
    console.log("🕐 Full day calendar analysis...");

    if (todayEvents.length > 0) {
      console.log("📊 Today's schedule breakdown:");
      console.log("─".repeat(50));

      // Sort events by start time
      const sortedEvents = [...todayEvents].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      let currentTime = new Date();
      currentTime.setHours(8, 0, 0, 0); // Start from 8 AM
      const endOfDay = new Date();
      endOfDay.setHours(18, 0, 0, 0); // End at 6 PM

      console.log(
        `⏰ Analyzing availability from ${currentTime.toLocaleTimeString()} to ${endOfDay.toLocaleTimeString()}\n`
      );

      for (const event of sortedEvents) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        // Show free time before this event
        if (currentTime < eventStart) {
          const freeMinutes = Math.round(
            (eventStart - currentTime) / (1000 * 60)
          );
          if (freeMinutes > 0) {
            console.log(
              `✅ FREE: ${currentTime.toLocaleTimeString()} - ${eventStart.toLocaleTimeString()} (${freeMinutes} minutes)`
            );
          }
        }

        // Show the busy event
        const eventMinutes = Math.round((eventEnd - eventStart) / (1000 * 60));
        console.log(
          `❌ BUSY: ${eventStart.toLocaleTimeString()} - ${eventEnd.toLocaleTimeString()} (${eventMinutes} min) - ${
            event.summary
          }`
        );

        currentTime = new Date(Math.max(currentTime, eventEnd));
      }

      // Show remaining free time at end of day
      if (currentTime < endOfDay) {
        const freeMinutes = Math.round((endOfDay - currentTime) / (1000 * 60));
        if (freeMinutes > 0) {
          console.log(
            `✅ FREE: ${currentTime.toLocaleTimeString()} - ${endOfDay.toLocaleTimeString()} (${freeMinutes} minutes)`
          );
        }
      }

      console.log("─".repeat(50));
    } else {
      console.log("✅ Entire day is FREE - No calendar conflicts!");
    }

    // Test a few different time slots throughout the day
    console.log("\n🔍 Testing availability for common work slots:");
    const testSlots = [
      { start: 9, end: 12, name: "Morning (9 AM - 12 PM)" },
      { start: 13, end: 16, name: "Afternoon (1 PM - 4 PM)" },
      { start: 14, end: 17, name: "Late Afternoon (2 PM - 5 PM)" },
    ];

    for (const slot of testSlots) {
      const testStart = new Date();
      testStart.setHours(slot.start, 0, 0, 0);
      const testEnd = new Date();
      testEnd.setHours(slot.end, 0, 0, 0);

      const conflictCheck = await calendarEvents.checkTimeConflict(
        testStart.toISOString(),
        testEnd.toISOString(),
        30 // 30-minute buffer
      );

      const status = conflictCheck.hasConflict ? "❌ CONFLICT" : "✅ AVAILABLE";
      console.log(`   ${slot.name}: ${status}`);

      if (conflictCheck.hasConflict && conflictCheck.conflicts.length > 0) {
        conflictCheck.conflicts.forEach(conflict => {
          console.log(`     → Conflicts with: "${conflict.eventSummary}"`);
        });
      }
    }

    console.log("\n✅ Calendar integration test completed successfully!");

    // Show next steps
    console.log("\n📋 Next steps:");
    console.log(
      "1. If you see events above, the integration is working perfectly"
    );
    console.log(
      "2. Try adding a test event to your calendar and run this script again"
    );
    console.log(
      "3. The system will now use these calendar events for work order availability"
    );
  } catch (error) {
    console.error("❌ Error accessing calendar:", error.message);

    if (error.message.includes("invalid_grant")) {
      console.log("\n🔧 Fix: Your authentication token expired.");
      console.log("   Run: rm token.json && node showTodayEvents.js");
    } else if (error.message.includes("Calendar API")) {
      console.log(
        "\n🔧 Fix: Make sure Google Calendar API is enabled in Google Cloud Console."
      );
    } else {
      console.log(
        "\n🔧 Check: Make sure you have internet connection and proper permissions."
      );
    }

    throw error;
  }
}

// Run the script
showTodayEvents().catch(error => {
  logger.error("Failed to show today's events:", error);
  process.exit(1);
});
