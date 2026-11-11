import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { startSupervisor } from "../utils/processSupervisor.js";
import { healthFailure } from "../utils/serverHealth.js";

test("health distinguishes a stopped monitor from stuck startup, login and order processing", () => {
  const now = 2_000_000;
  const health = { pid: 123, startedAt: now, startupComplete: true, monitoring: false };
  assert.equal(healthFailure(health, now), null);
  assert.match(healthFailure({ ...health, startupComplete: false, startedAt: 1 }, now), /Startup/);
  assert.match(healthFailure({ ...health, cookieRefreshStartedAt: 1 }, now), /login/);
  assert.equal(healthFailure({ ...health, emailCheckStartedAt: 1 }, now), null);
  assert.match(healthFailure({ ...health, monitoring: true, emailCheckStartedAt: 1 }, now), /processing/);
  assert.match(healthFailure({ ...health, monitoringRequestedAt: 1, monitoringReady: false }, now), /monitoring/);
  assert.equal(healthFailure({ ...health, monitoringRequestedAt: 1, monitoringReady: true }, now), null);
});

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitFor(condition, timeout = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for supervisor");
}

for (const mode of ["hang", "crash", "healthy"]) {
  test(`supervisor handles ${mode} without platform access`, { timeout: 20_000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fn-supervisor-"));
    const port = await freePort();
    const entry = path.join(directory, "dummy.mjs");
    const marker = path.join(directory, "launched");
    await writeFile(entry, `
      import http from 'node:http';
      import fs from 'node:fs';
      const first = !fs.existsSync(${JSON.stringify(marker)});
      fs.writeFileSync(${JSON.stringify(marker)}, 'started');
      const startedAt = Date.now();
      http.createServer((req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({pid:process.pid, startedAt, startupComplete:true, monitoring:false}));
      }).listen(${port}, '127.0.0.1', () => {
        if (first && ${JSON.stringify(mode)} === 'hang') setTimeout(() => { while (true) {} }, 250);
        if (first && ${JSON.stringify(mode)} === 'crash') setTimeout(() => process.exit(7), 250);
      });
    `);
    const supervisor = startSupervisor({ entry, cwd: directory, logDir: directory,
      healthUrl: `http://127.0.0.1:${port}/api/health`, intervalMs: 100,
      timeoutMs: 100, startupGraceMs: 300, failureLimit: 3, restartDelay: 50,
      env: { ...process.env, TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" },
    });
    const firstPid = supervisor.pid;
    let secondPid;
    try {
      if (mode === "healthy") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert.equal(supervisor.pid, firstPid, "A deliberately stopped monitor must stay stopped");
      } else {
        await waitFor(() => supervisor.pid && supervisor.pid !== firstPid);
        secondPid = supervisor.pid;
      }
      await waitFor(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(200) });
          return (await response.json()).pid === supervisor.pid;
        } catch { return false; }
      });
      const events = (await readFile(path.join(directory, "watchdog.ndjson"), "utf8"))
        .trim().split("\n").map(line => JSON.parse(line));
      if (mode === "hang") {
        assert.ok(events.some(event => event.event === "terminating-unresponsive-process"));
        const stack = events.find(event => event.event === "hang-stack");
        assert.ok(stack.frames?.some(frame => frame.url?.endsWith("dummy.mjs")), "Capture the blocked JS source before restart");
      }
      if (mode === "crash") assert.ok(events.some(event => event.event === "exited" && event.code === 7));
    } finally {
      await supervisor.stop();
      assert.throws(() => process.kill(secondPid || firstPid, 0), /ESRCH/);
      await rm(directory, { recursive: true, force: true });
    }
  });
}
