import type Database from "better-sqlite3";

import { listRecentJobs } from "../storage/repositories.js";

export function listJobs(
  db: Database.Database,
  limit = 10
): void {
  const rows = listRecentJobs(db, limit);

  console.log(JSON.stringify(rows, null, 2));
}
