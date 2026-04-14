import { authenticate } from "@google-cloud/local-auth";
import { promises as fs } from "node:fs";
import path from "node:path";
import { google } from "googleapis";

import type { BusyInterval } from "../types/availability.js";
import type { NormalizedJob } from "../types/job.js";
import type { CalendarAvailabilityProvider } from "./provider.js";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

interface GoogleCalendarProviderOptions {
  credentialsPath?: string;
  tokenPath?: string;
  excludedCalendarIds?: string[];
}

async function loadSavedCredentialsIfExist(tokenPath: string) {
  try {
    const content = await fs.readFile(tokenPath, "utf8");
    return google.auth.fromJSON(JSON.parse(content));
  } catch {
    return null;
  }
}

async function saveCredentials(tokenPath: string, credentialsPath: string, client: {
  credentials: { refresh_token?: string | null };
}) {
  const content = await fs.readFile(credentialsPath, "utf8");
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  });
  await fs.writeFile(tokenPath, payload, "utf8");
}

async function authorizeGoogleCalendar(
  credentialsPath: string,
  tokenPath: string
): Promise<any> {
  let client: any = await loadSavedCredentialsIfExist(tokenPath);

  if (client) {
    try {
      await client.getAccessToken();
      return client;
    } catch {
      client = null;
    }
  }

  client = await authenticate({
    scopes: GOOGLE_SCOPES,
    keyfilePath: credentialsPath
  });

  if (client?.credentials?.refresh_token) {
    await saveCredentials(tokenPath, credentialsPath, client);
  }

  return client;
}

function toDayRange(isoDatetime: string): { timeMin: string; timeMax: string } {
  const date = new Date(isoDatetime);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString()
  };
}

export class GoogleCalendarProvider implements CalendarAvailabilityProvider {
  readonly name = "google-calendar";
  private readonly credentialsPath: string;
  private readonly tokenPath: string;
  private readonly excludedCalendarIds: string[];

  constructor(options: GoogleCalendarProviderOptions = {}) {
    this.credentialsPath =
      options.credentialsPath ??
      path.resolve(process.cwd(), "../config/credentials.json");
    this.tokenPath =
      options.tokenPath ??
      path.resolve(process.cwd(), "../config/token.json");
    this.excludedCalendarIds = options.excludedCalendarIds ?? [];
  }

  async getBusyIntervalsForJob(job: NormalizedJob): Promise<BusyInterval[]> {
    return this.getBusyIntervalsForDate(job.requestedWindow.earliestStart);
  }

  async getBusyIntervalsForDate(anchorIso: string): Promise<BusyInterval[]> {
    const auth = await authorizeGoogleCalendar(this.credentialsPath, this.tokenPath);
    const calendar = google.calendar({ version: "v3", auth });
    const { timeMin, timeMax } = toDayRange(anchorIso);

    const calendarList = await calendar.calendarList.list();
    const calendars = (calendarList.data.items ?? []).filter(
      item => item.id && !this.excludedCalendarIds.includes(item.id)
    );

    const busyIntervals: BusyInterval[] = [];

    for (const entry of calendars) {
      if (!entry.id) {
        continue;
      }

      const response = await calendar.events.list({
        calendarId: entry.id,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250
      });

      for (const event of response.data.items ?? []) {
        if (event.status === "cancelled" || event.transparency === "transparent") {
          continue;
        }

        const start = event.start?.dateTime;
        const end = event.end?.dateTime;

        if (!start || !end) {
          continue;
        }

        busyIntervals.push({
          start,
          end,
          label: event.summary ?? entry.summary ?? "Busy"
        });
      }
    }

    return busyIntervals.sort((left, right) => left.start.localeCompare(right.start));
  }
}
