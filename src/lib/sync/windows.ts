// Pure date-window planning for the sync engine (no I/O, so it is unit-testable).
//
// Every date is a calendar day in YYYY-MM-DD form, computed in UTC. The nightly
// cron runs at 09:00 UTC, when the UTC date and the America/Los_Angeles date
// (the day YouTube Analytics reports in) are the same calendar day.

export const BACKFILL_DAYS = 365;
export const CHUNK_DAYS = 90;
/** Re-pull window so lagging revenue self-corrects. */
export const DAILY_OVERLAP_DAYS = 5;
/** Traffic-source reports are fetched in slices of at most this many days. */
export const TRAFFIC_SLICE_DAYS = 31;

/** An inclusive range of calendar days. */
export interface DateWindow {
  dateFrom: string;
  dateTo: string;
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The UTC calendar day `n` days before `now`. */
export function daysAgo(n: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - n);
  return toDateStr(d);
}

/**
 * Backfill chunks for a newly connected channel, newest first: 90-day chunks
 * walking back from today, the last one clipped so the oldest day is exactly
 * BACKFILL_DAYS before today.
 */
export function planBackfillChunks(now: Date = new Date()): DateWindow[] {
  const chunks: DateWindow[] = [];
  for (let offset = 0; offset < BACKFILL_DAYS; offset += CHUNK_DAYS) {
    chunks.push({
      dateFrom: daysAgo(Math.min(offset + CHUNK_DAYS - 1, BACKFILL_DAYS), now),
      dateTo: daysAgo(offset, now),
    });
  }
  return chunks;
}

/** The window each nightly "daily" job re-pulls: DAILY_OVERLAP_DAYS ago through today. */
export function dailyWindow(now: Date = new Date()): DateWindow {
  return {
    dateFrom: daysAgo(DAILY_OVERLAP_DAYS, now),
    dateTo: daysAgo(0, now),
  };
}

/** Split [from, to] into consecutive slices of at most TRAFFIC_SLICE_DAYS days. */
export function trafficSlices(from: string, to: string): DateWindow[] {
  const slices: DateWindow[] = [];
  let sliceStart = new Date(`${from}T00:00:00Z`);
  const rangeEnd = new Date(`${to}T00:00:00Z`);
  while (sliceStart <= rangeEnd) {
    const sliceEnd = new Date(sliceStart);
    sliceEnd.setUTCDate(sliceEnd.getUTCDate() + TRAFFIC_SLICE_DAYS - 1);
    slices.push({
      dateFrom: toDateStr(sliceStart),
      dateTo: toDateStr(sliceEnd > rangeEnd ? rangeEnd : sliceEnd),
    });
    sliceStart = new Date(sliceEnd);
    sliceStart.setUTCDate(sliceStart.getUTCDate() + 1);
  }
  return slices;
}
