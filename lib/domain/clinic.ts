import type { BookingRequestV1, BookingV1 } from "../a2a/schemas";
import type { Amount, Area, I18nText, IsoDate, IsoDateTime, Krw, Locale } from "./common";

// Entities of the `clinic` store namespace, docs/spec/06-data-model.md.

export interface LanguageSupport {
  locale: Locale;
  mode: "staff" | "interpreter" | "app_translation";
}

export interface ClinicProfile {
  id: string;
  slug: string;
  name: I18nText;
  address: string;
  area: Area;
  medicalInstitutionId: string;
  businessRegistrationNo: string;
  foreignPatientFacilityRegNo?: string;
  doctors: { name: string; boardCertifiedDermatology: boolean; yearsOfPractice?: number }[];
  languages: LanguageSupport[];
  operationMode: "proxy" | "clinic";
  contactPerson?: { name: string; role: string };
}

export interface MenuItem {
  id: string;
  clinicId: string;
  procedureId: string;
  product: string;
  amount: Amount;
  priceKrw: Krw;
  vatIncluded: boolean;
  includes: string[];
  foreignerSamePrice: boolean;
}

/** A monthly event. All five promotion fields are required (Medical Act enforcement decree art. 23). */
export interface Offer {
  id: string;
  clinicId: string;
  procedureId: string;
  title: string;
  amount: Amount;
  priceKrw: Krw;
  regularPriceKrw: Krw;
  validFrom: IsoDate;
  validUntil: IsoDate;
  conditions: string;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface SlotPolicy {
  clinicId: string;
  durationMinByProcedure: Record<string, number>;
  foreignSlotsPerDay: number;
  autoConfirm: boolean;
  /** null means closed that day. */
  hours: Record<Weekday, { open: string; close: string } | null>;
}

export interface Slot {
  id: string;
  clinicId: string;
  start: IsoDateTime;
  procedureIds: string[];
  held: boolean;
}

export interface ClinicBooking {
  id: string;
  clinicId: string;
  a2aTaskId: string;
  request: BookingRequestV1;
  status: BookingV1["status"];
  confirmedBy?: "clinic_staff" | "pibu_operator" | "auto";
  referralJti: string;
}

export interface ClinicTask {
  id: string;
  clinicId: string;
  a2aTaskId: string;
  skillId: string;
  state: string;
  summary: string;
  at: IsoDateTime;
}
