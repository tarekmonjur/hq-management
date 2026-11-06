export type FieldErrors = Record<string, string[]>;

export type ApiSuccess<T> = {
  success?: boolean;
  message: string;
  data: T;
};

export class ApiError extends Error {
  status: number;
  fieldErrors?: FieldErrors;

  constructor(status: number, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function isFieldMap(value: unknown): value is FieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (messages) =>
      Array.isArray(messages) &&
      messages.every((message) => typeof message === "string"),
  );
}

export function parseApiError(body: unknown, status: number) {
  const record =
    body && typeof body === "object"
      ? (body as { message?: unknown; error?: { message?: unknown } })
      : {};
  const raw = record.error?.message;

  if (isFieldMap(raw)) {
    return new ApiError(status, "Please fix the highlighted fields.", raw);
  }

  const message =
    typeof raw === "string"
      ? raw
      : typeof record.message === "string"
        ? record.message
        : "Request failed";

  return new ApiError(status, message);
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<ApiSuccess<T>> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!response.ok) {
    throw parseApiError(body, response.status);
  }

  return (body ?? { message: "", data: null }) as ApiSuccess<T>;
}
