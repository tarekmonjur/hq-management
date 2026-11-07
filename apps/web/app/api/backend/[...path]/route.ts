import { NextResponse } from "next/server";

import { nestFetch } from "@/lib/api/nest";

const BLOCKED_PATHS = new Set(["auth/login", "auth/refresh", "auth/logout"]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;

  if (path.some((segment) => segment === ".." || segment.includes("\\"))) {
    return NextResponse.json(
      { success: false, message: "Not found", data: null },
      { status: 404 },
    );
  }

  const target = path.join("/");
  if (BLOCKED_PATHS.has(target)) {
    return NextResponse.json(
      { success: false, message: "Not found", data: null },
      { status: 404 },
    );
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (accept) {
    headers.set("accept", accept);
  }
  if (idempotencyKey) {
    headers.set("idempotency-key", idempotencyKey);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const url = new URL(request.url);

  const upstream = await nestFetch(target, {
    method,
    headers,
    search: url.search,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) {
    responseHeaders.set("content-type", upstreamType);
  }
  responseHeaders.set("cache-control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
