import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "is required")
    .email("must be an email"),
  password: z
    .string()
    .min(8, "must be longer than or equal to 8 characters")
    .max(72, "must be shorter than or equal to 72 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;
