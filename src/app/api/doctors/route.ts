import { NextRequest } from "next/server";
import { fail, ok, options } from "@/lib/response";
import { ApiError } from "@/lib/errors";
import { errorMessage } from "@/lib/errors";
import { doctorService } from "@/services/doctor-service/doctor.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    const startedAt = Date.now();
    const rows = await doctorService.list({
      q: request.nextUrl.searchParams.get("q"),
      specialty: request.nextUrl.searchParams.get("specialty"),
      hospitalId: request.nextUrl.searchParams.get("hospitalId"),
      visit: request.nextUrl.searchParams.get("visit"),
      limit: request.nextUrl.searchParams.get("limit"),
    });
    if (Date.now() - startedAt > 600) console.info("GET /api/doctors slow", { ms: Date.now() - startedAt, count: rows.length });
    return ok(rows);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("GET /api/doctors failed", error);
    return fail(errorMessage(error), 500);
  }
}
