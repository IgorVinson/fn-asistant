import { spawn } from "node:child_process";
import { openSync, closeSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { calculateRestartDelay, nextCrashCount } from "./watchdogPolicy.js";
import { healthFailure } from "./serverHealth.js";
import { captureHangStack } from "./captureHangStack.js";

export function startSupervisor({
  entry, cwd, logDir, healthUrl = "http://127.0.0.1:3001/api/health",
  intervalMs = 15_000, timeoutMs = 5_000, startupGraceMs = 90_000,
  failureLimit = 3, restartDelay, env = process.env, onRestart = () => {},
}) {
  mkdirSync(logDir, { recursive: true });
  const diagnosticsFile = path.join(logDir, "watchdog.ndjson");
  let child, timer, restartTimer;
  let stopping = false;
  let crashes = 0;
  let checking = false;
  let lastHealth = null;

  function record(event, details = {}) {
    appendFileSync(diagnosticsFile, JSON.stringify({
      timestamp: new Date().toISOString(), event, ...details,
    }) + "\n");
  }

  function launch() {
    if (stopping) return;
    const startedAt = Date.now();
    let failures = 0;
    let lastHealthyRecordAt = 0;
    let restartReason = null;
    lastHealth = null;
    // Direct files remove the interactive console and pipe backpressure.
    const outputFile = path.join(logDir, `server-console-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
    const output = openSync(outputFile, "a");
    try {
      child = spawn(process.execPath, ["--inspect=127.0.0.1:0", entry], {
        cwd, env: { ...env, FN_ASSISTANT_SUPERVISED: "1" },
        stdio: ["ignore", output, output], windowsHide: true,
      });
    } finally { closeSync(output); }
    const current = child;
    record("started", { pid: current.pid, outputFile });
    current.once("exit", (code, signal) => {
      clearInterval(timer);
      child = null;
      record("exited", { pid: current.pid, code, signal, restartReason, lastHealth });
      if (stopping) return;
      crashes = nextCrashCount(crashes, Date.now() - startedAt);
      const delayMs = restartDelay ?? calculateRestartDelay(crashes);
      record("restart-scheduled", { delayMs });
      restartTimer = setTimeout(launch, delayMs);
      Promise.resolve().then(() => onRestart({ code, signal, restartReason, delayMs }))
        .catch(error => record("notification-error", { message: error.message }));
    });
    // Spawn errors have no exit event.
    current.once("error", error => {
      record("spawn-error", { message: error.message });
      if (!current.pid && !stopping) {
        clearInterval(timer);
        child = null;
        crashes += 1;
        restartTimer = setTimeout(launch, restartDelay ?? calculateRestartDelay(crashes));
      }
    });
    timer = setInterval(async () => {
      if (checking || stopping || current !== child || restartReason ||
          Date.now() - startedAt < startupGraceMs) return;
      checking = true;
      let failure;
      try {
        const response = await fetch(healthUrl, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const health = await response.json();
        if (health.pid !== current.pid) throw new Error("Health response belongs to another process");
        lastHealth = health;
        failure = healthFailure(health);
      } catch (error) {
        failure = `Health check failed: ${error.message}`;
      } finally { checking = false; }
      if (stopping || current !== child) return;
      if (!failure) {
        if (failures) record("recovered", { pid: current.pid });
        if (Date.now() - lastHealthyRecordAt >= 10 * 60_000) {
          record("healthy", { pid: current.pid, health: lastHealth });
          lastHealthyRecordAt = Date.now();
        }
        failures = 0;
        return;
      }
      failures += 1;
      record("unhealthy", { pid: current.pid, failures, reason: failure, lastHealth });
      if (failures < failureLimit) return;
      restartReason = failure;
      record("terminating-unresponsive-process", { pid: current.pid, reason: failure, lastHealth, outputFile });
      try {
        record("hang-stack", { pid: current.pid, ...await captureHangStack(outputFile) });
      } catch (error) {
        record("hang-stack", { pid: current.pid, error: error.message });
      }
      if (current !== child) return;
      // A blocked event loop cannot handle graceful shutdown. Only kill the
      // owned child, never unrelated Node or Chrome processes.
      current.kill("SIGKILL");
    }, intervalMs);
  }

  async function stop() {
    stopping = true;
    clearInterval(timer);
    clearTimeout(restartTimer);
    if (!child) return;
    const current = child;
    await new Promise(resolve => {
      const forceTimer = setTimeout(() => current.kill("SIGKILL"), 10_000);
      current.once("exit", () => { clearTimeout(forceTimer); resolve(); });
      current.kill("SIGTERM");
    });
    record("supervisor-stopped");
  }
  launch();
  return { stop, get pid() { return child?.pid; } };
}
