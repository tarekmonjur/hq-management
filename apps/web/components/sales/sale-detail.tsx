"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { formatMoney, getSale } from "@/lib/api/sales";

export function SaleDetail({ id }: { id: string }) {
  const router = useRouter();
  const sale = useQuery({
    queryKey: ["sales", "detail", id],
    queryFn: () => getSale(id),
  });

  useEffect(() => {
    if (sale.error instanceof ApiError && sale.error.status === 401) {
      router.replace("/login");
    }
  }, [sale.error, router]);

  if (sale.isPending) {
    return <SaleDetailSkeleton />;
  }

  if (sale.error instanceof ApiError) {
    return (
      <section className="flex flex-col gap-3">
        <Link href="/sales" className="text-sm font-medium text-zinc-500 hover:text-foreground">
          Back to sales
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Sale</h1>
        <p className="text-sm text-red-600 dark:text-red-400">{sale.error.message}</p>
      </section>
    );
  }

  const record = sale.data;
  if (!record) {
    return null;
  }

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <Link href="/sales" className="text-sm font-medium text-zinc-500 hover:text-foreground">
        Back to sales
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Receipt {record.receiptNo}</h1>
        <p className="text-sm text-zinc-500">
          {record.outletName} ({record.outletCode}) · {new Date(record.createdAt).toLocaleString()}
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailItem label="Table" value={record.tableNo ?? "—"} />
        <DetailItem label="Order status" value={record.orderStatus} />
        <DetailItem label="Payment status" value={record.paymentStatus} />
        <DetailItem label="Total" value={formatMoney(record.total)} />
      </dl>

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Line</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">{item.menuItemName}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{formatMoney(item.unitPrice)}</td>
                <td className="px-4 py-3">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

export function SaleDetailSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
