"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAgent } from "./agent-context";

// The conversation window lives on the landing (onboarding-chat.tsx renders it). A request made on any
// other screen of the customer app brings the customer back there, where the window picks it up.
export function AgentDock() {
  const { pending } = useAgent();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pending && pathname !== "/") router.push("/");
  }, [pending, pathname, router]);

  return null;
}
