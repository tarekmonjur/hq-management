import type { Metadata } from "next";

import { CreateMenuItem } from "@/components/menu-items/menu-item-editor";

export const metadata: Metadata = {
  title: "New menu item",
};

export default function NewMenuItemPage() {
  return <CreateMenuItem />;
}
