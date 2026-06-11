"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function TimeSeriesChart<T extends { date: string }>({
  data,
  dataKey,
  label,
  color = "var(--chart-1)",
  valueFormatter,
}: {
  data: T[];
  dataKey: Extract<keyof T, string>;
  label: string;
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const config: ChartConfig = { [dataKey]: { label, color } };
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
          fontSize={11}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(v: number) =>
            valueFormatter ? valueFormatter(v) : v.toLocaleString()
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => shortDate(String(v))}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function Sparkline({
  data,
}: {
  data: Array<{ date: string; views: number }>;
}) {
  return (
    <ChartContainer
      config={{ views: { label: "Views", color: "var(--chart-1)" } }}
      className="h-8 w-24"
    >
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="views"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function TrafficDonut({
  data,
}: {
  data: Array<{ name: string; views: number }>;
}) {
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.name, { label: d.name, color: PIE_COLORS[i % 5] }])
  );
  return (
    <ChartContainer config={config} className="mx-auto h-56 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie
          data={data}
          dataKey="views"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % 5]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

export function DemographicsBars({
  data,
}: {
  data: Array<{ ageGroup: string; male: number; female: number }>;
}) {
  const config: ChartConfig = {
    male: { label: "Male", color: "var(--chart-1)" },
    female: { label: "Female", color: "var(--chart-2)" },
  };
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="ageGroup"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(v: string) => v.replace("age", "")}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="male" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="female" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
