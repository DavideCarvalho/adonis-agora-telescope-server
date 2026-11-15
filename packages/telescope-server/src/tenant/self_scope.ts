import type { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Telescope marks the work it does on its own behalf with an `AsyncLocalStorage` kept on a
 * `Symbol.for()` global slot, so every copy of the package agrees on it. Sending entries to the
 * server runs inside it: the outbound request is not recorded by the http-client watcher (which
 * would record a new entry per send, forever).
 */
const SELF_SCOPE_KEY = Symbol.for('@agora/telescope:self-scope');
const WRAPPER_KEY = Symbol.for('@agora/telescope:self-scope-wrapper');

/** Run `fn` as telescope's own work (a no-op wrapper when telescope never loaded the slot). */
export function runAsTelescopeWork<T>(fn: () => T): T {
  const slot = globalThis as Record<symbol, unknown>;
  const scope = slot[SELF_SCOPE_KEY] as AsyncLocalStorage<true> | undefined;
  const wrapper = slot[WRAPPER_KEY] as (<R>(f: () => R) => R) | undefined;
  if (scope === undefined || typeof scope.run !== 'function') return fn();
  return scope.run(true, wrapper === undefined ? fn : () => wrapper(fn));
}
