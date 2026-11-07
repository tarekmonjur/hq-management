import { apiFetch } from "@/lib/api/client";
import type { InventoryQuery } from "@/lib/validations/inventories";

export type Inventory = {
  id: string;
  outletId: string;
  outletName: string;
  outletCode: string;
  menuItemId: string;
  menuItemName: string;
  menuItemUnit: string | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryList = {
  items: Inventory[];
  total: number;
  page: number;
  limit: number;
};

export type InventoryAdjustment = {
  quantity: number;
};

function toSearchParams(query: InventoryQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.outletId) params.set("outletId", query.outletId);
  return params;
}

export async function listInventories(query: InventoryQuery) {
  const response = await apiFetch<InventoryList>(
    `/api/backend/inventories?${toSearchParams(query)}`,
  );
  return response.data;
}

export function adjustInventory(id: string, input: InventoryAdjustment) {
  return apiFetch<Inventory>(`/api/backend/inventories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
