"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import { SignedOutCard } from "@/components/ui/signed-out-card";
import { CopyButton } from "@/components/clinic/copy-button";
import { CLINIC_LOGIN_PATH, updateClinicSession, useClinicSession, type ClinicSession } from "@/components/clinic/clinic-session";
import { Switch } from "@/components/clinic/switch";
import { cn } from "@/lib/cn";
import { createLocalStore, useHydrated } from "@/lib/local-store";
import { fieldBase, focusRing } from "@/lib/ui";
import {
  CLINIC_ACCOUNTS,
  DEMO_AGENT_TOKEN,
  LANGUAGE_COVERAGE_TEXT,
  LANGUAGE_TEXT,
  NOTIFY_CHANNELS,
  OPERATION_MODE_TEXT,
  STAFF_ROLE_TEXT,
  type ClinicAccount,
  type LanguageCoverage,
  type NotifyChannel,
} from "@/lib/ui-data/clinic";
import type { Locale } from "@/lib/domain/common";

type Draft = {
  name: string;
  area: string;
  address: string;
  languages: { locale: Locale; coverage: LanguageCoverage }[];
  notify: Record<NotifyChannel, boolean>;
  staffName: string;
  staffEmail: string;
};

type Saved = { draft: Draft; savedAt: string };

// Browser-only overrides per clinic and staff member until the backend stores settings.
const settingsStore = createLocalStore<Record<string, Saved>>("pibu.clinic.settings.v1");

const COVERAGE_ORDER: LanguageCoverage[] = ["staff", "interpreter", "app_translation", "none"];

const MODE_NOTE = {
  clinic: "병원이 직접 운영해요. 견적은 메뉴·가격으로 자동 응답하고 예약은 요청함에서 확정해요",
  proxy: "PibooK이 대신 응답해요. 예약은 병원 확인 뒤 운영팀이 확정해요",
} as const;

function defaults(clinic: ClinicAccount, session: ClinicSession): Draft {
  return {
    name: clinic.name,
    area: clinic.area,
    address: clinic.address,
    languages: clinic.languages.map((l) => ({ ...l })),
    notify: { console: true, kakao: false, phone: false },
    staffName: session.staffName,
    staffEmail: session.email,
  };
}

function storageKey(session: ClinicSession): string {
  return `${session.clinicId}:${session.staffId}`;
}

/** "2025년 3월 14일" from YYYY-MM-DD. */
function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function nowLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

export function ClinicSettingsView() {
  const hydrated = useHydrated();
  const { session, clinic } = useClinicSession();

  if (!hydrated) return null;
  if (!session) {
    return (
      <SignedOutCard
        description="병원 설정은 병원 직원 계정으로 로그인해야 볼 수 있어요"
        loginHref={`${CLINIC_LOGIN_PATH}?next=${encodeURIComponent("/clinic/settings")}`}
      />
    );
  }
  return <SettingsForm key={storageKey(session)} session={session} clinic={clinic ?? CLINIC_ACCOUNTS[0]} />;
}

