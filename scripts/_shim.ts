/**
 * Stubs the `server-only` package so CLI scripts can import modules from
 * src/lib. Must be imported *before* anything that pulls in the data layer —
 * ESM hoists imports, so this lives in its own file rather than inline.
 */
import Module from "node:module";

const mod = Module as unknown as { _load: (...args: unknown[]) => unknown };
const original = mod._load;

mod._load = function (this: unknown, request: unknown, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return original.call(this, request, ...rest);
} as never;

export {};
