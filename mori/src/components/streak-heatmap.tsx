"use client";

import { useMemo } from "react";
import { useRecord } from "@/lib/store";
import { heatmapWeeks, formatShort, todayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function StreakHeatmap({ weeks = 26 }: { weeks?: number }) {
  const { byDate, ready } = useRecord();
  const columns = useMemo(() => heatmapWeeks(weeks), [weeks]);
  const today = todayKey();

  if (!ready) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="flex flex-col justify-between gap-[3px] pr-1 pt-[2px] text-[10px] leading-none text-muted-foreground">
        {DAY_LABELS.map((l, i) => (
          <span key={i} className="h-3">
            {l}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((key) => {
              const entry = byDate.get(key);
              const future = key > today;
              return (
                <span
                  key={key}
                  title={
                    future
                      ? undefined
                      : `${formatShort(key)}${entry ? " — reckoned" : " — silent"}`
                  }
                  className={cn(
                    "size-3 rounded-[2px]",
                    future
                      ? "bg-transparent"
                      : entry
                        ? alignmentClass(entry.alignment)
                        : "bg-muted",
                    key === today && "ring-1 ring-foreground/40",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function alignmentClass(alignment: number): string {
  // Recorded days glow; the closer to true, the brighter.
  if (alignment >= 5) return "bg-accent";
  if (alignment >= 4) return "bg-accent/80";
  if (alignment >= 3) return "bg-accent/60";
  if (alignment >= 2) return "bg-accent/40";
  return "bg-accent/25";
}
