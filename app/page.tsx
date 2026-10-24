import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// "/" opens the English landing for every visitor (owner decision 2026-10-24: English is the default
// for now). Detecting the browser language (04-onboarding-chat.md) was removed on purpose; to bring it
// back, restore pickLocale() from the previous version of this file.
export default function Root() {
  redirect(`/${routing.defaultLocale}`);
}
