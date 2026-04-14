import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeJob } from "./app/executeJob.js";
import { importLiveFieldNationJob } from "./app/importLiveFieldNationJob.js";
import { importLiveWorkMarketJob } from "./app/importLiveWorkMarketJob.js";
import { inspectJob } from "./app/inspectJob.js";
import { previewExecution } from "./app/previewExecution.js";
import { createRuntime } from "./app/runtime.js";
import { runGraniteReplaySuite, runReplayJob, runReplaySeed } from "./app/runReplay.js";
import { openDatabase } from "./storage/database.js";
async function main() {
    const runtime = createRuntime();
    const command = process.argv[2];
    if (command === "replay-seed") {
        const platformArg = process.argv[3];
        const platform = platformArg === "fieldnation" ? "FieldNation" : "WorkMarket";
        const db = openDatabase(runtime.dbPath);
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const repoRoot = path.resolve(__dirname, "../..");
        try {
            await runReplaySeed(db, repoRoot, runtime.calendarProvider, platform);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "replay-granite") {
        const db = openDatabase(runtime.dbPath);
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const repoRoot = path.resolve(__dirname, "../..");
        try {
            await runGraniteReplaySuite(db, repoRoot, runtime.calendarProvider);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "replay-job") {
        const replayJobId = process.argv[3];
        if (!replayJobId) {
            throw new Error("Usage: replay-job <replay-job-id>");
        }
        const db = openDatabase(runtime.dbPath);
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const repoRoot = path.resolve(__dirname, "../..");
        try {
            await runReplayJob(db, repoRoot, runtime.calendarProvider, replayJobId);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "inspect-job") {
        const jobId = process.argv[3];
        if (!jobId) {
            throw new Error("Usage: inspect-job <job-id>");
        }
        const db = openDatabase(runtime.dbPath);
        try {
            inspectJob(db, jobId);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "import-wm") {
        const orderIdOrUrl = process.argv[3];
        if (!orderIdOrUrl) {
            throw new Error("Usage: import-wm <workmarket-order-id-or-url>");
        }
        const db = openDatabase(runtime.dbPath);
        try {
            await importLiveWorkMarketJob(db, runtime.calendarProvider, orderIdOrUrl);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "import-fn") {
        const orderIdOrUrl = process.argv[3];
        if (!orderIdOrUrl) {
            throw new Error("Usage: import-fn <fieldnation-order-id-or-url>");
        }
        const db = openDatabase(runtime.dbPath);
        try {
            await importLiveFieldNationJob(db, runtime.calendarProvider, orderIdOrUrl);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "preview-execution") {
        const jobId = process.argv[3];
        if (!jobId) {
            throw new Error("Usage: preview-execution <job-id>");
        }
        const db = openDatabase(runtime.dbPath);
        try {
            previewExecution(db, jobId);
        }
        finally {
            db.close();
        }
        return;
    }
    if (command === "execute-job") {
        const jobId = process.argv[3];
        const live = process.argv.includes("--live");
        if (!jobId) {
            throw new Error("Usage: execute-job <job-id> [--live]");
        }
        const db = openDatabase(runtime.dbPath);
        const dryRun = runtime.policy.testMode || !live;
        try {
            await executeJob(db, jobId, { dryRun });
        }
        finally {
            db.close();
        }
        return;
    }
    console.log("FieldOps v2 scaffold ready");
    console.log(`DB: ${runtime.dbPath}`);
    console.log(`Mode: ${runtime.policy.testMode ? "TEST" : "LIVE"}, Granite only: ${runtime.policy.graniteOnly}`);
    console.log(`Calendar provider: ${runtime.calendarProvider.name}`);
    console.log("Commands: replay-seed [fieldnation], replay-job <replay-job-id>, replay-granite, import-wm <order-id-or-url>, import-fn <order-id-or-url>, inspect-job <job-id>, preview-execution <job-id>, execute-job <job-id>");
}
main().catch(error => {
    console.error("Fatal startup error", error);
    process.exit(1);
});
