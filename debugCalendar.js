import { google } from 'googleapis';
import { authorize } from './utils/gmail/login.js';
import calendarEvents from './utils/gmail/googleCalendarEvents.js';
import logger from './utils/logger.js';

async function debugCalendarAccess() {
    console.log('=== Debug Calendar Access ===\n');

    try {
        // Get authenticated client
        console.log('🔐 Getting authenticated client...');
        const auth = await authorize();
        const calendar = google.calendar({ version: 'v3', auth });
        
        // List all calendars
        console.log('📋 Listing all available calendars...\n');
        const calendarList = await calendar.calendarList.list();
        
        console.log(`Found ${calendarList.data.items.length} calendar(s):\n`);
        
        calendarList.data.items.forEach((cal, index) => {
            console.log(`${index + 1}. 📅 ${cal.summary}`);
            console.log(`   ID: ${cal.id}`);
            console.log(`   Primary: ${cal.primary || false}`);
            console.log(`   Access Role: ${cal.accessRole}`);
            console.log(`   Selected: ${cal.selected}`);
            console.log(`   Timezone: ${cal.timeZone || 'Not specified'}`);
            console.log(`   Background Color: ${cal.backgroundColor || 'Default'}`);
            console.log('');
        });

        // Test each calendar for today's events
        console.log('🔍 Testing each calendar for today\'s events...\n');
        
        const today = new Date();
        const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
        
        for (const cal of calendarList.data.items) {
            console.log(`📅 Checking calendar: ${cal.summary} (${cal.id})`);
            
            try {
                const response = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: timeMin,
                    timeMax: timeMax,
                    singleEvents: true,
                    orderBy: 'startTime',
                    maxResults: 100
                });

                const events = response.data.items || [];
                console.log(`   📊 Found ${events.length} event(s) for today`);
                
                if (events.length > 0) {
                    events.forEach((event, index) => {
                        const startTime = new Date(event.start.dateTime || event.start.date);
                        const endTime = new Date(event.end.dateTime || event.end.date);
                        console.log(`   ${index + 1}. "${event.summary || 'No title'}" - ${startTime.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
                    });
                } else {
                    console.log('   (No events found)');
                }
                
            } catch (error) {
                console.log(`   ❌ Error accessing this calendar: ${error.message}`);
            }
            
            console.log('');
        }

        // Test specific calendar IDs
        console.log('🎯 Testing specific calendar scenarios...\n');
        
        const testCalendars = [
            'primary',
            'fn24vinson@gmail.com',
            'vinsonfn24@gmail.com'
        ];
        
        for (const calId of testCalendars) {
            console.log(`🔍 Testing calendar ID: ${calId}`);
            
            try {
                // Get calendar info
                const calInfo = await calendar.calendars.get({
                    calendarId: calId
                });
                
                console.log(`   ✅ Calendar found: ${calInfo.data.summary}`);
                console.log(`   📧 Email: ${calInfo.data.id}`);
                console.log(`   🌍 Timezone: ${calInfo.data.timeZone}`);
                
                // Get events
                const response = await calendar.events.list({
                    calendarId: calId,
                    timeMin: timeMin,
                    timeMax: timeMax,
                    singleEvents: true,
                    orderBy: 'startTime',
                    maxResults: 100
                });

                const events = response.data.items || [];
                console.log(`   📊 Events today: ${events.length}`);
                
                if (events.length > 0) {
                    events.forEach((event, index) => {
                        const startTime = new Date(event.start.dateTime || event.start.date);
                        const endTime = new Date(event.end.dateTime || event.end.date);
                        console.log(`   ${index + 1}. "${event.summary || 'No title'}" - ${startTime.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
                    });
                }
                
            } catch (error) {
                console.log(`   ❌ Cannot access calendar "${calId}": ${error.message}`);
            }
            
            console.log('');
        }

        // Show what our current function is using
        console.log('🔧 Testing our current calendar function...\n');
        
        try {
            const ourCalendarInfo = await calendarEvents.getCalendarInfo();
            console.log('Our function is using:');
            console.log(`   📅 Calendar: ${ourCalendarInfo.summary}`);
            console.log(`   📧 ID: ${ourCalendarInfo.id}`);
            console.log(`   🌍 Timezone: ${ourCalendarInfo.timeZone}`);
            
            const ourEvents = await calendarEvents.getEventsForDate(today);
            console.log(`   📊 Events found by our function: ${ourEvents.length}`);
            
            if (ourEvents.length > 0) {
                ourEvents.forEach((event, index) => {
                    const startTime = new Date(event.start);
                    const endTime = new Date(event.end);
                    console.log(`   ${index + 1}. "${event.summary}" - ${startTime.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
                });
            }
            
        } catch (error) {
            console.log(`❌ Error with our function: ${error.message}`);
        }

        console.log('\n✅ Calendar debug completed!');
        console.log('\n📋 Recommendations:');
        console.log('1. Check which calendar above shows your events');
        console.log('2. We may need to update the calendar ID in our functions');
        console.log('3. Verify you\'re signed in with the correct Google account');

    } catch (error) {
        console.error('❌ Error during calendar debug:', error.message);
        throw error;
    }
}

// Run the debug
debugCalendarAccess().catch(error => {
    logger.error('Calendar debug failed:', error);
    process.exit(1);
});
