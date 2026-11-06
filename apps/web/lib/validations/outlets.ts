import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "must be longer than or equal to 1 character")
    .max(max, `must be shorter than or equal to ${max} characters`)
    .optional();

export const outletsQuerySchema = z.object({
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
  search: optionalText(255),
  code: optionalText(20),
  location: optionalText(255),
});

export type OutletsQuery = z.infer<typeof outletsQuerySchema>;

export function readOutletsQuery(params: {
  page?: string | null;
  limit?: string | null;
  search?: string | null;
  code?: string | null;
  location?: string | null;
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
  if (params.code?.trim()) {
    input.code = params.code;
  }
  if (params.location?.trim()) {
    input.location = params.location;
  }

  return outletsQuerySchema.safeParse(input);
}
