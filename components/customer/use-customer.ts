"use client";

import { useLocale, useTranslations } from "next-intl";
import type { HomeView, MeView } from "@/lib/agents/customer/bff";
import type { Amount, Area, I18nText, Locale } from "@/lib/domain/common";
import { clinicName, procedureName } from "@/lib/ui-data/customer";
import { useApi, type ApiState } from "./api";
import { useDemoState } from "./demo-state";

/** The signed-in customer (or the demo customer) as the customer agent knows it, from GET /api/customer/home. */
export function useHome(options: { pollMs?: number } = {}): ApiState<HomeView> & { locale: Locale; name: string } {
  const locale = useLocale() as Locale;
  const demo = useDemoState();
  const state = useApi<HomeView>("/api/customer/home", options);
  return { ...state, locale, name: state.data?.me.profile.nickname ?? demo.nickname ?? "" };
}

/** Profile, eligibility, Agent Card and consents, from GET /api/customer/me. */
export function useMe(): ApiState<MeView> & { locale: Locale } {
  const locale = useLocale() as Locale;
  return { ...useApi<MeView>("/api/customer/me"), locale };
}

/** Localized labels for amounts, areas, procedures and clinics. */
export function useLabels() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  return {
    amount: (amount: Amount) => t(`unit.${amount.unit}`, { value: amount.value }),
    area: (area: Area | string) => t(`area.${area as Area}`),
    procedure: (id: string) => procedureName(id, locale),
    /** Clinic name from a server view when given, else the public directory. */
    clinic: (id: string, name?: I18nText) => name?.[locale] ?? name?.en ?? clinicName(id, locale),
  };
}
