"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FcGoogle } from "react-icons/fc";
import { Button, Chip, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { DEMO_ACCOUNTS } from "@/lib/ui-data/customer";
import { signIn } from "./session";

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
  /** Demo accounts shown under the form; picking one signs in as that person. */
  personas: string[];
  /** Mock: there is no account backend yet, so every path ends here. */
  onDone: () => void;
};

// The login block of the sign-in design (logo, heading, email, password, primary button, Google button,
// switch link) built from this project's primitives and tokens. Opens in sign-up mode; the link at
// the bottom switches to log-in and back.
export function AuthDialog({ open, onClose, brand, copy, personas, onDone }: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setMode("signup");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const isSignup = mode === "signup";

  // Mock session (session.ts): every path signs in so the header shows the account.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn({ email: email.trim() });
    onDone();
  };

  const pickPersona = (persona: string) => {
    const account = DEMO_ACCOUNTS.find((a) => a.displayName === persona);
    signIn(account ? { accountId: account.id } : { email: persona });
    onDone();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-dvh w-full max-w-sm overflow-y-auto bg-transparent p-sp-4 text-text backdrop:animate-fade-in backdrop:bg-scrim"
    >
      <div className="relative flex flex-col items-center gap-sp-8 rounded-card border border-border-soft bg-popover px-sp-6 py-sp-12 shadow-pop">
        <Button variant="ghost" className="absolute end-sp-2 top-sp-2" onClick={onClose}>
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
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input label={copy.password} type="password" autoComplete={isSignup ? "new-password" : "current-password"} required />
          <Button type="submit" fullWidth className="mt-sp-2">
            {isSignup ? copy.submit : copy.loginSubmit}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => {
              // no Google in the demo: a guest session, or the address already typed
              signIn(email.trim() ? { email: email.trim() } : { accountId: "cus_google" });
              onDone();
            }}
          >
            <FcGoogle aria-hidden className="size-sp-5" />
            {isSignup ? copy.googleSignup : copy.googleLogin}
          </Button>
        </form>

        <p className="flex flex-wrap items-center justify-center gap-x-sp-1 text-label text-muted">
          <span>{isSignup ? copy.haveAccount : copy.noAccount}</span>
          <button
            type="button"
            onClick={() => setMode(isSignup ? "login" : "signup")}
            className={cn("inline-flex min-h-touch items-center px-sp-1 font-med text-brand hover:underline", focusRing)}
          >
            {isSignup ? copy.loginLink : copy.signupLink}
          </button>
        </p>

        <section className="flex w-full flex-col gap-sp-2 border-t border-border-soft pt-sp-6">
          <p className="text-label text-muted">{copy.demo}</p>
          <div className="flex flex-wrap gap-sp-2">
            {personas.map((persona) => (
              <Chip key={persona} onClick={() => pickPersona(persona)}>
                {persona}
              </Chip>
            ))}
          </div>
          <p className="text-caption text-subtle">{copy.demoNote}</p>
        </section>
      </div>
    </dialog>
  );
}
