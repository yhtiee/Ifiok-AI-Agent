import "server-only";
import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/query/api";

/** An error with a status and a user-facing message (what happened and how to fix it). */
export class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

export function errorResponse(status: number, message: string, code?: string) {
  const body: ApiErrorBody = { error: { message, ...(code ? { code } : {}) } };
  return NextResponse.json(body, { status });
}

/**
 * Wraps a route handler: RouteErrors become `{ error }` JSON responses; anything else is a 500
 * with a generic message (details are never sent to the client or logged with user content).
 */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof RouteError) return errorResponse(err.status, err.message, err.code);
      console.error("Unhandled route error", err instanceof Error ? err.name : typeof err);
      return errorResponse(500, "Ifiok hit a problem on our side. Try again in a minute.", "internal");
    }
  };
}
