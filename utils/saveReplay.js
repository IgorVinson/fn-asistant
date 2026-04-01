import fsSync from "fs";

export function saveReplay(job, result) {
  try {
    fsSync.appendFileSync(
      "./jobs-replay.json",
      JSON.stringify({
        job,
        result,
        action: result.eligible
          ? "APPLY"
          : result.counterOffer
            ? "COUNTER"
            : "SKIP",
        ts: Date.now(),
      }) + "\n"
    );
  } catch (e) {
    console.error("Replay save error:", e);
  }
}
