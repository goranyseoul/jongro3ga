import type { ReactNode } from "react";
import { LOCALE_NAME } from "@/app/[locale]/locales";
import { Card } from "@/components/ui";
import type { Locale } from "@/lib/domain/common";
import type { DirectoryClinic } from "@/lib/ui-data/directory";
import type { DirectoryProfile } from "@/lib/ui-data/directory-profile";
import type { DetailCopy } from "./copy";

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-1 py-sp-3 first:pt-0 last:pb-0">
      <dt className="text-label text-muted">{term}</dt>
      <dd className="flex flex-col gap-sp-1 text-body">{children}</dd>
    </div>
  );
}

export type ClinicFactsProps = {
  clinic: DirectoryClinic;
  profile: DirectoryProfile;
  copy: DetailCopy["facts"];
  total: number;
};

// Languages, female doctor, listing year and who answers quote requests, as a definition list.
export function ClinicFacts({ clinic, profile, copy, total }: ClinicFactsProps) {
  const isProxy = clinic.operationMode === "proxy";
  const languages: Locale[] = clinic.languages;
  return (
    <section aria-labelledby="cd-facts" className="flex flex-col gap-sp-3">
      <h2 id="cd-facts" className="text-title font-semi">
        {copy.title}
      </h2>
      <Card>
        <dl className="flex flex-col divide-y divide-border-soft">
          <Fact term={copy.languages}>
            <span>
              {languages.map((l, i) => (
                <span key={l}>
                  {i > 0 ? " · " : null}
                  <span lang={l}>{LOCALE_NAME[l]}</span>
                </span>
              ))}
            </span>
          </Fact>
          <Fact term={copy.femaleDoctor}>{profile.femaleDoctor ? copy.femaleYes : copy.femaleNo}</Fact>
          <Fact term={copy.listedSince}>
            <span className="tabular-nums">{copy.year(profile.listedSince)}</span>
          </Fact>
          <Fact term={copy.operation}>
            <span className="font-med">{isProxy ? copy.proxyTitle : copy.clinicTitle}</span>
            <span className="text-label text-muted">{isProxy ? copy.proxyNote : copy.clinicNote}</span>
          </Fact>
          <Fact term={copy.standards}>
            <span className="tabular-nums">{copy.standardsCount(clinic.passes.length, total)}</span>
          </Fact>
        </dl>
      </Card>
    </section>
  );
}
