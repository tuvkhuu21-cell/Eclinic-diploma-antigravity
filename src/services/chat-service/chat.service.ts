import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { broadcastRealtimeServer } from "@/lib/supabase-realtime-server";

export const chatService = {
  async rooms(userId: string) {
    const rooms = await prisma.chatRoom.findMany({
      where: { OR: [{ patient: { userId } }, { doctor: { userId } }] },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        createdAt: true,
        patient: { select: { userId: true, user: { select: { id: true, firstName: true, lastName: true } } } },
        doctor: {
          select: {
            id: true,
            userId: true,
            specialty: true,
            online: true,
            user: { select: { id: true, firstName: true, lastName: true } },
            hospital: { select: { id: true, name: true } },
          },
        },
        messages: { take: 1, orderBy: { createdAt: "desc" }, select: { id: true, content: true, senderId: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    if (!rooms.length) return [];
    const appointments = await prisma.appointment.findMany({
      where: {
        type: "ONLINE",
        status: { in: ["CONFIRMED", "COMPLETED"] },
        OR: rooms.map((room) => ({ patientId: room.patientId, doctorId: room.doctorId })),
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        type: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        paymentStatus: true,
        videoCall: { select: { roomId: true, status: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    });
    const appointmentByPair = new Map(appointments.map((appointment) => [`${appointment.patientId}:${appointment.doctorId}`, appointment]));
    return rooms.map((room) => {
      const appointment = appointmentByPair.get(`${room.patientId}:${room.doctorId}`);
      return {
        ...room,
        appointment: appointment ? {
          id: appointment.id,
          type: appointment.type,
          scheduledAt: appointment.scheduledAt,
          durationMinutes: appointment.durationMinutes,
          status: appointment.status,
          paymentStatus: appointment.paymentStatus,
          videoCall: appointment.videoCall,
        } : null,
      };
    });
  },
  async messages(userId: string, roomId: string, options?: { limit?: number; since?: string }) {
    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId, OR: [{ patient: { userId } }, { doctor: { userId } }] },
      select: { id: true },
    });
    if (!room) throw new ApiError(404, "Chat room not found");
    const limit = Math.min(Math.max(options?.limit || 50, 1), 100);
    const sinceDate = options?.since ? new Date(options.since) : null;
    const rows = await prisma.message.findMany({
      where: {
        roomId,
        ...(sinceDate && !Number.isNaN(sinceDate.getTime()) ? { createdAt: { gt: sinceDate } } : {}),
      },
      select: { id: true, content: true, senderId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse();
  },
  async send(userId: string, data: { roomId: string; content: string }) {
    const room = await prisma.chatRoom.findUnique({
      where: { id: data.roomId },
      select: { id: true, patient: { select: { userId: true } }, doctor: { select: { userId: true } } },
    });
    if (!room) throw new ApiError(404, "Chat room not found");
    if (room.patient.userId !== userId && room.doctor.userId !== userId) throw new ApiError(403, "Chat room access denied");
    const message = await prisma.message.create({
      data: { roomId: data.roomId, senderId: userId, content: data.content },
      select: { id: true, roomId: true, senderId: true, content: true, createdAt: true },
    });
    // Fire notification + broadcast completely in background using setTimeout
    // This ensures the HTTP response is sent BEFORE any notification work starts
    const recipientUserId = room.patient.userId === userId ? room.doctor.userId : room.patient.userId;
    if (recipientUserId) {
      setTimeout(() => {
        createChatNotification(recipientUserId).catch(() => null);
      }, 0);
    }
    return message;
  },
};

async function createChatNotification(recipientUserId: string) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: recipientUserId,
        title: "Шинэ чат зурвас",
        body: "Танд шинэ чат зурвас ирлээ.",
        type: "CHAT",
      },
      select: { id: true, title: true, body: true, type: true, readAt: true, createdAt: true },
    });
    broadcastRealtimeServer(`user-notifications-${recipientUserId}`, "new-notification", notification).catch(() => null);
  } catch {
    // Notification should never block or crash the chat send flow.
  }
}
