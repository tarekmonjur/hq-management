import "server-only";

import { cookies } from "next/headers";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  SESSION_ID_COOKIE,
  type AuthTokenPair,
} from "@/lib/auth/cookies";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function writeSessionCookies(tokens: AuthTokenPair) {
  const cookieStore = await cookies();
  cookieStore.set(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    cookieOptions(tokens.expiresIn),
  );
  cookieStore.set(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    cookieOptions(REFRESH_COOKIE_MAX_AGE),
  );
  cookieStore.set(
    SESSION_ID_COOKIE,
    tokens.sessionId,
    cookieOptions(REFRESH_COOKIE_MAX_AGE),
  );
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(SESSION_ID_COOKIE);
}
