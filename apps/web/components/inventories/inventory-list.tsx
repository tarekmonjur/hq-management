"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import {
  adjustInventory,
  listInventories,
  type Inventory,
} from "@/lib/api/inventories";
import { listOutlets } from "@/lib/api/outlets";
import { ApiError, type FieldErrors } from "@/lib/api/client";
import { canAdjustInventory, canViewInventory } from "@/lib/auth/roles";
import {
  inventoryAdjustmentSchema,
  readInventoryQuery,
  type InventoryAdjustmentValues,
} from "@/lib/validations/inventories";

export function InventoryList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });
  const allowed = canViewInventory(profile.data?.role);
  const canAdjust = canAdjustInventory(profile.data?.role);
  const parsed = readInventoryQuery({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    search: searchParams.get("search"),
    outletId: canAdjust ? searchParams.get("outletId") : null,
  });

  const inventory = useQuery({
    queryKey: ["inventories", parsed.success ? parsed.data : null],
    queryFn: () =>
      listInventories(
        parsed.success ? parsed.data : { page: 1, limit: 20 },
      ),
    enabled: profile.isSuccess && allowed && parsed.success,
  });
  const outlets = useQuery({
    queryKey: ["outlets", "inventory-filter"],
    queryFn: () => listOutlets({ page: 1, limit: 100 }),
    enabled: profile.isSuccess && canAdjust,
  });

  useEffect(() => {
    const error = inventory.error ?? outlets.error;
    if (error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [inventory.error, outlets.error, router]);

  function replaceParams(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = readInventoryQuery({
      page: "1",
      limit: searchParams.get("limit"),
      search: String(form.get("search") ?? ""),
      outletId: canAdjust ? String(form.get("outletId") ?? "") : null,
    });

    if (!result.success) {
      setClientErrors(flattenZodErrors(result.error.flatten().fieldErrors));
      return;
    }

    setClientErrors({});
    const params = new URLSearchParams();
    if (result.data.search) params.set("search", result.data.search);
    if (canAdjust && result.data.outletId) {
      params.set("outletId", result.data.outletId);
    }
    const limit = searchParams.get("limit");
    if (limit) params.set("limit", limit);
    replaceParams(params);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (!canAdjust) params.delete("outletId");
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    replaceParams(params);
  }

  const apiFieldErrors =
    inventory.error instanceof ApiError
      ? inventory.error.fieldErrors
      : undefined;
  const queryErrors = parsed.success
    ? {}
    : flattenZodErrors(parsed.error.flatten().fieldErrors);
  const fieldErrors = { ...queryErrors, ...clientErrors, ...apiFieldErrors };
  const pageError =
    inventory.error instanceof ApiError && !inventory.error.fieldErrors
      ? inventory.error.message
      : inventory.error instanceof Error
        ? inventory.error.message
        : null;
  const outletFilterError =
    outlets.error instanceof Error ? outlets.error.message : null;

  if (profile.isPending) {
    return <InventoryResultsSkeleton />;
  }

  if (profile.error) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          {profile.error instanceof Error
            ? profile.error.message
            : "Could not verify inventory access."}
        </p>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-zinc-500">
          You don&apos;t have access to inventory.
        </p>
      </section>
    );
  }

  const list = inventory.data;
  const page = list?.page ?? (parsed.success ? parsed.data.page : 1);
  const limit = list?.limit ?? (parsed.success ? parsed.data.limit : 20);
  const total = list?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <section className="listing-page flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-zinc-500">
          {canAdjust
            ? "View stock across your company outlets and adjust quantities."
            : "View stock for your assigned outlet."}
        </p>
      </div>

      <form
        className="grid grid-cols-2 items-end gap-3 sm:gap-4 lg:grid-cols-3"
        onSubmit={applyFilters}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="search">Menu item</Label>
          <Input
            key={searchParams.toString()}
            id="search"
            name="search"
            placeholder="Search menu item name"
            defaultValue={searchParams.get("search") ?? ""}
            aria-invalid={Boolean(fieldErrors.search?.[0])}
          />
          {fieldErrors.search?.[0] ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {fieldErrors.search[0]}
            </p>
          ) : null}
        </div>

        {canAdjust ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="outletId">Outlet</Label>
            <select
              key={searchParams.toString()}
              id="outletId"
              name="outletId"
              defaultValue={searchParams.get("outletId") ?? ""}
              aria-invalid={Boolean(fieldErrors.outletId?.[0])}
              disabled={outlets.isPending || Boolean(outletFilterError)}
              className="h-11 rounded-lg border border-zinc-300 bg-background px-3 text-sm disabled:opacity-60 dark:border-zinc-700"
            >
              <option value="">All outlets</option>
              {(outlets.data?.items ?? []).map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </option>
              ))}
            </select>
            {fieldErrors.outletId?.[0] ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.outletId[0]}
              </p>
            ) : outletFilterError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Could not load outlets: {outletFilterError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          {inventory.isFetching ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Button type="submit" className="w-full">
              Apply filters
            </Button>
          )}
        </div>
      </form>

      {pageError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{pageError}</p>
      ) : null}

      <div className="min-h-0 flex-1">
        {inventory.isFetching ? (
          <InventoryResultsSkeleton />
        ) : !parsed.success || inventory.isError ? null : list?.items.length ? (
          <InventoryResults items={list.items} canAdjust={canAdjust} />
        ) : (
          <p className="text-sm text-zinc-500">No inventory records found.</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {total === 0 ? "0 records" : `${from}–${to} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || inventory.isFetching}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            disabled={page * limit >= total || inventory.isFetching}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function InventoryResults({
  items,
  canAdjust,
}: {
  items: Inventory[];
  canAdjust: boolean;
}) {
  return (
    <>
      <div className="hidden h-full min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Menu item</th>
              <th className="px-4 py-3 font-medium">Outlet</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Quantity</th>
              {canAdjust ? (
                <th className="px-4 py-3 font-medium">Adjust stock</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">{item.menuItemName}</td>
                <td className="px-4 py-3">
                  {item.outletName} <span className="text-zinc-500">({item.outletCode})</span>
                </td>
                <td className="px-4 py-3">{item.menuItemUnit ?? "—"}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                {canAdjust ? (
                  <td className="px-4 py-3">
                    <StockAdjustmentForm inventory={item} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">{item.menuItemName}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {item.outletName} ({item.outletCode})
              </p>
            </div>
            <p className="text-sm">
              Stock: {item.quantity} {item.menuItemUnit ?? ""}
            </p>
            {canAdjust ? <StockAdjustmentForm inventory={item} /> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function StockAdjustmentForm({ inventory }: { inventory: Inventory }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InventoryAdjustmentValues>({
    resolver: zodResolver(inventoryAdjustmentSchema),
    defaultValues: { quantity: inventory.quantity },
  });
  const save = useMutation({
    mutationFn: (quantity: number) =>
      adjustInventory(inventory.id, { quantity }),
    onSuccess: async (response) => {
      toast.success(response.message || "Inventory quantity updated");
      await queryClient.invalidateQueries({ queryKey: ["inventories"] });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.fieldErrors?.quantity?.[0]
      ) {
        setError("quantity", { message: error.fieldErrors.quantity[0] });
      } else {
        toast.error(error instanceof Error ? error.message : "Stock adjustment failed");
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={handleSubmit((values) => save.mutate(values.quantity))}
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label={`New stock quantity for ${inventory.menuItemName} at ${inventory.outletName}`}
          className="w-24"
          type="number"
          min={0}
          step={1}
          aria-invalid={Boolean(errors.quantity)}
          {...register("quantity", { valueAsNumber: true })}
        />
        <Button type="submit" disabled={save.isPending} className="shrink-0 px-3">
          {save.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
      {errors.quantity?.message ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {errors.quantity.message}
        </p>
      ) : null}
    </form>
  );
}

export function InventoryResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

function flattenZodErrors(
  errors: Record<string, string[] | undefined>,
): FieldErrors {
  const flattened: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0) {
      flattened[field] = messages;
    }
  }
  return flattened;
}
