import type { Metadata } from "next";
import { Suspense } from "react";

import { PosSkeleton, PosTerminal } from "@/components/sales/pos-terminal";

export const metadata: Metadata = {
  title: "Point of sale",
};

export default function NewSalePage() {
  return (
    <Suspense fallback={<PosSkeleton />}>
      <PosTerminal />
    </Suspense>
  );
}
