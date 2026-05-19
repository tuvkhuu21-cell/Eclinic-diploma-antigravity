import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/patient") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/appointments") ||
    pathname.startsWith("/consultation");
  const token = request.cookies.get("mediconnect_token");
  if (protectedPath && !token) return NextResponse.redirect(new URL("/auth/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/patient/:path*", "/chat/:path*", "/appointments/:path*", "/consultation/:path*"] };
