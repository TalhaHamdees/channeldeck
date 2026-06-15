import {
  DEFAULT_LIFESPAN_YEARS,
  type Entry,
  type RecordState,
} from "./types";
import { formatLong } from "./date";

/**
 * Persistence lives entirely in the browser. There is no server, no account,
 * no feed. The record is yours, on your machine — which is rather the point.
 */
const STORAGE_KEY = "mori.record.v1";

export const EMPTY_STATE: RecordState = {
  entries: [],
  birthYear: null,
  lifespanYears: DEFAULT_LIFESPAN_YEARS,
};

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    typeof e.epitaph === "string" &&
    typeof e.truth === "string"
  );
}

/** Tolerant loader: never throws, fills gaps with sane defaults. */
export function loadState(): RecordState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<RecordState>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(isEntry).map(normalizeEntry)
      : [];
    return {
      entries,
      birthYear:
        typeof parsed.birthYear === "number" ? parsed.birthYear : null,
      lifespanYears:
        typeof parsed.lifespanYears === "number"
          ? parsed.lifespanYears
          : DEFAULT_LIFESPAN_YEARS,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function normalizeEntry(e: Entry): Entry {
  return {
    id: e.id,
    date: e.date,
    createdAt: e.createdAt ?? new Date().toISOString(),
    updatedAt: e.updatedAt ?? e.createdAt ?? new Date().toISOString(),
    epitaph: e.epitaph ?? "",
    truth: e.truth ?? "",
    avoided: e.avoided ?? "",
    intention: e.intention ?? "",
    alignment:
      typeof e.alignment === "number" ? clampAlignment(e.alignment) : 3,
  };
}

export function clampAlignment(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function saveState(state: RecordState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or blocked (private mode). Fail quietly; the
    // in-memory record still works for the session.
  }
}

/* ----------------------------- Export / import ---------------------------- */

export function toJSON(state: RecordState): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), ...state },
    null,
    2,
  );
}

const ALIGNMENT_WORDS = [
  "", // 0, unused
  "a stranger to myself",
  "mostly adrift",
  "somewhere in between",
  "close to true",
  "exactly who I mean to be",
];

export function alignmentWord(n: number): string {
  return ALIGNMENT_WORDS[clampAlignment(n)];
}

/** The record as a plain-text obituary collection — readable without the app. */
export function toMarkdown(state: RecordState): string {
  const sorted = [...state.entries].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const lines: string[] = [
    "# The honest record",
    "",
    `*${sorted.length} ${sorted.length === 1 ? "reckoning" : "reckonings"}, exported ${formatLong(
      new Date().toISOString().slice(0, 10),
    )}.*`,
    "",
  ];
  for (const e of sorted) {
    lines.push(`## ${formatLong(e.date)}`);
    lines.push("");
    if (e.epitaph) lines.push(`> Here lies someone who ${e.epitaph}`);
    lines.push("");
    if (e.truth) lines.push(e.truth);
    if (e.avoided) lines.push("", `**Avoided:** ${e.avoided}`);
    if (e.intention) lines.push("", `**Intention:** ${e.intention}`);
    lines.push("", `*Alignment: ${alignmentWord(e.alignment)}.*`, "", "---", "");
  }
  return lines.join("\n");
}

export function parseImport(raw: string): RecordState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RecordState>;
    if (!Array.isArray(parsed.entries)) return null;
    return {
      entries: parsed.entries.filter(isEntry).map(normalizeEntry),
      birthYear:
        typeof parsed.birthYear === "number" ? parsed.birthYear : null,
      lifespanYears:
        typeof parsed.lifespanYears === "number"
          ? parsed.lifespanYears
          : DEFAULT_LIFESPAN_YEARS,
    };
  } catch {
    return null;
  }
}

export function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
