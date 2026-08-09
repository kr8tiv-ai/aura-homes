// Base-path helper: GH Pages serves the app under /aura-homes, dev serves at /.
// NEXT_PUBLIC_BASE_PATH is inlined at build time from next.config.mjs.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
