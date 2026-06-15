import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif italic">
          “Remember that you will die.” — the only deadline that never moves.
        </p>
        <p className="flex items-center gap-3">
          <Link href="/about" className="hover:text-foreground">
            Why this exists
          </Link>
          <span aria-hidden>·</span>
          <span>Stored only on this device.</span>
        </p>
      </div>
    </footer>
  );
}
