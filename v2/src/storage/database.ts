import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        source_kind TEXT NOT NULL,
        source_id TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        status TEXT NOT NULL,
        link TEXT,
        payload_json TEXT NOT NULL,
        received_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_events_dedupe_key
      ON raw_events(dedupe_key);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS policy_snapshots (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_snapshots_active
      ON policy_snapshots(is_active)
      WHERE is_active = 1;
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        status TEXT NOT NULL,
        external_job_id TEXT,
        raw_event_id TEXT NOT NULL,
        normalized_job_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (raw_event_id) REFERENCES raw_events(id)
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status
      ON jobs(status);
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        policy_snapshot_id TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        decision_json TEXT NOT NULL,
        trace_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (policy_snapshot_id) REFERENCES policy_snapshots(id)
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_job_id
      ON decisions(job_id);
    `
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS execution_attempts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        request_payload_json TEXT NOT NULL,
        response_payload_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (decision_id) REFERENCES decisions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_execution_attempts_job_id
      ON execution_attempts(job_id);
    `
  },
  {
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        status TEXT NOT NULL,
        session_json TEXT NOT NULL,
        last_refreshed_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_platform
      ON sessions(platform);
    `
  },
  {
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 9,
    sql: `
      ALTER TABLE decisions ADD COLUMN calendar_provider TEXT;
      ALTER TABLE decisions ADD COLUMN evaluation_context_json TEXT;
    `
  },
  {
    version: 10,
    sql: `
      ALTER TABLE execution_attempts ADD COLUMN result_summary TEXT;
    `
  }
] as const;

function hasTable(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `
    )
    .get(tableName);

  return Boolean(row);
}

function isLegacyPrototypeSchema(db: Database.Database): boolean {
  if (!hasTable(db, "jobs")) {
    return false;
  }

  const columns = db.prepare("PRAGMA table_info(jobs)").all() as Array<{
    name: string;
  }>;

  const requiredJobColumns = [
    "external_job_id",
    "raw_event_id",
    "normalized_job_json"
  ];

  return requiredJobColumns.some(
    requiredColumn => !columns.some(column => column.name === requiredColumn)
  );
}

function resetLegacyPrototypeSchema(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS decisions;
    DROP TABLE IF EXISTS jobs;
    DROP TABLE IF EXISTS raw_events;
    DROP TABLE IF EXISTS policy_snapshots;
    DROP TABLE IF EXISTS execution_attempts;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS app_state;
    DROP TABLE IF EXISTS schema_migrations;
  `);
}

function runMigrations(db: Database.Database): void {
  if (isLegacyPrototypeSchema(db)) {
    resetLegacyPrototypeSchema(db);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  db.exec("BEGIN");

  try {
    for (const migration of migrations) {
      const alreadyApplied = db
        .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
        .get(migration.version);

      if (!alreadyApplied) {
        db.exec(migration.sql);
        db.prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
        ).run(migration.version, new Date().toISOString());
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function openDatabase(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);

  return db;
}
