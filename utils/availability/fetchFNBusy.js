import { CONFIG } from "../../config.js";
import logger from "../logger.js";

/**
 * Fetch busy blocks from the Field Nation public iCal feed (accepted/assigned work orders).
 * Mirrors fetchWMBusy: returns [] on any failure so a transient feed outage never blocks scheduling.
 */
export async function fetchFNBusy() {
  const rawUrl = CONFIG.PLATFORMS?.FIELD_NATION?.CALENDAR_FEED_URL;
  if (!rawUrl) {
    logger.info("fetchFNBusy: no FN calendar feed URL configured");
    return [];
  }

  // webcal:// is just an iCal feed served over http(s)
  const url = rawUrl.replace(/^webcal:\/\//i, "https://");

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      logger.error(`fetchFNBusy: feed returned HTTP ${res.status}`);
      return [];
    }

    const ics = await res.text();
    const busyBlocks = parseIcsBusyBlocks(ics);

    logger.info(`fetchFNBusy: found ${busyBlocks.length} FN busy blocks`);
    return busyBlocks;
  } catch (error) {
    logger.error(`fetchFNBusy: error fetching FN calendar feed: ${error.message}`);
    return [];
  }
}

/**
 * Parse VEVENT blocks from an iCal string into { start, end, summary } busy blocks.
 * Handles RFC 5545 line folding, UTC (Z), floating local, date-only and TZID-prefixed values.
 */
export function parseIcsBusyBlocks(ics) {
  const lines = unfoldIcsLines(ics);
  const blocks = [];

  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const start = current.start;
        let end = current.end;
        if (start instanceof Date && !isNaN(start.getTime())) {
          if (!(end instanceof Date) || isNaN(end.getTime())) {
            // No DTEND — default to a 4h block, matching fetchWMBusy's fallback
            end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
          }
          blocks.push({ start, end, summary: current.summary || "FN Work Order" });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "DTSTART") current.start = parseIcsDate(value);
    else if (key === "DTEND") current.end = parseIcsDate(value);
    else if (key === "SUMMARY") current.summary = unescapeIcsText(value);
  }

  return blocks;
}

function unfoldIcsLines(ics) {
  const rawLines = ics.split(/\r\n|\n|\r/);
  const unfolded = [];
  for (const raw of rawLines) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += raw.slice(1);
    } else {
      unfolded.push(raw);
    }
  }
  return unfolded;
}

/**
 * Parse an iCal date value into a Date.
 * - "20260702T130000Z"  -> UTC instant
 * - "20260702T130000"   -> floating, interpreted as local time
 * - "20260702"          -> date-only (all-day), local midnight
 */
function parseIcsDate(value) {
  const v = value.trim();

  const dateTimeUtc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  if (dateTimeUtc) {
    const [, y, mo, d, h, mi, s] = dateTimeUtc;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }

  const dateTimeLocal = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (dateTimeLocal) {
    const [, y, mo, d, h, mi, s] = dateTimeLocal;
    return new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return new Date(+y, +mo - 1, +d);
  }

  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function unescapeIcsText(text) {
  return text
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}
