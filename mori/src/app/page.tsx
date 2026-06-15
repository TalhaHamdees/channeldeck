"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { useRecord } from "@/lib/store";
import { formatLong, todayKey } from "@/lib/date";
import { promptForDay } from "@/lib/prompts";
import { ReckoningEditor } from "@/components/reckoning-editor";
import { Stat } from "@/components/stat";
import { Card, CardContent } from "@/components/ui/card";

export default function TodayPage() {
  const { streaks, entries, today, ready } = useRecord();
  const key = todayKey();
  const prompt = promptForDay(key);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {formatLong(key)}
        </p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          This morning, write the obituary of yesterday.
        </h1>
        <p className="max-w-2xl text-balance text-muted-foreground">
          Not the polished version. The honest one — based on how you actually
          lived the last twenty-four hours.
        </p>
      </header>

      <Card className="mt-8 border-accent/30 bg-accent/5">
        <CardContent className="flex items-start gap-3 p-5">
          <span
            aria-hidden
            className="mt-0.5 select-none font-serif text-2xl leading-none text-accent"
          >
            ❝
          </span>
          <p className="font-serif text-lg leading-snug">{prompt}</p>
        </CardContent>
      </Card>

      <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border bg-card px-6 py-5">
        <div className="flex items-center gap-2">
          <Flame
            className={
              ready && streaks.current > 0
                ? "size-5 text-accent"
                : "size-5 text-muted-foreground"
            }
          />
          <Stat
            value={ready ? streaks.current : "—"}
            label="day streak"
            hint="relentlessness"
          />
        </div>
        <Stat
          value={ready ? streaks.longest : "—"}
          label="longest run"
        />
        <Stat
          value={ready ? entries.length : "—"}
          label="days reckoned"
        />
        <Link
          href="/record"
          className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Read the record →
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="sr-only">Today&rsquo;s reckoning</h2>
        <ReckoningEditor dateKey={key} />
      </section>

      {ready && !today && entries.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Nothing is recorded yet. The first one is the hardest — it is also the
          only one you can write right now.
        </p>
      )}
    </div>
  );
}
