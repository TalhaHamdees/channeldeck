"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Entry, type NewEntry, type RecordState } from "./types";
import {
  EMPTY_STATE,
  loadState,
  makeId,
  saveState,
} from "./storage";
import { computeStreaks, todayKey, type Streaks } from "./date";

type RecordContextValue = {
  /** True once we've read localStorage on the client. Render skeletons until then. */
  ready: boolean;
  state: RecordState;
  entries: Entry[];
  byDate: Map<string, Entry>;
  today: Entry | null;
  streaks: Streaks;
  saveEntry: (input: NewEntry) => void;
  deleteEntry: (id: string) => void;
  setBirthYear: (year: number | null) => void;
  setLifespanYears: (years: number) => void;
  replaceState: (next: RecordState) => void;
};

const RecordContext = createContext<RecordContextValue | null>(null);

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecordState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  // Avoid writing back the empty placeholder before the first read completes.
  const hydrated = useRef(false);

  // Read the persisted record once, on mount. localStorage isn't available
  // during SSR, so this deliberate post-hydration sync is the correct place —
  // hence the disable of set-state-in-effect for these two intentional calls.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setReady(true);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) saveState(state);
  }, [state]);

  const saveEntry = useCallback((input: NewEntry) => {
    setState((prev) => {
      const now = new Date().toISOString();
      const existing = prev.entries.find((e) => e.date === input.date);
      let entries: Entry[];
      if (existing) {
        entries = prev.entries.map((e) =>
          e.date === input.date ? { ...e, ...input, updatedAt: now } : e,
        );
      } else {
        const entry: Entry = {
          ...input,
          id: makeId(),
          createdAt: now,
          updatedAt: now,
        };
        entries = [...prev.entries, entry];
      }
      return { ...prev, entries };
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  }, []);

  const setBirthYear = useCallback((year: number | null) => {
    setState((prev) => ({ ...prev, birthYear: year }));
  }, []);

  const setLifespanYears = useCallback((years: number) => {
    setState((prev) => ({ ...prev, lifespanYears: years }));
  }, []);

  const replaceState = useCallback((next: RecordState) => {
    setState(next);
  }, []);

  const entries = useMemo(
    () => [...state.entries].sort((a, b) => b.date.localeCompare(a.date)),
    [state.entries],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of state.entries) m.set(e.date, e);
    return m;
  }, [state.entries]);

  const streaks = useMemo(
    () => computeStreaks(state.entries.map((e) => e.date)),
    [state.entries],
  );

  const today = byDate.get(todayKey()) ?? null;

  const value: RecordContextValue = {
    ready,
    state,
    entries,
    byDate,
    today,
    streaks,
    saveEntry,
    deleteEntry,
    setBirthYear,
    setLifespanYears,
    replaceState,
  };

  return (
    <RecordContext.Provider value={value}>{children}</RecordContext.Provider>
  );
}

export function useRecord(): RecordContextValue {
  const ctx = useContext(RecordContext);
  if (!ctx) throw new Error("useRecord must be used within a RecordProvider");
  return ctx;
}
