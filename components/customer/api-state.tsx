"use client";

import { useTranslations } from "next-intl";
import { Button, Card, CardHeader, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { ApiError } from "./api";

// Loading, signed-out and error states shared by the customer screens. Flat text, no tinted banners.
export function ApiStatus({ error, loading, onRetry }: { error?: ApiError; loading?: boolean; onRetry?: () => void }) {
  const t = useTranslations("common.api");
  if (error?.status === 401) {
    return (
      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("signedOutTitle")} description={t("signedOutBody")} as="h2" />
        <Link href="/signup" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
          {t("signIn")}
        </Link>
      </Card>
    );
  }
  if (error?.status === 409 && error.code === "needs_onboarding") {
    return (
      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("onboardingTitle")} description={t("onboardingBody")} as="h2" />
        <Link href="/onboarding" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
          {t("onboarding")}
        </Link>
      </Card>
    );
  }
  if (error?.status === 404) {
    return (
      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("notFoundTitle")} as="h2" />
        <Link href="/home" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
          {t("home")}
        </Link>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("errorTitle")} description={t("errorBody")} as="h2" />
        {onRetry ? (
          <Button variant="secondary" className="self-start" onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : null}
      </Card>
    );
  }
  if (loading) {
    return (
      <p role="status" className="text-body text-muted">
        {t("loading")}
      </p>
    );
  }
  return null;
}
