import calendarEvents from "./utils/gmail/googleCalendarEvents.js";

async function testWorkCalendarDetection() {
  console.log("🧪 TESTING WORK CALENDAR CONFLICT DETECTION\n");

  try {
    // Test scenario 1: Conflict with the 8:30-9:30 AM job
    console.log("📋 Test 1: Work order during job time (8:30-9:30 AM)");
    console.log("─".repeat(50));

    const conflictStart = new Date();
    conflictStart.setHours(8, 45, 0, 0); // 8:45 AM - overlaps with job
    const conflictEnd = new Date();
    conflictEnd.setHours(9, 45, 0, 0); // 9:45 AM

    console.log(
      `⏰ Testing time: ${conflictStart.toLocaleTimeString()} - ${conflictEnd.toLocaleTimeString()}`
    );

    const conflict = await calendarEvents.checkTimeConflict(
      conflictStart.toISOString(),
      conflictEnd.toISOString(),
      30 // 30 minute buffer
    );

    console.log(
      `📊 Result: ${
        conflict.hasConflict ? "❌ CONFLICT DETECTED" : "✅ NO CONFLICT"
      }`
    );
    console.log(`📅 Total events checked: ${conflict.totalEvents}`);
    console.log(`🔥 Busy events: ${conflict.busyEvents}`);

    if (conflict.hasConflict) {
      console.log(`⚠️ Conflicts found: ${conflict.conflicts.length}`);
      conflict.conflicts.forEach((conf, i) => {
        console.log(
          `   ${i + 1}. "${conf.eventSummary}" (${conf.eventStart} - ${
            conf.eventEnd
          })`
        );
        console.log(`      Overlap type: ${conf.overlapType}`);
      });
    }

    console.log("\n");

    // Test scenario 2: No conflict - early morning
    console.log("📋 Test 2: Work order in early morning (7:00-8:00 AM)");
    console.log("─".repeat(50));

    const noConflictStart = new Date();
    noConflictStart.setHours(7, 0, 0, 0); // 7:00 AM
    const noConflictEnd = new Date();
    noConflictEnd.setHours(8, 0, 0, 0); // 8:00 AM

    console.log(
      `⏰ Testing time: ${noConflictStart.toLocaleTimeString()} - ${noConflictEnd.toLocaleTimeString()}`
    );

    const noConflict = await calendarEvents.checkTimeConflict(
      noConflictStart.toISOString(),
      noConflictEnd.toISOString(),
      30 // 30 minute buffer
    );

    console.log(
      `📊 Result: ${
        noConflict.hasConflict ? "❌ CONFLICT DETECTED" : "✅ NO CONFLICT"
      }`
    );
    console.log(`📅 Total events checked: ${noConflict.totalEvents}`);
    console.log(`🔥 Busy events: ${noConflict.busyEvents}`);

    if (noConflict.hasConflict) {
      console.log(`⚠️ Conflicts found: ${noConflict.conflicts.length}`);
      noConflict.conflicts.forEach((conf, i) => {
        console.log(
          `   ${i + 1}. "${conf.eventSummary}" (${conf.eventStart} - ${
            conf.eventEnd
          })`
        );
      });
    }

    console.log("\n");

    // Test scenario 3: Get all events for today
    console.log("📋 Test 3: Show all events for today");
    console.log("─".repeat(50));

    const today = new Date();
    const events = await calendarEvents.getEventsForDate(today);

    console.log(
      `📅 Events found for ${today.toLocaleDateString()}: ${events.length}`
    );

    if (events.length > 0) {
      events.forEach((event, i) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        console.log(`   ${i + 1}. "${event.summary}"`);
        console.log(
          `      ⏰ ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`
        );
        console.log(`      📍 ${event.location || "No location"}`);
        console.log(`      👁️ Transparency: ${event.transparency}`);
        console.log(`      📊 Status: ${event.status}`);
      });
    } else {
      console.log("   📭 No events found");
    }

    console.log("\n");

    // Test scenario 4: Calendar info
    console.log("📋 Test 4: Calendar information");
    console.log("─".repeat(50));

    const calInfo = await calendarEvents.getCalendarInfo();
    console.log(`📅 Calendar: ${calInfo.summary}`);
    console.log(`📧 ID: ${calInfo.id}`);
    console.log(`🌍 Timezone: ${calInfo.timeZone}`);
    console.log(`⭐ Primary: ${calInfo.primary}`);

    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testWorkCalendarDetection();
