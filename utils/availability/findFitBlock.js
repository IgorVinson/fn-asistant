export function findFitBlock(availableBlocks, woTimeWindow, travelMinutes = 0) {
  if (!availableBlocks || availableBlocks.length === 0) {
    return { fits: false, block: null };
  }

  const { earliestStart, latestStart, durationMs } = woTimeWindow;
  const travelMs = travelMinutes * 60 * 1000;

  const blocksByDate = groupBlocksByDate(availableBlocks);

  for (const block of availableBlocks) {
    const blockDate = toDateString(block.start);
    const daysBlocks = blocksByDate.get(blockDate);
    const isLastBlockOfDay = daysBlocks && daysBlocks[daysBlocks.length - 1] === block;

    const effectiveDurationMs = durationMs + travelMs + (isLastBlockOfDay ? 0 : travelMs);

    const candidateStart = new Date(Math.max(earliestStart.getTime(), block.start.getTime()));
    const candidateEnd = new Date(candidateStart.getTime() + effectiveDurationMs);

    const fitsInBlock = candidateStart >= block.start && candidateEnd <= block.end;
    const withinLatestStart = candidateStart.getTime() <= latestStart.getTime();

    if (fitsInBlock && withinLatestStart) {
      return { fits: true, block };
    }
  }

  return { fits: false, block: null };
}

function groupBlocksByDate(blocks) {
  const map = new Map();
  for (const block of blocks) {
    const key = toDateString(block.start);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(block);
  }
  return map;
}

function toDateString(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}