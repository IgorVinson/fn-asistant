import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

import { getSessionByPlatform } from "../storage/repositories.js";

type PlatformName = "WorkMarket" | "FieldNation";

export function getPreferredCookiePathCandidates(
  db: Database.Database,
  platform: PlatformName
): string[] {
  const sessionRow = getSessionByPlatform(db, platform);
  const candidates: string[] = [];

  if (sessionRow) {
    const session = JSON.parse(sessionRow.session_json) as {
      cookiePath?: string;
    };

    if (sessionRow.status === "active" && typeof session.cookiePath === "string") {
      candidates.push(session.cookiePath);
    }
  }

  if (platform === "WorkMarket") {
    candidates.push(
      path.resolve(process.cwd(), "data/sessions/workmarket-cookies.json"),
      path.resolve(process.cwd(), "data/sessions/workmarket-fallback-cookies.json")
    );
  } else {
    candidates.push(
      path.resolve(process.cwd(), "data/sessions/fieldnation-cookies.json"),
      path.resolve(process.cwd(), "data/sessions/fieldnation-fallback-cookies.json")
    );
  }

  return [...new Set(candidates)];
}

export function assertActiveSessionForImport(
  db: Database.Database,
  platform: PlatformName
): void {
  const sessionRow = getSessionByPlatform(db, platform);

  if (!sessionRow || sessionRow.status !== "active") {
    throw new Error(
      `${platform} session is not active. Run refresh-session before live import.`
    );
  }

  const session = JSON.parse(sessionRow.session_json) as {
    cookiePath?: string;
  };

  if (!session.cookiePath || !fs.existsSync(session.cookiePath)) {
    throw new Error(
      `${platform} session cookie file is missing. Run refresh-session before live import.`
    );
  }
}
