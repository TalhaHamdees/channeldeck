/**
 * The honest record is made of days. Each day is one entry: not a diary of
 * events, but a reckoning — the obituary you would write for the last
 * twenty-four hours if you had to be truthful about them.
 */
export type Entry = {
  id: string;
  /** The calendar day being reckoned with, as `YYYY-MM-DD` (local time). */
  date: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** The one-line epitaph. "Here lies someone who…" */
  epitaph: string;
  /** The honest account of how the day was actually spent. */
  truth: string;
  /** What you flinched from. The thing you knew and avoided anyway. */
  avoided: string;
  /** A single intention carried into the day ahead. */
  intention: string;
  /**
   * How closely the day matched the person you mean to be, 1–5.
   * Not a mood score. A verdict.
   */
  alignment: number;
};

export type RecordState = {
  entries: Entry[];
  /** Year of birth, used only to render life in weeks. Stays on this device. */
  birthYear: number | null;
  /** Expected span in years for the memento-mori grid. */
  lifespanYears: number;
};

export const DEFAULT_LIFESPAN_YEARS = 80;

export type NewEntry = Omit<Entry, "id" | "createdAt" | "updatedAt">;
