import { apiFetch } from "@/lib/api/client";
import type { OutletsQuery } from "@/lib/validations/outlets";

export type Outlet = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  location: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type OutletList = {
  items: Outlet[];
  total: number;
  page: number;
  limit: number;
};

export async function listOutlets(query: OutletsQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));

  if (query.search) {
    params.set("search", query.search);
  }
  if (query.code) {
    params.set("code", query.code);
  }
  if (query.location) {
    params.set("location", query.location);
  }

  const response = await apiFetch<OutletList>(`/api/backend/outlets?${params}`);
  return response.data;
}
