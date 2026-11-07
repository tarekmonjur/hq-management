import type { Metadata } from "next";
import { Suspense } from "react";

import {
  MenuItemsList,
  MenuItemsResultsSkeleton,
} from "@/components/menu-items/menu-items-list";

export const metadata: Metadata = {
  title: "Menu items",
};

export default function MenuItemsPage() {
  return (
    <div className="listing-route flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<MenuItemsResultsSkeleton />}>
        <MenuItemsList />
      </Suspense>
    </div>
  );
}
