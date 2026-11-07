export const OUTLET_ROLES = ["HQ_ADMIN", "SUPER_ADMIN"] as const;

export type OutletRole = (typeof OUTLET_ROLES)[number];

export function canViewOutlets(role: string | undefined) {
  return OUTLET_ROLES.some((allowed) => allowed === role);
}

export function canManageMenuItems(role: string | undefined) {
  return role === "HQ_ADMIN" || role === "SUPER_ADMIN";
}

export function canManageOutletMenus(role: string | undefined) {
  return role === "HQ_ADMIN" || role === "SUPER_ADMIN";
}

const SALES_ROLES = ["SUPER_ADMIN", "HQ_ADMIN", "OUTLET_MANAGER", "OUTLET_STAFF"] as const;

export function canUseSales(role: string | undefined) {
  return SALES_ROLES.some((allowed) => allowed === role);
}

export function canChooseSaleOutlet(role: string | undefined) {
  return role === "HQ_ADMIN" || role === "SUPER_ADMIN";
}
