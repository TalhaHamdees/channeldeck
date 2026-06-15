"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useRecord } from "@/lib/store";
import { clampAlignment, alignmentWord } from "@/lib/storage";
import { epitaphPlaceholder } from "@/lib/prompts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

function AlignmentPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`Alignment ${n} of 5`}
            aria-pressed={value === n}
            className={cn(
              "size-7 rounded-full border text-xs transition-colors",
              value >= n
                ? "border-accent bg-accent/80 text-accent-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-accent/50",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        How close to true: <span className="italic">{alignmentWord(value)}</span>
      </p>
    </div>
  );
}

export function ReckoningEditor({ dateKey }: { dateKey: string }) {
  const { byDate, saveEntry, deleteEntry, ready } = useRecord();
  const existing = byDate.get(dateKey) ?? null;

  const [epitaph, setEpitaph] = useState("");
  const [truth, setTruth] = useState("");
  const [avoided, setAvoided] = useState("");
  const [intention, setIntention] = useState("");
  const [alignment, setAlignment] = useState(3);
  const [justSaved, setJustSaved] = useState(false);

  // Load the existing entry once the store is ready (or when the day changes).
  useEffect(() => {
    if (!ready) return;
    setEpitaph(existing?.epitaph ?? "");
    setTruth(existing?.truth ?? "");
    setAvoided(existing?.avoided ?? "");
    setIntention(existing?.intention ?? "");
    setAlignment(existing?.alignment ?? 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dateKey, existing?.id]);

  const dirty = useMemo(() => {
    return (
      epitaph !== (existing?.epitaph ?? "") ||
      truth !== (existing?.truth ?? "") ||
      avoided !== (existing?.avoided ?? "") ||
      intention !== (existing?.intention ?? "") ||
      alignment !== (existing?.alignment ?? 3)
    );
  }, [epitaph, truth, avoided, intention, alignment, existing]);

  const canSave = (epitaph.trim() || truth.trim()) && dirty;

  function handleSave() {
    if (!canSave) return;
    saveEntry({
      date: dateKey,
      epitaph: epitaph.trim(),
      truth: truth.trim(),
      avoided: avoided.trim(),
      intention: intention.trim(),
      alignment: clampAlignment(alignment),
    });
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2200);
  }

  function handleDelete() {
    if (!existing) return;
    if (
      !window.confirm(
        "Strike this day from the record? An honest record is allowed to lose a page, but not to lie.",
      )
    )
      return;
    deleteEntry(existing.id);
  }

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          The epitaph
        </label>
        <div className="flex flex-col gap-1.5 rounded-md border border-input bg-background p-3">
          <span className="font-serif text-sm text-muted-foreground">
            Here lies someone who…
          </span>
          <Input
            value={epitaph}
            onChange={(e) => setEpitaph(e.target.value)}
            placeholder={epitaphPlaceholder(dateKey)}
            className="border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 font-serif"
            maxLength={160}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          The truth of it
        </label>
        <Textarea
          value={truth}
          onChange={(e) => setTruth(e.target.value)}
          placeholder="How was the day actually spent? Not the version for other people — the real one."
          className="min-h-36"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What you flinched from
          </label>
          <Textarea
            value={avoided}
            onChange={(e) => setAvoided(e.target.value)}
            placeholder="The thing you knew, and avoided anyway."
            className="min-h-24"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            One intention for today
          </label>
          <Textarea
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="A single, honest thing to carry into the next 24 hours."
            className="min-h-24"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          The verdict
        </label>
        <AlignmentPicker value={alignment} onChange={setAlignment} />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={!canSave} variant="accent">
          {justSaved ? (
            <>
              <Check className="size-4" /> Recorded
            </>
          ) : existing ? (
            "Update the record"
          ) : (
            "Seal today"
          )}
        </Button>
        {existing && (
          <>
            <span className="text-xs text-muted-foreground">
              {dirty ? "Unsaved changes" : "Saved"}
            </span>
            <Button
              onClick={handleDelete}
              variant="destructive"
              size="sm"
              className="ml-auto"
            >
              <Trash2 className="size-4" /> Strike
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
