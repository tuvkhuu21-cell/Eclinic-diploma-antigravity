import { prisma } from "@/lib/prisma";

type HospitalListQuery = { q?: string | null; district?: string | null; full?: string | null };
type CachedHospitals = Awaited<ReturnType<typeof listHospitalsUncached>>;

const hospitalListCache = new Map<string, { expiresAt: number; value: CachedHospitals }>();
const HOSPITAL_LIST_CACHE_MS = 30_000;

export const hospitalService = {
  async list(query: HospitalListQuery) {
    const cacheKey = JSON.stringify({
      q: query.q?.trim().toLowerCase() || "",
      district: query.district?.trim().toLowerCase() || "",
      full: query.full === "1",
    });
    const cached = hospitalListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await listHospitalsUncached(query);
    hospitalListCache.set(cacheKey, { expiresAt: Date.now() + HOSPITAL_LIST_CACHE_MS, value });
    if (hospitalListCache.size > 60) {
      const oldestKey = hospitalListCache.keys().next().value;
      if (oldestKey) hospitalListCache.delete(oldestKey);
    }
    return value;
  },
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

function listHospitalsUncached(query: HospitalListQuery) {
  const includeFull = query.full === "1";
  return prisma.hospital.findMany({
    where: {
      name: query.q ? { contains: query.q, mode: "insensitive" } : undefined,
      district: query.district ? { contains: query.district, mode: "insensitive" } : undefined,
    },
    select: {
      id: true,
      name: true,
      type: true,
      description: includeFull,
      phone: true,
      address: true,
      district: true,
      latitude: true,
      longitude: true,
      rating: true,
      createdAt: true,
      departments: includeFull ? { select: { id: true, name: true, description: true } } : false,
      doctors: includeFull ? {
        select: {
          id: true,
          specialty: true,
          supportsInPerson: true,
          supportsOnline: true,
          user: { select: { firstName: true, lastName: true } },
        },
        take: 12,
      } : false,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(query.q ? 50 : 80), 1), 100),
  });
}
