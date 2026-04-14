import fs from "node:fs";
import path from "node:path";

export interface LiveWorkMarketOrder {
  id: string;
  company: string;
  title: string;
  hourlyRate: number;
  hoursOfWork: number;
  totalPayment: number;
  payType: "hourly" | "fixed";
  date: string;
  time: string;
  latestStartTime?: string;
  distance: number;
}

export interface WorkMarketAssignedSummary {
  id: string;
  title: string;
  status: string;
}

function assertWorkMarketParseConfidence(input: {
  id: string;
  company: string;
  title: string;
  totalPayment: number;
  pageHtml?: string;
}): void {
  const company = input.company.trim();
  const title = input.title.trim();
  const loweredHtml = (input.pageHtml ?? "").toLowerCase();

  if (
    /no longer available|assigned to someone else|not available|cannot be accepted/i.test(loweredHtml)
  ) {
    throw new Error(`WorkMarket order unavailable: ${input.id}`);
  }

  if (company === "Unknown Company" || title === "No Title") {
    throw new Error(`WorkMarket parser low-confidence for order ${input.id}`);
  }

  if (input.totalPayment <= 0 && !/per[_\s-]?hour|pricing|total budget/i.test(loweredHtml)) {
    throw new Error(`WorkMarket parser missing compensation details for order ${input.id}`);
  }
}

function readCookies(cookiePathCandidates: string[]): string {
  for (const filePath of cookiePathCandidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const cookiesJson = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!Array.isArray(cookiesJson)) {
      continue;
    }

    const cookies = cookiesJson
      .filter(
        cookie =>
          typeof cookie?.name === "string" &&
          typeof cookie?.value === "string"
      )
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (cookies) {
      return cookies;
    }
  }

  throw new Error("No valid WorkMarket cookies found");
}

export function readWorkMarketCookies(cookiePathCandidates: string[]): string {
  return readCookies(cookiePathCandidates);
}

function convert24HourClockTo12Hour(timeStr: string): string {
  const [rawHours, rawMinutes = "00", rawSeconds = "00"] = timeStr.split(":");
  let hours = Number(rawHours);
  const minutes = rawMinutes.padStart(2, "0");
  const seconds = rawSeconds.padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }

  return `${hours}:${minutes}:${seconds} ${period}`;
}

