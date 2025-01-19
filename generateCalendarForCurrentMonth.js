export default function generateCalendarForCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based, so 0 = January
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Get total days in the month

    // Map numeric days to week names (starting from Monday)
    const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

    // Initialize calendar structure
    const calendar = {};
    let currentWeek = 1;

    for (let i = 0; i < daysInMonth; i++) {
        const currentDate = new Date(year, month, i + 1); // Current date
        const weekday = (currentDate.getDay() + 6) % 7; // Adjust to make Monday the first day (0)
        const dayNumber = currentDate.getDate(); // Day number (1-31)

        // If it's the start of a new week, increment the week counter
        if (weekday === 0 && i !== 0) {
            currentWeek++;
        }

        const weekKey = `week${currentWeek}`;
        if (!calendar[weekKey]) {
            calendar[weekKey] = {};
        }

        const dayNameWithDate = `${dayNames[weekday]} ${dayNumber}`;
        if (!calendar[weekKey][dayNameWithDate]) {
            calendar[weekKey][dayNameWithDate] = [];
        }
    }

    return JSON.stringify(calendar, null, 2);
}

console.log(generateCalendarForCurrentMonth());


