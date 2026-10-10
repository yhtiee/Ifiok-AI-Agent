import "server-only";
import type { z } from "zod";
import { RouteError } from "./route";

/** Parse a JSON request body with a zod schema, or throw a 422 that says what to fix. */
export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new RouteError(400, "The request body must be JSON.", "bad_json");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RouteError(
      422,
      `Check ${issue?.path.join(".") || "the request"}: ${issue?.message ?? "invalid"}.`,
      "invalid",
    );
  }
  return parsed.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids from the URL: reject anything that isn't a UUID before it reaches the database. */
export function requireUuid(value: string): string {
  if (!UUID.test(value)) throw new RouteError(404, "Not found.", "not_found");
  return value;
}
