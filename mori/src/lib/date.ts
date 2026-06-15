/**
 * Date helpers. Everything is keyed to the user's *local* day — a reckoning
 * belongs to the day you lived, not to a UTC timestamp. Keys are `YYYY-MM-DD`.
 */

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** Parse a `YYYY-MM-DD` key into a local Date at midnight. */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from `a` to `b` (b - a), ignoring time-of-day. */
export function daysBetween(aKey: string, bKey: string): number {
  const a = parseKey(aKey).getTime();
  const b = parseKey(bKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function formatLong(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShort(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "today", "yesterday", "3 days ago", "last week", … */
export function formatRelative(key: string, fromKey = todayKey()): string {
  const diff = daysBetween(key, fromKey);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return "last week";
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  if (diff < 60) return "last month";
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`;
  if (diff < 730) return "last year";
  return `${Math.floor(diff / 365)} years ago`;
}

export type Streaks = {
  current: number;
  longest: number;
};

/**
 * A streak is consecutive days reckoned with, counted backward from today.
 * If today has no entry yet, yesterday still keeps the streak alive — the
 * morning obituary is written about the day before. Miss two days and it
 * breaks; the point is relentlessness, not perfectionism.
 */
export function computeStreaks(dateKeys: string[]): Streaks {
  if (dateKeys.length === 0) return { current: 0, longest: 0 };

  const unique = Array.from(new Set(dateKeys)).sort();

  // Longest run of consecutive days anywhere in the record.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (daysBetween(unique[i - 1], unique[i]) === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current run, anchored to today or yesterday.
  const today = todayKey();
  const last = unique[unique.length - 1];
  const gapToToday = daysBetween(last, today);
  let current = 0;
  if (gapToToday <= 1) {
    current = 1;
    for (let i = unique.length - 1; i > 0; i--) {
      if (daysBetween(unique[i - 1], unique[i]) === 1) current += 1;
      else break;
    }
  }

  return { current, longest };
}

/**
 * Build a grid of the last `weeks` weeks (columns), each column a Sun→Sat
 * run of day keys, for a contribution-style heatmap. The final column ends
 * on today.
 */
export function heatmapWeeks(weeks = 26): string[][] {
  const today = parseKey(todayKey());
  // Walk back to the most recent Sunday so columns align to weeks.
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // Saturday of this week
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const columns: string[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) {
      col.push(dateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
  }
  return columns;
}
