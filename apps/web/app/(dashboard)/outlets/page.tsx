import type { Metadata } from "next";
import { Suspense } from "react";

import {
  OutletsList,
  OutletsResultsSkeleton,
} from "@/components/outlets/outlets-list";

export const metadata: Metadata = {
  title: "Outlets",
};

export default function OutletsPage() {
  return (
    <div className="listing-route flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<OutletsResultsSkeleton />}>
        <OutletsList />
      </Suspense>
    </div>
  );
}
