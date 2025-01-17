export default function generateCalendarForCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based, so 0 = January
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Get total days in the month
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Map numeric days to week names (starting from Sunday)
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Initialize calendar structure
    const calendar = {};
    let currentWeek = 1;

    for (let i = 0; i < daysInMonth; i++) {
        const currentDate = new Date(year, month, i + 1); // Current date
        const weekday = currentDate.getDay(); // Day of the week (0-6)

        // If it's the start of a new week, increment the week counter
        if (weekday === 0 && i !== 0) {
            currentWeek++;
        }

        const weekKey = `week${currentWeek}`;
        if (!calendar[weekKey]) {
            calendar[weekKey] = {};
        }

        const dayName = dayNames[weekday];
        if (!calendar[weekKey][dayName]) {
            calendar[weekKey][dayName] = [];
        }

        calendar[weekKey][dayName].push({
            date: currentDate.toISOString().split("T")[0], // Format: YYYY-MM-DD
            events: []
        });
    }

    return calendar;
}

const currentMonthCalendar = generateCalendarForCurrentMonth();

// Use JSON.stringify() with pretty-print formatting
const fullData = JSON.stringify(currentMonthCalendar, null, 2);

console.log(fullData);

