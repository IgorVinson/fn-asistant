import fs from "node:fs";
import { chromium } from "playwright";

import type { BusyInterval } from "../types/availability.js";
import type { NormalizedJob } from "../types/job.js";
import type { CalendarAvailabilityProvider } from "./provider.js";
import {
  fetchLiveWorkMarketOrder,
  parseAssignedSummariesFromAssignmentsPage,
  resolveWorkMarketSessionPaths,
  workMarketOrderToBusyInterval
} from "../platforms/workmarket/liveClient.js";

export class WorkMarketAssignedProvider implements CalendarAvailabilityProvider {
  readonly name = "workmarket-assigned";

  private async loadAssignmentSummaries(): Promise<Array<{ id: string; title: string; status: string }>> {
    const primaryCookiePath = resolveWorkMarketSessionPaths()[0];

    if (!primaryCookiePath || !fs.existsSync(primaryCookiePath)) {
      return [];
    }

    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      // Degrade gracefully when Playwright browser binaries are not installed.
      const message = error instanceof Error ? error.message : String(error);
      if (/Executable doesn't exist|playwright install/i.test(message)) {
        return [];
      }
      throw error;
    }

    try {
      const context = await browser.newContext();
      const rawCookies = JSON.parse(fs.readFileSync(primaryCookiePath, "utf8")) as Array<{
        name?: string;
        value?: string;
        url?: string;
        domain?: string;
        path?: string;
        expires?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "Strict" | "Lax" | "None";
      }>;
      const cookies = (Array.isArray(rawCookies) ? rawCookies : []).filter(
        cookie => typeof cookie.name === "string" && typeof cookie.value === "string"
      ) as Array<{
        name: string;
        value: string;
        url?: string;
        domain?: string;
        path?: string;
        expires?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "Strict" | "Lax" | "None";
      }>;
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto("https://www.workmarket.com/assignments", {
        waitUntil: "domcontentloaded"
      });
      await page.waitForTimeout(3000);

      const html = await page.content();
      return parseAssignedSummariesFromAssignmentsPage(html).filter(summary =>
        !/completed|cancelled|declined|rejected|paid/i.test(summary.status)
      );
    } finally {
      await browser.close();
    }
  }

  async getBusyIntervalsForJob(job: NormalizedJob): Promise<BusyInterval[]> {
    return this.getBusyIntervalsForDate(job.requestedWindow.earliestStart);
  }

  async getBusyIntervalsForDate(anchorIso: string): Promise<BusyInterval[]> {
    const targetDate = anchorIso.slice(0, 10);
    const summaries = await this.loadAssignmentSummaries();
    const busyIntervals: BusyInterval[] = [];

    for (const summary of summaries.slice(0, 10)) {
      try {
        const order = await fetchLiveWorkMarketOrder(summary.id, resolveWorkMarketSessionPaths());
        const busy = workMarketOrderToBusyInterval(order);

        if (busy && busy.start.slice(0, 10) === targetDate) {
          busyIntervals.push(busy);
        }
      } catch {
        // Ignore individual assignment fetch failures; availability should degrade gracefully.
      }
    }

    return busyIntervals.sort((left, right) => left.start.localeCompare(right.start));
  }
}
