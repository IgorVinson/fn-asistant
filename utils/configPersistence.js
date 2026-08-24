import fs from "fs/promises";
import { fileURLToPath } from "url";

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
  const source = await fs.readFile(configPath, "utf8");
  const updatedSource = replaceLeadTimeTierMinPay(source, tierIndex, minPay);
  await fs.writeFile(configPath, updatedSource, "utf8");
}
