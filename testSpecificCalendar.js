import calendarEvents from './utils/gmail/googleCalendarEvents.js';
import logger from './utils/logger.js';

async function testSpecificCalendar() {
    console.log('=== Testing Specific Calendar Access ===\n');

    try {
        // Test accessing fn24vinson@gmail.com calendar specifically
        console.log('1. Testing access to fn24vinson@gmail.com calendar...');
        
        try {
            const calendarInfo = await calendarEvents.getCalendarInfo('fn24vinson@gmail.com');
            console.log('✅ Successfully accessed fn24vinson@gmail.com calendar:');
            console.log({
                id: calendarInfo.id,
                summary: calendarInfo.summary,
                timeZone: calendarInfo.timeZone,
                primary: calendarInfo.primary
            });
        } catch (error) {
            console.log('❌ Cannot access fn24vinson@gmail.com calendar:', error.message);
            console.log('This is normal if you don\'t have access to this calendar from your current account.\n');
        }

        // Test primary calendar (which we know works)
        console.log('2. Using primary calendar (vinsonfn24@gmail.com) for integration...');
        const primaryCalendarInfo = await calendarEvents.getCalendarInfo('primary');
        console.log('✅ Primary calendar info:');
        console.log({
            id: primaryCalendarInfo.id,
            summary: primaryCalendarInfo.summary,
            timeZone: primaryCalendarInfo.timeZone,
            primary: primaryCalendarInfo.primary
        });

        console.log('\n=== Calendar Integration Ready! ===');
        console.log('✅ Google Calendar API is working');
        console.log('✅ Authentication is successful');
        console.log('✅ Calendar access is confirmed');
        console.log(`✅ Using calendar: ${primaryCalendarInfo.id}`);
        
        console.log('\nNext step: Update isEligibleForApplication.js to use Google Calendar');

    } catch (error) {
        console.error('❌ Error during calendar test:', error.message);
        throw error;
    }
}

// Run the test
testSpecificCalendar().catch(error => {
    logger.error('Calendar test failed:', error);
    process.exit(1);
});
