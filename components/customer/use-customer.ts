"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/domain/common";
import {
  clinicName,
  getCustomer,
  procedureName,
  recordsFor,
  type Amount,
  type Area,
  type CustomerProfile,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";
import { applyProfileEdits, useDemoState, type DemoState } from "./demo-state";

/** Seed records plus what this browser added, with the customer's continue / pause / stop choices applied. */
export function mergeRecords(customerId: string, demo: DemoState): TreatmentRecord[] {
  return [...recordsFor(customerId), ...demo.addedRecords.filter((r) => r.customerId === customerId)].map((r) => {
    const status = demo.recordStatus[r.id];
    return status ? { ...r, status } : r;
  });
}

/** The demo customer behind the current URL locale, plus the browser-side demo state. */
export function useCustomer(): { locale: Locale; profile: CustomerProfile; demo: DemoState; records: TreatmentRecord[]; name: string } {
  const locale = useLocale() as Locale;
  const demo = useDemoState();
  const seed = getCustomer(locale);
  const edits = demo.profileEdits?.[seed.id];
  const profile = applyProfileEdits(seed, edits);
  return {
    locale,
    profile,
    demo,
    records: mergeRecords(profile.id, demo),
    // a nickname saved on /me/profile wins over the one typed in onboarding
    name: edits?.nickname ?? demo.nickname ?? profile.nickname,
  };
}

/** Localized labels for amounts, areas, procedures and clinics. */
export function useLabels() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  return {
    amount: (amount: Amount) => t(`unit.${amount.unit}`, { value: amount.value }),
    area: (area: Area) => t(`area.${area}`),
    procedure: (id: string) => procedureName(id, locale),
    clinic: (id: string) => clinicName(id, locale),
  };
}