function SettingsForm({ session, clinic }: { session: ClinicSession; clinic: ClinicAccount }) {
  const key = storageKey(session);
  // Read once on mount (the parent keys this form by clinic and staff); later edits come from here.
  const [initial] = useState<Saved>(() => settingsStore.read()?.[key] ?? { draft: defaults(clinic, session), savedAt: "" });
  const [saved, setSaved] = useState<Saved>(initial);
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<{ name?: string; staffName?: string; staffEmail?: string }>({});

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.draft);

  // "내 계정" in the account menu links to #account; the form mounts after hydration, so scroll here.
  useEffect(() => {
    if (window.location.hash === "#account") document.getElementById("account")?.scrollIntoView();
  }, []);

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus("");
  };

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      name: draft.name.trim() ? undefined : "병원 이름을 입력해 주세요",
      staffName: draft.staffName.trim() ? undefined : "이름을 입력해 주세요",
      staffEmail: draft.staffEmail.includes("@") ? undefined : "이메일 형식을 확인해 주세요",
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.staffName || nextErrors.staffEmail) {
      setStatus("저장하지 못했어요. 표시된 칸을 확인해 주세요");
      return;
    }
    const next: Saved = { draft, savedAt: nowLabel() };
    settingsStore.write({ ...(settingsStore.read() ?? {}), [key]: next });
    updateClinicSession({ staffName: draft.staffName.trim(), email: draft.staffEmail.trim() });
    setSaved(next);
    setStatus(`저장했어요 · ${next.savedAt} · 이 브라우저에만 저장돼요`);
  };

  const fac = clinic.foreignPatientFacility;

  return (
    <div className="flex flex-col gap-sp-4">
      <form id="clinic-settings" noValidate onSubmit={onSave} className="flex flex-col gap-sp-4">
        <Card className="flex flex-col gap-sp-4">
          <CardHeader as="h2" title="병원 프로필" description="고객 에이전트에 보이는 병원 정보예요" />
          <div className="grid grid-cols-1 gap-sp-4 md:grid-cols-2">
            <Input label="병원 이름" value={draft.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
            <Input label="지역" value={draft.area} onChange={(e) => set("area", e.target.value)} hint="예: 강남, 신사, 홍대" />
            <div className="md:col-span-2">
              <Input label="주소" value={draft.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
            </div>
          </div>

          <fieldset className="flex flex-col gap-sp-2">
            <legend className="text-label font-med text-muted">언어와 응대 방식</legend>
            <ul className="flex flex-col">
              {draft.languages.map((language, index) => {
                const id = `coverage-${language.locale}`;
                return (
                  <li
                    key={language.locale}
                    className="flex flex-col gap-sp-2 border-b border-border-soft py-sp-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <label htmlFor={id} className="text-body">
                      {LANGUAGE_TEXT[language.locale]}
                    </label>
                    <select
                      id={id}
                      value={language.coverage}
                      onChange={(e) =>
                        set(
                          "languages",
                          draft.languages.map((l, i) => (i === index ? { ...l, coverage: e.target.value as LanguageCoverage } : l)),
                        )
                      }
                      className={cn(fieldBase, "border-input sm:w-auto", focusRing)}
                    >
                      {COVERAGE_ORDER.map((coverage) => (
                        <option key={coverage} value={coverage}>
                          {LANGUAGE_COVERAGE_TEXT[coverage]}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="flex flex-col gap-sp-2 rounded-md border border-border-soft p-sp-3">
            <p className="text-label font-med text-muted">외국인환자 유치기관 등록</p>
            <p className={cn("text-body font-med", fac.registered ? "text-text" : "text-warning")}>
              {fac.registered ? "등록됨" : "미등록"}
              {fac.registered && fac.registeredOn ? (
                <span className="font-reg text-muted">
                  {" "}
                  · {formatDate(fac.registeredOn)} 등록{fac.renewBy ? ` · ${formatDate(fac.renewBy)}까지 갱신` : ""}
                </span>
              ) : null}
            </p>
            <p className="text-caption text-subtle">
              {fac.registered
                ? "등록 정보는 등록증 기준이라 여기서 바꿀 수 없어요. 바뀌면 PibooK 운영팀에 알려 주세요"
                : "등록 전에는 외국인 고객의 예약 요청을 받을 수 없어요. 등록증을 받으면 PibooK 운영팀에 보내 주세요"}
            </p>
          </div>
        </Card>

        <Card id="account" className="flex scroll-mt-sp-6 flex-col gap-sp-4">
          <CardHeader as="h2" title="내 계정" description="콘솔에 로그인한 직원 정보예요" />
          <div className="grid grid-cols-1 gap-sp-4 md:grid-cols-2">
            <Input label="이름" value={draft.staffName} onChange={(e) => set("staffName", e.target.value)} error={errors.staffName} autoComplete="name" />
            <div className="flex flex-col gap-sp-1">
              <p className="text-label font-med text-muted">역할</p>
              <p className="flex min-h-touch items-center text-body">{STAFF_ROLE_TEXT[session.role]}</p>
            </div>
            <div className="md:col-span-2">
              <Input
                label="이메일"
                type="email"
                value={draft.staffEmail}
                onChange={(e) => set("staffEmail", e.target.value)}
                error={errors.staffEmail}
                autoComplete="email"
                hint="예약 요청 알림과 로그인에 써요"
              />
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-sp-4">
          <CardHeader as="h2" title="알림 채널" description="새 예약 요청을 어디로 알릴지 골라요" />
          <ul className="flex flex-col">
            {NOTIFY_CHANNELS.map((channel) => (
              <li
                key={channel.id}
                className="flex items-center justify-between gap-sp-3 border-b border-border-soft py-sp-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <p className={cn("text-body font-med", !channel.available && "text-muted")}>{channel.label}</p>
                  <p className="text-caption text-subtle">
                    {channel.available ? channel.description : `준비 중이에요 · ${channel.description}`}
                  </p>
                </div>
                <Switch
                  label={`${channel.label} 알림`}
                  checked={channel.available && draft.notify[channel.id]}
                  disabled={!channel.available}
                  onChange={(checked) => set("notify", { ...draft.notify, [channel.id]: checked })}
                />
              </li>
            ))}
          </ul>
        </Card>
      </form>

      <PasswordCard />

      <AgentConnectionCard clinic={clinic} />

      <div className="sticky bottom-sp-4 z-10 flex flex-wrap items-center justify-between gap-sp-3 rounded-card border border-border bg-popover px-sp-4 py-sp-2 shadow-pop">
        <p role="status" aria-live="polite" className="min-w-0 text-label text-muted">
          {status || (dirty ? "저장하지 않은 변경이 있어요" : saved.savedAt ? `마지막 저장 ${saved.savedAt}` : "변경 사항이 없어요")}
        </p>
        <Button type="submit" form="clinic-settings" disabled={!dirty}>
          변경 사항 저장
        </Button>
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [status, setStatus] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      current: current ? undefined : "지금 비밀번호를 입력해 주세요",
      next: next.length >= 8 ? (next === current ? "지금과 다른 비밀번호를 써 주세요" : undefined) : "8자 이상으로 정해 주세요",
      confirm: confirm === next && confirm ? undefined : "새 비밀번호와 같게 입력해 주세요",
    };
    setErrors(nextErrors);
    if (nextErrors.current || nextErrors.next || nextErrors.confirm) {
      setStatus("");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setStatus("비밀번호를 바꿨어요. 데모라 실제로 저장되지는 않아요");
  };

  return (
    <Card className="flex flex-col gap-sp-4">
      <CardHeader as="h2" title="비밀번호 변경" description="8자 이상, 지금 비밀번호와 다르게 정해요" />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-sp-4">
        <div className="grid grid-cols-1 gap-sp-4 md:grid-cols-3">
          <Input label="지금 비밀번호" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} />
          <Input label="새 비밀번호" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} />
          <Input label="새 비밀번호 확인" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        </div>
        <div className="flex flex-wrap items-center gap-sp-3">
          <Button type="submit" variant="secondary">
            비밀번호 변경
          </Button>
          <p role="status" aria-live="polite" className="text-label text-muted">
            {status}
          </p>
        </div>
      </form>
    </Card>
  );
}

function AgentConnectionCard({ clinic }: { clinic: ClinicAccount }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="flex flex-col gap-sp-4">
      <CardHeader
        as="h2"
        title="에이전트 연결"
        description={MODE_NOTE[clinic.operationMode]}
        action={
          <Link href="/clinic/agent" className={cn("flex min-h-touch items-center text-label text-muted hover:text-text", focusRing)}>
            내 에이전트 보기
          </Link>
        }
      />
      <dl className="flex flex-col">
        <div className="flex flex-col gap-sp-1 border-b border-border-soft py-sp-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-sp-4">
          <dt className="text-label text-muted">운영 모드</dt>
          <dd className="text-body font-med">{OPERATION_MODE_TEXT[clinic.operationMode]}</dd>
        </div>
        <div className="flex flex-col gap-sp-2 border-b border-border-soft py-sp-3">
          <dt className="text-label text-muted">Agent Card URL</dt>
          <dd className="flex flex-col gap-sp-2">
            <span className="break-all text-body">{clinic.agentCardUrl}</span>
            <CopyButton text={clinic.agentCardUrl} label="URL 복사" />
          </dd>
        </div>
        <div className="flex flex-col gap-sp-2 py-sp-3">
          <dt className="text-label text-muted">플랫폼 연결 토큰</dt>
          <dd className="flex flex-col gap-sp-2">
            <div className="flex flex-wrap items-center gap-sp-3">
              <span id="agent-token" className="break-all text-body tabular-nums">
                {revealed ? DEMO_AGENT_TOKEN.revealed : DEMO_AGENT_TOKEN.masked}
              </span>
              <Button variant="secondary" aria-pressed={revealed} aria-controls="agent-token" onClick={() => setRevealed((v) => !v)}>
                {revealed ? "숨기기" : "보기"}
              </Button>
            </div>
            <p className="text-caption text-subtle">
              {formatDate(DEMO_AGENT_TOKEN.issuedOn)} 발급 · 데모용 가짜 값이에요. 실제 토큰은 서버에만 있고 화면에 나오지 않아요
            </p>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
