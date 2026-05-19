import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { created, fail, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";
import { validateBody } from "@/lib/validate";
import { sendMessageSchema } from "@/services/chat-service/chat.schema";
import { chatService } from "@/services/chat-service/chat.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    const input = validateBody(sendMessageSchema, await request.json());
    return created(await chatService.send(user.userId, input));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("POST /api/chat/messages failed", error);
    return fail(errorMessage(error), 500);
  }
}
