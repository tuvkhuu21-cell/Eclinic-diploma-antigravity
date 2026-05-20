import { prisma } from "@/lib/prisma";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function isPaid(paymentStatus?: string, status?: string) {
  return paymentStatus === "PAID" || status === "CONFIRMED" || status === "COMPLETED";
}

export const adminService = {
  async stats() {
    const { start, end } = getTodayRange();
    const [totalUsers, totalDoctors, totalPatients, users, doctors, totalAppointmentCounts, todayAppointmentCounts, todayAppointments] = await Promise.all([
      prisma.user.count(),
      prisma.doctorProfile.count(),
      prisma.patientProfile.count(),
      prisma.user.findMany({
        take: 80,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.doctorProfile.findMany({
        orderBy: { user: { createdAt: "desc" } },
        select: {
          id: true,
          specialty: true,
          gender: true,
          online: true,
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
        take: 100,
      }),
      prisma.appointment.groupBy({ by: ["doctorId"], _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ["doctorId"], where: { scheduledAt: { gte: start, lt: end } }, _count: { _all: true } }),
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: start, lt: end } },
        orderBy: { scheduledAt: "asc" },
        include: {
          patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          hospital: true,
        },
      }),
    ]);
    const totalCountByDoctor = new Map(totalAppointmentCounts.map((item) => [item.doctorId, item._count._all]));
    const todayCountByDoctor = new Map(todayAppointmentCounts.map((item) => [item.doctorId, item._count._all]));

    const doctorAppointmentsToday = todayAppointments.filter((item) => item.type === "ONLINE").length;
    const hospitalAppointmentsToday = todayAppointments.filter((item) => item.type !== "ONLINE" || item.hospitalId).length;
    const revenueToday = todayAppointments
      .filter((item) => isPaid(item.paymentStatus, item.status))
      .reduce((sum, item) => sum + (item.price > 0 ? item.price : 30000), 0);

    return {
      summary: {
        totalUsers,
        totalDoctors,
        totalPatients,
        totalAppointmentsToday: todayAppointments.length,
        doctorAppointmentsToday,
        hospitalAppointmentsToday,
        revenueToday,
      },
      users,
      doctors: doctors.map((doctor) => ({
        id: doctor.id,
        name: `${doctor.user.lastName || ""} ${doctor.user.firstName}`.trim(),
        specialty: doctor.specialty,
        gender: doctor.gender,
        phone: doctor.user.phone,
        email: doctor.user.email,
        online: doctor.online,
        totalAppointments: totalCountByDoctor.get(doctor.id) || 0,
        todayAppointments: todayCountByDoctor.get(doctor.id) || 0,
      })),
      todayAppointments: todayAppointments.map((appointment) => ({
        id: appointment.id,
        patientName: `${appointment.patient.user.lastName || ""} ${appointment.patient.user.firstName}`.trim(),
        doctorName: `${appointment.doctor.user.lastName || ""} ${appointment.doctor.user.firstName}`.trim(),
        hospitalName: appointment.hospital?.name || "",
        type: appointment.type,
        scheduledAt: appointment.scheduledAt,
        paymentStatus: appointment.paymentStatus,
        status: appointment.status,
        price: appointment.price,
      })),
    };
  },
};
