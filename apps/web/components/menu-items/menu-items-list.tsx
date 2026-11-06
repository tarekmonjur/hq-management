"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { ApiError, type FieldErrors } from "@/lib/api/client";
import { listMenuItems, type MenuItem } from "@/lib/api/menu-items";
import { canManageMenuItems } from "@/lib/auth/roles";
import { readMenuItemsQuery } from "@/lib/validations/menu-items";

export function MenuItemsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });

  const parsed = readMenuItemsQuery({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    search: searchParams.get("search"),
  });

  const menuItems = useQuery({
    queryKey: ["menu-items", "list", parsed.success ? parsed.data : null],
    queryFn: () => listMenuItems(parsed.success ? parsed.data : { page: 1, limit: 20 }),
    enabled: parsed.success,
  });

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (menuItems.error instanceof ApiError && menuItems.error.status === 401) {
      router.replace("/login");
    }
  }, [menuItems.error, router]);

  const apiFieldErrors =
    menuItems.error instanceof ApiError ? menuItems.error.fieldErrors : undefined;
  const queryErrors = parsed.success
    ? {}
    : flattenZodErrors(parsed.error.flatten().fieldErrors);
  const fieldErrors = { ...queryErrors, ...clientErrors, ...apiFieldErrors };

  function replaceParams(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readMenuItemsQuery({
      page: "1",
      limit: searchParams.get("limit"),
      search,
    });
    if (!result.success) {
      setClientErrors(flattenZodErrors(result.error.flatten().fieldErrors));
      return;
    }

    setClientErrors({});
    const params = new URLSearchParams();
    if (result.data.search) {
      params.set("search", result.data.search);
    }
    const limit = searchParams.get("limit");
    if (limit) {
      params.set("limit", limit);
    }
    replaceParams(params);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    replaceParams(params);
  }

  const pageError =
    menuItems.error instanceof ApiError && !menuItems.error.fieldErrors
      ? menuItems.error.message
      : null;
  const list = menuItems.data;
  const page = list?.page ?? (parsed.success ? parsed.data.page : 1);
  const limit = list?.limit ?? (parsed.success ? parsed.data.limit : 20);
  const total = list?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Menu items</h1>
          <p className="text-sm text-zinc-500">Company menu catalog.</p>
        </div>
        {canManageMenuItems(profile.data?.role) ? (
          <Link
            href="/menu-items/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
          >
            New menu item
          </Link>
        ) : null}
      </div>

      <form className="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={applySearch}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            value={search}
            placeholder="Name"
            aria-invalid={Boolean(fieldErrors.search?.[0])}
            onChange={(event) => setSearch(event.target.value)}
          />
          {fieldErrors.search?.[0] ? (
            <p className="text-sm text-red-600 dark:text-red-400">{fieldErrors.search[0]}</p>
          ) : null}
        </div>
        <div className="flex items-end">
          {menuItems.isFetching ? (
            <Skeleton className="h-11 w-full sm:w-28" />
          ) : (
            <Button type="submit" className="w-full sm:w-28">
              Apply
            </Button>
          )}
        </div>
        {fieldErrors.page?.[0] ? (
          <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{fieldErrors.page[0]}</p>
        ) : null}
        {fieldErrors.limit?.[0] ? (
          <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">
            {fieldErrors.limit[0]}
          </p>
        ) : null}
      </form>

      {pageError ? <p className="text-sm text-red-600 dark:text-red-400">{pageError}</p> : null}

      {menuItems.isFetching ? (
        <MenuItemsResultsSkeleton />
      ) : !parsed.success || menuItems.isError ? null : list && list.items.length > 0 ? (
        <MenuItemResults items={list.items} />
      ) : (
        <p className="text-sm text-zinc-500">No menu items found.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {total === 0 ? "0 menu items" : `${from}–${to} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || menuItems.isFetching}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            disabled={page * limit >= total || menuItems.isFetching}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function MenuItemResults({ items }: { items: MenuItem[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Base price</th>
              <th className="px-4 py-3 font-medium">Unit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/menu-items/${item.id}`} className="hover:underline">
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatPrice(item.basePrice)}</td>
                <td className="px-4 py-3">{item.unit ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/menu-items/${item.id}`}
              className="block rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800"
            >
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 text-sm text-zinc-500">{formatPrice(item.basePrice)}</p>
              <p className="mt-1 text-sm">{item.unit ?? "—"}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function MenuItemsResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

function formatPrice(value: MenuItem["basePrice"]) {
  if (value == null || value === "") {
    return "—";
  }
  return String(value);
}

function flattenZodErrors(errors: Record<string, string[] | undefined>): FieldErrors {
  const flattened: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0) {
      flattened[field] = messages;
    }
  }
  return flattened;
}
