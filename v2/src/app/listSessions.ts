import type Database from "better-sqlite3";

import { listSessions } from "../storage/repositories.js";

export function printSessions(db: Database.Database): void {
  const rows = listSessions(db).map(row => ({
    id: row.id,
    platform: row.platform,
    status: row.status,
    lastRefreshedAt: row.last_refreshed_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    session: JSON.parse(row.session_json)
  }));

  console.log(JSON.stringify(rows, null, 2));
}
