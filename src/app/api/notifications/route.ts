import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { created, fail, ok, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";
import { requireRole } from "@/lib/api-role";
import { validateBody } from "@/lib/validate";
import { createNotificationSchema } from "@/services/notification-service/notification.schema";
import { notificationService } from "@/services/notification-service/notification.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const notifications = await notificationService.list(user.userId);
    return ok(Array.isArray(notifications) ? notifications : []);
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.statusCode);
    }
    console.error("GET /api/notifications failed", error);
    return fail("Failed to load notifications", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    requireRole(user, ["ADMIN"]);
    const input = validateBody(createNotificationSchema, await request.json());
    return created(await notificationService.create(input));
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.statusCode);
    }
    console.error("POST /api/notifications failed", error);
    return fail(errorMessage(error), 500);
  }
}
