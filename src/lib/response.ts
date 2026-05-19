import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.NODE_ENV === "production" ? (process.env.FRONTEND_URL || "") : "*",
  "Access-Control-Allow-Credentials": process.env.NODE_ENV === "production" ? "true" : "false",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export function ok(data: unknown, message = "success", init?: ResponseInit) {
  return NextResponse.json({ success: true, message, data }, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

export function created(data: unknown, message = "created") {
  return ok(data, message, { status: 201 });
}

export function fail(message: string, status = 400, errors?: unknown) {
  return NextResponse.json({ success: false, message, errors }, { status, headers: corsHeaders });
}

export function options() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
