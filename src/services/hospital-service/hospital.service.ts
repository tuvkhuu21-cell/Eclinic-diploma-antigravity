import { prisma } from "@/lib/prisma";

export const hospitalService = {
  list: (query: { q?: string | null; district?: string | null }) =>
    prisma.hospital.findMany({
      where: {
        name: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
        district: query.district ? { contains: query.district, mode: "insensitive" } : undefined,
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        phone: true,
        address: true,
        district: true,
        latitude: true,
        longitude: true,
        rating: true,
        createdAt: true,
        _count: { select: { departments: true, doctors: true, appointments: true } },
        departments: { select: { id: true, name: true, description: true } },
        doctors: {
          select: {
            id: true,
            specialty: true,
            supportsInPerson: true,
            supportsOnline: true,
            user: { select: { firstName: true, lastName: true } },
          },
          take: 12,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  detail: (id: string) => prisma.hospital.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      phone: true,
      address: true,
      district: true,
      latitude: true,
      longitude: true,
      rating: true,
      departments: { select: { id: true, name: true, description: true } },
      doctors: {
        select: {
          id: true,
          specialty: true,
          experience: true,
          fee: true,
          rating: true,
          gender: true,
          online: true,
          supportsOnline: true,
          supportsInPerson: true,
          verified: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        take: 40,
      },
    },
  }),
};
