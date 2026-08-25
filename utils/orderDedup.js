import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_ORDER_FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000;

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildOrderFingerprint(workOrder) {
  const identity = {
    platform: String(workOrder?.platform || ""),
    id: String(workOrder?.id || ""),
    time: {
      start: workOrder?.time?.start || null,
      latestStart: workOrder?.time?.latestStart || null,
      end: workOrder?.time?.end || null,
    },
    payType: workOrder?.payType || null,
    hourlyRate: numberOrZero(workOrder?.hourlyRate),
    payRange: {
      min: numberOrZero(workOrder?.payRange?.min),
      max: numberOrZero(workOrder?.payRange?.max),
    },
    payStructure: workOrder?.payStructure || null,
    estLaborHours: numberOrZero(workOrder?.estLaborHours),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
}

export class PersistentOrderDeduper {
  constructor({
    filePath,
    ttlMs = DEFAULT_ORDER_FINGERPRINT_TTL_MS,
    now = () => Date.now(),
  }) {
    this.filePath = filePath;
    this.ttlMs = ttlMs;
    this.now = now;
    this.entries = new Map();
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      for (const [fingerprint, expiresAt] of Object.entries(saved)) {
        if (Number(expiresAt) > this.now()) {
          this.entries.set(fingerprint, Number(expiresAt));
        }
      }
    } catch {
      // A missing or stale runtime cache is equivalent to an empty cache.
    }
  }

  prune() {
    const current = this.now();
    for (const [fingerprint, expiresAt] of this.entries) {
      if (expiresAt <= current) this.entries.delete(fingerprint);
    }
  }

  has(workOrder) {
    this.prune();
    return (this.entries.get(buildOrderFingerprint(workOrder)) || 0) > this.now();
  }

  remember(workOrder) {
    this.prune();
    this.entries.set(buildOrderFingerprint(workOrder), this.now() + this.ttlMs);
    this.persist();
  }

  persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(
        this.filePath,
        `${JSON.stringify(Object.fromEntries(this.entries), null, 2)}\n`,
        "utf8"
      );
    } catch {
      // Dedup persistence must never stop the monitoring loop.
    }
  }
}
