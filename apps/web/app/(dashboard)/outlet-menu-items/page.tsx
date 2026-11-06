import type { Metadata } from "next";
import { Suspense } from "react";

import {
  OutletMenuAssignments,
  ResultsSkeleton,
} from "@/components/outlet-menu-items/outlet-menu-assignments";

export const metadata: Metadata = {
  title: "Outlet menus",
};

export default function OutletMenuItemsPage() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <OutletMenuAssignments />
    </Suspense>
  );
}
