"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { FcGoogle } from "react-icons/fc";
import { Button, Chip, Input } from "@/components/ui";
import { authCopy } from "@/components/auth/copy";
import {
  demoSignIn,
  errorMessage,
  fetchAuthOptions,
  safeNext,
  signInEmail,
  signInGoogle,
  signUpEmail,
  type AuthOptions,
} from "@/components/auth/client";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type AuthCopy = {
  title: string;
  email: string;
  submit: string;
  demo: string;
  close: string;
  password: string;
  loginTitle: string;
  loginSubmit: string;
  googleSignup: string;
  googleLogin: string;
  haveAccount: string;
  loginLink: string;
  noAccount: string;
  signupLink: string;
  demoNote: string;
};

export type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  brand: string;
  copy: AuthCopy;
  /** Demo accounts shown under the form (DEMO_MODE only); picking one signs in as that person. */
  personas: string[];
  /** Called after a successful sign up or sign in when there is no ?next= to return to. */
  onDone: () => void;
};

type Mode = "signup" | "login";

const NO_OPTIONS: AuthOptions = { google: false, demo: false, demoAccounts: [] };

// The login block of the sign-in design (logo, heading, email, password, primary button, Google button,
// switch link) built from this project's primitives and tokens. Opens in sign-up mode; the link at
// the bottom switches to log-in and back. It also opens by itself when the page URL carries
// ?auth=login|signup (proxy.ts sends signed-out visitors of app routes here with ?next=).
export function AuthDialog({ open, onClose, brand, copy, personas, onDone }: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const locale = useLocale();
  const ui = authCopy(locale);
  const [mode, setMode] = useState<Mode>("signup");
  const [auto, setAuto] = useState<Mode | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [options, setOptions] = useState<AuthOptions>(NO_OPTIONS);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const visible = open || auto !== null;

  // ?auth=login|signup&next=/ja/home opens the dialog once, then the query is cleaned up
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("auth");
    if (requested !== "login" && requested !== "signup") return;
    setNext(safeNext(params.get("next")));
    setAuto(requested);
    params.delete("auth");
    params.delete("next");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (visible && !dialog.open) {
      setMode(auto ?? "signup");
      setError(null);
      setPassword("");
      dialog.showModal();
      void fetchAuthOptions().then(setOptions);
    }
    if (!visible && dialog.open) dialog.close();
  }, [visible, auto]);

  const isSignup = mode === "signup";

  const close = () => {
    setAuto(null);
    onClose();
  };

  const finish = (target?: string | null) => {
    const destination = next ?? target ?? null;
    if (destination) {
      window.location.assign(destination);
      return;
    }
    setAuto(null);
    onDone();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = isSignup ? await signUpEmail(email, password) : await signInEmail(email, password);
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code, result.status, ui));
      return;
    }
    finish();
  };

  const google = async () => {
    setError(null);
    const home = `/${locale}/home`;
    const result = await signInGoogle(next ?? home, next ?? `/${locale}/onboarding`);
    if (!result.ok) setError(errorMessage(result.code, result.status, ui));
  };

  const pickPersona = async (persona: string) => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await demoSignIn(persona);
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code, result.status, ui));
      return;
    }
    const picked = (result.data as { persona?: { locale?: string | null; start?: string | null } } | null)?.persona;
    // finished demo customers open their app home; Yuki (start: onboarding) continues the chat here
    finish(picked?.start === "home" && picked.locale ? `/${picked.locale}/home` : null);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto max-h-dvh w-full max-w-sm overflow-y-auto bg-transparent p-sp-4 text-text backdrop:animate-fade-in backdrop:bg-scrim"
    >
      <div className="relative flex flex-col items-center gap-sp-8 rounded-card border border-border-soft bg-popover px-sp-6 py-sp-12 shadow-pop">
        <Button variant="ghost" className="absolute end-sp-2 top-sp-2" onClick={close}>
          {copy.close}
        </Button>

        <div className="flex flex-col items-center gap-sp-2">
          <span className="text-title font-semi">{brand}</span>
          <h2 id={titleId} className="text-h2 font-semi">
            {isSignup ? copy.title : copy.loginTitle}
          </h2>
        </div>

        <form onSubmit={submit} className="flex w-full flex-col gap-sp-4">
          <Input
            label={copy.email}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label={copy.password}
            type="password"
            name="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            hint={isSignup ? ui.passwordHint : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" fullWidth className="mt-sp-2" disabled={pending} aria-busy={pending || undefined}>
            {pending ? ui.pending : isSignup ? copy.submit : copy.loginSubmit}
          </Button>
          {options.google ? (
            <Button type="button" variant="secondary" fullWidth onClick={google} disabled={pending}>
              <FcGoogle aria-hidden className="size-sp-5" />
              {isSignup ? copy.googleSignup : copy.googleLogin}
            </Button>
          ) : null}
        </form>

        <p className="flex flex-wrap items-center justify-center gap-x-sp-1 text-label text-muted">
          <span>{isSignup ? copy.haveAccount : copy.noAccount}</span>
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError(null);
            }}
            className={cn("inline-flex min-h-touch items-center px-sp-1 font-med text-brand hover:underline", focusRing)}
          >
            {isSignup ? copy.loginLink : copy.signupLink}
          </button>
        </p>

        {options.demo && personas.length > 0 ? (
          <section className="flex w-full flex-col gap-sp-2 border-t border-border-soft pt-sp-6">
            <p className="text-label text-muted">{copy.demo}</p>
            <div className="flex flex-wrap gap-sp-2">
              {personas.map((persona) => (
                <Chip key={persona} onClick={() => void pickPersona(persona)} disabled={pending}>
                  {persona}
                </Chip>
              ))}
            </div>
            <p className="text-caption text-subtle">{ui.demoNote}</p>
          </section>
        ) : null}
      </div>
    </dialog>
  );
}
