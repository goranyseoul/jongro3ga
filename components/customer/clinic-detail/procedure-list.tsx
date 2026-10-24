import { Money } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { getProcedure } from "@/lib/domain/procedure-master";
import { referenceFor } from "@/lib/ui-data/customer";
import { CATEGORY_NAME, procedureLabel, type DirectoryClinic } from "@/lib/ui-data/directory";
import { text, type DirectoryProfile } from "@/lib/ui-data/directory-profile";
import { AskButton } from "./ask-button";
import type { DetailCopy } from "./copy";

export type ProcedureListProps = {
  clinic: DirectoryClinic;
  profile: DirectoryProfile;
  clinicName: string;
  locale: Locale;
  copy: DetailCopy;
};

// Every procedure the clinic offers with a reference starting price. The signature procedure comes
// first and is set apart by a stronger border and a sunken surface, not by color.
export function ProcedureList({ clinic, profile, clinicName, locale, copy }: ProcedureListProps) {
  const ids = [profile.signature, ...clinic.procedures.filter((id) => id !== profile.signature)];
  return (
    <section aria-labelledby="cd-procedures" className="flex flex-col gap-sp-3">
      <div className="flex flex-col gap-sp-1">
        <h2 id="cd-procedures" className="text-title font-semi">
          {copy.procedures.title}
        </h2>
        <p className="text-label text-muted">{copy.procedures.lead}</p>
      </div>
      <ul className="flex flex-col gap-sp-3">
        {ids.map((id) => {
          const isSignature = id === profile.signature;
          const name = procedureLabel(id, locale);
          const area = getProcedure(id)?.areas[0];
          const krw = profile.priceFromKrw[id];
          return (
            <li
              key={id}
              className={cn(
                "flex flex-col gap-sp-3 rounded-card border p-sp-4 md:flex-row md:items-center md:justify-between md:gap-sp-4",
                isSignature ? "border-input bg-sunken" : "border-border-soft bg-elev shadow-card",
              )}
            >
              <div className="flex min-w-0 flex-col gap-sp-3 md:flex-1 md:flex-row md:items-center md:justify-between md:gap-sp-4">
                <div className="flex min-w-0 flex-col gap-sp-1">
                  {isSignature ? <p className="text-caption font-med text-text">{copy.procedures.signature}</p> : null}
                  <h3 className="text-title font-semi">{name}</h3>
                  {area ? <p className="text-label text-muted">{text(CATEGORY_NAME[area], locale)}</p> : null}
                </div>
                {krw ? (
                  <div className="flex shrink-0 flex-col gap-sp-1 md:items-end md:text-end">
                    <p className="text-body">
                      <span className="text-muted">{copy.procedures.from}</span>{" "}
                      <Money krw={krw} reference={referenceFor(krw, locale)} locale={locale} />
                    </p>
                    <p className="text-caption text-subtle">{copy.procedures.priceNote}</p>
                  </div>
                ) : null}
              </div>
              <AskButton
                variant="secondary"
                text={copy.askSentence(clinicName, name)}
                topic={{ kind: "procedure", id }}
                accessibleName={copy.cta.rowFor(name)}
                className="w-full md:w-auto md:shrink-0"
              >
                {copy.cta.row}
              </AskButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
