import { afterEach, describe, expect, it } from "vitest";
import {
  BACKFILL_DAYS,
  CHUNK_DAYS,
  TRAFFIC_SLICE_DAYS,
  dailyWindow,
  daysAgo,
  planBackfillChunks,
  trafficSlices,
  type DateWindow,
} from "../windows";
import { eachDay } from "./helpers/days";

// vercel.json schedules the sync cron at "0 9 * * *" (09:00 UTC).
const CRON_TICK = new Date("2026-11-24T09:00:00Z");

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
/** Inclusive length of a window, in calendar days. */
const lengthInDays = (w: DateWindow) => dayNumber(w.dateTo) - dayNumber(w.dateFrom) + 1;
const daysCovered = (windows: DateWindow[]) =>
  windows.flatMap((w) => eachDay(w.dateFrom, w.dateTo));

describe("planBackfillChunks", () => {
  const chunks = planBackfillChunks(CRON_TICK);

  it("plans 90-day chunks newest first, clipping the last one", () => {
    expect(chunks).toEqual([
      { dateFrom: "2026-08-27", dateTo: "2026-11-24" },
      { dateFrom: "2026-05-29", dateTo: "2026-08-26" },
      { dateFrom: "2026-02-28", dateTo: "2026-05-28" },
      { dateFrom: "2025-11-30", dateTo: "2026-02-27" },
      { dateFrom: "2025-11-24", dateTo: "2025-11-29" },
    ]);
    expect(chunks.map(lengthInDays)).toEqual([90, 90, 90, 90, 6]);
  });

  it("runs from today back to exactly 365 days ago", () => {
    expect(chunks[0].dateTo).toBe("2026-11-24");
    expect(chunks.at(-1)!.dateFrom).toBe("2025-11-24");
    expect(dayNumber(chunks[0].dateTo) - dayNumber(chunks.at(-1)!.dateFrom)).toBe(
      BACKFILL_DAYS
    );
  });

  it("covers every day of that span exactly once", () => {
    for (let i = 1; i < chunks.length; i++) {
      // Each older chunk ends the day before the newer one starts.
      expect(dayNumber(chunks[i].dateTo)).toBe(dayNumber(chunks[i - 1].dateFrom) - 1);
    }
    const covered = daysCovered(chunks);
    expect(new Set(covered).size).toBe(covered.length); // no overlaps
    expect(covered.sort()).toEqual(eachDay("2025-11-24", "2026-11-24")); // no gaps
  });

  it("holds for every start day across two years, leap day included", () => {
    for (const day of eachDay("2027-01-01", "2028-12-31")) {
      const now = new Date(`${day}T09:00:00Z`);
      const plan = planBackfillChunks(now);
      const covered = daysCovered(plan);

      expect(plan.every((c) => lengthInDays(c) >= 1 && lengthInDays(c) <= CHUNK_DAYS)).toBe(
        true
      );
      expect(new Set(covered).size).toBe(covered.length);
      expect(covered.length).toBe(BACKFILL_DAYS + 1);
      expect(plan[0].dateTo).toBe(day);
      expect(plan.at(-1)!.dateFrom).toBe(daysAgo(BACKFILL_DAYS, now));
    }
  });

  it("counts 365 days, not a calendar year, across a leap day", () => {
    // 2028-02-29 falls inside the window, so it starts on 2 March, not 1 March.
    const plan = planBackfillChunks(new Date("2028-03-01T09:00:00Z"));
    expect(plan.at(-1)!.dateFrom).toBe("2027-03-02");
  });
});

describe("dailyWindow (the nightly re-pull)", () => {
  it("re-pulls the five previous days plus today", () => {
    expect(dailyWindow(CRON_TICK)).toEqual({
      dateFrom: "2026-11-19",
      dateTo: "2026-11-24",
    });
    expect(lengthInDays(dailyWindow(CRON_TICK))).toBe(6);
  });

  it("overlaps the newest backfill chunk, so the first nightly run re-checks it", () => {
    const window = dailyWindow(CRON_TICK);
    const newestChunk = planBackfillChunks(CRON_TICK)[0];
    expect(window.dateFrom >= newestChunk.dateFrom).toBe(true);
    expect(window.dateTo).toBe(newestChunk.dateTo);
  });

  it("crosses month and year boundaries", () => {
    expect(dailyWindow(new Date("2027-01-02T09:00:00Z"))).toEqual({
      dateFrom: "2026-12-28",
      dateTo: "2027-01-02",
    });
    expect(dailyWindow(new Date("2028-03-03T09:00:00Z"))).toEqual({
      dateFrom: "2028-02-27",
      dateTo: "2028-03-03",
    });
  });

  it("uses the UTC calendar day, rolling over at UTC midnight", () => {
    // 23:59 UTC: already the 25th in Pakistan, still the 24th in UTC.
    expect(dailyWindow(new Date("2026-11-24T23:59:59Z")).dateTo).toBe("2026-11-24");
    // 00:00 UTC: still the 24th in California, already the 25th in UTC.
    expect(dailyWindow(new Date("2026-11-25T00:00:00Z")).dateTo).toBe("2026-11-25");
  });

  describe("does not depend on the server's local time zone", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    // 23:30 UTC on the 24th is a different local calendar day in some of these zones.
    const lateEvening = new Date("2026-11-24T23:30:00Z");

    it.each([
      ["UTC", 24],
      ["America/Los_Angeles", 24],
      ["Asia/Karachi", 25],
      ["Pacific/Kiritimati", 25],
    ])("same dates when the server runs in %s", (tz, localDayOfMonth) => {
      process.env.TZ = tz;
      expect(lateEvening.getDate()).toBe(localDayOfMonth); // the zone really applies

      expect(dailyWindow(lateEvening)).toEqual({
        dateFrom: "2026-11-19",
        dateTo: "2026-11-24",
      });
      expect(planBackfillChunks(lateEvening)[0]).toEqual({
        dateFrom: "2026-08-27",
        dateTo: "2026-11-24",
      });
    });
  });
});

describe("trafficSlices", () => {
  it("splits a 90-day backfill chunk into 31-day slices", () => {
    const slices = trafficSlices("2026-08-27", "2026-11-24");
    expect(slices).toEqual([
      { dateFrom: "2026-08-27", dateTo: "2026-09-26" },
      { dateFrom: "2026-09-27", dateTo: "2026-10-27" },
      { dateFrom: "2026-10-28", dateTo: "2026-11-24" },
    ]);
    expect(daysCovered(slices)).toEqual(eachDay("2026-08-27", "2026-11-24"));
  });

  it.each([
    ["a single day", "2026-11-24", "2026-11-24", [1]],
    ["the 6-day nightly window", "2026-11-19", "2026-11-24", [6]],
    ["exactly 31 days", "2026-01-01", "2026-01-31", [31]],
    ["32 days", "2026-01-01", "2026-02-01", [31, 1]],
  ])("handles %s", (_label, from, to, lengths) => {
    const slices = trafficSlices(from, to);
    expect(slices.map(lengthInDays)).toEqual(lengths);
    expect(slices.every((s) => lengthInDays(s) <= TRAFFIC_SLICE_DAYS)).toBe(true);
    expect(daysCovered(slices)).toEqual(eachDay(from, to));
  });

  it("returns nothing for an inverted range", () => {
    expect(trafficSlices("2026-11-24", "2026-11-23")).toEqual([]);
  });
});
