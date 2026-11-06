export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const SESSION_ID_COOKIE = "session_id";

/** Matches the API default JWT_REFRESH_EXPIRES_IN of 7 days. */
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type AuthTokenPair = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresIn: number;
};

export function readTokenPair(body: unknown): AuthTokenPair | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as { data?: unknown };
  const source =
    record.data && typeof record.data === "object" ? record.data : body;
  const tokens = source as Partial<AuthTokenPair>;

  if (
    typeof tokens.accessToken !== "string" ||
    typeof tokens.refreshToken !== "string" ||
    typeof tokens.sessionId !== "string"
  ) {
    return null;
  }

  const expiresIn =
    typeof tokens.expiresIn === "number" && tokens.expiresIn > 0
      ? tokens.expiresIn
      : 15 * 60;

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    expiresIn,
  };
}
