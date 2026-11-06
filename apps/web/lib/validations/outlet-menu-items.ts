import { z } from "zod";

const priceField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value),
    "must be a number with at most 2 decimal places",
  )
  .refine((value) => {
    if (value === "") {
      return true;
    }
    const price = Number(value);
    return price >= 0 && price <= 99999999.99;
  }, "must be between 0 and 99999999.99");

export const outletMenuItemsQuerySchema = z.object({
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
  search: z
    .string()
    .trim()
    .min(1, "must be longer than or equal to 1 character")
    .max(50, "must be shorter than or equal to 50 characters")
    .optional(),
  outletId: z.string().uuid("must be a UUID").optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type OutletMenuItemsQuery = z.infer<typeof outletMenuItemsQuerySchema>;

export function readOutletMenuItemsQuery(params: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  outletId?: string | null;
  isActive?: string | null;
}) {
  const input: Record<string, string> = {};
  if (params.page) {
    input.page = params.page;
  }
  if (params.limit) {
    input.limit = params.limit;
  }
  if (params.search?.trim()) {
    input.search = params.search;
  }
  if (params.outletId) {
    input.outletId = params.outletId;
  }
  if (params.isActive === "true" || params.isActive === "false") {
    input.isActive = params.isActive;
  }
  return outletMenuItemsQuerySchema.safeParse(input);
}

export const assignOutletMenuItemSchema = z.object({
  outletId: z.string().uuid("must be a UUID"),
  menuItemId: z.string().uuid("must be a UUID"),
  outletPrice: priceField,
  isActive: z.boolean(),
});

export type AssignOutletMenuItemValues = z.infer<typeof assignOutletMenuItemSchema>;

export const outletPriceSchema = z.object({
  outletPrice: priceField.refine((value) => value !== "", "is required"),
});

export type OutletPriceValues = z.infer<typeof outletPriceSchema>;
