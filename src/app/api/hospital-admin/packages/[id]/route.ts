import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { getAuthUser } from "@/lib/api-auth";
import { requireRole } from "@/lib/api-role";
import { fail, ok, options } from "@/lib/response";
import { validateBody } from "@/lib/validate";
import { hospitalAdminService } from "@/services/hospital-admin-service/hospital-admin.service";
import { healthPackageSchema } from "@/services/hospital-admin-service/hospital-admin.schema";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request);
    requireRole(user, ["HOSPITAL", "ADMIN"]);
    const { id } = await params;
    const input = validateBody(healthPackageSchema.partial(), await request.json());
    return ok(await hospitalAdminService.updateHealthPackage(user.userId, id, input), "updated");
  } catch (error) {
    return fail(errorMessage(error), error instanceof ApiError ? error.statusCode : 500);
  }
}
