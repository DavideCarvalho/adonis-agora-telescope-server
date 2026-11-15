import { fileURLToPath } from 'node:url';

/** The directory holding this package's stubs (copied into `dist/stubs` at build time). */
export function stubsRoot(): string {
  return fileURLToPath(new URL('../stubs', import.meta.url));
}
