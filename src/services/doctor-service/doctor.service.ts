import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/jwt";
import { ApiError } from "@/lib/errors";
import { hashPassword } from "@/lib/bcrypt";
import { broadcastRealtimeServer } from "@/lib/supabase-realtime-server";
import type { z } from "zod";
import type { doctorProfileUpdateSchema, doctorRegisterSchema } from "./doctor.schema";

type DoctorRegisterInput = z.infer<typeof doctorRegisterSchema>;
type DoctorProfileUpdateInput = z.infer<typeof doctorProfileUpdateSchema>;

function authPayload(user: { id: string; email: string; role: "PATIENT" | "DOCTOR" | "ADMIN"; firstName: string; lastName?: string | null }) {
  const token = signJwt({ userId: user.id, role: user.role });
  return { token, user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName || undefined } };
}

async function findHospitalId(name?: string) {
  const value = name?.trim();
  if (!value) return undefined;
  const hospital = await prisma.hospital.findFirst({ where: { name: { equals: value, mode: "insensitive" } }, select: { id: true } });
  return hospital?.id;
}

export const doctorService = {
  list: (query: { q?: string | null; specialty?: string | null; limit?: string | null }) =>
    prisma.doctorProfile.findMany({
      where: {
        specialty: query.specialty ? { contains: query.specialty, mode: "insensitive" } : undefined,
        user: query.q ? { OR: [{ firstName: { contains: query.q, mode: "insensitive" } }, { lastName: { contains: query.q, mode: "insensitive" } }] } : undefined,
      },
      select: {
        id: true,
        specialty: true,
        bio: true,
        experience: true,
        fee: true,
        rating: true,
        gender: true,
        online: true,
        supportsOnline: true,
        supportsInPerson: true,
        verified: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        hospital: { select: { id: true, name: true, address: true, phone: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { user: { createdAt: "desc" } },
      take: Math.min(Math.max(Number(query.limit) || 50, 1), 60),
    }),
  detail: (id: string) => prisma.doctorProfile.findUnique({
    where: { id },
    select: {
      id: true,
      specialty: true,
      bio: true,
      experience: true,
      fee: true,
      rating: true,
      gender: true,
      online: true,
      supportsOnline: true,
      supportsInPerson: true,
      verified: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      hospital: { select: { id: true, name: true, address: true, phone: true } },
      departments: { select: { id: true, name: true } },
      _count: { select: { appointments: true, consultations: true } },
    },
  }),
  async register(input: DoctorRegisterInput) {
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ApiError(409, "Email already registered");
    const passwordHash = await hashPassword(input.password);
    const hospitalId = await findHospitalId(input.hospital);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: "DOCTOR",
        doctorProfile: {
          create: {
            specialty: input.specialty,
            gender: input.gender,
            experience: input.experience,
            fee: input.fee,
            bio: input.bio,
            hospitalId,
            online: input.supportsOnline ?? true,
            supportsOnline: input.supportsOnline ?? true,
            supportsInPerson: input.supportsInPerson ?? false,
            verified: false,
          },
        },
      },
    });
    return authPayload(user);
  },
  me: (userId: string) => prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      specialty: true,
      bio: true,
      experience: true,
      fee: true,
      rating: true,
      gender: true,
      online: true,
      supportsOnline: true,
      supportsInPerson: true,
      verified: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      hospital: { select: { id: true, name: true, address: true, phone: true } },
    },
  }),
  async updateMe(userId: string, input: DoctorProfileUpdateInput) {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
    if (!doctor) throw new ApiError(404, "Doctor profile not found");
    const hospitalId = await findHospitalId(input.hospital);
    return prisma.$transaction(async (tx) => {
      if (input.firstName !== undefined || input.lastName !== undefined || input.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
          },
        });
      }
      const updated = await tx.doctorProfile.update({
        where: { userId },
        data: {
          specialty: input.specialty,
          gender: input.gender,
          experience: input.experience,
          fee: input.fee,
          bio: input.bio,
          online: input.online,
          supportsOnline: input.supportsOnline ?? input.online ?? undefined,
          supportsInPerson: input.supportsInPerson,
          hospitalId: input.hospital !== undefined ? hospitalId : undefined,
        },
        include: { user: true, hospital: true },
      });
      if (input.online !== undefined) {
        void broadcastRealtimeServer("doctor-status", "status-changed", {
          doctorId: updated.id,
          userId,
          online: updated.online,
          supportsOnline: updated.supportsOnline,
        }).catch(() => null);
      }
      return updated;
    });
  },
};
