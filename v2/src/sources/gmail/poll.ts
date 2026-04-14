import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { google } from "googleapis";

import {
  getAppState,
  setAppState,
  upsertRawEvent
} from "../../storage/repositories.js";

interface GmailConfig {
  credentialsPath?: string;
  tokenPath?: string;
  query?: string;
}

export interface GmailSourceEvent {
  id: string;
  sourceKind: "gmail";
  sourceId: string;
  dedupeKey: string;
  link: string;
  payload: {
    messageId: string;
    historyId: string;
    platform: "WorkMarket" | "FieldNation";
    orderId: string;
    snippet: string;
    subject?: string;
    from?: string;
  };
  receivedAt: string;
}

const DEFAULT_BACKFILL_QUERY =
  "newer_than:2d (from:myworkmarket.com OR from:workmarket.com OR from:fieldnation.com)";

function base64UrlDecode(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function createOAuthClient(config: GmailConfig) {
  const credentialsPath =
    config.credentialsPath ?? path.resolve(process.cwd(), "config", "credentials.json");
  const tokenPath =
    config.tokenPath ?? path.resolve(process.cwd(), "config", "token.json");

  if (!fs.existsSync(credentialsPath) || !fs.existsSync(tokenPath)) {
    throw new Error("Gmail credentials/token files are missing in v2/config");
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8")) as {
    installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
    web?: { client_id: string; client_secret: string; redirect_uris: string[] };
  };
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf8")) as Record<string, unknown>;
  const oauthConfig = credentials.installed ?? credentials.web;

  if (!oauthConfig) {
    throw new Error("Unsupported Gmail credentials format");
  }

  const client = new google.auth.OAuth2(
    oauthConfig.client_id,
    oauthConfig.client_secret,
    oauthConfig.redirect_uris[0]
  );
  client.setCredentials(token);
  return client;
}

function collectPayloadText(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as {
    body?: { data?: string };
    parts?: unknown[];
  };

  const chunks: string[] = [];

  if (record.body?.data) {
    chunks.push(base64UrlDecode(record.body.data));
  }

  for (const part of record.parts ?? []) {
    chunks.push(...collectPayloadText(part));
  }

  return chunks;
}

function extractHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string | undefined {
  return headers?.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function extractJobLinks(text: string): Array<{
  platform: "WorkMarket" | "FieldNation";
  orderId: string;
  link: string;
}> {
  const results = new Map<string, { platform: "WorkMarket" | "FieldNation"; orderId: string; link: string }>();
  const explicitWorkMarketIds = [
    ...text.matchAll(/\bOrder\s*ID\s*[:#]?\s*(\d{8,12})\b/gi)
  ]
    .map(match => match[1])
    .filter((id): id is string => Boolean(id));

  for (const id of explicitWorkMarketIds) {
    results.set(`wm:${id}`, {
      platform: "WorkMarket",
      orderId: id,
      link: `https://www.workmarket.com/assignments/details/${id}`
    });
  }

  let firstWorkMarketTrackingLink: string | undefined;

  for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/g)) {
    const link = match[0];

    const wmMatch =
      link.match(/workmarket\.com\/assignments\/details\/(\d+)/i) ??
      link.match(/redirectTo=\/assignments\/details\/(\d+)/i);
    if (wmMatch?.[1]) {
      results.set(`wm:${wmMatch[1]}`, {
        platform: "WorkMarket",
        orderId: wmMatch[1],
        link
      });
      continue;
    }

    if (/sendgrid\.workmarket\.com\/uni\/ls\/click/i.test(link)) {
      if (!firstWorkMarketTrackingLink) {
        firstWorkMarketTrackingLink = link;
      }
      continue;
    }

    const fnMatch = link.match(/fieldnation\.com\/workorders\/(\d+)/i);
    if (fnMatch?.[1]) {
      results.set(`fn:${fnMatch[1]}`, {
        platform: "FieldNation",
        orderId: fnMatch[1],
        link
      });
    }
  }

  if (results.size === 0 && firstWorkMarketTrackingLink) {
    results.set(`wm:tracking:1:${firstWorkMarketTrackingLink}`, {
      platform: "WorkMarket",
      orderId: "tracking-1",
      link: firstWorkMarketTrackingLink
    });
  }

  return [...results.values()];
}

function isGmailNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: number;
    status?: number;
    response?: { status?: number };
    errors?: Array<{ reason?: string }>;
  };

  return (
    maybeError.code === 404 ||
    maybeError.status === 404 ||
    maybeError.response?.status === 404 ||
    maybeError.errors?.some(item => item.reason === "notFound") === true
  );
}

