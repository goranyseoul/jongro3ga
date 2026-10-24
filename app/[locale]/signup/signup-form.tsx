"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@/components/ui";
import { resetDemoState } from "@/components/customer/demo-state";
import { signIn } from "@/components/customer/session";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { DEMO_ACCOUNTS } from "@/lib/ui-data/customer";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const t = useTranslations("signup");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError(true);
      return;
    }
    resetDemoState();
    signIn({ email: email.trim() });
    router.push("/onboarding");
  };

  return (
    <div className="flex flex-col gap-sp-8">
      <form noValidate onSubmit={submit} className="flex flex-col gap-sp-4">
        <Input
          type="email"
          label={t("emailLabel")}
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(false);
          }}
          hint={t("emailHint")}
          error={error ? t("emailError") : undefined}
        />
        <Button type="submit" size="lg" fullWidth>
          {t("submit")}
        </Button>
      </form>

      <p className="text-center text-label text-subtle">{t("or")}</p>

      <section aria-labelledby="signup-demo" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="signup-demo" className="text-title font-semi">
            {t("demoTitle")}
          </h2>
          <p className="text-label text-muted">{t("demoLead")}</p>
        </div>
        <ul className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => {
                  resetDemoState();
                  signIn({ accountId: account.id });
                  router.push(account.start === "onboarding" ? "/onboarding" : "/home", { locale: account.locale });
                }}
                className={cn(
                  "flex min-h-touch w-full flex-col gap-sp-1 rounded-card border border-border-soft bg-elev p-sp-4 text-start shadow-card transition-colors duration-press ease-out hover:bg-sunken",
                  focusRing,
                )}
              >
                <span className="text-title font-semi">{account.displayName}</span>
                <span className="text-label text-muted">{t(`accounts.${account.key}`)}</span>
                <span className="text-caption text-subtle">{t(`startLabel.${account.start}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
