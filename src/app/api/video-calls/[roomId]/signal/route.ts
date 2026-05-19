import { NextRequest } from "next/server";
import { ApiError, errorMessage } from "@/lib/errors";
import { fail, ok, options } from "@/lib/response";
import { getAuthUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = options;

type SignalMessage = {
  id: string;
  senderId: string;
  type: "offer" | "answer" | "ice";
  payload: unknown;
  createdAt: string;
};

const globalStore = globalThis as typeof globalThis & { __mediconnectVideoSignals?: Map<string, SignalMessage[]> };
const store = globalStore.__mediconnectVideoSignals ?? new Map<string, SignalMessage[]>();
globalStore.__mediconnectVideoSignals = store;

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = getAuthUser(request);
    const { roomId } = await params;
    const since = request.nextUrl.searchParams.get("since") || "";
    const messages = (store.get(roomId) || []).filter((message) => message.senderId !== user.userId && (!since || message.createdAt > since));
    return ok(messages);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("GET /api/video-calls/[roomId]/signal failed", error);
    return fail(errorMessage(error), 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = getAuthUser(request);
    const { roomId } = await params;
    const body = await request.json().catch(() => ({}));
    const type = body.type === "offer" || body.type === "answer" || body.type === "ice" ? body.type : "";
    if (!type) throw new ApiError(400, "Invalid signal type");
    const message: SignalMessage = {
      id: crypto.randomUUID(),
      senderId: user.userId,
      type,
      payload: body.payload,
      createdAt: new Date().toISOString(),
    };
    const rows = store.get(roomId) || [];
    rows.push(message);
    store.set(roomId, rows.slice(-80));
    return ok(message);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.statusCode);
    console.error("POST /api/video-calls/[roomId]/signal failed", error);
    return fail(errorMessage(error), 500);
  }
}
