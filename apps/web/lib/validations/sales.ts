import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "must be longer than or equal to 1 character")
    .max(max, `must be shorter than or equal to ${max} characters`)
    .optional();

export const ORDER_STATUSES = ["OPEN", "PREPARING", "SERVED", "CANCELLED"] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PAID", "REFUNDED"] as const;

export const salesQuerySchema = z
  .object({
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
    search: optionalText(50),
    outletId: z.string().uuid("must be a UUID").optional(),
    orderStatus: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    tableNo: optionalText(20),
    from: z.iso.date("must be a valid date").optional(),
    to: z.iso.date("must be a valid date").optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "from must be earlier than or equal to to",
  });

export type SalesQuery = z.infer<typeof salesQuerySchema>;

export function readSalesQuery(params: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  outletId?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  tableNo?: string | null;
  from?: string | null;
  to?: string | null;
}) {
  const input: Record<string, string> = {};
  if (params.page) input.page = params.page;
  if (params.limit) input.limit = params.limit;
  if (params.search?.trim()) input.search = params.search;
  if (params.outletId) input.outletId = params.outletId;
  if (params.orderStatus) input.orderStatus = params.orderStatus;
  if (params.paymentStatus) input.paymentStatus = params.paymentStatus;
  if (params.tableNo?.trim()) input.tableNo = params.tableNo;
  if (params.from) input.from = params.from;
  if (params.to) input.to = params.to;
  return salesQuerySchema.safeParse(input);
}
