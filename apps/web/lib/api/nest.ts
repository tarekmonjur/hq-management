import "server-only";

import { cookies } from "next/headers";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_ID_COOKIE,
  readTokenPair,
  type AuthTokenPair,
} from "@/lib/auth/cookies";
import { clearSessionCookies, writeSessionCookies } from "@/lib/auth/session";

const inflightRefresh = new Map<string, Promise<AuthTokenPair | null>>();

export function apiBaseUrl() {
  return (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

type NestRequest = {
  method?: string;
  body?: BodyInit | null;
  headers?: Headers;
  search?: string;
};

function nestUrl(path: string, search = "") {
  const normalized = path.replace(/^\/+/, "");
  return `${apiBaseUrl()}/api/v1/${normalized}${search}`;
}

async function callNest(
  path: string,
  accessToken: string | undefined,
  init: NestRequest,
) {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(nestUrl(path, init.search), {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    cache: "no-store",
  });
}

async function requestRefresh(
  sessionId: string,
  refreshToken: string,
): Promise<AuthTokenPair | null> {
  const response = await fetch(nestUrl("auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return readTokenPair(await response.json());
}

async function refreshFromCookies(): Promise<AuthTokenPair | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_ID_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!sessionId || !refreshToken) {
    return null;
  }

  const key = `${sessionId}:${refreshToken}`;
  let pending = inflightRefresh.get(key);
  if (!pending) {
    pending = requestRefresh(sessionId, refreshToken).finally(() => {
      inflightRefresh.delete(key);
    });
    inflightRefresh.set(key, pending);
  }

  const tokens = await pending;
  if (!tokens) {
    await clearSessionCookies();
    return null;
  }

  await writeSessionCookies(tokens);
  return tokens;
}

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      message: "Unauthorized",
      data: null,
      error: { message: "Unauthorized" },
    }),
    {
      status: 401,
      headers: { "content-type": "application/json" },
    },
  );
}

export async function nestFetch(path: string, init: NestRequest = {}) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    const refreshed = await refreshFromCookies();
    if (!refreshed) {
      return unauthorizedResponse();
    }
    accessToken = refreshed.accessToken;
  }

  const response = await callNest(path, accessToken, init);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshFromCookies();
  if (!refreshed) {
    return response;
  }

  return callNest(path, refreshed.accessToken, init);
}
