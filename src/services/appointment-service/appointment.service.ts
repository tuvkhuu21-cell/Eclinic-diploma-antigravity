import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const DEFAULT_ONLINE_PRICE = 30000;

export const appointmentService = {
  list: (userId: string) => prisma.appointment.findMany({
    where: { OR: [{ patient: { userId } }, { doctor: { userId } }] },
    select: {
      id: true,
      scheduledAt: true,
      durationMinutes: true,
      type: true,
      price: true,
      paymentStatus: true,
      reason: true,
      status: true,
      doctor: { select: { id: true, specialty: true, user: { select: { id: true, firstName: true, lastName: true } } } },
      patient: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } } },
      hospital: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  }),
  async my(userId: string) {
    const appointments = await prisma.appointment.findMany({
      where: { patient: { userId } },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        hospitalId: true,
        scheduledAt: true,
        durationMinutes: true,
        type: true,
        price: true,
        paymentStatus: true,
        reason: true,
        status: true,
        createdAt: true,
        doctor: {
          select: {
            id: true,
            specialty: true,
            fee: true,
            hospital: { select: { id: true, name: true, address: true, phone: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            chatRooms: { where: { patient: { userId } }, select: { id: true }, take: 1 },
          },
        },
        hospital: { select: { id: true, name: true, address: true, phone: true } },
        videoCall: { select: { roomId: true, status: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
    return appointments.map((appointment) => {
      const appointmentType = appointment.type || (appointment.reason?.includes("Багц шинжилгээ")
        ? "PACKAGE_ORDER"
        : appointment.reason?.includes("Биечлэн")
          ? "HOSPITAL_VISIT"
          : "ONLINE");
      return {
        ...appointment,
        durationMinutes: appointment.durationMinutes || 30,
        type: appointmentType,
        price: appointment.price > 0 ? appointment.price : appointment.doctor.fee > 0 ? appointment.doctor.fee : 30000,
        paymentStatus: appointment.paymentStatus || (appointment.status === "CONFIRMED" || appointment.status === "COMPLETED" ? "PAID" : "PENDING"),
        room: extractRoom(appointment.reason),
        specialty: extractSpecialty(appointment.reason, appointment.doctor.specialty),
        packageName: extractPackageName(appointment.reason),
        labName: extractPackageLabName(appointment.reason),
        hospital: appointment.hospital || appointment.doctor.hospital || null,
      };
    });
  },
  doctor: (userId: string) => prisma.appointment.findMany({
    where: { doctor: { userId } },
    select: {
      id: true,
      doctorId: true,
      scheduledAt: true,
      durationMinutes: true,
      type: true,
      price: true,
      paymentStatus: true,
      reason: true,
      status: true,
      patient: {
        select: {
          id: true,
          dateOfBirth: true,
          gender: true,
          registerNo: true,
          bloodType: true,
          maritalStatus: true,
          heightCm: true,
          weightKg: true,
          bmi: true,
          city: true,
          district: true,
          khoroo: true,
          addressDetail: true,
          emergencyRelation: true,
          emergencyName: true,
          emergencyPhone: true,
          hasAllergy: true,
          allergyNote: true,
          hasChronicDisease: true,
          chronicDiseaseNote: true,
          hasRegularMedicine: true,
          regularMedicineNote: true,
          hasInjury: true,
          injuryNote: true,
          hasSurgery: true,
          surgeryNote: true,
          smoking: true,
          alcohol: true,
          movement: true,
          food: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          chatRooms: { where: { doctor: { userId } }, select: { id: true }, take: 1 },
        },
      },
      hospital: { select: { id: true, name: true, address: true, phone: true } },
      videoCall: { select: { roomId: true, status: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  }),
  async create(userId: string, data: { doctorId: string; hospitalId?: string; scheduledAt: string; reason: string; durationMinutes?: number; type?: string; price?: number; paymentStatus?: string }) {
    const patient = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!patient) throw new ApiError(403, "Patient profile required");
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: data.doctorId }, include: { user: true } });
    if (!doctor) throw new ApiError(404, "Doctor not found");
    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: data.doctorId,
          hospitalId: data.hospitalId || doctor.hospitalId,
          scheduledAt: new Date(data.scheduledAt),
          durationMinutes: data.durationMinutes || 30,
          type: data.type || "ONLINE",
          price: data.price && data.price > 0 ? data.price : doctor.fee > 0 ? doctor.fee : DEFAULT_ONLINE_PRICE,
          paymentStatus: data.paymentStatus || "PAID",
          reason: data.reason,
          status: data.paymentStatus === "PAID" ? "CONFIRMED" : "PENDING",
        },
        include: { doctor: { include: { user: true, hospital: true } }, patient: { include: { user: true } } },
      });
      const chatRoom = await tx.chatRoom.findFirst({ where: { patientId: patient.id, doctorId: doctor.id }, select: { id: true } })
        || await tx.chatRoom.create({ data: { patientId: patient.id, doctorId: doctor.id }, select: { id: true } });
      await tx.notification.createMany({
        data: [
          {
            userId,
            title: "Төлбөр төлөгдлөө",
            body: "Төлбөр төлөгдлөө. Таны онлайн цаг баталгаажлаа.",
            type: "PAYMENT",
          },
          {
            userId: doctor.userId,
            title: "Шинэ онлайн цаг захиалга",
            body: "Шинэ онлайн цаг захиалга ирлээ.",
            type: "APPOINTMENT",
          },
        ],
      });
      return { ...appointment, chatRoom };
    });
  },
};

function extractRoom(reason?: string) {
  const match = reason?.match(/Өрөө\s+([^-\s]+)/);
  return match?.[1] || "";
}

function extractSpecialty(reason: string | undefined, fallback: string) {
  if (!reason?.includes("Биечлэн")) return fallback;
  const parts = reason.split(" - ").map((part) => part.trim()).filter(Boolean);
  return parts[2] || fallback;
}

function extractPackageName(reason?: string) {
  if (!reason?.includes("Багц шинжилгээ")) return "";
  const parts = reason.split(" - ").map((part) => part.trim()).filter(Boolean);
  return parts[1] || "";
}

function extractPackageLabName(reason?: string) {
  if (!reason?.includes("Багц шинжилгээ")) return "";
  const parts = reason.split(" - ").map((part) => part.trim()).filter(Boolean);
  return parts[2] || "";
}
