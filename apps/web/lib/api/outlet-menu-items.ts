import { apiFetch } from "@/lib/api/client";
import type { OutletMenuItemsQuery } from "@/lib/validations/outlet-menu-items";

export type OutletMenuItem = {
  id: string;
  outletId: string;
  outletName: string;
  menuItemId: string;
  menuItemName: string;
  outletPrice: number | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OutletMenuItemList = {
  items: OutletMenuItem[];
  total: number;
  page: number;
  limit: number;
};

export type AssignOutletMenuItemInput = {
  outletId: string;
  menuItemId: string;
  outletPrice?: number | null;
  isActive?: boolean;
};

function toSearchParams(query: OutletMenuItemsQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.outletId) {
    params.set("outletId", query.outletId);
  }
  if (query.isActive) {
    params.set("isActive", query.isActive);
  }
  return params;
}

export async function listOutletMenuItems(query: OutletMenuItemsQuery) {
  const response = await apiFetch<OutletMenuItemList>(
    `/api/backend/outlet-menu-items?${toSearchParams(query)}`,
  );
  return response.data;
}

export function assignOutletMenuItem(input: AssignOutletMenuItemInput) {
  return apiFetch<OutletMenuItem>("/api/backend/outlet-menu-items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOutletMenuPrice(
  menuItemId: string,
  input: { outletId: string; outletPrice: number },
) {
  return apiFetch<OutletMenuItem>(`/api/backend/outlet-menu-items/${menuItemId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function removeOutletMenuItem(menuItemId: string, outletId: string) {
  const params = new URLSearchParams({ outletId });
  return apiFetch<null>(`/api/backend/outlet-menu-items/${menuItemId}?${params}`, {
    method: "DELETE",
  });
}