function toIsoDate(dateStr: string): string {
  const [month, day, year] = dateStr.split("/");
  if (!month || !day || !year) {
    throw new Error(`Unable to parse WorkMarket date: ${dateStr}`);
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractWorkMarketOrderId(url: string): string | null {
  const directMatch = url.match(/\/assignments\/details\/(\d+)/);
  if (directMatch) {
    return directMatch[1] ?? null;
  }

  const redirectMatch = url.match(/redirectTo=\/assignments\/details\/(\d+)/);
  return redirectMatch?.[1] ?? null;
}

export async function resolveWorkMarketDetailsUrl(
  orderIdOrUrl: string
): Promise<string> {
  if (!orderIdOrUrl.startsWith("http")) {
    return `https://www.workmarket.com/assignments/details/${orderIdOrUrl}`;
  }

  const response = await fetch(orderIdOrUrl, {
    method: "GET",
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Unable to resolve WorkMarket URL (${response.status})`);
  }

  const workOrderId = extractWorkMarketOrderId(response.url);

  if (!workOrderId) {
    throw new Error("Could not extract WorkMarket order ID from redirect URL");
  }

  return `https://www.workmarket.com/assignments/details/${workOrderId}`;
}

export function parseLiveWorkMarketOrder(pageHtml: string, fallbackId: string): LiveWorkMarketOrder {
  if (
    pageHtml.includes("login?redirectTo=") ||
    pageHtml.includes("Please sign in") ||
    pageHtml.includes("<title>Login - WorkMarket</title>")
  ) {
    throw new Error("WorkMarket session expired or unauthenticated");
  }

  if (
    pageHtml.includes("<title>My Work - Work Market</title>") ||
    pageHtml.includes('id="assignment_list_results"')
  ) {
    throw new Error(`WorkMarket order ${fallbackId} redirected to My Work`);
  }

  const workEncodedMatch = pageHtml.match(/workEncoded:\s*({[\s\S]+?}),\s*companyName:/);
  if (workEncodedMatch?.[1]) {
    try {
      const workEncoded = JSON.parse(workEncodedMatch[1]) as {
        workNumber?: string | number;
        title?: string;
        pricing?: {
          type?: string;
          perHourPrice?: number;
          maxNumberOfHours?: number;
          maxSpendLimit?: number;
          flatPrice?: number;
        };
        schedule?: {
          from?: number;
          through?: number;
          range?: number;
        };
        distance?: number;
      };
      const companyMetaMatch = pageHtml.match(/<meta name="companyName" content="([^"]+)"/i);
      const configCompanyMatch = pageHtml.match(/companyName:\s*'([^']+)'/);
      const companyName =
        configCompanyMatch?.[1] ??
        companyMetaMatch?.[1] ??
        "Unknown Company";
      const pricing = workEncoded.pricing ?? {};
      const startIso =
        workEncoded.schedule?.from && Number(workEncoded.schedule.from) > 0
          ? new Date(Number(workEncoded.schedule.from)).toISOString().replace("Z", "-04:00")
          : undefined;
      const endIso =
        workEncoded.schedule?.through && Number(workEncoded.schedule.through) > 0
          ? new Date(Number(workEncoded.schedule.through)).toISOString().replace("Z", "-04:00")
          : undefined;
      const startDate = startIso ? startIso.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const startClock = startIso
        ? new Date(startIso).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/New_York"
          })
        : "09:00 AM";
      const endClock =
        endIso &&
        new Date(endIso).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/New_York"
        });
      const hourlyRate = Number(pricing.perHourPrice ?? 0);
      const hoursOfWork =
        Number(pricing.maxNumberOfHours ?? 0) ||
        (startIso && endIso
          ? Math.max(
              (new Date(endIso).getTime() - new Date(startIso).getTime()) /
                (60 * 60 * 1000),
              0
            )
          : 4);
      const totalPayment =
        Number(pricing.maxSpendLimit ?? 0) ||
        Number(pricing.flatPrice ?? 0) ||
        (hourlyRate > 0 ? hourlyRate * Math.max(hoursOfWork, 1) : 0);

      const parsed: LiveWorkMarketOrder = {
        id: String(workEncoded.workNumber ?? fallbackId),
        company: companyName,
        title: workEncoded.title ?? "No Title",
        hourlyRate,
        hoursOfWork,
        totalPayment,
        payType:
          pricing.type === "PER_HOUR" || hourlyRate > 0
            ? "hourly"
            : "fixed",
        date: startDate,
        time: endClock ? `${startClock} to ${endClock} EDT` : `${startClock} EDT`,
        distance: 0
      };
      assertWorkMarketParseConfidence({
        id: parsed.id,
        company: parsed.company,
        title: parsed.title,
        totalPayment: parsed.totalPayment,
        pageHtml
      });
      return parsed;
    } catch {
      // fall back to regex parser below
    }
  }

  const titleMatch =
    pageHtml.match(/<h2[^>]*class="assignment-header"[^>]*>\s*([^<]+)/i) ||
    pageHtml.match(/<title[^>]*>([^<]+)<\/title>/i);

  let companyName = "Unknown Company";
  const configCompanyMatch = pageHtml.match(/companyName:\s*'([^']+)'/);
  if (configCompanyMatch?.[1]) {
    companyName = configCompanyMatch[1];
  } else {
    const sidebarCompanyMatch = pageHtml.match(
      /<a[^>]*href="\/profile\/company\/\d+"[^>]*>([^<]+)<\/a>/i
    );
    if (sidebarCompanyMatch?.[1]) {
      companyName = sidebarCompanyMatch[1].trim().replace(/Learn More &raquo;/gi, "").trim();
    }
  }

  const hourlyRateMatch = pageHtml.match(/\$\s*([\d.,]+)\/hr/i);
  const maxHoursMatch = pageHtml.match(/up to\s+(\d+)hr/i);
  const totalBudgetMatch = pageHtml.match(
    /<td[^>]*><strong[^>]*>Total budget<\/strong><\/td>\s*<td[^>]*>\s*<strong[^>]*>\s*\$\s*([\d.,]+)/i
  );
  const distanceMatch = pageHtml.match(/\(([\d.,]+)\s*mi\)/i);
  const scheduleMatch = pageHtml.match(
    /<strong[^>]*>(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}\/\d{1,2}\/\d{4}))?<\/strong><br\/>\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(?:to\s*(\d{1,2}:\d{2}\s*(?:AM|PM)))?\s*(\w{3})/i
  );
  const titleWindowMatch = titleMatch?.[1]?.match(
    /\|\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})\s+([A-Z]{3})\s*\|\s*Requested Window/i
  );
  const marketplaceFeeMatch = pageHtml.match(
    /Marketplace Access Fee[^$]*-\s*\$\s*([\d.,]+)/i
  );

  let formattedDate = new Date().toISOString().slice(0, 10);
  let formattedTime = "09:00 AM EDT";
  let latestStartTime: string | undefined;

  if (scheduleMatch) {
    const startDate = scheduleMatch[2]!;
    const startTime = scheduleMatch[5]!;
    const endTime = scheduleMatch[6];
    const timezone = scheduleMatch[7]!;
    formattedDate = toIsoDate(startDate);
    formattedTime = endTime ? `${startTime} to ${endTime} ${timezone}` : `${startTime} ${timezone}`;
  }

  if (titleWindowMatch) {
    const startDate = titleWindowMatch[1];
    const startTime24 = titleWindowMatch[2];
    const latestStart24 = titleWindowMatch[3];
    const timezone = titleWindowMatch[4];
    if (!startDate || !startTime24 || !latestStart24 || !timezone) {
      throw new Error("Requested Window title was missing required time parts");
    }
    formattedDate = toIsoDate(startDate);
    formattedTime = `${convert24HourClockTo12Hour(startTime24)} to ${convert24HourClockTo12Hour(latestStart24)} ${timezone}`;
    latestStartTime = `${convert24HourClockTo12Hour(latestStart24)} ${timezone}`;
  }

  let jsonHourlyRate = 0;
  let jsonMaxHours: number | null = null;
  let jsonPayType: "hourly" | "fixed" | null = null;
  let jsonTotalPayment = 0;

  const pricingMatch = pageHtml.match(/"pricing"\s*:\s*({[^}]+})/);
  if (pricingMatch?.[1]) {
    try {
      const pricingJSON = JSON.parse(pricingMatch[1]) as {
        type?: string;
        perHourPrice?: number;
        maxNumberOfHours?: number;
        maxSpendLimit?: number;
        flatPrice?: number;
      };

      if (pricingJSON.type === "PER_HOUR") {
        jsonPayType = "hourly";
        jsonHourlyRate = pricingJSON.perHourPrice ?? 0;
        jsonMaxHours = pricingJSON.maxNumberOfHours ?? null;
        jsonTotalPayment =
          pricingJSON.maxSpendLimit ??
          jsonHourlyRate * (jsonMaxHours || 4);
      } else {
        jsonPayType = "fixed";
        jsonTotalPayment =
          pricingJSON.flatPrice ?? pricingJSON.maxSpendLimit ?? 0;
      }
    } catch {
      // ignore malformed pricing JSON and fall back to regexes
    }
  }

  let totalPayment = jsonTotalPayment > 0
    ? jsonTotalPayment
    : totalBudgetMatch?.[1]
      ? parseFloat(totalBudgetMatch[1].replace(/,/g, ""))
      : 0;

  if (marketplaceFeeMatch?.[1]) {
    const marketplaceFee = parseFloat(marketplaceFeeMatch[1].replace(/,/g, ""));
    totalPayment += Number.isFinite(marketplaceFee) ? 0 : 0;
  }

  const finalHourlyRate = jsonHourlyRate > 0
    ? jsonHourlyRate
    : hourlyRateMatch?.[1]
      ? parseFloat(hourlyRateMatch[1].replace(/,/g, ""))
      : 0;

  const finalMaxHours = jsonMaxHours !== null
    ? jsonMaxHours
    : maxHoursMatch?.[1]
      ? parseInt(maxHoursMatch[1], 10)
      : 4;

  const parsed = {
    id: fallbackId,
    company: companyName,
    title: titleMatch?.[1]?.trim().replace(" - Work Market", "") || "No Title",
    hourlyRate: finalHourlyRate,
    hoursOfWork: finalMaxHours,
    totalPayment,
    payType: jsonPayType || (finalHourlyRate > 0 ? "hourly" : "fixed"),
    date: formattedDate,
    time: formattedTime,
    latestStartTime,
    distance: distanceMatch?.[1]
      ? parseFloat(distanceMatch[1].replace(/,/g, ""))
      : 0
  };
  assertWorkMarketParseConfidence({
    id: parsed.id,
    company: parsed.company,
    title: parsed.title,
    totalPayment: parsed.totalPayment,
    pageHtml
  });
  return parsed;
}

