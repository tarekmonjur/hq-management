import { z } from "zod";

const optionalSearch = z
  .string()
  .trim()
  .min(1, "must be longer than or equal to 1 character")
  .max(50, "must be shorter than or equal to 50 characters")
  .optional();

export const inventoryQuerySchema = z.object({
  page: z.coerce
    .number({ error: "must be an integer" })
    .int("must be an integer")
    .min(1, "must be greater than or equal to 1")
    .default(1),
  limit: z.coerce
    .number({ error: "must be an integer" })
    .int("must be an integer")
    .min(1, "must be greater than or equal to 1")
    .max(100, "must be shorter than or equal to 100")
    .default(20),
  search: optionalSearch,
  outletId: z.string().uuid("must be a UUID").optional(),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export const inventoryAdjustmentSchema = z.object({
  quantity: z
    .number({ error: "must be an integer" })
    .int("must be an integer")
    .min(0, "must be greater than or equal to 0"),
});

export type InventoryAdjustmentValues = z.infer<
  typeof inventoryAdjustmentSchema
>;

export function readInventoryQuery(params: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  outletId?: string | null;
}) {
  const input: Record<string, string> = {};
  if (params.page) input.page = params.page;
  if (params.limit) input.limit = params.limit;
  if (params.search?.trim()) input.search = params.search;
  if (params.outletId) input.outletId = params.outletId;
  return inventoryQuerySchema.safeParse(input);
}
