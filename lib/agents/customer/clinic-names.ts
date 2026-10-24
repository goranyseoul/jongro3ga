import clinicsJson from "../../../data/seed/clinics.json";
import type { Area, I18nText, Locale } from "../../domain";

// Clinic names and areas for the customer's screens and records (06 "예외": the customer module may read the
// public clinic list of data/seed/clinics.json directly, `id`, `name` and `area` only, never prices or menus).

export interface ClinicName {
  id: string;
  name: I18nText;
  area: Area;
}

const CLINICS: readonly ClinicName[] = (clinicsJson.registry as Array<{ id: string; name: I18nText; area: Area }>).map(
  ({ id, name, area }) => ({ id, name, area }),
);

export const clinicNames = (): readonly ClinicName[] => CLINICS;

/** The clinic's name in `locale`, falling back to English, Korean, then the id. */
export function clinicName(clinicId: string, locale: Locale): string {
  const clinic = CLINICS.find((c) => c.id === clinicId);
  return clinic?.name[locale] ?? clinic?.name.en ?? clinic?.name.ko ?? clinicId;
}

const squash = (text: string) => text.toLowerCase().replace(/[\s()·.]/g, "");

/** The registry clinic a free text name points at (3 second record autocomplete, memo import), or undefined. */
export function clinicIdByName(text: string): string | undefined {
  const wanted = squash(text);
  if (wanted === "") return undefined;
  return CLINICS.find((c) =>
    Object.values(c.name).some((name) => name !== undefined && (squash(name) === wanted || wanted.includes(squash(name)))),
  )?.id;
}
