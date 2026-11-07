"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PrintReceiptButton, SaleReceipt } from "@/components/sales/sale-receipt";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getSale } from "@/lib/api/sales";

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
    <section className="sale-detail flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Sale details</h1>
        <Link href="/sales" className="text-sm font-medium text-zinc-500 hover:text-foreground">
          Back to sales
        </Link>
        <PrintReceiptButton />
      </div>
      <SaleReceipt sale={record} />
    </section>
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
