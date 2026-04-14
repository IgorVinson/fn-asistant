import http from "node:http";
import type Database from "better-sqlite3";

import { upsertRawEvent } from "../../storage/repositories.js";
import { extractJobLinksFromText } from "../gmail/poll.js";

export function startPhoneWebhookServer(
  db: Database.Database,
  port: number
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/phone-events") {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const payload = JSON.parse(raw) as {
          sourceId?: string;
          text?: string;
          url?: string;
        };
        const text = [payload.text ?? "", payload.url ?? ""].join("\n");
        const links = extractJobLinksFromText(text);
        const receivedAt = new Date().toISOString();

        for (const link of links) {
          upsertRawEvent(db, {
            id: `raw:phone:${payload.sourceId ?? "unknown"}:${link.platform}:${link.orderId}`,
            sourceKind: "phone_alert",
            sourceId: payload.sourceId ?? "unknown",
            dedupeKey: `phone:${payload.sourceId ?? "unknown"}:${link.platform}:${link.orderId}`,
            status: "new",
            link: link.link,
            payload: {
              ...payload,
              platform: link.platform,
              orderId: link.orderId
            },
            receivedAt
          });
        }

        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, stored: links.length }));
      } catch (error) {
        res.statusCode = 400;
        res.end(error instanceof Error ? error.message : String(error));
      }
    });
  });

  server.listen(port);
  return server;
}
