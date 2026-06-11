"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RANGE_PRESETS } from "@/lib/date-range";

export function RangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = Number(searchParams.get("range")) || 28;

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {RANGE_PRESETS.map((days) => (
        <Button
          key={days}
          size="sm"
          variant={current === days ? "default" : "ghost"}
          className="h-7 px-2.5 text-xs"
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set("range", String(days));
            router.push(`${pathname}?${params}`);
          }}
        >
          {days === 365 ? "1y" : `${days}d`}
        </Button>
      ))}
    </div>
  );
}
