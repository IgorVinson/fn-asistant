import fs from "node:fs";
import path from "node:path";
export function loadReplayEntries(repoRoot) {
    return fs
        .readFileSync(path.join(repoRoot, "jobs-replay.json"), "utf8")
        .trim()
        .split("\n")
        .map(line => JSON.parse(line));
}
export function findReplayEntry(entries, predicate) {
    const found = entries.find(predicate);
    if (!found) {
        throw new Error("Replay fixture not found");
    }
    return found;
}
