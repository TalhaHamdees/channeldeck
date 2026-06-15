"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useRecord } from "@/lib/store";
import { EntryCard } from "@/components/entry-card";
import { DataTools } from "@/components/data-tools";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";

export default function RecordPage() {
  const { entries, ready } = useRecord();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.epitaph, e.truth, e.avoided, e.intention]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-serif text-3xl tracking-tight">The Record</h1>
          <p className="text-sm text-muted-foreground">
            Every honest day, in order. No likes. No audience. The actual one.
          </p>
        </div>
        <DataTools />
      </header>

      {ready && entries.length > 0 && (
        <div className="relative mt-8">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the record…"
            className="pl-9"
          />
        </div>
      )}

      <div className="mt-10">
        {!ready ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
            <p className="font-serif text-lg">The record is empty.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              A life unexamined leaves no record. Write the first reckoning and
              this page becomes the truest thing you own.
            </p>
            <Link
              href="/"
              className={buttonVariants({ variant: "accent", className: "mt-6" })}
            >
              Begin today
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No reckoning matches “{query}”.
          </p>
        ) : (
          <div className="space-y-5">
            {filtered.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
