"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { PrintReceiptButton, SaleReceipt } from "@/components/sales/sale-receipt";
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
import { cn } from "@/lib/utils";
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
  const [dismissedQuery, setDismissedQuery] = useState("");
  const [highlightState, setHighlightState] = useState({ key: "", index: -1 });
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

  const trimmedSearch = search.trim();
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

  const queryReady = debouncedSearch.length > 0 && debouncedSearch === trimmedSearch;
  const matches = queryReady ? (menu.data?.items ?? []) : [];
  const matchKey = matches.map((item) => item.id).join("|");
  const highlight = highlightState.key === matchKey ? highlightState.index : -1;
  const showList =
    Boolean(activeOutletId) && trimmedSearch.length > 0 && dismissedQuery !== trimmedSearch;

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
      document.getElementById("pos-search")?.focus();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not create the sale");
    },
  });

  function chooseOutlet(nextOutletId: string) {
    setOutletId(nextOutletId);
    setLines([]);
    setSearch("");
    setIdempotencyKey(crypto.randomUUID());
    setLastSale(null);
  }

  function setHighlight(index: number) {
    setHighlightState({ key: matchKey, index });
    const item = matches[index];
    if (item) {
      document.getElementById(`pos-item-${item.id}`)?.scrollIntoView({ block: "nearest" });
    }
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
    setDismissedQuery("");
    document.getElementById("pos-search")?.focus();
  }

  function addFromSearch() {
    const selected = highlight >= 0 ? matches[highlight] : undefined;
    if (selected) {
      addItem(selected);
      return;
    }

    const exact = matches.filter(
      (item) => item.menuItemName.toLowerCase() === trimmedSearch.toLowerCase(),
    );
    const match = exact.length === 1 ? exact[0] : undefined;
    if (match) {
      addItem(match);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setDismissedQuery(trimmedSearch);
      setHighlightState({ key: matchKey, index: -1 });
      return;
    }

    if (event.key === "ArrowDown" && showList && matches.length > 0) {
      event.preventDefault();
      setHighlight(highlight < 0 ? 0 : Math.min(matches.length - 1, highlight + 1));
      return;
    }

    if (event.key === "ArrowUp" && showList && matches.length > 0) {
      event.preventDefault();
      setHighlight(highlight <= 0 ? 0 : highlight - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      addFromSearch();
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
  const activeOptionId = highlight >= 0 ? `pos-item-${matches[highlight]?.id ?? ""}` : undefined;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
          <p className="text-sm text-zinc-500">
            Search by name, then use the arrow keys and Enter to add an item.
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link className="text-sm font-medium underline" href={`/sales/${lastSale.id}`}>
              View sale
            </Link>
            <PrintReceiptButton />
          </div>
          <SaleReceipt sale={lastSale} />
        </div>
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

          <div className="relative flex flex-col gap-2">
            <Label htmlFor="pos-search">Item name</Label>
            <Input
              id="pos-search"
              role="combobox"
              aria-expanded={showList}
              aria-controls="pos-item-list"
              aria-activedescendant={showList ? activeOptionId : undefined}
              aria-autocomplete="list"
              autoFocus
              autoComplete="off"
              value={search}
              placeholder={
                activeOutletId ? "Type a name, then press Enter" : "Select an outlet first"
              }
              disabled={!activeOutletId}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {showList ? (
              <ul
                id="pos-item-list"
                role="listbox"
                className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-background shadow-lg dark:border-zinc-800"
              >
                {!queryReady || menu.isFetching ? (
                  <li className="px-4 py-3 text-sm text-zinc-500">Searching…</li>
                ) : menuError ? (
                  <li className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{menuError}</li>
                ) : matches.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-zinc-500">No active items match that name.</li>
                ) : (
                  matches.map((item, index) => (
                    <li
                      key={item.id}
                      id={`pos-item-${item.id}`}
                      role="option"
                      aria-selected={index === highlight}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-left",
                          index === highlight
                            ? "bg-foreground text-background"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                        )}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => addItem(item)}
                      >
                        <span className="font-medium">{item.menuItemName}</span>
                        <span className="text-sm">Price: {formatMoney(item.outletPrice)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-zinc-500">Added items will appear here.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li
                  key={line.menuItemId}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-background p-3 dark:border-zinc-800"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 font-medium">
                      {line.name}{" "}
                      <span className="text-sm font-normal text-zinc-500">
                        Price: {formatMoney(line.outletPrice)}
                      </span>
                    </p>
                    <p className="shrink-0 text-sm font-medium">
                      {line.outletPrice === null || line.outletPrice === ""
                        ? "—"
                        : formatMoney(Number(line.outletPrice) * line.quantity)}
                    </p>
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
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-background p-4 lg:sticky lg:top-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Ticket</h2>
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
