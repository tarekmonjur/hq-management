import { z } from "zod";

export const MENU_ITEM_UNITS = [
  "piece",
  "kg",
  "g",
  "liter",
  "ml",
  "portion",
  "serving",
  "cup",
  "bottle",
  "can",
  "pack",
  "combo",
  "set",
  "box",
  "bucket",
] as const;

export type MenuItemUnit = (typeof MENU_ITEM_UNITS)[number];

const optionalSearch = z
  .string()
  .trim()
  .min(1, "must be longer than or equal to 1 character")
  .max(50, "must be shorter than or equal to 50 characters")
  .optional();

export const menuItemsQuerySchema = z.object({
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
});

export type MenuItemsQuery = z.infer<typeof menuItemsQuerySchema>;

export function readMenuItemsQuery(params: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
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
  return menuItemsQuerySchema.safeParse(input);
}

export const menuItemFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "is required")
    .max(50, "must be shorter than or equal to 50 characters"),
  description: z.string().trim(),
  basePrice: z
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
    }, "must be between 0 and 99999999.99"),
  unit: z.union([z.enum(MENU_ITEM_UNITS), z.literal("")]),
});

export type MenuItemFormValues = z.infer<typeof menuItemFormSchema>;

export type MenuItemPayload = {
  name: string;
  description: string | null;
  basePrice: number | null;
  unit: MenuItemUnit | null;
};

export function toMenuItemPayload(values: MenuItemFormValues): MenuItemPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() ? values.description.trim() : null,
    basePrice: values.basePrice.trim() === "" ? null : Number(values.basePrice),
    unit: values.unit === "" ? null : values.unit,
  };
}
