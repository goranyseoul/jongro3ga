"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { Button, Input } from "@/components/ui";
import { authCopy } from "@/components/auth/copy";
import { errorMessage, fetchMe, safeNext, signInEmail } from "@/components/auth/client";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type Me = { account: { role: "customer" | "clinic_staff" | "operator" } };

export function LoginForm() {
  const locale = useLocale();
  const ui = authCopy(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    setDenied(params.get("denied") === "1");
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await signInEmail(email, password);
    if (!result.ok) {
      setPending(false);
      setError(errorMessage(result.code, result.status, ui));
      return;
    }
    if (next) {
      window.location.assign(next);
      return;
    }
    const me = await fetchMe<Me>();
    const role = me?.account.role;
    window.location.assign(role === "clinic_staff" ? "/clinic" : role === "operator" ? "/ops" : `/${locale}/home`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-sp-4">
      {denied ? (
        <p role="status" className="rounded-card border border-border-soft bg-elev p-sp-4 text-label text-muted">
          {ui.denied}
        </p>
      ) : null}
      <Input
        type="email"
        label={ui.email}
        name="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        type="password"
        label={ui.password}
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" fullWidth disabled={pending} aria-busy={pending || undefined}>
        {pending ? ui.pending : ui.loginSubmit}
      </Button>
      <p className="flex flex-wrap items-center justify-center gap-x-sp-1 text-label text-muted">
        <span>{ui.noAccount}</span>
        <Link href="/signup" className={cn("inline-flex min-h-touch items-center px-sp-1 font-med text-brand hover:underline", focusRing)}>
          {ui.signupLink}
        </Link>
      </p>
    </form>
  );
}
