import { z } from "zod";

const packageTestSchema = z.object({
  title: z.string().trim().min(2),
  tests: z.array(z.string().trim().min(1)).min(1),
  importance: z.string().trim().min(2),
});

export const healthPackageSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(2),
  summary: z.string().trim().optional(),
  oldPrice: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().int().min(1),
  discount: z.string().trim().optional(),
  icon: z.string().trim().optional(),
  labHours: z.string().trim().optional(),
  tests: z.array(packageTestSchema).min(1),
  active: z.boolean().optional(),
});
