"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FcGoogle } from "react-icons/fc";
import { Button, Input } from "@/components/ui";
import { resetDemoState } from "@/components/customer/demo-state";
import { authCopy } from "@/components/auth/copy";
import { demoSignIn, errorMessage, fetchAuthOptions, signInGoogle, signUpEmail, type AuthOptions } from "@/components/auth/client";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { DEMO_ACCOUNTS } from "@/lib/ui-data/customer";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const t = useTranslations("signup");
  const locale = useLocale();
  const ui = authCopy(locale);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [options, setOptions] = useState<AuthOptions>({ google: false, demo: false, demoAccounts: [] });

  useEffect(() => {
    void fetchAuthOptions().then(setOptions);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (!EMAIL.test(email.trim())) {
      setEmailError(true);
      return;
    }
    if (password.length < 8) {
      setError(ui.errors.passwordTooShort);
      return;
    }
    setPending(true);
    setError(null);
    const result = await signUpEmail(email, password);
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code, result.status, ui));
      return;
    }
    resetDemoState();
    router.push("/onboarding");
  };

  const pickDemo = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await demoSignIn(account.key);
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code, result.status, ui));
      return;
    }
    resetDemoState();
    router.push(account.start === "onboarding" ? "/onboarding" : "/home", { locale: account.locale });
  };

  return (
    <div className="flex flex-col gap-sp-8">
      <form noValidate onSubmit={submit} className="flex flex-col gap-sp-4">
        <Input
          type="email"
          label={t("emailLabel")}
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(false);
          }}
          hint={t("emailHint")}
          error={emailError ? t("emailError") : undefined}
        />
        <Input
          type="password"
          label={ui.password}
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          hint={ui.passwordHint}
        />
        {error ? (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" fullWidth disabled={pending} aria-busy={pending || undefined}>
          {pending ? ui.pending : t("submit")}
        </Button>
        {options.google ? (
          <Button type="button" variant="secondary" size="lg" fullWidth disabled={pending} onClick={() => void signInGoogle(`/${locale}/home`, `/${locale}/onboarding`)}>
            <FcGoogle aria-hidden className="size-sp-5" />
            {ui.googleSignup}
          </Button>
        ) : null}
        <p className="flex flex-wrap items-center justify-center gap-x-sp-1 text-label text-muted">
          <span>{ui.haveAccount}</span>
          <Link href="/login" className={cn("inline-flex min-h-touch items-center px-sp-1 font-med text-brand hover:underline", focusRing)}>
            {ui.loginLink}
          </Link>
        </p>
      </form>

      {options.demo ? (
        <>
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
                    disabled={pending}
                    onClick={() => void pickDemo(account)}
                    className={cn(
                      "flex min-h-touch w-full flex-col gap-sp-1 rounded-card border border-border-soft bg-elev p-sp-4 text-start shadow-card transition-colors duration-press ease-out hover:bg-sunken disabled:opacity-50",
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
        </>
      ) : null}
    </div>
  );
}
