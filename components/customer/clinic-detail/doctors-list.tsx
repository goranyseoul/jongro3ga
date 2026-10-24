import { Card } from "@/components/ui";
import type { Locale } from "@/lib/domain/common";
import { text, type DirectoryProfile } from "@/lib/ui-data/directory-profile";
import type { DetailCopy } from "./copy";

export type DoctorsListProps = {
  profile: DirectoryProfile;
  locale: Locale;
  copy: DetailCopy["doctors"];
};

export function DoctorsList({ profile, locale, copy }: DoctorsListProps) {
  return (
    <section aria-labelledby="cd-doctors" className="flex flex-col gap-sp-3">
      <h2 id="cd-doctors" className="text-title font-semi">
        {copy.title}
      </h2>
      <ul className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2">
        {profile.doctors.map((doctor, i) => (
          <li key={`${text(doctor.name, "en")}-${i}`}>
            <Card className="flex h-full flex-col gap-sp-1">
              <h3 className="text-body font-semi">{text(doctor.name, locale)}</h3>
              <p className="text-label text-muted">
                {text(doctor.title, locale)} · <span className="tabular-nums">{copy.years(doctor.years)}</span>
              </p>
              <p className="text-label text-muted">{doctor.boardCertifiedDermatology ? copy.boardYes : copy.boardNo}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
