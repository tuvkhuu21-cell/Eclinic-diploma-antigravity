import { z } from "zod";

const genderSchema = z.enum(["Эрэгтэй", "Эмэгтэй"]).optional();

export const doctorRegisterSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  specialty: z.string().min(1),
  gender: genderSchema,
  experience: z.coerce.number().int().min(0),
  fee: z.coerce.number().int().min(0),
  hospitalId: z.string().optional(),
  hospital: z.string().optional(),
  bio: z.string().optional(),
  supportsOnline: z.boolean().optional(),
  supportsInPerson: z.boolean().optional(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const doctorProfileUpdateSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  specialty: z.string().min(1).optional(),
  gender: genderSchema,
  experience: z.coerce.number().int().min(0).optional(),
  fee: z.coerce.number().int().min(0).optional(),
  hospitalId: z.string().optional(),
  hospital: z.string().optional(),
  bio: z.string().optional(),
  online: z.boolean().optional(),
  supportsOnline: z.boolean().optional(),
  supportsInPerson: z.boolean().optional(),
});
