import type { Metadata } from "next";
import { Suspense } from "react";

import { SalesList, SalesResultsSkeleton } from "@/components/sales/sales-list";

export const metadata: Metadata = {
  title: "Sales",
};

export default function SalesPage() {
  return (
    <div className="listing-route flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<SalesResultsSkeleton />}>
        <SalesList />
      </Suspense>
    </div>
  );
}
