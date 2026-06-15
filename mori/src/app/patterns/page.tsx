"use client";

import { useMemo } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useRecord } from "@/lib/store";
import { computeInsights } from "@/lib/insights";
import { alignmentWord } from "@/lib/storage";
import { StreakHeatmap } from "@/components/streak-heatmap";
import { LifeInWeeks } from "@/components/life-in-weeks";
import { Stat } from "@/components/stat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function PatternsPage() {
  const { entries, streaks, ready } = useRecord();
  const insights = useMemo(() => computeInsights(entries), [entries]);

  const trend =
    insights.recent7Alignment != null && insights.prior7Alignment != null
      ? insights.recent7Alignment - insights.prior7Alignment
      : null;

  if (ready && entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-serif text-3xl tracking-tight">Patterns</h1>
        <div className="mt-10 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="font-serif text-lg">No patterns yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Patterns are what a record reveals that a single day can&rsquo;t.
            Reckon with a few days first.
          </p>
          <Link
            href="/"
            className={buttonVariants({ variant: "accent", className: "mt-6" })}
          >
            Begin today
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header className="space-y-1.5">
        <h1 className="font-serif text-3xl tracking-tight">Patterns</h1>
        <p className="text-sm text-muted-foreground">
          The feedback loop. What the record says about you when you stop
          performing.
        </p>
      </header>

      {/* headline numbers */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Stat
              value={ready ? insights.total : "—"}
              label="days reckoned"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Stat
              value={ready ? streaks.current : "—"}
              label="current streak"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Stat
              value={ready ? insights.avgAlignment.toFixed(1) : "—"}
              label="avg alignment"
              hint={ready ? alignmentWord(insights.avgAlignment) : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Stat
              value={ready ? `${Math.round(insights.flinchRate * 100)}%` : "—"}
              label="days you flinched"
            />
          </CardContent>
        </Card>
      </div>

      {/* alignment trend */}
      {ready && trend != null && (
        <Card className="mt-4">
          <CardContent className="flex items-center gap-3 p-5">
            {trend > 0.15 ? (
              <TrendingUp className="size-5 text-accent" />
            ) : trend < -0.15 ? (
              <TrendingDown className="size-5 text-destructive" />
            ) : (
              <Minus className="size-5 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              The last seven days are{" "}
              <span className="font-medium text-foreground">
                {trend > 0.15
                  ? "truer"
                  : trend < -0.15
                    ? "drifting further from true"
                    : "holding steady"}
              </span>{" "}
              than the seven before. The point isn&rsquo;t the number — it&rsquo;s
              that you can&rsquo;t look away from it.
            </p>
          </CardContent>
        </Card>
      )}

      {/* heatmap */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Relentlessness</CardTitle>
          <CardDescription>
            Every day, recorded or silent. Brighter where the day was closer to
            true.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StreakHeatmap />
          <p className="mt-4 text-xs text-muted-foreground">
            Longest run: {ready ? streaks.longest : "—"} consecutive days.
          </p>
        </CardContent>
      </Card>

      {/* recurring words */}
      {ready && insights.topWords.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>What keeps coming up</CardTitle>
            <CardDescription>
              The words you reach for most. Themes you didn&rsquo;t choose, only
              noticed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {insights.topWords.map(({ word, count }) => (
                <span
                  key={word}
                  className="rounded-full border border-border px-3 py-1 text-sm"
                  style={{ opacity: 0.55 + Math.min(0.45, count * 0.08) }}
                >
                  {word}
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* life in weeks */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Memento mori</CardTitle>
          <CardDescription>
            The reason for all of this. One box per week of a life.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LifeInWeeks />
        </CardContent>
      </Card>
    </div>
  );
}
