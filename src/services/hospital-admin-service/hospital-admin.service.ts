import { randomUUID } from "crypto";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const hospitalAdminService = {
  async dashboard(userId: string) {
    const hospital = await prisma.hospital.findUnique({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        type: true,
        phone: true,
        address: true,
        district: true,
        rating: true,
        doctors: {
          select: {
            id: true,
            specialty: true,
            online: true,
            verified: true,
            fee: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
          take: 80,
        },
        appointments: {
          orderBy: { scheduledAt: "desc" },
          take: 120,
          select: {
            id: true,
            scheduledAt: true,
            type: true,
            price: true,
            paymentStatus: true,
            reason: true,
            status: true,
            patientId: true,
            patient: { select: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
            doctor: { select: { id: true, specialty: true, user: { select: { firstName: true, lastName: true } } } },
          },
        },
        labResults: {
          orderBy: { issuedAt: "desc" },
          take: 80,
          select: {
            id: true,
            code: true,
            title: true,
            summary: true,
            issuedAt: true,
            patient: { select: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
          },
        },
        healthPackages: {
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            id: true,
            name: true,
            description: true,
            summary: true,
            oldPrice: true,
            price: true,
            discount: true,
            icon: true,
            labHours: true,
            tests: true,
            active: true,
            createdAt: true,
          },
        },
      },
    });
    if (!hospital) throw new ApiError(404, "Hospital account not found");
    const appointmentCounts = await prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { doctorId: { in: hospital.doctors.map((doctor) => doctor.id) } },
      _count: { _all: true },
    });
    const appointmentCountByDoctor = new Map(appointmentCounts.map((item) => [item.doctorId, item._count._all]));

    const patientMap = new Map<string, {
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      totalOrders: number;
      latestOrder?: string;
    }>();
    for (const appointment of hospital.appointments) {
      const patientName = `${appointment.patient.user.lastName || ""} ${appointment.patient.user.firstName}`.trim();
      const existing = patientMap.get(appointment.patientId);
      patientMap.set(appointment.patientId, {
        id: appointment.patientId,
        name: patientName,
        email: appointment.patient.user.email,
        phone: appointment.patient.user.phone,
        totalOrders: (existing?.totalOrders || 0) + 1,
        latestOrder: existing?.latestOrder || appointment.scheduledAt.toISOString(),
      });
    }

    const paidAppointments = hospital.appointments.filter((item) => item.paymentStatus === "PAID" || item.status === "CONFIRMED" || item.status === "COMPLETED");
    const packageOrders = hospital.appointments.filter((item) => item.type === "PACKAGE_ORDER" || item.reason.includes("Багц шинжилгээ"));

    return {
      hospital,
      summary: {
        doctors: hospital.doctors.length,
        patients: patientMap.size,
        appointments: hospital.appointments.length,
        packageOrders: packageOrders.length,
        labResults: hospital.labResults.length,
        revenue: paidAppointments.reduce((sum, item) => sum + (item.price > 0 ? item.price : 30000), 0),
      },
      healthPackages: hospital.healthPackages.map(formatHealthPackage),
      doctors: hospital.doctors.map((doctor) => ({
        id: doctor.id,
        name: `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim(),
        specialty: doctor.specialty,
        email: doctor.user.email,
        phone: doctor.user.phone,
        online: doctor.online,
        verified: doctor.verified,
        fee: doctor.fee,
        appointments: appointmentCountByDoctor.get(doctor.id) || 0,
      })),
      patients: Array.from(patientMap.values()),
      appointments: hospital.appointments.map((appointment) => ({
        id: appointment.id,
        patientId: appointment.patientId,
        patientName: `${appointment.patient.user.lastName || ""} ${appointment.patient.user.firstName}`.trim(),
        doctorName: `${appointment.doctor.user.lastName || ""} ${appointment.doctor.user.firstName}`.trim(),
        specialty: appointment.doctor.specialty,
        scheduledAt: appointment.scheduledAt,
        type: appointment.type,
        reason: appointment.reason,
        paymentStatus: appointment.paymentStatus,
        status: appointment.status,
        price: appointment.price,
      })),
      labResults: hospital.labResults.map((result) => ({
        id: result.id,
        code: result.code,
        title: result.title,
        summary: result.summary,
        issuedAt: result.issuedAt,
        patientName: `${result.patient.user.lastName || ""} ${result.patient.user.firstName}`.trim(),
        patientEmail: result.patient.user.email,
      })),
    };
  },

  async createLabResult(userId: string, input: { patientId: string; title: string; summary?: string; doctorNote?: string; fileUrl?: string; fileName?: string }) {
    const hospital = await prisma.hospital.findUnique({ where: { ownerId: userId }, select: { id: true, name: true } });
    if (!hospital) throw new ApiError(404, "Hospital account not found");
    const appointment = await prisma.appointment.findFirst({
      where: { hospitalId: hospital.id, patientId: input.patientId },
      select: { id: true },
    });
    if (!appointment) throw new ApiError(403, "Patient is not linked to this hospital");
    const code = `LAB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const resultJson = {
      labName: hospital.name,
      status: "Бэлэн",
      sourceType: "hospital",
      doctorNote: input.doctorNote || input.summary || "",
      fileUrl: input.fileUrl || "",
      fileName: input.fileName || "",
      values: [],
      meta: { uploadedBy: "hospital-dashboard" },
    };
    return prisma.labResult.create({
      data: {
        patientId: input.patientId,
        hospitalId: hospital.id,
        code,
        title: input.title,
        summary: input.summary || input.doctorNote || "",
        resultJson,
      },
    });
  },

  async createHealthPackage(userId: string, input: HealthPackageInput) {
    const hospital = await prisma.hospital.findUnique({ where: { ownerId: userId }, select: { id: true } });
    if (!hospital) throw new ApiError(404, "Hospital account not found");
    const created = await prisma.healthPackage.create({
      data: {
        hospitalId: hospital.id,
        name: input.name,
        description: input.description,
        summary: input.summary || input.description,
        oldPrice: input.oldPrice || null,
        price: input.price,
        discount: input.discount || null,
        icon: input.icon || "flask",
        labHours: input.labHours || "08:30 - 17:00 (Даваа-Баасан)",
        tests: input.tests,
        active: input.active ?? true,
      },
    });
    return formatHealthPackage(created);
  },

  async updateHealthPackage(userId: string, packageId: string, input: Partial<HealthPackageInput>) {
    const hospital = await prisma.hospital.findUnique({ where: { ownerId: userId }, select: { id: true } });
    if (!hospital) throw new ApiError(404, "Hospital account not found");
    const existing = await prisma.healthPackage.findFirst({ where: { id: packageId, hospitalId: hospital.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, "Health package not found");
    const updated = await prisma.healthPackage.update({
      where: { id: packageId },
      data: {
        name: input.name,
        description: input.description,
        summary: input.summary,
        oldPrice: input.oldPrice === undefined ? undefined : input.oldPrice || null,
        price: input.price,
        discount: input.discount === undefined ? undefined : input.discount || null,
        icon: input.icon,
        labHours: input.labHours,
        tests: input.tests,
        active: input.active,
      },
    });
    return formatHealthPackage(updated);
  },
};

type HealthPackageInput = {
  name: string;
  description: string;
  summary?: string;
  oldPrice?: number;
  price: number;
  discount?: string;
  icon?: string;
  labHours?: string;
  tests: Array<{ title: string; tests: string[]; importance: string }>;
  active?: boolean;
};

function formatHealthPackage(item: {
  id: string;
  name: string;
  description: string;
  summary?: string | null;
  oldPrice?: number | null;
  price: number;
  discount?: string | null;
  icon?: string | null;
  labHours?: string | null;
  tests: unknown;
  active?: boolean;
  createdAt?: Date;
}) {
  return {
    ...item,
    oldPrice: item.oldPrice || 0,
    discount: item.discount || "",
    icon: item.icon || "flask",
    labHours: item.labHours || "08:30 - 17:00 (Даваа-Баасан)",
    summary: item.summary || item.description,
    tests: Array.isArray(item.tests) ? item.tests : [],
    createdAt: item.createdAt?.toISOString?.() || item.createdAt,
  };
}
