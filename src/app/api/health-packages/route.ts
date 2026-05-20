import { NextRequest } from "next/server";
import { fail, ok, options } from "@/lib/response";
import { errorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    const sort = request.nextUrl.searchParams.get("sort");
    const rows = await prisma.healthPackage.findMany({
      where: { active: true },
      orderBy: sort === "priceAsc" ? { price: "asc" } : sort === "priceDesc" ? { price: "desc" } : { createdAt: "desc" },
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
      take: 80,
    });
    return ok(rows.map(formatPackage), "success", { headers: { "Cache-Control": "public, max-age=20, s-maxage=60, stale-while-revalidate=120" } });
  } catch (error) {
    console.error("GET /api/health-packages failed", error);
    return fail(errorMessage(error), 500);
  }
}

function formatPackage(item: any) {
  return {
    ...item,
    summary: item.summary || item.description,
    oldPrice: item.oldPrice || 0,
    discount: item.discount || "",
    icon: item.icon || "flask",
    labHours: item.labHours || "08:30 - 17:00 (Даваа-Баасан)",
    tests: Array.isArray(item.tests) ? item.tests : [],
  };
}
