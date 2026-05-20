import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ApiError, errorMessage } from "@/lib/errors";
import { getAuthUser } from "@/lib/api-auth";
import { requireRole } from "@/lib/api-role";
import { options } from "@/lib/response";
import { prisma } from "@/lib/prisma";
import { broadcastRealtimeServer } from "@/lib/supabase-realtime-server";

export const runtime = "nodejs";
export const OPTIONS = options;

const DEFAULT_ONLINE_PRICE = 30000;

type MockPaymentBody = {
  doctorId?: unknown;
  service?: unknown;
  hospitalId?: unknown;
  hospitalName?: unknown;
  specialty?: unknown;
  room?: unknown;
  packageId?: unknown;
  packageName?: unknown;
  labName?: unknown;
  scheduledAt?: unknown;
  time?: unknown;
  selectedTime?: unknown;
  price?: unknown;
  type?: unknown;
  appointmentType?: unknown;
  paymentStatus?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    requireRole(user, ["PATIENT"]);

    const body = (await request.json().catch(() => ({}))) as MockPaymentBody;
    const doctorId = asString(body.doctorId) || asString(body.service);
    const scheduledAt = asString(body.scheduledAt) || asString(body.time) || asString(body.selectedTime);
    const type = asString(body.type) || asString(body.appointmentType) || "ONLINE";
    const isPackageOrder = type === "PACKAGE_ORDER";
    const hospitalId = asString(body.hospitalId);
    const hospitalName = asString(body.hospitalName);
    const specialty = asString(body.specialty);
    const room = asString(body.room);
    const packageId = asString(body.packageId);
    const packageName = asString(body.packageName) || "Урьдчилан сэргийлэх багц";
    const labName = asString(body.labName) || hospitalName || "Лаборатори";
    const paymentStatus = asString(body.paymentStatus) || "PAID";
    const requestedPrice = asPositiveNumber(body.price);

    if (!doctorId && !isPackageOrder) throw new ApiError(400, "doctorId is required");
    if (!scheduledAt && !isPackageOrder) throw new ApiError(400, "scheduledAt is required");

    const scheduledDate = new Date(scheduledAt || new Date().toISOString());
    if (Number.isNaN(scheduledDate.getTime())) throw new ApiError(400, "scheduledAt must be a valid date");

    const patient = await prisma.patientProfile.findUnique({ where: { userId: user.userId } });
    if (!patient) throw new ApiError(403, "Patient profile required");

    const doctor = isPackageOrder
      ? await resolvePackageOrderDoctor({ packageId, packageName, labName })
      : await resolveDoctorForPayment({ doctorId, hospitalId, hospitalName, specialty });
    if (!doctor) throw new ApiError(404, "Doctor not found");

    const price = requestedPrice || (doctor.fee > 0 ? doctor.fee : DEFAULT_ONLINE_PRICE);
    const isHospitalVisit = type === "HOSPITAL_VISIT";
    const reason = isPackageOrder
      ? `Багц шинжилгээ - ${packageName} - ${labName}${packageId ? ` - ${packageId}` : ""}`
      : isHospitalVisit ? `Биечлэн үзүүлэх${hospitalName ? ` - ${hospitalName}` : ""}${specialty ? ` - ${specialty}` : ""}${room ? ` - Өрөө ${room}` : ""}` : "Онлайн зөвлөгөө";

    const result = await prisma.$transaction(async (tx) => {
      const appointmentId = randomUUID();
      const status = paymentStatus === "PAID" ? "CONFIRMED" : "PENDING";
      const appointment = await tx.appointment.create({
        data: {
          id: appointmentId,
          patientId: patient.id,
          doctorId: doctor.id,
          hospitalId: doctor.hospitalId || (hospitalId.startsWith("seed-") ? hospitalId : undefined),
          scheduledAt: scheduledDate,
          durationMinutes: 30,
          type,
          price,
          paymentStatus,
          reason,
          status,
        },
        include: { patient: { include: { user: true } }, doctor: { include: { user: true, hospital: true } }, hospital: true },
      });

      const patientNotification = await tx.notification.create({
        data: {
          userId: user.userId,
          title: "Төлбөр төлөгдлөө",
          body: isPackageOrder ? "Багц шинжилгээний төлбөр төлөгдлөө." : "Төлбөр төлөгдлөө. Таны онлайн цаг баталгаажлаа.",
          type: "PAYMENT",
        },
      });

      const doctorNotification = isPackageOrder ? null : await tx.notification.create({
        data: {
          userId: doctor.userId,
          title: isHospitalVisit ? "Шинэ эмнэлгийн цаг захиалга" : "Шинэ онлайн цаг захиалга",
          body: isHospitalVisit ? "Шинэ биечлэн үзүүлэх цаг захиалга ирлээ." : "Шинэ онлайн цаг захиалга ирлээ.",
          type: "APPOINTMENT",
        },
      });

      const chatRoom = isHospitalVisit || isPackageOrder ? null : await tx.chatRoom.findFirst({
        where: { patientId: patient.id, doctorId: doctor.id },
        select: { id: true },
      }) || await tx.chatRoom.create({
        data: { patientId: patient.id, doctorId: doctor.id },
        select: { id: true },
      });
      const videoCall = isHospitalVisit || isPackageOrder ? null : await tx.videoCall.upsert({
        where: { appointmentId: appointmentId },
        update: { status: "waiting" },
        create: {
          appointmentId,
          patientId: patient.id,
          doctorId: doctor.id,
          roomId: `video-${appointmentId}`,
          status: "waiting",
        },
      });

      return {
        appointment: { ...appointment, chatRoom, videoCall },
        notifications: { patient: patientNotification, doctor: doctorNotification },
      };
    });

    void broadcastRealtimeServer(`user-notifications-${user.userId}`, "new-notification", result.notifications.patient).catch(() => null);
    if (result.notifications.doctor) {
      void broadcastRealtimeServer(`user-notifications-${result.notifications.doctor.userId}`, "new-notification", result.notifications.doctor).catch(() => null);
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/payments/mock failed", error);
    return NextResponse.json(
      { success: false, message: errorMessage(error) },
      { status: error instanceof ApiError ? error.statusCode : 500 },
    );
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asPositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

async function resolveDoctorForPayment({ doctorId, hospitalId, hospitalName, specialty }: { doctorId: string; hospitalId: string; hospitalName: string; specialty: string }) {
  if (!doctorId.startsWith("demo-hospital-doctor:")) {
    return prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
  }

  const [, encodedHospital, encodedSpecialty, index = "1"] = doctorId.split(":");
  const resolvedHospitalName = decodeURIComponent(encodedHospital || "") || hospitalName || "Demo Hospital";
  const resolvedSpecialty = decodeURIComponent(encodedSpecialty || "") || specialty || "Дотор";
  const safeHospitalId = hospitalId.startsWith("seed-") ? hospitalId : `demo-hospital-${slugify(resolvedHospitalName)}`;
  const safeIndex = Math.max(1, Number(index) || 1);
  const email = `hospital.${slugify(resolvedHospitalName)}.${slugify(resolvedSpecialty)}.${safeIndex}@mediconnect.demo`;
  const demoName = demoDoctorName(resolvedSpecialty, safeIndex);

  const hospital = await prisma.hospital.upsert({
    where: { id: safeHospitalId },
    update: { name: resolvedHospitalName, type: "Хувийн эмнэлэг" },
    create: {
      id: safeHospitalId,
      name: resolvedHospitalName,
      type: "Хувийн эмнэлэг",
      district: "Сүхбаатар",
      address: `Улаанбаатар хот, ${resolvedHospitalName}`,
      latitude: 47.9186,
      longitude: 106.9176,
      rating: 4.7,
      description: "Эмнэлэгт биечлэн үзүүлэх цаг захиалгын demo эмнэлэг.",
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { firstName: demoName.firstName, lastName: demoName.lastName, phone: "7500-2026" },
    create: {
      email,
      passwordHash: "demo-doctor-no-login",
      firstName: demoName.firstName,
      lastName: demoName.lastName,
      phone: "7500-2026",
      role: "DOCTOR",
    },
  });

  return prisma.doctorProfile.upsert({
    where: { userId: user.id },
    update: {
      hospitalId: hospital.id,
      specialty: resolvedSpecialty,
      experience: demoName.experience,
      fee: DEFAULT_ONLINE_PRICE,
      verified: true,
      online: false,
    },
    create: {
      userId: user.id,
      hospitalId: hospital.id,
      specialty: resolvedSpecialty,
      experience: demoName.experience,
      fee: DEFAULT_ONLINE_PRICE,
      rating: 4.8,
      verified: true,
      online: false,
      bio: `${resolvedHospitalName}-ийн ${resolvedSpecialty} чиглэлийн эмч.`,
    },
    include: { user: true },
  });
}

async function resolvePackageOrderDoctor({ packageId, packageName, labName }: { packageId: string; packageName: string; labName: string }) {
  const safeLabId = `package-lab-${slugify(labName)}`;
  const email = `package.${slugify(labName)}@mediconnect.demo`;
  const hospital = await prisma.hospital.upsert({
    where: { id: safeLabId },
    update: { name: labName, type: "Лаборатори" },
    create: {
      id: safeLabId,
      name: labName,
      type: "Лаборатори",
      district: "Сүхбаатар",
      address: `Улаанбаатар хот, ${labName}`,
      latitude: 47.9186,
      longitude: 106.9176,
      rating: 4.7,
      description: `${packageName}${packageId ? ` (${packageId})` : ""} багц шинжилгээний лаборатори.`,
    },
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: { firstName: "Багц", lastName: "Шинжилгээ", phone: "7511-0011" },
    create: {
      email,
      passwordHash: "package-order-no-login",
      firstName: "Багц",
      lastName: "Шинжилгээ",
      phone: "7511-0011",
      role: "DOCTOR",
    },
  });
  return prisma.doctorProfile.upsert({
    where: { userId: user.id },
    update: {
      hospitalId: hospital.id,
      specialty: "Багц шинжилгээ",
      experience: 1,
      fee: DEFAULT_ONLINE_PRICE,
      verified: true,
      online: false,
    },
    create: {
      userId: user.id,
      hospitalId: hospital.id,
      specialty: "Багц шинжилгээ",
      experience: 1,
      fee: DEFAULT_ONLINE_PRICE,
      rating: 4.8,
      verified: true,
      online: false,
      bio: `${labName}-ийн багц шинжилгээний захиалга хүлээн авах профайл.`,
    },
    include: { user: true },
  });
}

function slugify(value: string) {
  return encodeURIComponent(value.toLowerCase().trim()).replace(/%/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "demo";
}

function demoDoctorName(specialty: string, index: number) {
  const names: Record<string, Array<{ firstName: string; lastName: string; experience: number }>> = {
    "Дотор": [
      { lastName: "Бат", firstName: "Эрдэнэ", experience: 11 },
      { lastName: "Сүх", firstName: "Номин", experience: 8 },
      { lastName: "Очир", firstName: "Тэмүүлэн", experience: 6 },
    ],
    "Зүрх судас": [
      { lastName: "Дорж", firstName: "Энхтуяа", experience: 12 },
      { lastName: "Ган", firstName: "Билгүүн", experience: 9 },
      { lastName: "Цогт", firstName: "Солонго", experience: 7 },
    ],
    "Мэдрэл": [
      { lastName: "Ням", firstName: "Ананд", experience: 10 },
      { lastName: "Лхагва", firstName: "Мөнхзул", experience: 8 },
      { lastName: "Болд", firstName: "Идэр", experience: 5 },
    ],
    "Мэс засал": [
      { lastName: "Жаргал", firstName: "Отгон", experience: 14 },
      { lastName: "Баяр", firstName: "Энхжин", experience: 9 },
      { lastName: "Даваа", firstName: "Төгөлдөр", experience: 6 },
    ],
    "Уушги": [
      { lastName: "Пүрэв", firstName: "Ариун", experience: 13 },
      { lastName: "Сайн", firstName: "Хулан", experience: 7 },
      { lastName: "Мөнх", firstName: "Тэнүүн", experience: 5 },
    ],
  };
  const rows = names[specialty] || names["Дотор"];
  return rows[(index - 1) % rows.length];
}
