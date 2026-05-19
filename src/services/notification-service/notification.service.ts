import { prisma } from "@/lib/prisma";
export const notificationService = {
  list: (userId: string) => prisma.notification.findMany({
    where: { userId },
    select: { id: true, title: true, body: true, type: true, readAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  }),
  create: (data: { userId: string; title: string; body?: string; type?: string }) => prisma.notification.create({
    data,
    select: { id: true, title: true, body: true, type: true, readAt: true, createdAt: true },
  }),
  markRead: (id: string, userId?: string) => prisma.notification.update({ where: userId ? { id, userId } : { id }, data: { readAt: new Date() } }),
};
