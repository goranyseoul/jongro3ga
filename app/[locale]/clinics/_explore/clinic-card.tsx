"use client";

import type { FocusEvent } from "react";
import { Button, Card, Money, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import {
  STANDARD_ORDER,
  directoryClinicName,
  procedureLabel,
  type DirectoryClinic,
  type DirectoryTopic,
} from "@/lib/ui-data/directory";
import type { DirectoryProfile } from "@/lib/ui-data/directory-profile";
import type { ExploreCopy } from "./copy";
import { MapGlyph } from "./glyphs";

export const cardDomId = (clinicId: string) => `explore-card-${clinicId}`;

type Props = {
  clinic: DirectoryClinic;
  profile: DirectoryProfile;
  locale: Locale;
  copy: ExploreCopy;
  areaLabel: string;
  /** The pointer (or focus) is on this card or on its pin. */
  hovered: boolean;
  /** Its pin was tapped. */
  selected: boolean;
  onHover: (clinicId: string | null) => void;
  onShowOnMap: (clinicId: string) => void;
  onAsk: (text: string, topic: DirectoryTopic) => void;
};

/** Eight flat segments, one per standard; the filled ones are the standards the clinic passes. */
export function StandardsMeter({ passed, label }: { passed: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center gap-sp-1">
      {STANDARD_ORDER.map((key, index) => (
        <span key={key} className={cn("h-sp-1 w-sp-3 rounded-pill", index < passed ? "bg-brand" : "bg-sunken")} />
      ))}
    </span>
  );
}

export function ClinicCard({ clinic, profile, locale, copy, areaLabel, hovered, selected, onHover, onShowOnMap, onAsk }: Props) {
  const c = copy.card;
  const name = directoryClinicName(clinic, locale);
  const total = STANDARD_ORDER.length;
  const passed = clinic.passes.length;
  const signature = procedureLabel(profile.signature, locale);
  const price = profile.priceFromKrw[profile.signature];
  const languages = clinic.languages.map((lang) => copy.languageNames[lang]).join(" · ");

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) onHover(null);
  };

  return (
    <li>
      <Card
        id={cardDomId(clinic.id)}
        data-clinic-card={clinic.id}
        data-state={selected ? "selected" : hovered ? "hover" : "idle"}
        aria-current={selected ? "true" : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") onHover(clinic.id);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") onHover(null);
        }}
        onFocus={() => onHover(clinic.id)}
        onBlur={onBlur}
        className="ex-card flex flex-col gap-sp-3"
      >
        <div className="flex flex-col gap-sp-1">
          <h2 className="text-title font-semi">{name}</h2>
          <p className="text-label text-muted">
            {areaLabel} · {languages}
            {profile.femaleDoctor ? ` · ${copy.filters.femaleDoctor}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-sp-3 gap-y-sp-1 text-label">
          <span className="text-muted">{c.standards}</span>
          <span className="font-semi tabular-nums">
            {passed}/{total}
          </span>
          <StandardsMeter passed={passed} label={c.standardsAria(passed, total)} />
        </div>

        <div className="flex flex-col gap-sp-1">
          <p className="text-caption text-muted">{c.signature}</p>
          <p className="flex flex-wrap items-baseline gap-x-sp-2 text-body">
            <span className="font-med">{signature}</span>
            {price !== undefined ? (
              <span>
                {c.pricePrefix}
                <Money krw={price} locale={locale} />
                {c.priceSuffix}
              </span>
            ) : null}
          </p>
          {price !== undefined ? <p className="text-caption text-subtle">{c.priceNote}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-sp-2">
          <Button
            aria-label={`${c.ask}: ${name}`}
            onClick={() => onAsk(copy.askSentence(name, signature), { kind: "procedure", id: profile.signature })}
          >
            {c.ask}
          </Button>
          <Link href={`/clinics/${profile.slug}`} aria-label={`${c.details}: ${name}`} className={buttonStyles({ variant: "secondary" })}>
            {c.details}
          </Link>
          <Button variant="ghost" aria-label={`${c.showOnMap}: ${name}`} onClick={() => onShowOnMap(clinic.id)}>
            <MapGlyph className="size-sp-4" />
            {c.showOnMap}
          </Button>
        </div>
      </Card>
    </li>
  );
}
