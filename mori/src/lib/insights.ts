import { type Entry } from "./types";

const STOPWORDS = new Set(
  "a an and the to of in on at for with without i me my myself we our you your he she it they them this that these those is are was were be been being do did does done have has had having not no so but or if then than too very just only also about into out up down off over under again more most some any all can will would should could of as it's im i'm dont don't didnt didn't was were".split(
    /\s+/,
  ),
);

export type Insights = {
  total: number;
  avgAlignment: number;
  flinchRate: number; // share of days where something was avoided
  bestRun: number;
  topWords: { word: string; count: number }[];
  recent7Alignment: number | null;
  prior7Alignment: number | null;
};

export function computeInsights(entries: Entry[]): Insights {
  const total = entries.length;
  if (total === 0) {
    return {
      total: 0,
      avgAlignment: 0,
      flinchRate: 0,
      bestRun: 0,
      topWords: [],
      recent7Alignment: null,
      prior7Alignment: null,
    };
  }

  const avgAlignment =
    entries.reduce((s, e) => s + e.alignment, 0) / total;

  const flinched = entries.filter((e) => e.avoided.trim().length > 0).length;
  const flinchRate = flinched / total;

  const counts = new Map<string, number>();
  for (const e of entries) {
    const text = `${e.epitaph} ${e.truth} ${e.avoided}`.toLowerCase();
    const words = text.match(/[a-z][a-z'']+/g) ?? [];
    for (const w of words) {
      if (w.length < 4 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const topWords = [...counts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  // Sort newest first for the trend windows.
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const recent7 = sorted.slice(0, 7);
  const prior7 = sorted.slice(7, 14);
  const avg = (arr: Entry[]) =>
    arr.length ? arr.reduce((s, e) => s + e.alignment, 0) / arr.length : null;

  return {
    total,
    avgAlignment,
    flinchRate,
    bestRun: 0, // filled by caller from streaks
    topWords,
    recent7Alignment: avg(recent7),
    prior7Alignment: avg(prior7),
  };
}
