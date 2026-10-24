"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import { SignedOutCard } from "@/components/ui/signed-out-card";
import { OPS_LOGIN_PATH, useOpsSession, type OpsSession } from "@/components/ops/ops-session";
import { cn } from "@/lib/cn";
import { useHydrated } from "@/lib/local-store";
import {
  OPERATOR_ROLE_LABEL,
  OPS_PERMISSION_LABEL,
  ROLE_PERMISSIONS,
  formatDate,
  formatMonthDayTime,
  type OperatorAccount,
  type OpsPermission,
} from "@/lib/ui-data/ops";

const ALL_PERMISSIONS = Object.keys(OPS_PERMISSION_LABEL) as OpsPermission[];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-1 border-b border-border-soft py-sp-2 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-sp-4">
      <dt className="text-label text-muted">{label}</dt>
      <dd className="break-all text-body font-med sm:text-end">{children}</dd>
    </div>
  );
}

export function OpsAccountView() {
  const hydrated = useHydrated();
  const { session, account } = useOpsSession();

  if (!hydrated) return null;
  if (!session) {
    return (
      <SignedOutCard
        description="내 계정은 운영자 계정으로 로그인해야 볼 수 있어요"
        loginHref={`${OPS_LOGIN_PATH}?next=${encodeURIComponent("/ops/account")}`}
      />
    );
  }
  return <AccountDetail session={session} account={account} />;
}

function AccountDetail({ session, account }: { session: OpsSession; account: OperatorAccount | undefined }) {
  const granted = new Set(ROLE_PERMISSIONS[session.role]);

  return (
    <div className="grid grid-cols-1 items-start gap-sp-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-sp-3">
        <CardHeader as="h2" title="프로필" description="운영자 정보는 관리자가 바꿔요" />
        <dl className="flex flex-col">
          <Row label="이름">{session.name}</Row>
          <Row label="이메일">{session.email}</Row>
          <Row label="역할">{OPERATOR_ROLE_LABEL[session.role]}</Row>
          <Row label="팀">{account?.team ?? "배정 전"}</Row>
        </dl>
      </Card>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader
          as="h2"
          title="권한 요약"
          description={`${OPERATOR_ROLE_LABEL[session.role]} 역할로 할 수 있는 일이에요. 읽기 전용`}
        />
        <ul className="flex flex-col">
          {ALL_PERMISSIONS.map((permission) => {
            const has = granted.has(permission);
            return (
              <li
                key={permission}
                className="flex items-start justify-between gap-sp-3 border-b border-border-soft py-sp-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <p className={cn("text-body font-med", !has && "text-muted")}>{OPS_PERMISSION_LABEL[permission].label}</p>
                  <p className="text-caption text-subtle">{OPS_PERMISSION_LABEL[permission].description}</p>
                </div>
                <p className={cn("shrink-0 text-label", has ? "text-text" : "text-subtle")}>{has ? "가능" : "불가"}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader as="h2" title="세션과 보안" />
        <dl className="flex flex-col">
          <Row label="이번 로그인">{formatMonthDayTime(session.signedInAt)}</Row>
          <Row label="지난 로그인">{account ? formatMonthDayTime(account.lastSignInAt) : "기록 없음"}</Row>
          <Row label="세션 저장 위치">이 브라우저 (데모)</Row>
        </dl>
        <PasswordForm />
      </Card>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader as="h2" title="감사 기록" />
        <p className="text-body text-muted">
          대행 예약 확정, 규칙 승인·반려·폐기, 병원 레지스트리 변경은 운영자 ID와 시각이 함께 감사 로그에 남아요. 로그는 지울 수 없고,
          A2A 로그의 요청·응답 원문은 개인정보를 가린 채로만 보여요.
        </p>
        <p className="text-caption text-subtle">
          운영자 ID {session.operatorId} · 기준일 {formatDate(session.signedInAt)}
        </p>
      </Card>
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [status, setStatus] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      current: current ? undefined : "지금 비밀번호를 입력해 주세요",
      next: next.length >= 12 ? (next === current ? "지금과 다른 비밀번호를 써 주세요" : undefined) : "운영자 비밀번호는 12자 이상이에요",
      confirm: confirm && confirm === next ? undefined : "새 비밀번호와 같게 입력해 주세요",
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
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-sp-3 border-t border-border-soft pt-sp-3">
      <p className="text-body font-semi">비밀번호 변경</p>
      <Input label="지금 비밀번호" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} />
      <Input label="새 비밀번호" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} hint="12자 이상" />
      <Input label="새 비밀번호 확인" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
      <div className="flex flex-wrap items-center gap-sp-3">
        <Button type="submit" variant="secondary">
          비밀번호 변경
        </Button>
        <p role="status" aria-live="polite" className="text-label text-muted">
          {status}
        </p>
      </div>
    </form>
  );
}
