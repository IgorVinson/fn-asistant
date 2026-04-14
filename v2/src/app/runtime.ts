import path from "node:path";
import { fileURLToPath } from "node:url";
import { CompositeCalendarProvider } from "../calendar/compositeProvider.js";
import { GoogleCalendarProvider } from "../calendar/googleCalendarProvider.js";
import { NoopCalendarProvider } from "../calendar/noopCalendarProvider.js";
import type { CalendarAvailabilityProvider } from "../calendar/provider.js";
import { WorkMarketAssignedProvider } from "../calendar/workmarketAssignedProvider.js";
import { defaultPolicy } from "../config/policy.js";
import { openDatabase } from "../storage/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppRuntime {
  policy: typeof defaultPolicy;
  dbPath: string;
  calendarProvider: CalendarAvailabilityProvider;
}

function createCalendarProvider(): CalendarAvailabilityProvider {
  const providers: CalendarAvailabilityProvider[] = [];

  if (process.env.CALENDAR_PROVIDER === "google") {
    providers.push(new GoogleCalendarProvider({
      credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH,
      tokenPath: process.env.GOOGLE_TOKEN_PATH,
      excludedCalendarIds: process.env.GOOGLE_EXCLUDED_CALENDAR_IDS
        ? process.env.GOOGLE_EXCLUDED_CALENDAR_IDS.split(",").map(item => item.trim()).filter(Boolean)
        : []
    }));
  }

  if (process.env.ENABLE_WORKMARKET_ASSIGNED_PROVIDER === "true") {
    providers.push(new WorkMarketAssignedProvider());
  }

  if (providers.length === 0) {
    return new NoopCalendarProvider();
  }

  if (providers.length === 1) {
    return providers[0]!;
  }

  return new CompositeCalendarProvider(providers);
}

export function createRuntime(): AppRuntime {
  const dbPath = path.resolve(__dirname, "../../data/fieldops-v2.sqlite");
  openDatabase(dbPath).close();

  return {
    policy: defaultPolicy,
    dbPath,
    calendarProvider: createCalendarProvider()
  };
}
