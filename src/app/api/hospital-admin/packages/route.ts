import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { getAuthUser } from "@/lib/api-auth";
import { requireRole } from "@/lib/api-role";
import { created, fail, options } from "@/lib/response";
import { validateBody } from "@/lib/validate";
import { hospitalAdminService } from "@/services/hospital-admin-service/hospital-admin.service";
import { healthPackageSchema } from "@/services/hospital-admin-service/hospital-admin.schema";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    requireRole(user, ["HOSPITAL", "ADMIN"]);
    const input = validateBody(healthPackageSchema, await request.json());
    return created(await hospitalAdminService.createHealthPackage(user.userId, input), "created");
  } catch (error) {
    return fail(errorMessage(error), error instanceof ApiError ? error.statusCode : 500);
  }
}
