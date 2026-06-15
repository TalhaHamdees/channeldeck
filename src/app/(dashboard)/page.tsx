import Link from "next/link";
import { resolveRange } from "@/lib/date-range";
import {
  getChannelSummaries,
  getDataThroughDate,
  getSeries,
  getTotals,
} from "@/lib/queries";
import {
  fmtCurrency,
  fmtDate,
  fmtNumber,
  fmtPctDelta,
  fmtSigned,
  fmtWatchHours,
} from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";
import { RangePicker } from "@/components/range-picker";
import { Sparkline, TimeSeriesChart } from "@/components/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const { range, previous, days } = resolveRange(rangeParam);

  const [totals, prevTotals, series, channels, dataThrough] =
    await Promise.all([
      getTotals(range),
      getTotals(previous),
      getSeries(range),
      getChannelSummaries(range),
      getDataThroughDate(),
    ]);

  if (channels.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>No channels connected yet</CardTitle>
            <CardDescription>
              Connect your YouTube channels to start seeing unified analytics.
              You&apos;ll sign in once per channel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings" className={buttonVariants()}>
              Connect channels
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const netSubs = totals.subsGained - totals.subsLost;
  const prevNetSubs = prevTotals.subsGained - prevTotals.subsLost;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            All channels
          </h1>
          <p className="text-xs text-muted-foreground">
            Last {days} days
            {dataThrough && <> · data through {fmtDate(dataThrough)}</>}
          </p>
        </div>
        <RangePicker />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Views"
          value={fmtNumber(totals.views)}
          delta={fmtPctDelta(totals.views, prevTotals.views)}
          sub={`vs prev ${days}d`}
        />
        <KpiCard
          label="Watch time"
          value={fmtWatchHours(totals.watchMinutes)}
          delta={fmtPctDelta(totals.watchMinutes, prevTotals.watchMinutes)}
          sub={`vs prev ${days}d`}
        />
        <KpiCard
          label="Net subscribers"
          value={fmtSigned(netSubs)}
          delta={fmtPctDelta(netSubs, prevNetSubs)}
          sub={`vs prev ${days}d`}
        />
        <KpiCard
          label="Est. revenue"
          value={fmtCurrency(totals.revenue)}
          delta={fmtPctDelta(totals.revenue, prevTotals.revenue)}
          sub={`vs prev ${days}d`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart
              data={series}
              dataKey="views"
              label="Views"
              format="number"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Est. revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart
              data={series}
              dataKey="revenue"
              label="Revenue"
              color="var(--chart-2)"
              format="currency"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Subscribers</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Watch time
                </TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Net subs
                </TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="hidden lg:table-cell">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/channels/${c.id}?range=${days}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      {c.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.thumbnailUrl}
                          alt=""
                          className="h-7 w-7 rounded-full"
                        />
                      )}
                      <span className="max-w-40 truncate sm:max-w-none">
                        {c.title}
                      </span>
                      {c.tokenStatus !== "active" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Reconnect
                        </Badge>
                      )}
                      {!c.backfillComplete && c.tokenStatus === "active" && (
                        <Badge variant="secondary" className="text-[10px]">
                          Syncing…
                        </Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.subscriberCount != null
                      ? fmtNumber(c.subscriberCount)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(c.totals.views)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {fmtWatchHours(c.totals.watchMinutes)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {fmtSigned(c.totals.subsGained - c.totals.subsLost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCurrency(c.totals.revenue)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Sparkline data={c.sparkline} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
