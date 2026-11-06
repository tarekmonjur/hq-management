import { apiFetch } from "@/lib/api/client";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  outletId: string | null;
  sessionId: string;
};

export function loginRequest(input: { email: string; password: string }) {
  return apiFetch<null>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutRequest() {
  return apiFetch<null>("/api/auth/logout", { method: "POST" });
}

export async function currentUserRequest() {
  const response = await apiFetch<CurrentUser>("/api/backend/auth/me");
  return response.data;
}
