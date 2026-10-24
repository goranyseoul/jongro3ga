"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, buttonStyles } from "@/components/ui";
import { signIn, useSession } from "@/components/customer/session";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { DEMO_ACCOUNTS } from "@/lib/ui-data/customer";
import { resolveNext } from "./next-path";

// Mock login: there is no account backend yet, so any non-empty email and password sign in.
export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("account.login");
  const tSignup = useTranslations("signup");
  const router = useRouter();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: boolean; password?: boolean }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const target = resolveNext(next);
  const go = () => router.replace(target.pathname, target.locale ? { locale: target.locale } : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const missing = { email: !email.trim(), password: !password };
    setErrors(missing);
    if (missing.email) return emailRef.current?.focus();
    if (missing.password) return passwordRef.current?.focus();
    signIn({ email: email.trim() });
    go();
  };

  return (
    <div className="flex flex-col gap-sp-8">
      {session ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-sp-3 rounded-card border border-border-soft bg-elev p-sp-4">
          <p className="cu-wrap text-body">{t("signedIn", { name: session.displayName })}</p>
          <button type="button" onClick={go} className={buttonStyles({ variant: "secondary" })}>
            {t("continue")}
          </button>
        </div>
      ) : null}

      <form noValidate onSubmit={submit} className="flex flex-col gap-sp-4">
        <Input
          ref={emailRef}
          type="email"
          name="email"
          label={t("emailLabel")}
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((e) => ({ ...e, email: false }));
          }}
          error={errors.email ? t("emailError") : undefined}
        />
        <Input
          ref={passwordRef}
          type="password"
          name="password"
          label={t("passwordLabel")}
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((e) => ({ ...e, password: false }));
          }}
          error={errors.password ? t("passwordError") : undefined}
        />
        <Button type="submit" size="lg" fullWidth className="mt-sp-2">
          {t("submit")}
        </Button>
        <p className="text-caption text-subtle">{t("demoNote")}</p>
      </form>

      <p className="flex flex-wrap items-center justify-center gap-x-sp-1 text-label text-muted">
        <span>{t("noAccount")}</span>
        <Link href="/signup" className={cn("inline-flex min-h-touch items-center px-sp-1 font-med text-brand hover:underline", focusRing)}>
          {t("signupLink")}
        </Link>
      </p>

      <section aria-labelledby="login-demo" className="flex flex-col gap-sp-3 border-t border-border-soft pt-sp-6">
        <div className="flex flex-col gap-sp-1">
          <h2 id="login-demo" className="text-title font-semi">
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
                  signIn({ accountId: account.id });
                  go();
                }}
                className={cn(
                  "flex min-h-touch w-full flex-col gap-sp-1 rounded-card border border-border-soft bg-elev p-sp-4 text-start shadow-card transition-colors duration-press ease-out hover:bg-sunken",
                  focusRing,
                )}
              >
                <span className="text-title font-semi">{account.displayName}</span>
                <span className="text-label text-muted">{tSignup(`accounts.${account.key}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
