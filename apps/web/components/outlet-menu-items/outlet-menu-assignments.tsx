"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { ApiError, type FieldErrors } from "@/lib/api/client";
import {
  listOutletMenuItems,
  removeOutletMenuItem,
  updateOutletMenuPrice,
  type OutletMenuItem,
} from "@/lib/api/outlet-menu-items";
import { listOutlets } from "@/lib/api/outlets";
import { canManageOutletMenus } from "@/lib/auth/roles";
import {
  outletPriceSchema,
  readOutletMenuItemsQuery,
  type OutletPriceValues,
} from "@/lib/validations/outlet-menu-items";

export function OutletMenuAssignments() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });
  const canManage = canManageOutletMenus(profile.data?.role);
  const parsed = readOutletMenuItemsQuery({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    search: searchParams.get("search"),
    outletId: canManage ? searchParams.get("outletId") : null,
    isActive: searchParams.get("isActive"),
  });
  const listQuery = parsed.success
    ? canManage
      ? parsed.data
      : { ...parsed.data, outletId: undefined }
    : null;

  const assignments = useQuery({
    queryKey: ["outlet-menu-items", listQuery],
    queryFn: () => listOutletMenuItems(listQuery ?? { page: 1, limit: 20 }),
    enabled: profile.isSuccess && parsed.success,
  });

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (assignments.error instanceof ApiError && assignments.error.status === 401) {
      router.replace("/login");
    }
  }, [assignments.error, router]);

  function replaceParams(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = readOutletMenuItemsQuery({
      page: "1",
      limit: searchParams.get("limit"),
      search,
      outletId: canManage ? String(form.get("outletId") ?? "") : null,
      isActive: String(form.get("isActive") ?? ""),
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
    if (canManage && result.data.outletId) {
      params.set("outletId", result.data.outletId);
    }
    if (result.data.isActive) {
      params.set("isActive", result.data.isActive);
    }
    const limit = searchParams.get("limit");
    if (limit) {
      params.set("limit", limit);
    }
    replaceParams(params);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (!canManage) {
      params.delete("outletId");
    }
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    replaceParams(params);
  }

  const apiFieldErrors =
    assignments.error instanceof ApiError ? assignments.error.fieldErrors : undefined;
  const queryErrors = parsed.success ? {} : flattenZodErrors(parsed.error.flatten().fieldErrors);
  const fieldErrors = { ...queryErrors, ...clientErrors, ...apiFieldErrors };
  const pageError =
    assignments.error instanceof ApiError && !assignments.error.fieldErrors
      ? assignments.error.message
      : null;
  const list = assignments.data;
  const page = list?.page ?? (parsed.success ? parsed.data.page : 1);
  const limit = list?.limit ?? (parsed.success ? parsed.data.limit : 20);
  const total = list?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Outlet menus</h1>
          <p className="text-sm text-zinc-500">
            {canManage ? "Assignments for your company outlets." : "Menu items for your outlet."}
          </p>
        </div>
        {profile.isSuccess && canManage ? (
          <Link
            href="/outlet-menu-items/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
          >
            Assign menu item
          </Link>
        ) : null}
      </div>

      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={applyFilters}>
        <TextFilter
          id="search"
          label="Search"
          placeholder="Menu item name"
          value={search}
          error={fieldErrors.search?.[0]}
          onChange={setSearch}
        />
        {canManage ? (
          <OutletFilter
            selectedId={searchParams.get("outletId") ?? ""}
            error={fieldErrors.outletId?.[0]}
          />
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="isActive">Status</Label>
          <select
            id="isActive"
            name="isActive"
            defaultValue={searchParams.get("isActive") ?? ""}
            className="h-11 rounded-lg border border-zinc-300 bg-background px-3 text-sm dark:border-zinc-700"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {fieldErrors.isActive?.[0] ? (
            <p className="text-sm text-red-600 dark:text-red-400">{fieldErrors.isActive[0]}</p>
          ) : null}
        </div>
        <div className="flex items-end">
          {assignments.isFetching ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Button type="submit" className="w-full">
              Apply
            </Button>
          )}
        </div>
      </form>

      {pageError ? <p className="text-sm text-red-600 dark:text-red-400">{pageError}</p> : null}

      {assignments.isFetching || profile.isPending ? (
        <ResultsSkeleton />
      ) : !parsed.success || assignments.isError ? null : list && list.items.length > 0 ? (
        <AssignmentResults items={list.items} canManage={canManage} />
      ) : (
        <p className="text-sm text-zinc-500">No outlet menu items found.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {total === 0 ? "0 assignments" : `${from}–${to} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button disabled={page <= 1 || assignments.isFetching} onClick={() => goToPage(page - 1)}>
            Previous
          </Button>
          <Button
            disabled={page * limit >= total || assignments.isFetching}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function AssignmentResults({
  items,
  canManage,
}: {
  items: OutletMenuItem[];
  canManage: boolean;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Outlet</th>
              <th className="px-4 py-3 font-medium">Menu item</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Active</th>
              {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3">{item.outletName}</td>
                <td className="px-4 py-3 font-medium">{item.menuItemName}</td>
                <td className="px-4 py-3">
                  {canManage ? <PriceEditor item={item} /> : formatPrice(item.outletPrice)}
                </td>
                <td className="px-4 py-3">{item.isActive ? "Yes" : "No"}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <DeleteAssignment item={item} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">{item.menuItemName}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.outletName}</p>
              <p className="mt-1 text-sm">{item.isActive ? "Active" : "Inactive"}</p>
            </div>
            {canManage ? (
              <>
                <PriceEditor item={item} />
                <DeleteAssignment item={item} />
              </>
            ) : (
              <p className="text-sm">{formatPrice(item.outletPrice)}</p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function PriceEditor({ item }: { item: OutletMenuItem }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<OutletPriceValues>({
    resolver: zodResolver(outletPriceSchema),
    defaultValues: {
      outletPrice: item.outletPrice == null ? "" : String(item.outletPrice),
    },
  });
  const save = useMutation({
    mutationFn: (outletPrice: number) =>
      updateOutletMenuPrice(item.menuItemId, { outletId: item.outletId, outletPrice }),
    onSuccess: async (response) => {
      toast.success(response.message || "Price updated");
      await queryClient.invalidateQueries({ queryKey: ["outlet-menu-items"] });
    },
  });

  useEffect(() => {
    if (!(save.error instanceof ApiError)) {
      return;
    }
    if (save.error.fieldErrors?.outletPrice?.[0]) {
      setError("outletPrice", { message: save.error.fieldErrors.outletPrice[0] });
      setFormError(null);
      return;
    }
    setFormError(save.error.message);
  }, [save.error, setError]);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        save.mutate(Number(values.outletPrice));
      })}
    >
      <Input
        aria-label={`Price for ${item.menuItemName}`}
        inputMode="decimal"
        aria-invalid={Boolean(isSubmitted && errors.outletPrice)}
        {...register("outletPrice")}
      />
      {isSubmitted && errors.outletPrice?.message ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.outletPrice.message}</p>
      ) : null}
      {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
      {save.isPending ? (
        <Skeleton className="h-11 w-24" />
      ) : (
        <Button type="submit" className="w-24">
          Save
        </Button>
      )}
    </form>
  );
}

function DeleteAssignment({ item }: { item: OutletMenuItem }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => removeOutletMenuItem(item.menuItemId, item.outletId),
    onSuccess: async (response) => {
      toast.success(response.message || "Assignment removed");
      await queryClient.invalidateQueries({ queryKey: ["outlet-menu-items"] });
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Delete failed");
    },
  });

  return (
    <div className="flex flex-col gap-2">
      {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
      {remove.isPending ? (
        <Skeleton className="h-11 w-28" />
      ) : confirming ? (
        <div className="flex gap-2">
          <Button onClick={() => remove.mutate()}>Confirm</Button>
          <Button
            className="bg-transparent text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          className="bg-transparent text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          onClick={() => setConfirming(true)}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

function OutletFilter({ selectedId, error }: { selectedId: string; error?: string }) {
  const [search, setSearch] = useState("");
  const outlets = useQuery({
    queryKey: ["outlets", "filter", search],
    queryFn: () => listOutlets({ page: 1, limit: 20, search: search.trim() || undefined }),
  });

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="outlet-filter-search">Outlet</Label>
      <Input
        id="outlet-filter-search"
        value={search}
        placeholder="Search outlets"
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        id="outletId"
        name="outletId"
        defaultValue={selectedId}
        aria-invalid={Boolean(error)}
        className="h-11 rounded-lg border border-zinc-300 bg-background px-3 text-sm dark:border-zinc-700"
      >
        <option value="">All outlets</option>
        {(outlets.data?.items ?? []).map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function TextFilter({
  id,
  label,
  placeholder,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

function formatPrice(value: OutletMenuItem["outletPrice"]) {
  return value == null || value === "" ? "—" : String(value);
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
