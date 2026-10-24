// The demo personas of 05-screens.md ("Yuki, Lin, Emily, 지수 / 병원 계정 / 운영자") and where each starts.
export interface DemoPersonaInfo {
  id: string;
  label: string;
  kind: "customer" | "clinic" | "operator";
  /** Seed customer id (customers.json) for customer personas. */
  customerId?: string;
  locale?: "ja" | "zh-CN" | "en" | "ko";
  /** Screen the persona starts on. */
  path: string;
  hint: string;
}

export const DEMO_PERSONA_LIST: DemoPersonaInfo[] = [
  { id: "yuki", label: "Yuki", kind: "customer", customerId: "cus_yuki", locale: "ja", path: "/ja/onboarding", hint: "일본 · 온보딩부터 시작" },
  { id: "lin", label: "Lin", kind: "customer", customerId: "cus_lin", locale: "zh-CN", path: "/zh-CN/home", hint: "중국 · 방한 리듬에 맞춘 시술" },
  { id: "emily", label: "Emily", kind: "customer", customerId: "cus_emily", locale: "en", path: "/en/home", hint: "미국 · 처음 받는 K시술" },
  { id: "jisoo", label: "지수", kind: "customer", customerId: "cus_jisoo", locale: "ko", path: "/ko/home", hint: "한국 거주 · 기록 중심 홈, 매칭 없음" },
  { id: "clinic", label: "병원 계정", kind: "clinic", path: "/clinic/inbox", hint: "직접 운영 병원 요청함" },
  { id: "operator", label: "운영자", kind: "operator", path: "/ops/proxy-queue", hint: "대행 응답 큐" },
];
