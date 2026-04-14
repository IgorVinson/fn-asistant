import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { upsertSession } from "../storage/repositories.js";

const execFileAsync = promisify(execFile);

type SessionPlatform = "WorkMarket" | "FieldNation";

function addHours(timestamp: string, hours: number): string {
  return new Date(Date.parse(timestamp) + hours * 60 * 60 * 1000).toISOString();
}

function resolveTsxBinary(v2Root: string): string {
  const candidates = [
    path.join(v2Root, "node_modules", ".bin", "tsx"),
    path.join(v2Root, "node_modules", ".bin", "tsx.cmd")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "tsx";
}

function resolveRefreshScript(v2Root: string): string {
  const candidates = [
    path.resolve(v2Root, "scripts", "refreshLegacySession.ts"),
    path.resolve(v2Root, "scripts", "refreshLegacySession.mjs")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(v2Root, "scripts", "refreshLegacySession.mjs");
}

async function refreshPlatformSession(
  db: Database.Database,
  platform: SessionPlatform
): Promise<void> {
  const refreshedAt = new Date().toISOString();
  const v2Root = path.resolve(process.cwd());
  fs.mkdirSync(path.resolve(v2Root, "data", "sessions"), { recursive: true });
  fs.mkdirSync(path.resolve(v2Root, "config"), { recursive: true });
  const scriptPath = resolveRefreshScript(v2Root);
  const tsxBinary = resolveTsxBinary(v2Root);

  try {
    const { stdout } = await execFileAsync(tsxBinary, [scriptPath, platform], {
      cwd: v2Root,
      maxBuffer: 1024 * 1024 * 10
    });

    const lines = stdout
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);
    const jsonLine = [...lines].reverse().find(line => line.startsWith("{"));

    if (!jsonLine) {
      throw new Error("Session refresh did not return a JSON result");
    }

    const result = JSON.parse(jsonLine) as {
      platform: SessionPlatform;
      success: boolean;
      cookiePath: string;
      cookieCount: number;
      message?: string | null;
      error?: string | null;
    };

    upsertSession(db, {
      id: `session:${platform}`,
      platform,
      status: result.success ? "active" : "failed",
      session: result,
      lastRefreshedAt: refreshedAt,
      expiresAt: result.success ? addHours(refreshedAt, 4) : null
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    upsertSession(db, {
      id: `session:${platform}`,
      platform,
      status: "failed",
      session: {
        error: error instanceof Error ? error.message : String(error)
      },
      lastRefreshedAt: refreshedAt,
      expiresAt: null
    });

    throw error;
  }
}

export async function refreshSession(
  db: Database.Database,
  target: "wm" | "fn" | "all"
): Promise<void> {
  if (target === "all") {
    await refreshPlatformSession(db, "FieldNation");
    await refreshPlatformSession(db, "WorkMarket");
    return;
  }

  if (target === "wm") {
    await refreshPlatformSession(db, "WorkMarket");
    return;
  }

  await refreshPlatformSession(db, "FieldNation");
}
