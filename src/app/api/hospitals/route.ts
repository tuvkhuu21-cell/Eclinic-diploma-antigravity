import { NextRequest } from "next/server";
import { fail, ok, options } from "@/lib/response";
import { errorMessage } from "@/lib/errors";
import { hospitalService } from "@/services/hospital-service/hospital.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    return ok(await hospitalService.list({
      q: request.nextUrl.searchParams.get("q"),
      district: request.nextUrl.searchParams.get("district"),
      full: request.nextUrl.searchParams.get("full"),
    }));
  } catch (error) {
    console.error("GET /api/hospitals failed", error);
    return fail(errorMessage(error), 500);
  }
}
