import { z } from "zod";
export const sharedRegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8), firstName: z.string().min(2), lastName: z.string().optional(), role: z.enum(["PATIENT", "DOCTOR", "HOSPITAL", "ADMIN"]).default("PATIENT") });
export const sharedLoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

