import { apiFetch } from "@/lib/api/client";
import type { SalesQuery } from "@/lib/validations/sales";

export type SaleItem = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
};

export type Sale = {
  id: string;
  outletId: string;
  outletName: string;
  outletCode: string;
  companyId: string;
  receiptNo: number | string;
  total: number | string;
  tableNo: string | null;
  orderStatus: string;
  paymentStatus: string;
  idempotencyKey: string | null;
  createdAt: string;
  items: SaleItem[];
};

export type SaleList = {
  items: Sale[];
  total: number;
  page: number;
  limit: number;
};

export type CreateSaleInput = {
  outletId?: string;
  tableNo?: string;
  orderStatus?: string;
  paymentStatus?: string;
  items: Array<{ menuItemId: string; quantity: number }>;
};

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "—";
  }
  return amount.toFixed(2);
}

function toSearchParams(query: SalesQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.outletId) params.set("outletId", query.outletId);
  if (query.orderStatus) params.set("orderStatus", query.orderStatus);
  if (query.paymentStatus) params.set("paymentStatus", query.paymentStatus);
  if (query.tableNo) params.set("tableNo", query.tableNo);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params;
}

export async function listSales(query: SalesQuery) {
  const response = await apiFetch<SaleList>(`/api/backend/sales?${toSearchParams(query)}`);
  return response.data;
}

export async function getSale(id: string) {
  const response = await apiFetch<Sale>(`/api/backend/sales/${id}`);
  return response.data;
}

export function createSale(input: CreateSaleInput, idempotencyKey: string) {
  return apiFetch<Sale>("/api/backend/sales", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}
