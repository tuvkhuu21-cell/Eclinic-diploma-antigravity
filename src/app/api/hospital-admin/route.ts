import { z } from "zod";
import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { getAuthUser } from "@/lib/api-auth";
import { requireRole } from "@/lib/api-role";
import { created, fail, ok, options } from "@/lib/response";
import { validateBody } from "@/lib/validate";
import { hospitalAdminService } from "@/services/hospital-admin-service/hospital-admin.service";

export const runtime = "nodejs";
export const OPTIONS = options;

const labResultSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(2),
  summary: z.string().optional(),
  doctorNote: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.literal("")),
  fileName: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    requireRole(user, ["HOSPITAL", "ADMIN"]);
    return ok(await hospitalAdminService.dashboard(user.userId));
  } catch (error) {
    return fail(errorMessage(error), error instanceof ApiError ? error.statusCode : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    requireRole(user, ["HOSPITAL", "ADMIN"]);
    const input = validateBody(labResultSchema, await request.json());
    return created(await hospitalAdminService.createLabResult(user.userId, input), "created");
  } catch (error) {
    return fail(errorMessage(error), error instanceof ApiError ? error.statusCode : 500);
  }
}
