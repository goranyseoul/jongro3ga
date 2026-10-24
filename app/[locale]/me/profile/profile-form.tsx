"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonStyles, Card, CardHeader, ChipGroup, Input, WidgetDateRange, type DateRange } from "@/components/ui";
import { updateDemoState } from "@/components/customer/demo-state";
import { useSession } from "@/components/customer/session";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { focusRing } from "@/lib/ui";
import { DEMO_NOW, canMatch, type Area, type CustomerProfile } from "@/lib/ui-data/customer";
import { LOCALES, LOCALE_NAME, wordBreak } from "../../locales";
import { SignedOutCard } from "../signed-out-card";

const AREAS: Area[] = ["gangnam", "sinsa", "apgujeong", "myeongdong", "hongdae", "other"];
const CHANNELS: CustomerProfile["contact"]["channel"][] = ["email", "line", "wechat", "whatsapp"];
const KNOWN_NATIONALITIES = ["JP", "CN", "US", "KR"];

export function ProfileForm() {
  const { session } = useSession();
  const { profile } = useCustomer();
  if (!session) return <SignedOutCard next="/me/profile" />;
  // Mounted only once the browser state is readable, so the fields start from the saved profile.
  return <ProfileFields key={profile.id} />;
}

type Errors = Partial<Record<"nickname" | "languages" | "handle" | "trip", string>>;

function ProfileFields() {
  const t = useTranslations("me.profile");
  const me = useTranslations("me");
  const label = useLabels();
  const { locale, profile, name } = useCustomer();
  const matchable = canMatch(profile);

  const [nickname, setNickname] = useState(name);
  const [trip, setTrip] = useState<DateRange>({ start: profile.trip?.arrival ?? "", end: profile.trip?.departure ?? "" });
  const [stayArea, setStayArea] = useState<Area | null>(profile.trip?.stayArea ?? null);
  const [languages, setLanguages] = useState<Locale[]>(profile.prefs.languagesNeeded);
  const [channel, setChannel] = useState(profile.contact.channel);
  const [handle, setHandle] = useState(profile.contact.handle);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);

  // Any change after a save hides the confirmation until the next save.
  const edit =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setSaved(false);
    };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!nickname.trim()) next.nickname = t("errors.nickname");
    if (languages.length === 0) next.languages = t("errors.languages");
    if (!handle.trim()) next.handle = t("errors.handle");
    if (matchable && (!trip.start || !trip.end)) next.trip = t("errors.trip");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSaved(false);
      return;
    }
    updateDemoState((state) => ({
      ...state,
      profileEdits: {
        ...state.profileEdits,
        [profile.id]: {
          nickname: nickname.trim(),
          trip: matchable ? { arrival: trip.start, departure: trip.end, stayArea: stayArea ?? undefined } : undefined,
          languagesNeeded: languages,
          contact: { channel, handle: handle.trim() },
          savedAt: DEMO_NOW,
        },
      },
    }));
    setSaved(true);
  };

  const nationality = KNOWN_NATIONALITIES.includes(profile.nationality)
    ? t(`nationalityValue.${profile.nationality}`)
    : profile.nationality;
  const residency = profile.residency ? t(`residencyValue.${profile.residency}`) : "·";

  return (
    <div className={cn("flex flex-col gap-sp-6", wordBreak(locale))}>
      <header className="flex flex-col gap-sp-2">
        <Link
          href="/me"
          className={cn("inline-flex min-h-touch items-center self-start text-label text-muted hover:text-text", focusRing)}
        >
          {t("back")}
        </Link>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <p className="text-body text-muted">{t("description")}</p>
      </header>

      <form onSubmit={submit} noValidate className="flex flex-col gap-sp-4">
        <Card className="flex flex-col gap-sp-4">
          <CardHeader title={t("basics")} as="h2" />
          <Input
            label={t("nickname")}
            value={nickname}
            maxLength={20}
            autoComplete="nickname"
            hint={t("nicknameHint")}
            error={errors.nickname}
            onChange={(event) => edit(setNickname)(event.target.value)}
          />
          <Field label={t("languages")} error={errors.languages} hint={t("languagesHint")}>
            <ChipGroup
              multiple
              label={t("languages")}
              value={languages}
              onChange={edit(setLanguages)}
              options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAME[l] }))}
            />
          </Field>
        </Card>

        {matchable ? (
          <Card className="flex flex-col gap-sp-4">
            <CardHeader title={t("trip")} description={t("tripHint")} as="h2" />
            <WidgetDateRange
              value={trip}
              onChange={edit(setTrip)}
              startLabel={t("arrival")}
              endLabel={t("departure")}
            />
            {errors.trip ? <p className="text-caption text-danger">{errors.trip}</p> : null}
            <Field label={t("stayArea")}>
              <ChipGroup
                label={t("stayArea")}
                value={stayArea}
                onChange={edit(setStayArea)}
                options={AREAS.map((a) => ({ value: a, label: label.area(a) }))}
              />
            </Field>
          </Card>
        ) : null}

        <Card className="flex flex-col gap-sp-4">
          <CardHeader title={t("contact")} description={t("contactHint")} as="h2" />
          <Field label={t("channel")}>
            <ChipGroup
              label={t("channel")}
              value={channel}
              onChange={edit(setChannel)}
              options={CHANNELS.map((c) => ({ value: c, label: me(`channel.${c}`) }))}
            />
          </Field>
          <Input
            label={t("handle")}
            value={handle}
            autoComplete={channel === "email" ? "email" : "off"}
            inputMode={channel === "email" ? "email" : "text"}
            error={errors.handle}
            onChange={(event) => edit(setHandle)(event.target.value)}
          />
        </Card>

        <Card className="flex flex-col gap-sp-4">
          <CardHeader title={t("identity")} description={t("identityNote")} as="h2" />
          <dl className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2">
            <div className="flex flex-col gap-sp-1">
              <dt className="text-label text-muted">{t("nationality")}</dt>
              <dd className="text-body">{nationality}</dd>
            </div>
            <div className="flex flex-col gap-sp-1">
              <dt className="text-label text-muted">{t("residency")}</dt>
              <dd className="text-body">{residency}</dd>
            </div>
          </dl>
        </Card>

        <div className="flex flex-col gap-sp-3 sm:flex-row sm:items-center">
          <Button type="submit" className="sm:self-start">
            {t("save")}
          </Button>
          <p role="status" aria-live="polite" className={cn("text-label", saved ? "font-med text-success" : "sr-only")}>
            {saved ? t("saved") : ""}
          </p>
          {saved ? (
            <Link href="/me" className={cn(buttonStyles({ variant: "ghost" }), "self-start sm:self-auto")}>
              {t("backToMe")}
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-2">
      <p className="text-label font-med text-muted">{label}</p>
      {children}
      {error ? <p className="text-caption text-danger">{error}</p> : hint ? <p className="text-caption text-subtle">{hint}</p> : null}
    </div>
  );
}
