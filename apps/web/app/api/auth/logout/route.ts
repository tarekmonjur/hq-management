import { NextResponse } from "next/server";

import { nestFetch } from "@/lib/api/nest";
import { clearSessionCookies } from "@/lib/auth/session";

export async function POST() {
  const upstream = await nestFetch("auth/logout", { method: "POST" });
  const body = await upstream.json().catch(() => null);
  await clearSessionCookies();

  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : "Logged out successfully";

  return NextResponse.json({
    success: true,
    message,
    data: null,
  });
}
