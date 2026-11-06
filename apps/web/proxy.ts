import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookies";

function hasSession(request: NextRequest) {
  return (
    request.cookies.has(ACCESS_TOKEN_COOKIE) ||
    request.cookies.has(REFRESH_TOKEN_COOKIE)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const signedIn = hasSession(request);

  if (pathname === "/dashboard/outlets" || pathname.startsWith("/dashboard/outlets/")) {
    const nextPath = pathname.replace("/dashboard/outlets", "/outlets");
    return NextResponse.redirect(new URL(`${nextPath}${request.nextUrl.search}`, request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(signedIn ? "/dashboard" : "/login", request.url),
    );
  }

  if (pathname === "/login") {
    if (signedIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  const protectedPath = ["/dashboard", "/outlets", "/menu-items"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (protectedPath && !signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
