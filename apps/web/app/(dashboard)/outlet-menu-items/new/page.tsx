import type { Metadata } from "next";

import { AssignOutletMenuItem } from "@/components/outlet-menu-items/assign-outlet-menu-item";

export const metadata: Metadata = {
  title: "Assign menu item",
};

export default function AssignOutletMenuItemPage() {
  return <AssignOutletMenuItem />;
}
