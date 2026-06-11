"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ signOutButton }: { signOutButton: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-bold tracking-tight">
            ChannelDeck
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                  (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href))
                    ? "bg-muted font-medium"
                    : "text-muted-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        {signOutButton}
      </div>
    </header>
  );
}
