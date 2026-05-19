import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().optional(),
  phone: z.string().trim().min(6).optional(),
  role: z.enum(["PATIENT", "DOCTOR", "ADMIN"]).default("PATIENT"),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(8),
});
