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
import { listOutlets } from "@/lib/api/outlets";
import { formatMoney, listSales, type Sale } from "@/lib/api/sales";
import { canChooseSaleOutlet, canUseSales } from "@/lib/auth/roles";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  readSalesQuery,
  type SalesQuery,
} from "@/lib/validations/sales";

type Draft = {
  search: string;
  outletId: string;
  orderStatus: string;
  paymentStatus: string;
  tableNo: string;
  from: string;
  to: string;
};

const selectClassName =
  "h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground dark:border-zinc-700";

export function SalesList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftState, setDraftState] = useState<{ key: string; value: Draft } | null>(null);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });
  const choosesOutlet = canChooseSaleOutlet(profile.data?.role);
  const allowed = canUseSales(profile.data?.role);

  const parsed = readSalesQuery({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    search: searchParams.get("search"),
    outletId: choosesOutlet ? searchParams.get("outletId") : null,
    orderStatus: searchParams.get("orderStatus"),
    paymentStatus: searchParams.get("paymentStatus"),
    tableNo: searchParams.get("tableNo"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  const sales = useQuery({
    queryKey: ["sales", "list", parsed.success ? parsed.data : null],
    queryFn: () => listSales(parsed.success ? parsed.data : { page: 1, limit: 20 }),
    enabled: allowed && parsed.success,
  });

  const outlets = useQuery({
    queryKey: ["outlets", "sales-filter"],
    queryFn: () => listOutlets({ page: 1, limit: 100 }),
    enabled: choosesOutlet,
  });

  const paramsKey = `${searchParams.toString()}|${choosesOutlet}`;
  const draftFromParams: Draft = {
    search: searchParams.get("search") ?? "",
    outletId: choosesOutlet ? (searchParams.get("outletId") ?? "") : "",
    orderStatus: searchParams.get("orderStatus") ?? "",
    paymentStatus: searchParams.get("paymentStatus") ?? "",
    tableNo: searchParams.get("tableNo") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  };
  const draft = draftState?.key === paramsKey ? draftState.value : draftFromParams;

  function updateDraft(patch: Partial<Draft>) {
    setDraftState({ key: paramsKey, value: { ...draft, ...patch } });
  }

  useEffect(() => {
    if (sales.error instanceof ApiError && sales.error.status === 401) {
      router.replace("/login");
    }
  }, [sales.error, router]);

  const apiFieldErrors = sales.error instanceof ApiError ? sales.error.fieldErrors : undefined;
  const queryErrors = parsed.success
    ? {}
    : flattenZodErrors(parsed.error.flatten().fieldErrors);
  const fieldErrors = { ...queryErrors, ...clientErrors, ...apiFieldErrors };

  function replaceParams(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readSalesQuery({
      page: "1",
      limit: searchParams.get("limit"),
      search: draft.search,
      outletId: choosesOutlet ? draft.outletId : null,
      orderStatus: draft.orderStatus,
      paymentStatus: draft.paymentStatus,
      tableNo: draft.tableNo,
      from: draft.from,
      to: draft.to,
    });
    if (!result.success) {
      setClientErrors(flattenZodErrors(result.error.flatten().fieldErrors));
      return;
    }

    setClientErrors({});
    replaceParams(toParams(result.data, searchParams.get("limit")));
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (!choosesOutlet) {
      params.delete("outletId");
    }
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    replaceParams(params);
  }

  if (profile.isPending) {
    return <SalesResultsSkeleton />;
  }

  if (!allowed) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to sales.</p>
      </section>
    );
  }

  const pageError =
    sales.error instanceof ApiError && !sales.error.fieldErrors ? sales.error.message : null;
  const list = sales.data;
  const page = list?.page ?? (parsed.success ? parsed.data.page : 1);
  const limit = list?.limit ?? (parsed.success ? parsed.data.limit : 20);
  const total = list?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-zinc-500">
            {choosesOutlet
              ? "Sales for the outlets you can access."
              : "Sales for your outlet."}
          </p>
        </div>
        <Link
          href="/sales/new"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
        >
          New sale
        </Link>
      </div>

      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        <FilterField
          id="search"
          label="Search"
          placeholder="Receipt number or table"
          value={draft.search}
          error={fieldErrors.search?.[0]}
          onChange={(searchValue) => updateDraft({ search: searchValue })}
        />
        <FilterField
          id="tableNo"
          label="Table"
          placeholder="T12"
          value={draft.tableNo}
          error={fieldErrors.tableNo?.[0]}
          onChange={(tableNoValue) => updateDraft({ tableNo: tableNoValue })}
        />
        <SelectField
          id="orderStatus"
          label="Order status"
          value={draft.orderStatus}
          error={fieldErrors.orderStatus?.[0]}
          options={ORDER_STATUSES}
          onChange={(orderStatus) => updateDraft({ orderStatus })}
        />
        <SelectField
          id="paymentStatus"
          label="Payment status"
          value={draft.paymentStatus}
          error={fieldErrors.paymentStatus?.[0]}
          options={PAYMENT_STATUSES}
          onChange={(paymentStatus) => updateDraft({ paymentStatus })}
        />
        <FilterField
          id="from"
          label="From"
          type="date"
          value={draft.from}
          error={fieldErrors.from?.[0]}
          onChange={(from) => updateDraft({ from })}
        />
        <FilterField
          id="to"
          label="To"
          type="date"
          value={draft.to}
          error={fieldErrors.to?.[0]}
          onChange={(to) => updateDraft({ to })}
        />
        {choosesOutlet ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="outletId">Outlet</Label>
            <select
              id="outletId"
              className={selectClassName}
              value={draft.outletId}
              onChange={(event) =>
                updateDraft({ outletId: event.target.value })
              }
            >
              <option value="">All outlets</option>
              {outlets.data?.items.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </option>
              ))}
            </select>
            {fieldErrors.outletId?.[0] ? (
              <p className="text-sm text-red-600 dark:text-red-400">{fieldErrors.outletId[0]}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={sales.isFetching}>
            Apply
          </Button>
        </div>
      </form>

      {pageError ? <p className="text-sm text-red-600 dark:text-red-400">{pageError}</p> : null}

      {sales.isFetching ? (
        <SalesResultsSkeleton />
      ) : !parsed.success || sales.isError ? null : list && list.items.length > 0 ? (
        <SaleResults items={list.items} />
      ) : (
        <p className="text-sm text-zinc-500">No sales found.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {total === 0 ? "0 sales" : `${from}–${to} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button disabled={page <= 1 || sales.isFetching} onClick={() => goToPage(page - 1)}>
            Previous
          </Button>
          <Button
            disabled={page * limit >= total || sales.isFetching}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function toParams(query: SalesQuery, limit: string | null) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.outletId) params.set("outletId", query.outletId);
  if (query.orderStatus) params.set("orderStatus", query.orderStatus);
  if (query.paymentStatus) params.set("paymentStatus", query.paymentStatus);
  if (query.tableNo) params.set("tableNo", query.tableNo);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (limit) params.set("limit", limit);
  return params;
}

function FilterField({
  id,
  label,
  placeholder,
  value,
  error,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  error,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function SaleResults({ items }: { items: Sale[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">Outlet</th>
              <th className="px-4 py-3 font-medium">Table</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((sale) => (
              <tr key={sale.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/sales/${sale.id}`} className="hover:underline">
                    {sale.receiptNo}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {sale.outletName}
                  <span className="text-zinc-500"> · {sale.outletCode}</span>
                </td>
                <td className="px-4 py-3">{sale.tableNo ?? "—"}</td>
                <td className="px-4 py-3">{sale.orderStatus}</td>
                <td className="px-4 py-3">{sale.paymentStatus}</td>
                <td className="px-4 py-3">{formatMoney(sale.total)}</td>
                <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((sale) => (
          <li key={sale.id}>
            <Link
              href={`/sales/${sale.id}`}
              className="block rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800"
            >
              <p className="font-medium">Receipt {sale.receiptNo}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {sale.outletName} · {sale.tableNo ?? "No table"}
              </p>
              <p className="mt-1 text-sm">
                {sale.orderStatus} · {sale.paymentStatus} · {formatMoney(sale.total)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SalesResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
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
