import type { Metadata } from "next";
import { Suspense } from "react";

import {
  EditorSkeleton,
  MenuItemDetail,
} from "@/components/menu-items/menu-item-editor";

export const metadata: Metadata = {
  title: "Menu item",
};

async function MenuItemContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MenuItemDetail id={id} />;
}

export default function MenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <MenuItemContent params={params} />
    </Suspense>
  );
}
