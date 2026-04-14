import { authenticate } from "@google-cloud/local-auth";
import { promises as fs } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
async function loadSavedCredentialsIfExist(tokenPath) {
    try {
        const content = await fs.readFile(tokenPath, "utf8");
        return google.auth.fromJSON(JSON.parse(content));
    }
    catch {
        return null;
    }
}
async function saveCredentials(tokenPath, credentialsPath, client) {
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
async function authorizeGoogleCalendar(credentialsPath, tokenPath) {
    let client = await loadSavedCredentialsIfExist(tokenPath);
    if (client) {
        try {
            await client.getAccessToken();
            return client;
        }
        catch {
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
function toDayRange(isoDatetime) {
    const date = new Date(isoDatetime);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
    return {
        timeMin: start.toISOString(),
        timeMax: end.toISOString()
    };
}
export class GoogleCalendarProvider {
    name = "google-calendar";
    credentialsPath;
    tokenPath;
    excludedCalendarIds;
    constructor(options = {}) {
        this.credentialsPath =
            options.credentialsPath ??
                path.resolve(process.cwd(), "../config/credentials.json");
        this.tokenPath =
            options.tokenPath ??
                path.resolve(process.cwd(), "../config/token.json");
        this.excludedCalendarIds = options.excludedCalendarIds ?? [];
    }
    async getBusyIntervalsForJob(job) {
        return this.getBusyIntervalsForDate(job.requestedWindow.earliestStart);
    }
    async getBusyIntervalsForDate(anchorIso) {
        const auth = await authorizeGoogleCalendar(this.credentialsPath, this.tokenPath);
        const calendar = google.calendar({ version: "v3", auth });
        const { timeMin, timeMax } = toDayRange(anchorIso);
        const calendarList = await calendar.calendarList.list();
        const calendars = (calendarList.data.items ?? []).filter(item => item.id && !this.excludedCalendarIds.includes(item.id));
        const busyIntervals = [];
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
