import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  persistLeadTimeTierMinPay,
  replaceLeadTimeTierMinPay,
} from "../utils/configPersistence.js";

const sampleConfig = `export const CONFIG = {
  STRATEGY: {
    LEAD_TIME_TIERS: [
      { maxLeadHours: 36, minPay: 120 },
      { maxLeadHours: 168, minPay: 200 },
      { maxLeadHours: null, minPay: 260 },
    ],
  },
};
`;

test("lead-time persistence changes only the selected tier", () => {
  const updated = replaceLeadTimeTierMinPay(sampleConfig, 1, 175);

  assert.match(updated, /maxLeadHours: 36, minPay: 120/);
  assert.match(updated, /maxLeadHours: 168, minPay: 175/);
  assert.match(updated, /maxLeadHours: null, minPay: 260/);
});

test("lead-time persistence writes the new minimum to config.js", async t => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fn-policy-"));
  const configPath = path.join(tempDir, "config.js");
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  await fs.writeFile(configPath, sampleConfig, "utf8");

  await persistLeadTimeTierMinPay(2, 325, configPath);

  const persisted = await fs.readFile(configPath, "utf8");
  assert.match(persisted, /maxLeadHours: null, minPay: 325/);
});

test("lead-time persistence rejects invalid values", () => {
  assert.throws(
    () => replaceLeadTimeTierMinPay(sampleConfig, 0, 0),
    /between \$1 and \$2000/
  );
  assert.throws(
    () => replaceLeadTimeTierMinPay(sampleConfig, 3, 150),
    /tier 4 was not found/
  );
});
