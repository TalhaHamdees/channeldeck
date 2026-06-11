import type { DateRange } from "./queries";

export const RANGE_PRESETS = [7, 28, 90, 365] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve ?range= search param (7/28/90/365, default 28) into concrete dates.
 * Ends yesterday — today's data is always partial.
 */
export function resolveRange(rangeParam?: string): {
  range: DateRange;
  previous: DateRange;
  days: RangePreset;
} {
  const days = (RANGE_PRESETS as readonly number[]).includes(Number(rangeParam))
    ? (Number(rangeParam) as RangePreset)
    : 28;

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));

  return {
    days,
    range: { from: toDateStr(start), to: toDateStr(end) },
    previous: { from: toDateStr(prevStart), to: toDateStr(prevEnd) },
  };
}
