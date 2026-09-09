import fs from "fs/promises";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";

const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL("../config.js", import.meta.url)
);

export function replaceLeadTimeTierMinPay(source, tierIndex, minPay) {
  if (!Number.isInteger(tierIndex) || tierIndex < 0) {
    throw new Error("Invalid lead-time tier index");
  }

  if (!Number.isFinite(minPay) || minPay <= 0 || minPay > 2000) {
    throw new Error("Minimum pay must be between $1 and $2000");
  }

  const tiersMatch = source.match(/LEAD_TIME_TIERS\s*:\s*\[[\s\S]*?\n\s*\],/);
  if (!tiersMatch) {
    throw new Error("LEAD_TIME_TIERS was not found in config.js");
  }

  let currentIndex = -1;
  let replaced = false;
  const updatedTiers = tiersMatch[0].replace(
    /minPay\s*:\s*\d+(?:\.\d+)?/g,
    match => {
      currentIndex += 1;
      if (currentIndex !== tierIndex) return match;
      replaced = true;
      return `minPay: ${minPay}`;
    }
  );

  if (!replaced) {
    throw new Error(`Lead-time tier ${tierIndex + 1} was not found in config.js`);
  }

  return (
    source.slice(0, tiersMatch.index) +
    updatedTiers +
    source.slice(tiersMatch.index + tiersMatch[0].length)
  );
}

export async function persistLeadTimeTierMinPay(
  tierIndex,
  minPay,
  configPath = DEFAULT_CONFIG_PATH
) {
  return persistConfigUpdate(configPath, source => replaceLeadTimeTierMinPay(source, tierIndex, minPay));
}

const writes = new Map();
function persistConfigUpdate(configPath, transform) {
  const previous = writes.get(configPath) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const source = await fs.readFile(configPath, 'utf8');
    const updated = transform(source);
    const temporary = `${configPath}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, updated, 'utf8');
      await fs.rename(temporary, configPath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  });
  writes.set(configPath, next);
  return next.finally(() => { if (writes.get(configPath) === next) writes.delete(configPath); });
}

export function replaceArrivalWindowMinutes(source, minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
    throw new Error('Enter whole minutes from 0 to 240 (0 = disabled)');
  }
  const pattern = /(ARRIVAL_WINDOW_AFTER_JOB_MINUTES\s*:\s*)\d+/g;
  if ([...source.matchAll(pattern)].length !== 1) {
    throw new Error('Expected one ARRIVAL_WINDOW_AFTER_JOB_MINUTES setting in config.js');
  }
  return source.replace(pattern, (_, prefix) => `${prefix}${minutes}`);
}

export function persistArrivalWindowMinutes(minutes, configPath = DEFAULT_CONFIG_PATH) {
  return persistConfigUpdate(configPath, source => replaceArrivalWindowMinutes(source, minutes));
}
