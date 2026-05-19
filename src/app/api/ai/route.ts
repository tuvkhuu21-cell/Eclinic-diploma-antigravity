import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { fail, ok, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";
import { validateBody } from "@/lib/validate";
import { aiAskSchema } from "@/services/ai-service/ai.schema";
import { aiService } from "@/services/ai-service/ai.service";

export const runtime = "nodejs";
export const OPTIONS = options;

export async function GET(request: NextRequest) {
  try {
    const user = getOptionalAuthUser(request);
    return ok(aiService.tools(user?.role || "PATIENT"));
  } catch (error) {
    return fail(errorMessage(error), error instanceof ApiError ? error.statusCode : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getOptionalAuthUser(request);
    const input = validateBody(aiAskSchema, await request.json());
    return ok(await aiService.ask(user?.userId || null, user?.role || "PATIENT", input));
  } catch (error) {
    return fail(errorMessage(error), error instanceof ApiError ? error.statusCode : 500);
  }
}

function getOptionalAuthUser(request: NextRequest) {
  try {
    return getAuthUser(request);
  } catch {
    return null;
  }
}

