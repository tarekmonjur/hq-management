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
    <Suspense fallback={<MenuItemsResultsSkeleton />}>
      <MenuItemsList />
    </Suspense>
  );
}
