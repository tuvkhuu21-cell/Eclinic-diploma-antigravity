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
    return Promise.all(rooms.map(async (room) => {
      const appointment = await prisma.appointment.findFirst({
        where: {
          patientId: room.patientId,
          doctorId: room.doctorId,
          type: "ONLINE",
          status: { in: ["CONFIRMED", "COMPLETED"] },
        },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          paymentStatus: true,
          videoCall: { select: { roomId: true, status: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });
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
    }));
  },
  async messages(userId: string, roomId: string, options?: { limit?: number; since?: string }) {
    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId, OR: [{ patient: { userId } }, { doctor: { userId } }] },
      select: { id: true },
    });
    if (!room) throw new ApiError(404, "Chat room not found");
    const limit = Math.min(Math.max(options?.limit || 80, 1), 100);
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
      include: { patient: true, doctor: true },
    });
    if (!room) throw new ApiError(404, "Chat room not found");
    if (room.patient.userId !== userId && room.doctor.userId !== userId) throw new ApiError(403, "Chat room access denied");
    const message = await prisma.message.create({ data: { roomId: data.roomId, senderId: userId, content: data.content } });
    const recipientUserId = room?.patient.userId === userId ? room.doctor.userId : room?.patient.userId;
    if (recipientUserId) {
      const notification = await prisma.notification.create({
        data: {
          userId: recipientUserId,
          title: "Шинэ чат зурвас",
          body: "Танд шинэ чат зурвас ирлээ.",
          type: "CHAT",
        },
      });
      await broadcastRealtimeServer(`user-notifications-${recipientUserId}`, "new-notification", notification).catch(() => null);
    }
    return message;
  },
};
