"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listOutletMenuItems, type OutletMenuItem } from "@/lib/api/outlet-menu-items";
import { listOutlets } from "@/lib/api/outlets";
import { createSale, formatMoney, type Sale } from "@/lib/api/sales";
import { canChooseSaleOutlet, canUseSales } from "@/lib/auth/roles";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/validations/sales";

type TicketLine = {
  menuItemId: string;
  name: string;
  quantity: number;
  outletPrice: number | string | null;
};

const selectClassName =
  "h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground dark:border-zinc-700";

export function PosTerminal() {
  const queryClient = useQueryClient();
  const [outletId, setOutletId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lines, setLines] = useState<TicketLine[]>([]);
  const [tableNo, setTableNo] = useState("");
  const [orderStatus, setOrderStatus] = useState<(typeof ORDER_STATUSES)[number]>("SERVED");
  const [paymentStatus, setPaymentStatus] = useState<(typeof PAYMENT_STATUSES)[number]>("PAID");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });

  const choosesOutlet = canChooseSaleOutlet(profile.data?.role);
  const assignedOutletId = profile.data?.outletId ?? "";
  const activeOutletId = choosesOutlet ? outletId : assignedOutletId;

  const outlets = useQuery({
    queryKey: ["outlets", "pos"],
    queryFn: () => listOutlets({ page: 1, limit: 100 }),
    enabled: choosesOutlet,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const menu = useQuery({
    queryKey: ["outlet-menu-items", "pos", activeOutletId, debouncedSearch],
    queryFn: () =>
      listOutletMenuItems({
        page: 1,
        limit: 20,
        search: debouncedSearch,
        outletId: activeOutletId,
        isActive: "true",
      }),
    enabled: Boolean(activeOutletId) && debouncedSearch.length > 0,
  });

  const charge = useMutation({
    mutationFn: () =>
      createSale(
        {
          ...(choosesOutlet ? { outletId: activeOutletId } : {}),
          ...(tableNo.trim() ? { tableNo: tableNo.trim() } : {}),
          orderStatus,
          paymentStatus,
          items: lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
          })),
        },
        idempotencyKey,
      ),
    onSuccess: (response) => {
      const sale = response.data;
      setLastSale(sale);
      setLines([]);
      setTableNo("");
      setOrderStatus("SERVED");
      setPaymentStatus("PAID");
      setSearch("");
      setIdempotencyKey(crypto.randomUUID());
      toast.success(`Receipt ${sale.receiptNo} created`);
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not create the sale");
    },
  });

  function chooseOutlet(nextOutletId: string) {
    setOutletId(nextOutletId);
    setLines([]);
    setIdempotencyKey(crypto.randomUUID());
    setLastSale(null);
  }

  function addItem(item: OutletMenuItem) {
    setLines((current) => {
      const existing = current.find((line) => line.menuItemId === item.menuItemId);
      if (existing) {
        return current.map((line) =>
          line.menuItemId === item.menuItemId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...current,
        {
          menuItemId: item.menuItemId,
          name: item.menuItemName,
          quantity: 1,
          outletPrice: item.outletPrice,
        },
      ];
    });
    setSearch("");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matches = menu.data?.items ?? [];
    const exact = matches.filter(
      (item) => item.menuItemName.toLowerCase() === search.trim().toLowerCase(),
    );
    const match = exact.length === 1 ? exact[0] : undefined;
    if (match) {
      addItem(match);
    }
  }

  if (profile.isPending) {
    return <PosSkeleton />;
  }

  if (!canUseSales(profile.data?.role)) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to sales.</p>
      </section>
    );
  }

  if (!choosesOutlet && !assignedOutletId) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
        <p className="text-sm text-zinc-500">No outlet is assigned to this account.</p>
      </section>
    );
  }

  const menuError =
    menu.error instanceof ApiError && !menu.error.fieldErrors ? menu.error.message : null;
  const knownTotal = lines.every((line) => line.outletPrice !== null && line.outletPrice !== "")
    ? lines.reduce((sum, line) => sum + Number(line.outletPrice) * line.quantity, 0)
    : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
          <p className="text-sm text-zinc-500">
            Search an assigned item by name, then add it to the ticket.
          </p>
        </div>
        <Link
          href="/sales"
          className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
        >
          Sales history
        </Link>
      </div>

      {lastSale ? (
        <p className="rounded-lg border border-zinc-200 bg-background px-4 py-3 text-sm dark:border-zinc-800">
          Receipt {lastSale.receiptNo} · {formatMoney(lastSale.total)}{" "}
          <Link className="font-medium underline" href={`/sales/${lastSale.id}`}>
            View sale
          </Link>
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          {choosesOutlet ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-outlet">Outlet</Label>
              <select
                id="pos-outlet"
                className={selectClassName}
                value={outletId}
                onChange={(event) => chooseOutlet(event.target.value)}
              >
                <option value="">Select an outlet</option>
                {outlets.data?.items.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code})
                  </option>
                ))}
              </select>
              {outlets.error instanceof ApiError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{outlets.error.message}</p>
              ) : null}
            </div>
          ) : null}

          <form className="flex flex-col gap-2" onSubmit={submitSearch}>
            <Label htmlFor="pos-search">Item name</Label>
            <Input
              id="pos-search"
              autoFocus
              value={search}
              placeholder={activeOutletId ? "Type a name and press Enter" : "Select an outlet first"}
              disabled={!activeOutletId}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>

          {!activeOutletId ? (
            <p className="text-sm text-zinc-500">Choose an outlet to look up items.</p>
          ) : menu.isFetching ? (
            <PosSkeleton />
          ) : menuError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{menuError}</p>
          ) : debouncedSearch && menu.data?.items.length === 0 ? (
            <p className="text-sm text-zinc-500">No active items match that name.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {menu.data?.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-background px-4 py-3 text-left hover:border-foreground dark:border-zinc-800"
                    onClick={() => addItem(item)}
                  >
                    <span className="font-medium">{item.menuItemName}</span>
                    <span className="text-sm text-zinc-500">{formatMoney(item.outletPrice)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-background p-4 lg:sticky lg:top-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Ticket</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-zinc-500">No items yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li key={line.menuItemId} className="flex flex-col gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-sm text-zinc-500">{formatMoney(line.outletPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="size-11 bg-transparent px-0 text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                      aria-label={`Decrease ${line.name}`}
                      onClick={() =>
                        setLines((current) =>
                          current.map((item) =>
                            item.menuItemId === line.menuItemId
                              ? { ...item, quantity: Math.max(1, item.quantity - 1) }
                              : item,
                          ),
                        )
                      }
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <Button
                      className="size-11 bg-transparent px-0 text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                      aria-label={`Increase ${line.name}`}
                      onClick={() =>
                        setLines((current) =>
                          current.map((item) =>
                            item.menuItemId === line.menuItemId
                              ? { ...item, quantity: item.quantity + 1 }
                              : item,
                          ),
                        )
                      }
                    >
                      +
                    </Button>
                    <Button
                      className="ml-auto bg-transparent text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.menuItemId !== line.menuItemId),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="table-no">Table</Label>
              <Input
                id="table-no"
                maxLength={20}
                value={tableNo}
                placeholder="T12"
                onChange={(event) => setTableNo(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-status">Order status</Label>
              <select
                id="order-status"
                className={selectClassName}
                value={orderStatus}
                onChange={(event) =>
                  setOrderStatus(event.target.value as (typeof ORDER_STATUSES)[number])
                }
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-status">Payment status</Label>
              <select
                id="payment-status"
                className={selectClassName}
                value={paymentStatus}
                onChange={(event) =>
                  setPaymentStatus(event.target.value as (typeof PAYMENT_STATUSES)[number])
                }
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">
              {knownTotal === null ? "Total confirmed at charge" : "Estimated total"}
            </span>
            <span className="text-base font-semibold">
              {knownTotal === null ? "" : formatMoney(knownTotal)}
            </span>
          </div>

          <Button
            disabled={lines.length === 0 || !activeOutletId || charge.isPending}
            onClick={() => charge.mutate()}
          >
            {charge.isPending ? "Charging…" : "Charge"}
          </Button>
        </aside>
      </div>
    </section>
  );
}

export function PosSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}
