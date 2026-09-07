export function createLogThrottle(intervalMs, now = () => Date.now()) {
  let lastLogAt = Number.NEGATIVE_INFINITY;

  return () => {
    const currentTime = now();
    if (currentTime - lastLogAt < intervalMs) return false;

    lastLogAt = currentTime;
    return true;
  };
}
