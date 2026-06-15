"use client";

import { useMemo, useState } from "react";
import { useRecord } from "@/lib/store";
import { parseKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKS_PER_YEAR = 52;

export function LifeInWeeks() {
  const { state, setBirthYear, setLifespanYears, ready } = useRecord();
  const [draftYear, setDraftYear] = useState("");
  // Capture "now" once on mount so render stays pure (no impure Date.now in body).
  const [now] = useState(() => Date.now());

  const recordedWeeks = useMemo(() => {
    if (!state.birthYear) return new Set<number>();
    const start = parseKey(`${state.birthYear}-01-01`).getTime();
    const set = new Set<number>();
    for (const e of state.entries) {
      const w = Math.floor((parseKey(e.date).getTime() - start) / 604_800_000);
      if (w >= 0) set.add(w);
    }
    return set;
  }, [state.birthYear, state.entries]);

  if (!ready) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  if (!state.birthYear) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6">
        <p className="font-serif text-base">
          Your life, drawn as one box per week.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the year you were born to see how many weeks you&rsquo;ve
          already spent — and roughly how many remain. It never leaves this
          device.
        </p>
        <form
          className="mt-4 flex max-w-xs items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const y = Number(draftYear);
            const now = new Date().getFullYear();
            if (y >= 1900 && y <= now) setBirthYear(y);
          }}
        >
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 1998"
            value={draftYear}
            onChange={(e) => setDraftYear(e.target.value)}
            min={1900}
            max={new Date().getFullYear()}
          />
          <Button type="submit" variant="accent">
            Draw it
          </Button>
        </form>
      </div>
    );
  }

  const totalWeeks = state.lifespanYears * WEEKS_PER_YEAR;
  const start = parseKey(`${state.birthYear}-01-01`).getTime();
  const livedWeeks = Math.max(
    0,
    Math.floor((now - start) / 604_800_000),
  );
  const remaining = Math.max(0, totalWeeks - livedWeeks);
  const pctLived = Math.min(100, Math.round((livedWeeks / totalWeeks) * 100));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span>
            <span className="font-serif text-xl tabular-nums">
              {livedWeeks.toLocaleString()}
            </span>{" "}
            <span className="text-muted-foreground">weeks lived</span>
          </span>
          <span>
            <span className="font-serif text-xl tabular-nums">
              {remaining.toLocaleString()}
            </span>{" "}
            <span className="text-muted-foreground">
              left, at {state.lifespanYears}
            </span>
          </span>
          <span>
            <span className="font-serif text-xl tabular-nums">{pctLived}%</span>{" "}
            <span className="text-muted-foreground">spent</span>
          </span>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setBirthYear(null)}
        >
          reset
        </button>
      </div>

      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS_PER_YEAR}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${livedWeeks} of about ${totalWeeks} weeks lived`}
      >
        {Array.from({ length: totalWeeks }).map((_, i) => {
          const lived = i < livedWeeks;
          const current = i === livedWeeks;
          const recorded = recordedWeeks.has(i);
          return (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-[1px]",
                current
                  ? "bg-accent ring-1 ring-accent"
                  : recorded
                    ? "bg-accent/70"
                    : lived
                      ? "bg-muted-foreground/40"
                      : "bg-border/50",
              )}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <Legend className="bg-muted-foreground/40" label="lived" />
        <Legend className="bg-accent/70" label="reckoned with" />
        <Legend className="bg-accent" label="this week" />
        <Legend className="bg-border/50" label="not yet" />
        <span className="ml-auto flex items-center gap-2">
          lifespan
          <select
            className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs"
            value={state.lifespanYears}
            onChange={(e) => setLifespanYears(Number(e.target.value))}
          >
            {[70, 75, 80, 85, 90].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[1px]", className)} />
      {label}
    </span>
  );
}
