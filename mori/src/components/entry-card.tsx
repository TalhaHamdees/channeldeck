"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { type Entry } from "@/lib/types";
import { formatLong, formatRelative } from "@/lib/date";
import { alignmentWord } from "@/lib/storage";
import { ReckoningEditor } from "@/components/reckoning-editor";
import { cn } from "@/lib/utils";

function AlignmentMarks({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            value >= n ? "bg-accent" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

export function EntryCard({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="relative pl-6">
      {/* timeline node + rail */}
      <span
        aria-hidden
        className="absolute left-0 top-2 size-2.5 -translate-x-1/2 rounded-full border border-accent bg-background"
      />
      <span
        aria-hidden
        className="absolute left-0 top-2 h-full w-px -translate-x-1/2 bg-border"
      />

      <div className="rounded-lg border border-border bg-card p-5">
        <header className="flex items-baseline justify-between gap-3">
          <div className="flex flex-col">
            <time
              dateTime={entry.date}
              className="text-sm font-medium"
              suppressHydrationWarning
            >
              {formatLong(entry.date)}
            </time>
            <span
              className="text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              {formatRelative(entry.date)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {editing ? (
              <>
                <X className="size-3.5" /> Close
              </>
            ) : (
              <>
                <Pencil className="size-3.5" /> Edit
              </>
            )}
          </button>
        </header>

        {editing ? (
          <div className="mt-5 border-t border-border pt-5">
            <ReckoningEditor dateKey={entry.date} />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {entry.epitaph && (
              <p className="font-serif text-lg leading-snug">
                <span className="text-muted-foreground">
                  Here lies someone who{" "}
                </span>
                {entry.epitaph}
              </p>
            )}
            {entry.truth && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {entry.truth}
              </p>
            )}
            {entry.avoided && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  Flinched from:{" "}
                </span>
                {entry.avoided}
              </p>
            )}
            {entry.intention && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  Carried forward:{" "}
                </span>
                {entry.intention}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <AlignmentMarks value={entry.alignment} />
              <span className="text-xs italic text-muted-foreground">
                {alignmentWord(entry.alignment)}
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
