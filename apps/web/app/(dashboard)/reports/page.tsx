import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportsSkeleton, ReportsView } from "@/components/reports/reports-view";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsView />
    </Suspense>
  );
}
