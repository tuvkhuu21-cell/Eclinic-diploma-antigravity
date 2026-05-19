import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { fail, ok, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";
import { chatService } from "@/services/chat-service/chat.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = getAuthUser(request);
    const { roomId } = await params;
    const limit = Number(request.nextUrl.searchParams.get("limit") || 80);
    const since = request.nextUrl.searchParams.get("since") || undefined;
    return ok(await chatService.messages(user.userId, roomId, { limit, since }));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("GET /api/chat/rooms/[roomId]/messages failed", error);
    return fail(errorMessage(error), 500);
  }
}
