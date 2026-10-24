import { isLocale } from "../locales";
import type { Locale } from "@/lib/domain/common";

/**
 * Where to go after login. Only a same-site path is honoured ("/records", "/ja/records"); anything that
 * could leave the site ("//evil.example", "https://...", "/\\evil") falls back to home. A leading locale
 * segment is split off so the router can switch to it.
 */
export function resolveNext(next: string | undefined): { pathname: string; locale?: Locale } {
  const fallback = { pathname: "/home" };
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // control characters can be used to smuggle a scheme past the checks above
  if (/[\u0000-\u001f]/.test(next)) return fallback;

  let url: URL;
  try {
    url = new URL(next, "https://pibook.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://pibook.invalid") return fallback;

  const [, first, ...rest] = url.pathname.split("/");
  const locale: Locale | undefined = isLocale(first) ? first : undefined;
  const path = locale ? `/${rest.join("/")}` : url.pathname;
  if (path === "/login" || path === "/signup") return { ...fallback, locale };
  return { pathname: `${path}${url.search}${url.hash}`, locale };
}
