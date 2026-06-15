import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-28 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        404
      </p>
      <h1 className="mt-3 font-serif text-3xl tracking-tight">
        Here lies a page that never was.
      </h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        It left no record. You, however, still can.
      </p>
      <Link
        href="/"
        className={buttonVariants({ variant: "accent", className: "mt-8" })}
      >
        Return to today
      </Link>
    </div>
  );
}
