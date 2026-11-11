import { openSync, readSync, closeSync } from "node:fs";

// The inspector remains on a random loopback port. Never evaluate code or
// capture variables; collect only source locations before terminating a hang.
export async function captureHangStack(outputFile, timeoutMs = 3_000) {
  const descriptor = openSync(outputFile, "r");
  const buffer = Buffer.alloc(8192);
  let length;
  try { length = readSync(descriptor, buffer, 0, buffer.length, 0); }
  finally { closeSync(descriptor); }
  const address = buffer.toString("utf8", 0, length).match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1];
  if (!address) return { error: "Inspector address unavailable" };
  return new Promise(resolve => {
    const socket = new WebSocket(address);
    const scripts = new Map();
    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ error: "Inspector did not respond before timeout" }), timeoutMs);
    socket.addEventListener("error", () => finish({ error: "Inspector connection failed" }));
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method: "Debugger.enable" })));
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.method === "Debugger.scriptParsed") scripts.set(message.params.scriptId, message.params.url);
      if (message.id === 1) socket.send(JSON.stringify({ id: 2, method: "Debugger.pause" }));
      if (message.method === "Debugger.paused") {
        finish({ frames: message.params.callFrames.map(frame => ({
          functionName: frame.functionName, url: frame.url || scripts.get(frame.location.scriptId),
          scriptId: frame.location.scriptId,
          line: frame.location.lineNumber + 1,
        })) });
      }
    });
  });
}
