import type { Metadata } from "next";
import { Suspense } from "react";

import {
  InventoryList,
  InventoryResultsSkeleton,
} from "@/components/inventories/inventory-list";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function InventoryPage() {
  return (
    <div className="listing-route flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<InventoryResultsSkeleton />}>
        <InventoryList />
      </Suspense>
    </div>
  );
}
