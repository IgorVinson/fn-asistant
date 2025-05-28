import calendarEvents from "./utils/gmail/googleCalendarEvents.js";
import logger from "./utils/logger.js";

async function testCalendarIntegration() {
  console.log("=== Testing Google Calendar Integration ===\n");

  try {
    // Test 1: Get calendar info
    console.log("1. Getting calendar information...");
    const calendarInfo = await calendarEvents.getCalendarInfo();
    console.log("Calendar Info:", {
      id: calendarInfo.id,
      summary: calendarInfo.summary,
      timeZone: calendarInfo.timeZone,
      primary: calendarInfo.primary,
    });
    console.log("✅ Calendar info retrieved successfully\n");

    // Test 2: Get today's events
    console.log("2. Getting today's events...");
    const today = new Date();
    const todayEvents = await calendarEvents.getEventsForDate(today);
    console.log(
      `Found ${todayEvents.length} events for today (${today.toDateString()})`
    );

    if (todayEvents.length > 0) {
      console.log("Today's events:");
      todayEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.summary}`);
        console.log(
          `     Time: ${new Date(event.start).toLocaleString()} - ${new Date(
            event.end
          ).toLocaleString()}`
        );
        console.log(
          `     Status: ${event.status}, Transparency: ${event.transparency}`
        );
      });
    } else {
      console.log("  No events found for today");
    }
    console.log("✅ Today's events retrieved successfully\n");

    // Test 3: Get events for next 7 days
    console.log("3. Getting events for next 7 days...");
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const weekEvents = await calendarEvents.getEventsForDateRange(
      today,
      nextWeek
    );
    console.log(`Found ${weekEvents.length} events for the next 7 days`);

    if (weekEvents.length > 0) {
      console.log("Upcoming events:");
      weekEvents.slice(0, 5).forEach((event, index) => {
        // Show first 5 events
        console.log(
          `  ${index + 1}. ${event.summary} - ${new Date(
            event.start
          ).toLocaleDateString()}`
        );
      });
      if (weekEvents.length > 5) {
        console.log(`  ... and ${weekEvents.length - 5} more events`);
      }
    }
    console.log("✅ Week events retrieved successfully\n");

    // Test 4: Test time conflict detection
    console.log("4. Testing time conflict detection...");

    // Create a test time slot for tomorrow at 2 PM - 4 PM
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const testStartTime = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      14,
      0,
      0
    ); // 2 PM
    const testEndTime = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      16,
      0,
      0
    ); // 4 PM

    console.log(
      `Testing time slot: ${testStartTime.toLocaleString()} - ${testEndTime.toLocaleString()}`
    );

    const conflictCheck = await calendarEvents.checkTimeConflict(
      testStartTime.toISOString(),
      testEndTime.toISOString(),
      30 // 30-minute buffer
    );

    console.log("Conflict check result:", {
      hasConflict: conflictCheck.hasConflict,
      conflictsFound: conflictCheck.conflicts.length,
      totalEvents: conflictCheck.totalEvents,
      busyEvents: conflictCheck.busyEvents,
    });

    if (conflictCheck.hasConflict) {
      console.log("Conflicting events:");
      conflictCheck.conflicts.forEach((conflict, index) => {
        console.log(`  ${index + 1}. ${conflict.eventSummary}`);
        console.log(
          `     Event time: ${new Date(
            conflict.eventStart
          ).toLocaleString()} - ${new Date(conflict.eventEnd).toLocaleString()}`
        );
        console.log(`     Overlap type: ${conflict.overlapType}`);
      });
    } else {
      console.log("  No conflicts found - time slot is available!");
    }
    console.log("✅ Time conflict detection test completed\n");

    console.log("=== All tests completed successfully! ===");
    console.log("\nNext steps:");
    console.log(
      "1. Update your isEligibleForApplication.js to use calendar events instead of static schedule"
    );
    console.log("2. Test with real work orders");
    console.log("3. Integrate with your main application workflow");
  } catch (error) {
    console.error("❌ Error during calendar integration test:", error.message);

    if (error.message.includes("invalid_grant")) {
      console.log("\n🔧 Solution: Your authentication token may be expired.");
      console.log(
        "   Delete token.json and run the test again to re-authenticate."
      );
    } else if (error.message.includes("Calendar API has not been used")) {
      console.log(
        "\n🔧 Solution: Enable the Google Calendar API in your Google Cloud Console."
      );
      console.log(
        "   Go to: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
      );
    } else if (error.message.includes("insufficient permission")) {
      console.log(
        "\n🔧 Solution: Make sure you have the correct Calendar API scopes."
      );
      console.log(
        "   Delete token.json and re-authenticate with updated scopes."
      );
    }

    throw error;
  }
}

// Run the test
testCalendarIntegration().catch(error => {
  logger.error("Calendar integration test failed:", error);
  process.exit(1);
});
