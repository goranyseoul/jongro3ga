import type { Locale } from "../domain/common";
import type { SessionUser } from "./session";

// Demo accounts seeded when DEMO_MODE=true (05-screens.md /[locale]/signup, DEMO.md personas).
// Ids and agent ids match the UI mock (lib/ui-data/customer.ts) and A2A fixtures so seeded customer
// data lines up. Emails use the reserved example.com domain (08-compliance.md 5: no real contacts).

export interface DemoAccount {
  /** Stable key used by the demo sign-in endpoint and the persona buttons. */
  key: string;
  id: string;
  email: string;
  name: string;
  role: SessionUser["role"];
  customerAgentId: string;
  clinicId?: string;
  /** Customers: the locale their app opens in, and where the demo button sends them. */
  locale?: Locale;
  start?: "onboarding" | "home";
  /** Other labels the persona buttons may send (display names). */
  aliases: string[];
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { key: "yuki", id: "cus_yuki", email: "yuki.demo@example.com", name: "Yuki", role: "customer", customerAgentId: "cag_7f3k2", locale: "ja", start: "onboarding", aliases: ["Yuki", "ゆき"] },
  { key: "lin", id: "cus_lin", email: "lin.demo@example.com", name: "Lin", role: "customer", customerAgentId: "cag_4n8vd", locale: "zh-CN", start: "home", aliases: ["Lin"] },
  { key: "emily", id: "cus_emily", email: "emily.demo@example.com", name: "Emily", role: "customer", customerAgentId: "cag_2q9wk", locale: "en", start: "home", aliases: ["Emily"] },
  { key: "jisoo", id: "cus_jisoo", email: "jisoo.demo@example.com", name: "지수", role: "customer", customerAgentId: "cag_8h3tb", locale: "ko", start: "home", aliases: ["지수", "Jisoo"] },
  { key: "seoul_glow_staff", id: "stf_seoul_glow", email: "staff.seoulglow.demo@example.com", name: "서울글로우 실장", role: "clinic_staff", customerAgentId: "cag_stfseoulglow", clinicId: "cln_seoul_glow", aliases: ["clinic_staff"] },
  { key: "operator", id: "opr_demo", email: "operator.demo@example.com", name: "PibooK 운영자", role: "operator", customerAgentId: "cag_oprdemo", aliases: ["operator"] },
];

export function findDemoAccount(label: string): DemoAccount | undefined {
  const wanted = label.trim();
  const lower = wanted.toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.key === lower || a.id === wanted || a.aliases.some((alias) => alias.toLowerCase() === lower));
}

/** The demo account DEMO_MODE falls back to on the clinic console (clinic_staff) and ops/demo (operator). */
export function demoAccountForRole(role: "clinic_staff" | "operator"): DemoAccount {
  return DEMO_ACCOUNTS.find((a) => a.role === role)!;
}

export function demoSessionUser(account: DemoAccount): SessionUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    customerAgentId: account.customerAgentId,
    role: account.role,
    ...(account.clinicId ? { clinicId: account.clinicId } : {}),
  };
}
