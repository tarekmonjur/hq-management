"use client";

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import {
  currentMonthQuery,
  getRevenueReport,
  getTopItemsReport,
  type OutletRevenueItem,
  type TopSellingItem,
} from "@/lib/api/reports";
import { formatMoney } from "@/lib/api/sales";
import { canFilterReportOutlets, canViewReports } from "@/lib/auth/roles";

const monthQuery = currentMonthQuery();

export function DashboardOverview() {
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });
  const allowed = canViewReports(profile.data?.role);
  const canFilterOutlets = canFilterReportOutlets(profile.data?.role);
  const isOutletScoped = !canFilterOutlets && !!profile.data?.outletId;

  const queryParams = {
    ...monthQuery,
    outletId: isOutletScoped ? (profile.data?.outletId ?? undefined) : undefined,
  };

  const revenue = useQuery({
    queryKey: ["reports", "revenue", "dashboard", queryParams],
    queryFn: () => getRevenueReport(queryParams),
    enabled: allowed,
  });
  const topItems = useQuery({
    queryKey: ["reports", "top-items", "dashboard", queryParams],
    queryFn: () => getTopItemsReport({ ...queryParams, limit: 5 }),
    enabled: allowed,
  });

  if (profile.isPending) {
    return <DashboardSkeleton />;
  }

  if (!allowed) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to reports.</p>
      </section>
    );
  }

  const summary = revenue.data?.summary;
  const salesCount = summary?.totalSalesCount ?? 0;
  const averageOrderValue = salesCount > 0 ? (summary?.totalRevenue ?? 0) / salesCount : 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          {isOutletScoped
            ? "This month, for your assigned outlet."
            : "This month, for the outlets you can access."}
        </p>
      </div>

      {revenue.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {revenue.error instanceof Error ? revenue.error.message : "Could not load revenue"}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total revenue" value={formatMoney(summary?.totalRevenue ?? 0)} loading={revenue.isPending} />
        <Metric label="Sales" value={String(salesCount)} loading={revenue.isPending} />
        <Metric label="Average order" value={formatMoney(averageOrderValue)} loading={revenue.isPending} />
        <Metric label="Outlets" value={String(summary?.outletCount ?? 0)} loading={revenue.isPending} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Outlet revenue</h2>
          {revenue.isPending ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : (
            <OutletRevenueChart outlets={revenue.data?.outlets ?? []} />
          )}
        </article>
        <article className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Top items</h2>
          {topItems.isPending ? (
            <Skeleton className="mt-4 h-48 w-full" />
          ) : topItems.error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {topItems.error instanceof Error ? topItems.error.message : "Could not load items"}
            </p>
          ) : (
            <TopItemsChart items={topItems.data?.items ?? []} />
          )}
        </article>
      </div>
    </section>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="mt-1 text-2xl font-semibold">{value}</p>}
    </div>
  );
}

function OutletRevenueChart({ outlets }: { outlets: OutletRevenueItem[] }) {
  if (outlets.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500">No outlet revenue this month.</p>;
  }

  const max = Math.max(...outlets.map((outlet) => outlet.totalRevenue), 1);
  const barWidth = 48;
  const gap = 28;
  const chartHeight = 160;
  const width = outlets.length * (barWidth + gap);
  const height = chartHeight + 56;

  return (
    <div className="mt-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 min-w-full"
        role="img"
        aria-label="Revenue by outlet"
      >
        {outlets.map((outlet, index) => {
          const barHeight = Math.max((outlet.totalRevenue / max) * chartHeight, outlet.totalRevenue > 0 ? 4 : 0);
          const x = index * (barWidth + gap) + gap / 2;
          const y = chartHeight - barHeight;
          const label = outlet.outletName.length > 14 ? `${outlet.outletName.slice(0, 13)}…` : outlet.outletName;
          return (
            <g key={outlet.outletId}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" className="fill-foreground" />
              <text
                x={x + barWidth / 2}
                y={Math.max(y - 8, 12)}
                textAnchor="middle"
                className="fill-current text-[11px]"
              >
                {formatMoney(outlet.totalRevenue)}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 20}
                textAnchor="middle"
                className="fill-current text-[11px]"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TopItemsChart({ items }: { items: TopSellingItem[] }) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500">No items sold this month.</p>;
  }

  const max = Math.max(...items.map((item) => item.quantitySold), 1);
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.menuItemId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              #{item.rank} {item.itemName}
            </span>
            <span className="shrink-0 text-zinc-500">
              {item.quantitySold} · {formatMoney(item.totalRevenue)}
            </span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-3 rounded-full bg-foreground"
              style={{ width: `${Math.max((item.quantitySold / max) * 100, item.quantitySold > 0 ? 4 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
