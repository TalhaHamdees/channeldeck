"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/record", label: "The Record" },
  { href: "/patterns", label: "Patterns" },
  { href: "/about", label: "Manifesto" },
];

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("mori.theme", next ? "dark" : "light");
    } catch {
      /* private mode — preference simply won't persist */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {/* Render a stable icon until mounted to avoid a hydration mismatch. */}
      {!mounted ? (
        <span className="size-4" />
      ) : dark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-6 px-5">
        <Link href="/" className="group flex flex-col leading-none">
          <span className="font-serif text-lg tracking-tight">Mori</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            the honest record
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors hover:text-foreground",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <span className="hidden sm:inline">{link.label}</span>
                <span className="sm:hidden">{link.label.split(" ").at(-1)}</span>
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
