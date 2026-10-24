/**
 * Where a console login sends you after sign-in. Only a same-site absolute path is accepted: no
 * scheme, no protocol-relative "//host", no backslash tricks, and never the login page itself.
 * Anything else falls back, so a crafted ?next= link cannot bounce staff to another site.
 */
export function safeNextPath(next: string | null | undefined, fallback: string, loginPath?: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\s]/.test(next) || next.includes("://")) return fallback;
  const path = next.split(/[?#]/)[0];
  if (loginPath && (path === loginPath || path === `${loginPath}/`)) return fallback;
  return next;
}
