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
            _count: { select: { appointments: true } },
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
      },
    });
    if (!hospital) throw new ApiError(404, "Hospital account not found");

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
      doctors: hospital.doctors.map((doctor) => ({
        id: doctor.id,
        name: `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim(),
        specialty: doctor.specialty,
        email: doctor.user.email,
        phone: doctor.user.phone,
        online: doctor.online,
        verified: doctor.verified,
        fee: doctor.fee,
        appointments: doctor._count.appointments,
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
};
