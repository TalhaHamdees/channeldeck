import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  delta?: string | null;
  sub?: string;
}) {
  const positive = delta?.startsWith("+");
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {delta != null && (
            <span
              className={cn(
                "text-xs font-medium",
                positive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {delta}
            </span>
          )}
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
