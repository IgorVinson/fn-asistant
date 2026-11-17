import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("Windows launcher termination kills its supervisor and grandchildren", {
  skip: process.platform !== "win32", timeout: 20_000,
}, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fn-job-"));
  await mkdir(path.join(directory, "scripts"));
  await mkdir(path.join(directory, "logs"));
  const launcher = path.join(directory, "scripts", "launcher.ps1");
  const original = await readFile(new URL("../scripts/start-server.ps1", import.meta.url), "utf8");
  await writeFile(launcher, original.replace("'watchdog.js'", "'dummy.mjs'"));
  const marker = path.join(directory, "pids.json");
  await writeFile(path.join(directory, "scripts", "dummy.mjs"), `
    import { spawn } from 'node:child_process';
    import { writeFileSync } from 'node:fs';
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {windowsHide:true, stdio:'ignore'});
    writeFileSync(${JSON.stringify(marker)}, JSON.stringify([process.pid, child.pid]));
    setInterval(() => {}, 1000);
  `);
  const processHandle = spawn("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher], { windowsHide: true, stdio: "ignore" });
  let pids = [];
  const gone = pid => {
    try { process.kill(pid, 0); return false; } catch (error) { return error.code === "ESRCH"; }
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { pids = JSON.parse(await readFile(marker, "utf8")); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(pids.length, 2, "Fixture supervisor and child must start");
    // Allow assignment and prove both members are alive before termination.
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.ok(pids.every(pid => !gone(pid)));
    processHandle.kill("SIGKILL");
    for (let attempt = 0; attempt < 50 && !pids.every(gone); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(pids.every(gone), "No child may survive its task launcher");
  } finally {
    processHandle.kill("SIGKILL");
    for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch {} }
    await rm(directory, { recursive: true, force: true, maxRetries: 30, retryDelay: 100 });
  }
});
