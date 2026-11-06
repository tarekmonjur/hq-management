import { apiFetch } from "@/lib/api/client";
import type { MenuItemPayload, MenuItemsQuery, MenuItemUnit } from "@/lib/validations/menu-items";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | string | null;
  unit: MenuItemUnit | null;
  createdAt: string;
  updatedAt: string;
};

export type MenuItemList = {
  items: MenuItem[];
  total: number;
  page: number;
  limit: number;
};

export async function listMenuItems(query: MenuItemsQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));
  if (query.search) {
    params.set("search", query.search);
  }

  const response = await apiFetch<MenuItemList>(`/api/backend/menu-items?${params}`);
  return response.data;
}

export async function getMenuItem(id: string) {
  const response = await apiFetch<MenuItem>(`/api/backend/menu-items/${id}`);
  return response.data;
}

export function createMenuItem(input: MenuItemPayload) {
  return apiFetch<MenuItem>("/api/backend/menu-items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMenuItem(id: string, input: MenuItemPayload) {
  return apiFetch<MenuItem>(`/api/backend/menu-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMenuItem(id: string) {
  return apiFetch<null>(`/api/backend/menu-items/${id}`, { method: "DELETE" });
}
