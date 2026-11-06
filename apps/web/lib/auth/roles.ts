export const OUTLET_ROLES = ["HQ_ADMIN", "SUPER_ADMIN"] as const;

export type OutletRole = (typeof OUTLET_ROLES)[number];

export function canViewOutlets(role: string | undefined) {
  return OUTLET_ROLES.some((allowed) => allowed === role);
}
