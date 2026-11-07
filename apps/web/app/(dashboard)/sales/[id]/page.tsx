import type { Metadata } from "next";
import { Suspense } from "react";

import { SaleDetail, SaleDetailSkeleton } from "@/components/sales/sale-detail";

export const metadata: Metadata = {
  title: "Sale",
};

async function SaleContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SaleDetail id={id} />;
}

export default function SalePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<SaleDetailSkeleton />}>
      <SaleContent params={params} />
    </Suspense>
  );
}
