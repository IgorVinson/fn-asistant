import { google } from 'googleapis';
import { authorize } from './utils/gmail/login.js';

async function showAllCalendarsEvents() {
    console.log('📅 CHECKING ALL CALENDARS IN vinsonfn24@gmail.com\n');
    
    try {
        console.log('🔐 Getting authenticated client...');
        const auth = await authorize();
        const calendar = google.calendar({ version: 'v3', auth });
        console.log('✅ Authentication successful!\n');
        
        // Get all calendars in the account
        console.log('🔍 Step 1: Finding all calendars...');
        const calendarList = await calendar.calendarList.list();
        console.log(`✅ API call successful!\n`);
        
        console.log(`Found ${calendarList.data.items.length} calendars:\n`);
        
        // Show all available calendars
        calendarList.data.items.forEach((cal, index) => {
            console.log(`${index + 1}. ${cal.summary}`);
            console.log(`   📧 ID: ${cal.id}`);
            console.log(`   🌍 Timezone: ${cal.timeZone}`);
            console.log(`   ⭐ Primary: ${cal.primary || false}`);
            console.log(`   🎨 Color: ${cal.backgroundColor || 'Default'}`);
            console.log(`   👁️ Access: ${cal.accessRole}`);
            console.log('');
        });
        
        console.log('─'.repeat(60));
        console.log('🗓️ Step 2: Getting today\'s events from ALL calendars...\n');
        
        // Get today's date range
        const today = new Date();
        const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
        
        let totalEvents = 0;
        const allEvents = [];
        
        // Check each calendar for events
        for (const cal of calendarList.data.items) {
            try {
                console.log(`🔍 Checking "${cal.summary}" calendar...`);
                
                const events = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: timeMin,
                    timeMax: timeMax,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                
                const todayEvents = events.data.items || [];
                console.log(`   📊 Found ${todayEvents.length} events`);
                
                if (todayEvents.length > 0) {
                    todayEvents.forEach((event, index) => {
                        const start = event.start.dateTime || event.start.date;
                        const end = event.end.dateTime || event.end.date;
                        const startTime = new Date(start);
                        const endTime = new Date(end);
                        
                        console.log(`   ${index + 1}. "${event.summary || 'No title'}"`);
                        console.log(`      ⏰ ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
                        console.log(`      📍 ${event.location || 'No location'}`);
                        console.log(`      📝 ${event.description ? event.description.substring(0, 50) + '...' : 'No description'}`);
                        console.log(`      👁️ Status: ${event.status}, Transparency: ${event.transparency || 'opaque'}`);
                        console.log('');
                        
                        // Add to master list with calendar info
                        allEvents.push({
                            ...event,
                            calendarName: cal.summary,
                            calendarId: cal.id,
                            start: startTime,
                            end: endTime
                        });
                    });
                }
                
                totalEvents += todayEvents.length;
                console.log('');
                
            } catch (error) {
                console.log(`   ❌ Error accessing calendar: ${error.message}`);
                console.log('');
            }
        }
        
        console.log('─'.repeat(60));
        console.log('📊 SUMMARY:\n');
        console.log(`📅 Total calendars checked: ${calendarList.data.items.length}`);
        console.log(`🗓️ Total events today: ${totalEvents}`);
        
        if (allEvents.length > 0) {
            console.log('\n🕐 ALL EVENTS TODAY (sorted by time):');
            console.log('─'.repeat(60));
            
            // Sort all events by start time
            allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
            
            allEvents.forEach((event, index) => {
                console.log(`${index + 1}. "${event.summary || 'No title'}" [${event.calendarName}]`);
                console.log(`   ⏰ ${event.start.toLocaleTimeString()} - ${event.end.toLocaleTimeString()}`);
                console.log(`   📍 ${event.location || 'No location'}`);
                console.log('');
            });
            
            console.log('─'.repeat(60));
            console.log('💡 NEXT STEPS:');
            console.log('1. Choose which calendars should be checked for work order conflicts');
            console.log('2. Update the app to use multiple calendars for availability checking');
            console.log('3. Configure calendar priorities (e.g., personal vs work events)');
            
        } else {
            console.log('\n✅ No events scheduled for today across all calendars!');
            console.log('💡 This means any work order time would be available (no conflicts)');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

console.log('🚀 Starting script...');
showAllCalendarsEvents()
    .then(() => {
        console.log('✅ Script completed successfully!');
    })
    .catch((error) => {
        console.error('💥 Script failed:', error.message);
        process.exit(1);
    });
