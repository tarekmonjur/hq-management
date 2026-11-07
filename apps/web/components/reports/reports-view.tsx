"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Calendar, DollarSign, Printer, ShoppingBag, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { listOutlets } from "@/lib/api/outlets";
import { formatMoney } from "@/lib/api/sales";
import {
  formatLocalDate,
  getRevenueReport,
  getTopItemsReport,
  localDayIso,
  type ReportQueryParams,
} from "@/lib/api/reports";
import { canFilterReportOutlets, canViewReports } from "@/lib/auth/roles";

type DatePreset = "today" | "last7" | "thisMonth" | "custom";

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const toStr = formatLocalDate(now);

  if (preset === "today") {
    return { from: toStr, to: toStr };
  }
  if (preset === "last7") {
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    return { from: formatLocalDate(past7), to: toStr };
  }
  if (preset === "thisMonth") {
    return { from: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toStr };
  }
  return {};
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load this report";
}

export function ReportsView() {
  const [preset, setPreset] = useState<DatePreset>("thisMonth");
  const initialDates = getDateRange("thisMonth");
  const [fromDate, setFromDate] = useState<string>(initialDates.from ?? "");
  const [toDate, setToDate] = useState<string>(initialDates.to ?? "");
  const [selectedOutletId, setSelectedOutletId] = useState<string>("ALL");

  // Load current user profile for role verification and default outlet assignment
  const { data: userProfile, isLoading: isUserLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });

  const canFilterOutlets = canFilterReportOutlets(userProfile?.role);
  const allowed = canViewReports(userProfile?.role);
  const effectiveOutletId = canFilterOutlets
    ? selectedOutletId
    : (userProfile?.outletId ?? undefined);

  // Load outlets list for admins to filter
  const { data: outletsData } = useQuery({
    queryKey: ["outlets", "all-for-reports"],
    queryFn: () => listOutlets({ page: 1, limit: 100 }),
    enabled: canFilterOutlets,
  });

  const queryParams: ReportQueryParams = {
    outletId: effectiveOutletId && effectiveOutletId !== "ALL" ? effectiveOutletId : undefined,
    from: fromDate ? localDayIso(fromDate, false) : undefined,
    to: toDate ? localDayIso(toDate, true) : undefined,
  };

  // Queries for Revenue and Top Items
  const {
    data: revenueReport,
    isLoading: isRevenueLoading,
    error: revenueError,
  } = useQuery({
    queryKey: ["reports", "revenue", queryParams],
    queryFn: () => getRevenueReport(queryParams),
    enabled: allowed,
  });

  const {
    data: topItemsReport,
    isLoading: isTopItemsLoading,
    error: topItemsError,
  } = useQuery({
    queryKey: ["reports", "top-items", queryParams],
    queryFn: () => getTopItemsReport({ ...queryParams, limit: 5 }),
    enabled: allowed,
  });

  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    if (newPreset !== "custom") {
      const dates = getDateRange(newPreset);
      setFromDate(dates.from ?? "");
      setToDate(dates.to ?? "");
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const assignedOutletName =
    (canFilterOutlets
      ? outletsData?.items?.find((outlet) => outlet.id === effectiveOutletId)?.name
      : revenueReport?.outlets?.[0]?.outletName) ?? "Your outlet";

  if (isUserLoading) {
    return <ReportsSkeleton />;
  }

  if (!allowed) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to reports.</p>
      </section>
    );
  }

  return (
    <div className="print-report flex flex-col gap-6">
      {/* Printable Header (Visible strictly during @media print) */}
      <div className="hidden border-b pb-4 print:block">
        <h1 className="text-2xl font-bold tracking-tight">HQ Management — Sales & Revenue Report</h1>
        <div className="mt-2 flex flex-wrap justify-between text-xs text-zinc-600">
          <div>
            <p>
              <span className="font-semibold">Outlet Scope:</span>{" "}
              {canFilterOutlets && selectedOutletId === "ALL"
                ? "All Outlets (Company Consolidated)"
                : assignedOutletName}
            </p>
            <p>
              <span className="font-semibold">Period:</span>{" "}
              {fromDate ? fromDate : "Beginning"} — {toDate ? toDate : "Present"}
            </p>
          </div>
          <div className="text-right">
            <p>
              <span className="font-semibold">Generated by:</span> {userProfile?.fullName} (
              {userProfile?.role})
            </p>
            <p>
              <span className="font-semibold">Generated on:</span> {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Screen Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Reports & Analytics
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Audit-ready revenue summary and top-selling product performances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} className="print:hidden">
            <Printer className="size-4" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar (Hidden on print) */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Calendar className="size-3.5" /> Date Range:
            </span>
            {(
              [
                { id: "today", label: "Today" },
                { id: "last7", label: "Last 7 Days" },
                { id: "thisMonth", label: "This Month" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePresetChange(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  preset === item.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Outlet Selector (Role-based) */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Building2 className="size-3.5" /> Scope:
            </span>
            {canFilterOutlets ? (
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="h-8.5 rounded-md border border-zinc-200 bg-transparent px-2.5 text-xs text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200"
              >
                <option value="ALL">All Outlets</option>
                {outletsData?.items?.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="inline-flex h-8 items-center rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {assignedOutletName}
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <label htmlFor="report-from" className="text-xs text-zinc-500">
                From:
              </label>
              <input
                id="report-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 rounded-md border border-zinc-200 bg-transparent px-2.5 text-xs dark:border-zinc-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="report-to" className="text-xs text-zinc-500">
                To:
              </label>
              <input
                id="report-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 rounded-md border border-zinc-200 bg-transparent px-2.5 text-xs dark:border-zinc-700"
              />
            </div>
          </div>
        )}
      </div>

      {revenueError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(revenueError)}</p>
      ) : null}
      {topItemsError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(topItemsError)}</p>
      ) : null}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Revenue */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium tracking-wide uppercase">Total Revenue</span>
            <DollarSign className="size-4" />
          </div>
          {isRevenueLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatMoney(revenueReport?.summary?.totalRevenue ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">Realized & completed sales</p>
        </div>

        {/* Card 2: Completed Sales */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium tracking-wide uppercase">Completed Sales</span>
            <ShoppingBag className="size-4" />
          </div>
          {isRevenueLoading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {revenueReport?.summary?.totalSalesCount ?? 0}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">Total orders served & paid</p>
        </div>

        {/* Card 3: Average Order Value */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium tracking-wide uppercase">Avg. Order Value</span>
            <TrendingUp className="size-4" />
          </div>
          {isRevenueLoading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {revenueReport?.summary?.totalSalesCount && revenueReport.summary.totalSalesCount > 0
                ? formatMoney(
                    revenueReport.summary.totalRevenue / revenueReport.summary.totalSalesCount,
                  )
                : formatMoney(0)}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">Revenue per transaction</p>
        </div>

        {/* Card 4: Outlets Scoped */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium tracking-wide uppercase">Active Outlets</span>
            <Building2 className="size-4" />
          </div>
          {isRevenueLoading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {revenueReport?.summary?.outletCount ?? 0}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">Outlets reporting in period</p>
        </div>
      </div>

      {/* Table 1: Outlet Revenue Breakdown */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Outlet Revenue Breakdown
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Detailed performance and earnings by outlet.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Outlet Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Transactions</th>
                <th className="px-4 py-3 text-right">Average Order Value</th>
                <th className="px-4 py-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isRevenueLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </td>
                  </tr>
                ))
              ) : revenueReport?.outlets?.length ? (
                revenueReport.outlets.map((outlet) => (
                  <tr
                    key={outlet.outletId}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {outlet.outletName}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {outlet.outletLocation ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {outlet.totalSalesCount}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatMoney(outlet.averageOrderValue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatMoney(outlet.totalRevenue)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    No revenue data recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Grand Totals Footer */}
            {revenueReport?.outlets && revenueReport.outlets.length > 0 && (
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-50">
                <tr>
                  <td className="px-4 py-3">Grand Total</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 text-right">
                    {revenueReport.summary.totalSalesCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {revenueReport.summary.totalSalesCount > 0
                      ? formatMoney(
                          revenueReport.summary.totalRevenue / revenueReport.summary.totalSalesCount,
                        )
                      : formatMoney(0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(revenueReport.summary.totalRevenue)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Table 2: Top 5 Selling Items */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Top 5 Selling Items
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ranked by total quantity sold and revenue contribution.
              </p>
            </div>
            {topItemsReport?.scope?.outletName && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Scope: {topItemsReport.scope.outletName}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="w-16 px-4 py-3 text-center">Rank</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Base Price</th>
                <th className="px-4 py-3 text-right">Units Sold</th>
                <th className="px-4 py-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isTopItemsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-center">
                      <Skeleton className="mx-auto h-5 w-6" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-14" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-18" />
                    </td>
                  </tr>
                ))
              ) : topItemsReport?.items?.length ? (
                topItemsReport.items.map((item) => (
                  <tr
                    key={item.menuItemId}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                          item.rank === 1
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                            : item.rank === 2
                              ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                              : item.rank === 3
                                ? "bg-amber-700/20 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        #{item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {item.itemName}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {item.sku ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatMoney(item.basePrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                      {item.quantitySold}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatMoney(item.totalRevenue)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No top-selling item records for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

