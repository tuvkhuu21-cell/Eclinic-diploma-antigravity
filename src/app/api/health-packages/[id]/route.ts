import { fail, ok, options } from "@/lib/response";
import { errorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await prisma.healthPackage.findFirst({
      where: { id, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        summary: true,
        oldPrice: true,
        price: true,
        discount: true,
        icon: true,
        labHours: true,
        tests: true,
        hospital: { select: { id: true, name: true, type: true, address: true, district: true, phone: true } },
      },
    });
    if (!item) return fail("Package not found", 404);
    return ok({
      ...item,
      summary: item.summary || item.description,
      oldPrice: item.oldPrice || 0,
      discount: item.discount || "",
      icon: item.icon || "flask",
      labHours: item.labHours || "08:30 - 17:00 (Даваа-Баасан)",
      tests: Array.isArray(item.tests) ? item.tests : [],
    });
  } catch (error) {
    console.error("GET /api/health-packages/[id] failed", error);
    return fail(errorMessage(error), 500);
  }
}
