import type { Metadata } from "next";

import { MenuItemDetail } from "@/components/menu-items/menu-item-editor";

export const metadata: Metadata = {
  title: "Menu item",
};

export default async function MenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MenuItemDetail id={id} />;
}
