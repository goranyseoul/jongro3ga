import type { CustomerProfileBody } from "./engine";

// On finish the profile goes to the account through the AUTH track's PUT /api/me/profile (body: CustomerProfile,
// 06-data-model.md). The call is made server side with the customer's cookie so the browser never sees a 404
// while AUTH has not landed; the chat then keeps its browser demo-state fallback.

export type ProfileSaveResult = "account" | "demo_fallback" | "error";

export async function saveProfileToAccount(profile: CustomerProfileBody, request: Request): Promise<ProfileSaveResult> {
  const url = new URL("/api/me/profile", request.url);
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
        origin: url.origin,
      },
      body: JSON.stringify(profile),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (response.ok) return "account";
    // 401 signed out, 404 route not there yet (AUTH track), 405 route without PUT: all mean "keep it in the browser"
    if (response.status === 401 || response.status === 404 || response.status === 405) return "demo_fallback";
    return "error";
  } catch {
    return "demo_fallback";
  }
}
