import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { created, fail, ok, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";
import { validateBody } from "@/lib/validate";
import { sendMessageSchema } from "@/services/chat-service/chat.schema";
import { chatService } from "@/services/chat-service/chat.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (roomId) {
      const limit = Number(request.nextUrl.searchParams.get("limit") || 80);
      const since = request.nextUrl.searchParams.get("since") || undefined;
      return ok(await chatService.messages(user.userId, roomId, { limit, since }));
    }
    return ok(await chatService.rooms(user.userId));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("GET /api/chat failed", error);
    return fail(errorMessage(error), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const input = validateBody(sendMessageSchema, await request.json());
    return created(await chatService.send(user.userId, input));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("POST /api/chat failed", error);
    return fail(errorMessage(error), 500);
  }
}
