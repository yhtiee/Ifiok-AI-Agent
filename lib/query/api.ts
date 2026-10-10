// Client-side fetch for our own route handlers (/api/*). Responses are validated at the
// boundary with the caller's schema (zod or zod/mini, anything with `.parse`).

/** Error body every route handler returns on failure: `{ error: { message, code? } }`. */
export type ApiErrorBody = { error: { message: string; code?: string } };

/** A failed API call. `message` is user-facing: it says what happened and how to fix it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** 4xx errors other than timeouts and rate limits won't succeed on retry. */
  get retryable() {
    return this.status === 0 || this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

type Parser<T> = { parse: (input: unknown) => T };

type ApiFetchOptions<T> = {
  schema: Parser<T>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function readErrorBody(json: unknown): { message?: string; code?: string } {
  if (typeof json !== "object" || json === null || !("error" in json)) return {};
  const error = (json as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return {};
  const { message, code } = error as Record<string, unknown>;
  return {
    message: typeof message === "string" ? message : undefined,
    code: typeof code === "string" ? code : undefined,
  };
}

export async function apiFetch<T>(
  path: string,
  { schema, method = "GET", body, signal }: ApiFetchOptions<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "You're offline or the connection dropped. Check your data and try again.");
  }

  const json: unknown = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const { message, code } = readErrorBody(json);
    throw new ApiError(res.status, message ?? `The request failed (${res.status}). Try again in a moment.`, code);
  }

  try {
    return schema.parse(json);
  } catch {
    throw new ApiError(
      res.status,
      "Ifiok got an unexpected reply. Refresh the page; if it keeps happening, update the app.",
      "bad_response",
    );
  }
}
