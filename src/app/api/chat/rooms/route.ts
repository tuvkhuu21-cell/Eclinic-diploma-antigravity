import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { fail, ok, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";
import { chatService } from "@/services/chat-service/chat.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    return ok(await chatService.rooms(user.userId));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("GET /api/chat/rooms failed", error);
    return fail(errorMessage(error), 500);
  }
}
