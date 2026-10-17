"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { formatMoney } from "@fm/shared/currencies";
import { useI18n } from "@/components/i18n-provider";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Colors: validated categorical slots 1 (blue) and 2 (orange), each with its own dark-surface step.
// Deliberately not green/red, which stay reserved for status.
const BLUE = { light: "#2a78d6", dark: "#3987e5" };
const ORANGE = { light: "#eb6834", dark: "#d95926" };

function moneyTooltip(currency: string, config: ChartConfig, locale: string) {
  return function formatTooltipRow(value: unknown, name: unknown) {
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
        <span className="font-medium text-foreground tabular-nums">{formatMoney(String(value), currency, locale)}</span>
      </div>
    );
  };
}

export function CategoryChart({
  data,
  currency,
}: {
  data: { name: string; total: number; label: string }[];
  currency: string;
}) {
  const { t, locale } = useI18n();
  const config = { total: { label: t("Đã chi"), theme: BLUE } } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full overflow-x-clip"
      style={{ height: data.length * 36 + 16 }}
      aria-hidden
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="name"
          width={104}
          tickLine={false}
          axisLine={false}
          // Non-breaking spaces keep each label on one line; long names are cut instead of wrapping.
          tickFormatter={(name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name).replace(/ /g, " ")}
        />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent formatter={moneyTooltip(currency, config, locale)} />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="label" position="right" className="fill-muted-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function TrendChart({
  data,
  currency,
}: {
  data: { label: string; income: number; expense: number }[];
  currency: string;
}) {
  const { t, locale } = useI18n();
  const config = {
    income: { label: t("Thu nhập"), theme: BLUE },
    expense: { label: t("Chi tiêu"), theme: ORANGE },
  } satisfies ChartConfig;
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full overflow-x-clip" aria-hidden>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value: number) => compact.format(value)} />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent formatter={moneyTooltip(currency, config, locale)} />} />
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}
