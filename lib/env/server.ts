import "server-only";
import { parseEnv, serverEnvSchema, type ServerEnv } from "./schema";

/** Server env, including secrets. Never import this from a client component. */
export const serverEnv: ServerEnv = parseEnv(serverEnvSchema, process.env);

type OptionalKey = { [K in keyof ServerEnv]-?: undefined extends ServerEnv[K] ? K : never }[keyof ServerEnv];

/** Read a variable that is optional at boot but required by the feature calling it. */
export function requireServerEnv<K extends OptionalKey>(key: K): NonNullable<ServerEnv[K]> {
  const value = serverEnv[key];
  if (value === undefined || value === null) {
    throw new Error(`${key} is not set. Add it to .env.local (see .env.example), then restart.`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