async function fetchMessageById(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
) {
  return gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  });
}

function upsertEventsFromMessage(
  db: Database.Database,
  message: Awaited<ReturnType<typeof fetchMessageById>>["data"],
  fallbackHistoryId: string
): GmailSourceEvent[] {
  const payload = message.payload;
  const headers = payload?.headers ?? [];
  const subject = extractHeader(headers, "Subject");
  const from = extractHeader(headers, "From");
  const texts = [message.snippet ?? "", ...collectPayloadText(payload)].join("\n");
  const events: GmailSourceEvent[] = [];

  for (const link of extractJobLinks(texts)) {
    const event: GmailSourceEvent = {
      id: `raw:gmail:${message.id}:${link.platform}:${link.orderId}`,
      sourceKind: "gmail",
      sourceId: message.id ?? "unknown",
      dedupeKey: `gmail:${message.id}:${link.platform}:${link.orderId}`,
      link: link.link,
      payload: {
        messageId: message.id ?? "unknown",
        historyId: message.historyId ?? fallbackHistoryId,
        platform: link.platform,
        orderId: link.orderId,
        snippet: message.snippet ?? "",
        subject,
        from
      },
      receivedAt: new Date().toISOString()
    };

    upsertRawEvent(db, {
      id: event.id,
      sourceKind: event.sourceKind,
      sourceId: event.sourceId,
      dedupeKey: event.dedupeKey,
      status: "new",
      link: event.link,
      payload: event.payload,
      receivedAt: event.receivedAt
    });

    events.push(event);
  }

  return events;
}

async function bootstrapRecentEvents(
  db: Database.Database,
  gmail: ReturnType<typeof google.gmail>,
  historyId: string,
  query?: string
): Promise<GmailSourceEvent[]> {
  const list = await gmail.users.messages.list({
    userId: "me",
    q: query?.trim() || DEFAULT_BACKFILL_QUERY,
    maxResults: 25
  });

  const events: GmailSourceEvent[] = [];
  for (const item of list.data.messages ?? []) {
    if (!item.id) {
      continue;
    }

    try {
      const message = await fetchMessageById(gmail, item.id);
      events.push(...upsertEventsFromMessage(db, message.data, historyId));
    } catch (error) {
      if (isGmailNotFoundError(error)) {
        continue;
      }
      throw error;
    }
  }

  return events;
}

export async function pollGmailSource(
  db: Database.Database,
  config: GmailConfig = {}
): Promise<GmailSourceEvent[]> {
  const auth = createOAuthClient(config);
  const gmail = google.gmail({ version: "v1", auth });
  const state = getAppState<{ historyId?: string }>(db, "gmail:cursor");
  const profile = await gmail.users.getProfile({ userId: "me" });
  const currentHistoryId = profile.data.historyId;

  if (!state?.historyId || !currentHistoryId) {
    setAppState(db, "gmail:cursor", { historyId: currentHistoryId ?? null });
    if (!currentHistoryId) {
      return [];
    }

    return bootstrapRecentEvents(db, gmail, currentHistoryId, config.query);
  }

  let history;
  try {
    history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: state.historyId,
      historyTypes: ["messageAdded"]
    });
  } catch (error) {
    setAppState(db, "gmail:cursor", { historyId: currentHistoryId });
    throw error;
  }

  const messageIds = new Set<string>();
  for (const item of history.data.history ?? []) {
    for (const added of item.messagesAdded ?? []) {
      if (added.message?.id) {
        messageIds.add(added.message.id);
      }
    }
  }

  const events: GmailSourceEvent[] = [];

  for (const messageId of messageIds) {
    let message;

    try {
      message = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full"
      });
    } catch (error) {
      if (isGmailNotFoundError(error)) {
        continue;
      }

      throw error;
    }

    events.push(
      ...upsertEventsFromMessage(
        db,
        {
          ...message.data,
          id: messageId
        },
        currentHistoryId ?? state.historyId
      )
    );
  }

  setAppState(db, "gmail:cursor", {
    historyId: history.data.historyId ?? currentHistoryId
  });

  return events;
}

export function extractJobLinksFromText(text: string) {
  return extractJobLinks(text);
}
