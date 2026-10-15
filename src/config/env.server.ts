import "server-only";

import { parseServerEnv, type ServerEnv } from "./env.server-schema";

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}
