import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/domain/common";

// "/" sends the visitor to the landing in their browser language (04-onboarding-chat.md: browser
// language is the default). Chinese variants fall back to zh-CN, anything unknown to English.
function pickLocale(acceptLanguage: string): Locale {
  const tags = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("zh")) return "zh-CN";
    if (tag.startsWith("ko")) return "ko";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

export default async function Root() {
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  redirect(`/${pickLocale(acceptLanguage)}`);
}
