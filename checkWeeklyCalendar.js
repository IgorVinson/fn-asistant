import calendarEvents from './utils/gmail/googleCalendarEvents.js';

async function checkCalendarRange() {
    console.log('=== Checking Calendar for Next 7 Days ===\n');

    try {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        console.log(`📅 Checking from ${today.toDateString()} to ${nextWeek.toDateString()}\n`);

        const events = await calendarEvents.getEventsForDateRange(today, nextWeek);
        
        if (events.length === 0) {
            console.log('📭 No events found in the next 7 days.');
            console.log('   Try adding a test event to your calendar and run this again.');
        } else {
            console.log(`📋 Found ${events.length} event(s) in the next 7 days:\n`);
            
            events.forEach((event, index) => {
                const startDate = new Date(event.start);
                const endDate = new Date(event.end);
                
                console.log(`${index + 1}. 📌 ${event.summary}`);
                console.log(`   📅 Date: ${startDate.toDateString()}`);
                console.log(`   ⏰ Time: ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`);
                console.log('');
            });
        }

        console.log('✅ Extended calendar check completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkCalendarRange();
