import { apiFetch } from "@/lib/api/client";

export type OutletRevenueItem = {
  outletId: string;
  outletName: string;
  outletLocation: string | null;
  totalRevenue: number;
  totalSalesCount: number;
  averageOrderValue: number;
};

export type RevenueReportSummary = {
  totalRevenue: number;
  totalSalesCount: number;
  outletCount: number;
};

export type RevenueReportData = {
  from: string | null;
  to: string | null;
  summary: RevenueReportSummary;
  outlets: OutletRevenueItem[];
};

export type TopSellingItem = {
  rank: number;
  menuItemId: string;
  itemName: string;
  category: string | null;
  sku: string;
  basePrice: number;
  quantitySold: number;
  totalRevenue: number;
};

export type TopItemsOutletScope = {
  outletId: string | null;
  outletName: string | null;
};

export type TopItemsReportData = {
  from: string | null;
  to: string | null;
  scope: TopItemsOutletScope;
  limit: number;
  totalItemsCount: number;
  items: TopSellingItem[];
};

export type ReportQueryParams = {
  outletId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDayIso(dateInput: string, endOfDay: boolean) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return date.toISOString();
}

export function currentMonthQuery(): Pick<ReportQueryParams, "from" | "to"> {
  const now = new Date();
  const start = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  return {
    from: localDayIso(start, false),
    to: localDayIso(formatLocalDate(now), true),
  };
}

function buildSearchParams(query: ReportQueryParams): URLSearchParams {
  const params = new URLSearchParams();
  if (query.outletId && query.outletId !== 'ALL') {
    params.set('outletId', query.outletId);
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.limit) {
    params.set('limit', String(query.limit));
  }
  return params;
}

export async function getRevenueReport(query: ReportQueryParams = {}): Promise<RevenueReportData> {
  const params = buildSearchParams(query);
  const response = await apiFetch<RevenueReportData>(
    `/api/backend/reports/revenue?${params.toString()}`,
  );
  return response.data;
}

export async function getTopItemsReport(query: ReportQueryParams = {}): Promise<TopItemsReportData> {
  const params = buildSearchParams(query);
  const response = await apiFetch<TopItemsReportData>(
    `/api/backend/reports/top-items?${params.toString()}`,
  );
  return response.data;
}

