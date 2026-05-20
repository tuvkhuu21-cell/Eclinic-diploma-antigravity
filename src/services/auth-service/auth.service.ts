import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/jwt";
import { ApiError } from "@/lib/errors";
import { comparePassword, hashPassword } from "@/lib/bcrypt";
import type { z } from "zod";
import type { loginSchema } from "./auth.schema";

type AuthRole = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";
type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role?: AuthRole;
  hospitalName?: string;
  hospitalType?: string;
  hospitalAddress?: string;
  hospitalDistrict?: string;
};
type LoginInput = z.infer<typeof loginSchema>;

function authPayload(user: { id: string; email: string; role: AuthRole; firstName: string; lastName?: string | null }) {
  const token = signJwt({ userId: user.id, role: user.role });
  return { token, user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName || undefined } };
}

export const authService = {
  async register(input: RegisterInput) {
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ApiError(409, "Email already registered");
    if (input.phone) {
      const phoneExists = await prisma.user.findFirst({ where: { phone: input.phone } });
      if (phoneExists) throw new ApiError(409, "Phone already registered");
    }
    const passwordHash = await hashPassword(input.password);
    const role = input.role || "PATIENT";
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role,
        patientProfile: role === "PATIENT" ? { create: {} } : undefined,
        hospitalAccount: role === "HOSPITAL" ? {
          create: {
            name: input.hospitalName || input.firstName,
            type: input.hospitalType || "Эмнэлэг",
            description: `${input.hospitalName || input.firstName} байгууллагын профайл.`,
            phone: input.phone,
            address: input.hospitalAddress || "Улаанбаатар хот",
            district: input.hospitalDistrict || "Сүхбаатар",
            latitude: 47.9186,
            longitude: 106.9176,
          },
        } : undefined,
      },
    });
    return authPayload(user);
  },
  async login(input: LoginInput) {
    const identifier = input.email.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
    });
    if (!user || !(await comparePassword(input.password, user.passwordHash))) throw new ApiError(401, "Invalid credentials");
    return authPayload(user);
  },
};
