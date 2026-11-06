import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api/nest";
import { readTokenPair } from "@/lib/auth/cookies";
import { writeSessionCookies } from "@/lib/auth/session";

export async function POST(request: Request) {
  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request",
        data: null,
        error: { message: "Invalid request" },
      },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${apiBaseUrl()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    cache: "no-store",
  });

  const body = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  const tokens = readTokenPair(body);
  if (!tokens) {
    return NextResponse.json(
      {
        success: false,
        message: "Login failed",
        data: null,
        error: { message: "Login failed" },
      },
      { status: 502 },
    );
  }

  await writeSessionCookies(tokens);

  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : "Logged in successfully";

  return NextResponse.json({
    success: true,
    message,
    data: null,
  });
}
