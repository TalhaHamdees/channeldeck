import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { DEV_AUTH_BYPASS } from "@/lib/dev";

export default auth((req) => {
  // Local-only: skip all auth gating when the dev bypass is enabled.
  if (DEV_AUTH_BYPASS) return NextResponse.next();

  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron");

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  // Everything except static assets. API routes also re-check auth themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
