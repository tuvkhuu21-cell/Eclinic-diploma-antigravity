import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const closedStatuses = new Set(["ended", "declined", "rejected", "cancelled", "missed"]);
const allowedTransitions: Record<string, Set<string>> = {
  REQUESTED: new Set(["waiting", "ringing", "active", "declined", "ended"]),
  waiting: new Set(["ringing", "active", "declined", "ended"]),
  ringing: new Set(["active", "declined", "ended"]),
  active: new Set(["ended"]),
  declined: new Set([]),
  ended: new Set([]),
};
const RINGING_TIMEOUT_MS = 30_000;

export const videoService = {
  async incoming(userId: string) {
    const ringingCutoff = new Date(Date.now() - RINGING_TIMEOUT_MS);
    const calls = await prisma.videoCall.findMany({
      where: {
        status: "ringing",
        startedAt: { gte: ringingCutoff },
        OR: [{ patient: { userId } }, { doctor: { userId } }],
      },
      select: {
        id: true,
        roomId: true,
        appointmentId: true,
        patientId: true,
        doctorId: true,
        status: true,
        startedAt: true,
        createdAt: true,
        patient: { select: { userId: true, user: { select: { id: true, firstName: true, lastName: true } } } },
        doctor: { select: { userId: true, user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    return calls;
  },
  async getByRoom(userId: string, roomId: string) {
    const call = await prisma.videoCall.findUnique({
      where: { roomId },
      select: {
        id: true,
        appointmentId: true,
        patientId: true,
        doctorId: true,
        roomId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        appointment: { select: { id: true, scheduledAt: true, type: true, status: true, paymentStatus: true, durationMinutes: true } },
        patient: { select: { userId: true, user: { select: { id: true, firstName: true, lastName: true } } } },
        doctor: { select: { userId: true, specialty: true, user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    if (!call) throw new ApiError(404, "Video call not found");
    if (call.patient.userId !== userId && call.doctor.userId !== userId) throw new ApiError(403, "Video call access denied");
    const chatRoom = await prisma.chatRoom.findFirst({ where: { patientId: call.patientId, doctorId: call.doctorId }, select: { id: true } });
    return { ...call, chatRoom };
  },
  async request(userId: string, data: { doctorId: string; appointmentId?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        patientProfile: { select: { id: true } },
        doctorProfile: { select: { id: true } },
      },
    });
    if (!user) throw new ApiError(401, "Authentication required");

    const appointment = data.appointmentId ? await prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      select: { id: true, patientId: true, doctorId: true, type: true },
    }) : null;
    if (appointment && appointment.type !== "ONLINE") throw new ApiError(400, "Video call is available only for online appointments");
    const patientId = appointment?.patientId || user.patientProfile?.id;
    const doctorId = appointment?.doctorId || data.doctorId || user.doctorProfile?.id;
    if (!patientId || !doctorId) throw new ApiError(400, "Video call requires patient and doctor");

    const existing = data.appointmentId ? await prisma.videoCall.findUnique({ where: { appointmentId: data.appointmentId } }) : null;
    if (existing && !closedStatuses.has(existing.status)) {
      console.log("video-call: reuse open room", { roomId: existing.roomId, status: existing.status, appointmentId: existing.appointmentId, doctorId: existing.doctorId, patientId: existing.patientId });
      return existing;
    }
    if (existing) {
      const roomId = createRoomId(data.appointmentId, patientId, doctorId);
      const reopened = await prisma.videoCall.update({
        where: { id: existing.id },
        data: { roomId, status: "waiting", startedAt: null, endedAt: null },
      });
      console.log("video-call: reopened closed room with new roomId", { roomId, oldRoomId: existing.roomId, appointmentId: reopened.appointmentId, doctorId: reopened.doctorId, patientId: reopened.patientId });
      return reopened;
    }

    const roomId = createRoomId(data.appointmentId, patientId, doctorId);
    const created = await prisma.videoCall.create({
      data: {
        patientId,
        doctorId,
        appointmentId: data.appointmentId,
        roomId,
        status: "waiting",
      },
    });
    console.log("video-call: created room", { roomId: created.roomId, appointmentId: created.appointmentId, doctorId: created.doctorId, patientId: created.patientId });
    return created;
  },
  async start(roomId: string) {
    return prisma.videoCall.update({ where: { roomId }, data: { status: "active", startedAt: new Date() } });
  },
  async updateStatus(userId: string, roomId: string, status: "waiting" | "ringing" | "active" | "declined" | "ended") {
    const current = await this.getByRoom(userId, roomId);
    if (current.status === status) return current;
    const allowed = allowedTransitions[current.status]?.has(status);
    if (!allowed) {
      console.warn("video-call: ignored invalid status transition", { roomId, from: current.status, to: status });
      return current;
    }
    const updated = await prisma.videoCall.update({
      where: { roomId },
      data: {
        status,
        startedAt: status === "active" ? (current.startedAt || new Date()) : status === "ringing" ? new Date() : status === "waiting" ? null : undefined,
        endedAt: status === "ended" || status === "declined" ? new Date() : undefined,
      },
    });
    console.log("video-call: status updated", { roomId, status, appointmentId: updated.appointmentId, doctorId: updated.doctorId, patientId: updated.patientId });
    return updated;
  },
};

function createRoomId(appointmentId: string | undefined, patientId: string, doctorId: string) {
  const seed = appointmentId || `${patientId}-${doctorId}`;
  return `video-${seed}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}
