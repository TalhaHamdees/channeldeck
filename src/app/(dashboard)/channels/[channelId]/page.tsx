import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resolveRange } from "@/lib/date-range";
import {
  getDataThroughDate,
  getDemographics,
  getGeography,
  getSeries,
  getTopVideos,
  getTotals,
  getTrafficSources,
} from "@/lib/queries";
import {
  countryName,
  fmtCurrency,
  fmtDate,
  fmtDuration,
  fmtNumber,
  fmtPctDelta,
  fmtSigned,
  fmtWatchHours,
  trafficSourceLabel,
} from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";
import { RangePicker } from "@/components/range-picker";
import {
  DemographicsBars,
  TimeSeriesChart,
  TrafficDonut,
} from "@/components/charts";
import {
  Card,
  CardContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { channelId } = await params;
  const { range: rangeParam } = await searchParams;
  const { range, previous, days } = resolveRange(rangeParam);

  const db = getDb();
  const [channel] = await db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.id, channelId));
  if (!channel) notFound();

  const [totals, prevTotals, series, topVideos, traffic, geo, demo, dataThrough] =
    await Promise.all([
      getTotals(range, channelId),
      getTotals(previous, channelId),
      getSeries(range, channelId),
      getTopVideos(channelId, days),
      getTrafficSources(range, channelId),
      getGeography(channelId, days),
      getDemographics(channelId),
      getDataThroughDate(channelId),
    ]);

  const netSubs = totals.subsGained - totals.subsLost;
  const prevNetSubs = prevTotals.subsGained - prevTotals.subsLost;

  const trafficData = traffic
    .slice(0, 8)
    .map((t) => ({ name: trafficSourceLabel(t.sourceType), views: t.views }));

  const demoByAge = new Map<string, { male: number; female: number }>();
  for (const d of demo) {
    const entry = demoByAge.get(d.ageGroup) ?? { male: 0, female: 0 };
    const pct = Number(d.viewerPercentage);
    if (d.gender.toLowerCase() === "male") entry.male += pct;
    else if (d.gender.toLowerCase() === "female") entry.female += pct;
    demoByAge.set(d.ageGroup, entry);
  }
  const demoData = [...demoByAge.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ageGroup, v]) => ({ ageGroup, ...v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {channel.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.thumbnailUrl}
              alt=""
              className="h-10 w-10 rounded-full"
            />
          )}
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {channel.title}
              {channel.tokenStatus !== "active" && (
                <Badge variant="destructive">Reconnect needed</Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {channel.subscriberCount != null &&
                `${fmtNumber(channel.subscriberCount)} subscribers · `}
              Last {days} days
              {dataThrough && <> · data through {fmtDate(dataThrough)}</>}
              {" · "}
              <Link href={`/?range=${days}`} className="underline">
                all channels
              </Link>
            </p>
          </div>
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
          sub={
            totals.views > 0
              ? `RPM ${fmtCurrency((totals.revenue / totals.views) * 1000)}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="views">
            <TabsList>
              <TabsTrigger value="views">Views</TabsTrigger>
              <TabsTrigger value="watch">Watch time</TabsTrigger>
              <TabsTrigger value="subs">Subscribers</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
            </TabsList>
            <TabsContent value="views">
              <TimeSeriesChart
                data={series}
                dataKey="views"
                label="Views"
                format="number"
              />
            </TabsContent>
            <TabsContent value="watch">
              <TimeSeriesChart
                data={series}
                dataKey="watchMinutes"
                label="Minutes watched"
                color="var(--chart-3)"
                format="number"
              />
            </TabsContent>
            <TabsContent value="subs">
              <TimeSeriesChart
                data={series}
                dataKey="netSubs"
                label="Net subscribers"
                color="var(--chart-4)"
                format="number"
              />
            </TabsContent>
            <TabsContent value="revenue">
              <TimeSeriesChart
                data={series}
                dataKey="revenue"
                label="Revenue"
                color="var(--chart-2)"
                format="currency"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top videos · last {days} days</CardTitle>
        </CardHeader>
        <CardContent>
          {topVideos.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No video data yet — it appears after the first daily sync.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Watch time
                  </TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Avg view
                  </TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVideos.map((v) => (
                  <TableRow key={v.videoId}>
                    <TableCell>
                      <a
                        href={`https://www.youtube.com/watch?v=${v.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        {v.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            className="h-9 w-16 rounded object-cover"
                          />
                        )}
                        <span className="max-w-48 truncate text-sm sm:max-w-md">
                          {v.title}
                        </span>
                      </a>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(v.views)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {fmtWatchHours(v.watchMinutes)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {fmtDuration(v.avgViewDurationSecs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.revenue != null ? fmtCurrency(Number(v.revenue)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Traffic sources</CardTitle>
          </CardHeader>
          <CardContent>
            {trafficData.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <TrafficDonut data={trafficData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audience · rolling 28d</CardTitle>
          </CardHeader>
          <CardContent>
            {demoData.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <DemographicsBars data={demoData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Top countries · last {days} days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {geo.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geo.map((g) => (
                    <TableRow key={g.country}>
                      <TableCell className="text-sm">
                        {countryName(g.country)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(g.views)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.estimatedRevenue != null
                          ? fmtCurrency(Number(g.estimatedRevenue))
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
