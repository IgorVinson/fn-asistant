import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleCalendarProvider } from "../calendar/googleCalendarProvider.js";
import { NoopCalendarProvider } from "../calendar/noopCalendarProvider.js";
import { defaultPolicy } from "../config/policy.js";
import { openDatabase } from "../storage/database.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function createCalendarProvider() {
    if (process.env.CALENDAR_PROVIDER === "google") {
        return new GoogleCalendarProvider({
            credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH,
            tokenPath: process.env.GOOGLE_TOKEN_PATH,
            excludedCalendarIds: process.env.GOOGLE_EXCLUDED_CALENDAR_IDS
                ? process.env.GOOGLE_EXCLUDED_CALENDAR_IDS.split(",").map(item => item.trim()).filter(Boolean)
                : []
        });
    }
    return new NoopCalendarProvider();
}
export function createRuntime() {
    const dbPath = path.resolve(__dirname, "../../data/fieldops-v2.sqlite");
    openDatabase(dbPath).close();
    return {
        policy: defaultPolicy,
        dbPath,
        calendarProvider: createCalendarProvider()
    };
}