export function parseAssignedSummariesFromAssignmentsPage(pageHtml: string): WorkMarketAssignedSummary[] {
  const matches = [
    ...pageHtml.matchAll(
      /href="\/assignments\/details\/(\d+)"[\s\S]{0,1800}?<span class="title"[\s\S]{0,400}?>\s*([^<]+?)\s*<\/span>[\s\S]{0,1600}?<p><strong>([^<]+)<\/strong><br\/><\/p>/gi
    )
  ];

  return matches.map(match => ({
    id: match[1] ?? "",
    title: match[2]?.trim() ?? "Unknown Assignment",
    status: match[3]?.trim() ?? "Unknown"
  }));
}

export function workMarketOrderToBusyInterval(order: LiveWorkMarketOrder): {
  start: string;
  end: string;
  label: string;
} | null {
  const startMatch = order.time.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))/i);
  const endMatch = order.time.match(/to\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))/i);

  if (!startMatch?.[1]) {
    return null;
  }

  const parseTo24h = (value: string) => {
    const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!match) {
      throw new Error(`Unable to parse WorkMarket assignment time: ${value}`);
    }
    const periodRaw = match[4];
    if (!periodRaw) {
      throw new Error(`Unable to parse WorkMarket assignment period: ${value}`);
    }

    let hours = Number(match[1]);
    const minutes = match[2];
    const seconds = match[3] ?? "00";
    const period = periodRaw.toUpperCase();

    if (period === "PM" && hours !== 12) {
      hours += 12;
    }
    if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  };

  const start = `${order.date}T${parseTo24h(startMatch[1])}-04:00`;
  let end: string;

  if (endMatch?.[1]) {
    end = `${order.date}T${parseTo24h(endMatch[1])}-04:00`;
  } else {
    const startDate = new Date(start);
    startDate.setHours(startDate.getHours() + Math.max(order.hoursOfWork || 0, 1));
    end = startDate.toISOString().replace("Z", "-04:00");
  }

  return {
    start,
    end,
    label: `WorkMarket Assigned: ${order.title}`
  };
}

export function resolveWorkMarketSessionPaths(): string[] {
  return [
    path.resolve(process.cwd(), "data/sessions/workmarket-cookies.json"),
    path.resolve(process.cwd(), "data/sessions/workmarket-fallback-cookies.json")
  ];
}

export async function fetchLiveWorkMarketOrder(
  orderIdOrUrl: string,
  cookiePathCandidates: string[]
): Promise<LiveWorkMarketOrder> {
  const detailsUrl = await resolveWorkMarketDetailsUrl(orderIdOrUrl);
  const workOrderId = extractWorkMarketOrderId(detailsUrl);

  if (!workOrderId) {
    throw new Error("Could not resolve WorkMarket order ID");
  }

  const cookies = readCookies(cookiePathCandidates);
  const response = await fetch(detailsUrl, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      cookie: cookies,
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    },
    method: "GET",
    redirect: "follow"
  });

  const pageHtml = await response.text();

  if (!response.ok) {
    throw new Error(`WorkMarket fetch failed (${response.status})`);
  }

  if (/\/login\?redirectTo=\/assignments\/details\//i.test(response.url)) {
    throw new Error("WorkMarket session expired or unauthenticated");
  }

  return parseLiveWorkMarketOrder(pageHtml, workOrderId);
}
