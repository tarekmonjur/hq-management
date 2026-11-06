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
    <Suspense fallback={<OutletsResultsSkeleton />}>
      <OutletsList />
    </Suspense>
  );
}
