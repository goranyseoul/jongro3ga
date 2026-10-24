import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { focusRing } from "@/lib/ui";
import { STANDARD_ORDER, STANDARD_TEXT, type DirectoryClinic } from "@/lib/ui-data/directory";
import { text, type DirectoryProfile } from "@/lib/ui-data/directory-profile";
import type { DetailCopy } from "./copy";
import { formatDate } from "./format";

export type StandardsListProps = {
  clinic: DirectoryClinic;
  profile: DirectoryProfile;
  locale: Locale;
  copy: DetailCopy["standards"];
};

// All eight standards. A passed one shows its check date and what was checked; the others say
// "not checked yet". Same vocabulary as TaskSteps (line check, empty square) without its one-line
// truncation, because the evidence sentence has to be readable in full.
export function StandardsList({ clinic, profile, locale, copy }: StandardsListProps) {
  const passed = STANDARD_ORDER.filter((key) => clinic.passes.includes(key)).length;
  return (
    <section aria-labelledby="cd-standards" className="flex flex-col gap-sp-3">
      <div className="flex flex-col gap-sp-1">
        <h2 id="cd-standards" className="text-title font-semi">
          {copy.title}
        </h2>
        <p className="text-label text-muted">{copy.lead(passed, STANDARD_ORDER.length)}</p>
      </div>
      <Card className="py-sp-1">
        <ol className="flex flex-col divide-y divide-border-soft">
          {STANDARD_ORDER.map((key) => {
            const verification = profile.verifications.find((v) => v.key === key);
            return (
              <li key={key} className="flex items-start gap-sp-3 py-sp-3">
                <span aria-hidden="true" className="flex size-sp-5 shrink-0 items-center justify-center">
                  {verification ? (
                    <svg viewBox="0 0 16 16" fill="none" className="size-sp-4 text-success">
                      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="size-sp-4 rounded-sm border border-input" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-sp-1">
                  <div className="flex flex-col gap-x-sp-3 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className={cn("text-body", verification ? "font-med" : "text-muted")}>{text(STANDARD_TEXT[key].label, locale)}</h3>
                    <p className={cn("text-label tabular-nums", verification ? "text-muted" : "text-subtle")}>
                      <span className="sr-only">{copy.statusLabel}: </span>
                      {verification ? copy.checked(formatDate(verification.checkedAt, locale)) : copy.notChecked}
                    </p>
                  </div>
                  {verification ? <p className="text-label text-muted">{text(verification.evidence, locale)}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
      <Link href="/standards" className={cn("inline-flex min-h-touch items-center self-start text-label text-text underline", focusRing)}>
        {copy.how}
      </Link>
    </section>
  );
}
