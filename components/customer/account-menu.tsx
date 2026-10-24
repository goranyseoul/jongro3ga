"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FiChevronDown, FiUser } from "react-icons/fi";
import { buttonStyles } from "@/components/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { signOut, useSession } from "./session";

export type AccountMenuProps = {
  /** Landing only: sign up opens the AuthDialog there instead of going to /signup. */
  onSignUp?: () => void;
  /** aria-expanded for the sign-up button while that dialog is open. */
  signUpOpen?: boolean;
  /**
   * Phones have no room for two buttons next to the language links, so below sm the signed-out state
   * folds into one account button with the same choices. The landing header has room and opts out.
   */
  compact?: boolean;
  /** App header: the settings gear is hidden below sm, so the folded menu carries it instead. */
  settingsHref?: string;
};

// Paths where a "back to where you were" after login makes no sense.
const NO_RETURN = new Set(["/", "/login", "/signup"]);

/**
 * Account area at the right of every customer header. Server render and the first client render are
 * always signed out (useSession), so the signed-in trigger appears after hydration without a mismatch.
 */
export function AccountMenu({ onSignUp, signUpOpen, compact = true, settingsHref }: AccountMenuProps) {
  const t = useTranslations("account");
  const { session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const loginHref = NO_RETURN.has(pathname) ? "/login" : { pathname: "/login", query: { next: pathname } };

  if (!session) {
    const signUpButton = onSignUp ? (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={signUpOpen ?? false}
        onClick={onSignUp}
        className={buttonStyles({ variant: "secondary" })}
      >
        {t("signUp")}
      </button>
    ) : (
      <Link href="/signup" aria-current={pathname === "/signup" ? "page" : undefined} className={buttonStyles({ variant: "secondary" })}>
        {t("signUp")}
      </Link>
    );

    const buttons = (
      <div className={cn("items-center gap-sp-1", compact ? "hidden sm:flex" : "flex")}>
        <Link href={loginHref} aria-current={pathname === "/login" ? "page" : undefined} className={buttonStyles({ variant: "ghost" })}>
          {t("logIn")}
        </Link>
        {signUpButton}
      </div>
    );

    if (!compact) return buttons;

    return (
      <>
        {buttons}
        <div className="sm:hidden">
          <Menu
            triggerLabel={t("menuLabel")}
            trigger={<FiUser aria-hidden className="text-title" />}
            iconOnly
            items={[
              { kind: "link", href: loginHref, label: t("logIn") },
              onSignUp ? { kind: "action", onSelect: onSignUp, label: t("signUp") } : { kind: "link", href: "/signup", label: t("signUp") },
              ...(settingsHref ? [{ kind: "link" as const, href: settingsHref, label: t("data") }] : []),
            ]}
          />
        </div>
      </>
    );
  }

  const isGuest = session.accountId === "cus_email" && !session.email && session.displayName === "guest";
  const name = isGuest ? t("guestName") : session.displayName;
  const detail = session.email ?? (session.accountId.startsWith("cus_") && !isGuest ? t("demoAccount") : undefined);

  return (
    <Menu
      triggerLabel={t("menuFor", { name })}
      trigger={
        <>
          <FiUser aria-hidden className="text-title" />
          <span className="hidden max-w-xs truncate sm:inline">{name}</span>
          <FiChevronDown aria-hidden className="hidden sm:inline" />
        </>
      }
      compactTrigger
      heading={
        <div className="flex flex-col px-sp-3 py-sp-2">
          <span className="cu-wrap text-label font-semi text-text">{name}</span>
          {detail ? <span className="cu-wrap text-caption text-subtle">{detail}</span> : null}
        </div>
      }
      items={[
        { kind: "link", href: "/me", label: t("myPage") },
        { kind: "link", href: "/records", label: t("records") },
        { kind: "link", href: "/settings/data", label: t("data") },
        {
          kind: "action",
          separated: true,
          label: t("logOut"),
          onSelect: () => {
            signOut();
            router.push("/");
          },
        },
      ]}
    />
  );
}

type Href = Parameters<typeof Link>[0]["href"];
type MenuItem =
  | { kind: "link"; href: Href; label: string; separated?: boolean }
  | { kind: "action"; onSelect: () => void; label: string; separated?: boolean };

/**
 * Menu button pattern (WAI-ARIA APG): Enter, Space or ArrowDown opens and focuses the first item,
 * ArrowUp opens on the last, arrows and Home/End move, Escape closes and returns focus to the button,
 * Tab and an outside press close it.
 */
function Menu({
  trigger,
  triggerLabel,
  iconOnly = false,
  compactTrigger = false,
  heading,
  items,
}: {
  trigger: ReactNode;
  triggerLabel: string;
  iconOnly?: boolean;
  /** Icon only below sm, icon and name from sm up. */
  compactTrigger?: boolean;
  heading?: ReactNode;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const pendingFocus = useRef<"first" | "last" | null>(null);
  const pathname = usePathname();

  // Close on navigation (a picked link) without stealing focus.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    if (pendingFocus.current) {
      const list = itemRefs.current.filter(Boolean) as HTMLElement[];
      (pendingFocus.current === "first" ? list[0] : list[list.length - 1])?.focus();
      pendingFocus.current = null;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openWith = (focus: "first" | "last") => {
    pendingFocus.current = focus;
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openWith("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openWith("last");
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = itemRefs.current.filter(Boolean) as HTMLElement[];
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(list.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") setOpen(false);
  };

  const itemClass = cn(
    "flex min-h-touch w-full items-center rounded-md px-sp-3 text-start text-body text-text transition-colors duration-press ease-out hover:bg-sunken focus-visible:bg-sunken",
    focusRing,
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        title={iconOnly ? triggerLabel : undefined}
        onClick={(event) => {
          if (open) return close(false);
          // Enter or Space (detail 0): move focus into the menu, as a keyboard user expects
          if (event.detail === 0) pendingFocus.current = "first";
          setOpen(true);
        }}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "inline-flex min-h-touch min-w-touch items-center justify-center gap-sp-2 rounded-md font-med text-body transition duration-press ease-out active:scale-press",
          iconOnly && "text-muted hover:text-text",
          compactTrigger &&
            "text-muted hover:text-text sm:border sm:border-input sm:bg-elev sm:px-sp-3 sm:text-text sm:hover:bg-sunken",
          open && "text-text",
          focusRing,
        )}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onMenuKeyDown}
          className="absolute end-0 top-full z-20 mt-sp-1 flex w-max min-w-full max-w-xs flex-col rounded-card border border-border-soft bg-popover p-sp-1 text-text shadow-pop"
        >
          {heading ? (
            <div role="presentation" className="border-b border-border-soft pb-sp-1 mb-sp-1">
              {heading}
            </div>
          ) : null}
          {items.map((item, i) => (
            <div key={item.label} role="none" className={cn(item.separated && "mt-sp-1 border-t border-border-soft pt-sp-1")}>
              {item.kind === "link" ? (
                <Link
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  href={item.href}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  className={itemClass}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                  className={itemClass}
                >
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
