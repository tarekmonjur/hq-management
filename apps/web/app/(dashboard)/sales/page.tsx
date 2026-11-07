import type { Metadata } from "next";
import { Suspense } from "react";

import { SalesList, SalesResultsSkeleton } from "@/components/sales/sales-list";

export const metadata: Metadata = {
  title: "Sales",
};

export default function SalesPage() {
  return (
    <Suspense fallback={<SalesResultsSkeleton />}>
      <SalesList />
    </Suspense>
  );
}
