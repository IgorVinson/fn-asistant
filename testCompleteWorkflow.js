import isEligibleForApplication from "./utils/isEligibleForApplication.js";

async function testRealWorkOrderScenario() {
  console.log("🧪 TESTING COMPLETE WORK ORDER SCENARIO WITH CALENDAR\n");

  // Test Case 1: High-paying job with conflict
  console.log(
    "📋 Test Case 1: High-paying job during scheduled work (8:30-9:30 AM)"
  );
  console.log("=".repeat(60));

  const conflictWorkOrder = {
    title: "Website Redesign Project",
    description: "Complete website redesign for local business",
    payRange: {
      min: 200,
      max: 250, // Above the $200 threshold
    },
    estLaborHours: 2,
    distance: 15,
    clientRating: 4.8,
    isUrgent: false,
    time: {
      start: new Date()
        .toISOString()
        .replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "T12:45:00.000Z"), // 8:45 AM EST (12:45 UTC)
      end: new Date()
        .toISOString()
        .replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "T14:30:00.000Z"), // 10:30 AM EST (14:30 UTC)
    },
    skillsRequired: ["Web Development", "UI/UX Design"],
    location: "Remote",
    platform: "FieldNation",
    id: "test-conflict-001",
  };

  console.log(
    `💰 Pay: $${conflictWorkOrder.payRange.min}-$${conflictWorkOrder.payRange.max}/hour`
  );
  console.log(
    `⏰ Time: ${new Date(
      conflictWorkOrder.time.start
    ).toLocaleTimeString()} - ${new Date(
      conflictWorkOrder.time.end
    ).toLocaleTimeString()}`
  );
  console.log(
    `📅 Date: ${new Date(conflictWorkOrder.time.start).toLocaleDateString()}`
  );

  try {
    const result1 = await isEligibleForApplication(conflictWorkOrder);
    console.log(
      `\n📊 Decision: ${result1.eligible ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE"}`
    );
    console.log(`💡 Reason: ${result1.reason}`);

    if (result1.details) {
      console.log("\n📋 Details:");
      Object.entries(result1.details).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          console.log(`   ${key}: ${JSON.stringify(value, null, 2)}`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error in Test Case 1:", error.message);
  }

  console.log("\n" + "─".repeat(60) + "\n");

  // Test Case 2: High-paying job with no conflict
  console.log(
    "📋 Test Case 2: High-paying job during free time (10:00-11:30 AM)"
  );
  console.log("=".repeat(60));

  const noConflictWorkOrder = {
    title: "Mobile App Development",
    description: "Build a React Native mobile app",
    payRange: {
      min: 220,
      max: 280, // Above the $200 threshold
    },
    estLaborHours: 1.5,
    distance: 12,
    clientRating: 4.9,
    isUrgent: false,
    time: {
      start: new Date()
        .toISOString()
        .replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "T14:00:00.000Z"), // 10:00 AM EST (14:00 UTC)
      end: new Date()
        .toISOString()
        .replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "T15:30:00.000Z"), // 11:30 AM EST (15:30 UTC)
    },
    skillsRequired: ["React Native", "Mobile Development"],
    location: "Remote",
    platform: "WorkMarket",
    id: "test-no-conflict-002",
  };

  console.log(
    `💰 Pay: $${noConflictWorkOrder.payRange.min}-$${noConflictWorkOrder.payRange.max}/hour`
  );
  console.log(
    `⏰ Time: ${new Date(
      noConflictWorkOrder.time.start
    ).toLocaleTimeString()} - ${new Date(
      noConflictWorkOrder.time.end
    ).toLocaleTimeString()}`
  );
  console.log(
    `📅 Date: ${new Date(noConflictWorkOrder.time.start).toLocaleDateString()}`
  );

  try {
    const result2 = await isEligibleForApplication(noConflictWorkOrder);
    console.log(
      `\n📊 Decision: ${result2.eligible ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE"}`
    );
    console.log(`💡 Reason: ${result2.reason}`);

    if (result2.details) {
      console.log("\n📋 Details:");
      Object.entries(result2.details).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          console.log(`   ${key}: ${JSON.stringify(value, null, 2)}`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error in Test Case 2:", error.message);
  }

  console.log("\n" + "─".repeat(60) + "\n");

  // Test Case 3: Low-paying job (should be rejected regardless of schedule)
  console.log("📋 Test Case 3: Low-paying job during free time");
  console.log("=".repeat(60));

  const lowPayWorkOrder = {
    title: "Data Entry Work",
    description: "Simple data entry task",
    payRange: {
      min: 12,
      max: 15,
    },
    estLaborHours: 1,
    distance: 8,
    clientRating: 4.2,
    isUrgent: false,
    time: {
      start: new Date()
        .toISOString()
        .replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "T18:00:00.000Z"), // 2:00 PM EST (18:00 UTC)
      end: new Date()
        .toISOString()
        .replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "T19:00:00.000Z"), // 3:00 PM EST (19:00 UTC)
    },
    skillsRequired: ["Data Entry"],
    location: "Remote",
    platform: "FieldNation",
    id: "test-low-pay-003",
  };

  console.log(
    `💰 Pay: $${lowPayWorkOrder.payRange.min}-$${lowPayWorkOrder.payRange.max}/hour`
  );
  console.log(
    `⏰ Time: ${new Date(
      lowPayWorkOrder.time.start
    ).toLocaleTimeString()} - ${new Date(
      lowPayWorkOrder.time.end
    ).toLocaleTimeString()}`
  );
  console.log(
    `📅 Date: ${new Date(lowPayWorkOrder.time.start).toLocaleDateString()}`
  );

  try {
    const result3 = await isEligibleForApplication(lowPayWorkOrder);
    console.log(
      `\n📊 Decision: ${result3.eligible ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE"}`
    );
    console.log(`💡 Reason: ${result3.reason}`);

    if (result3.details) {
      console.log("\n📋 Details:");
      Object.entries(result3.details).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          console.log(`   ${key}: ${JSON.stringify(value, null, 2)}`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error in Test Case 3:", error.message);
  }

  console.log("\n✅ All test cases completed!");
  console.log("\n📋 SUMMARY:");
  console.log("- Test 1: Should be rejected due to calendar conflict");
  console.log("- Test 2: Should be accepted (good pay + no conflict)");
  console.log("- Test 3: Should be rejected due to low pay");
}

testRealWorkOrderScenario();
