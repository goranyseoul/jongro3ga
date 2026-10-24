"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonStyles, Card, CardHeader, Input } from "@/components/ui";
import { OPS_HOME_PATH, OPS_LOGIN_PATH, signInOps, signOutOps, useOpsSession } from "@/components/ops/ops-session";
import { cn } from "@/lib/cn";
import { safeNextPath } from "@/lib/safe-next";
import { focusRing } from "@/lib/ui";
import { OPERATOR_ACCOUNTS, OPERATOR_ROLE_LABEL } from "@/lib/ui-data/ops";

export function OpsLoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), OPS_HOME_PATH, OPS_LOGIN_PATH);
  const { session } = useOpsSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const go = () => router.replace(next);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? undefined : "이메일을 입력해 주세요",
      password: password ? undefined : "비밀번호를 입력해 주세요",
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    signInOps({ email });
    go();
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-sp-6">
      <header className="flex flex-col gap-sp-1">
        <p className="text-label text-muted">PibooK 운영 콘솔</p>
        <h1 className="text-h2 font-semi">운영자 로그인</h1>
        <p className="text-body text-muted">병원 레지스트리, 대행 응답, 연결 규칙은 PibooK 운영자만 다뤄요</p>
      </header>

      {session ? (
        <Card className="flex flex-col gap-sp-3 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="text-body">
            {session.name} 님({OPERATOR_ROLE_LABEL[session.role]})으로 로그인돼 있어요
          </p>
          <div className="flex flex-wrap gap-sp-2">
            <Link href={next} className={buttonStyles({ variant: "primary" })}>
              콘솔로 이동
            </Link>
            <Button variant="secondary" onClick={signOutOps}>
              로그아웃
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-sp-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-sp-4">
          <CardHeader
            as="h2"
            title="이메일로 로그인"
            description="데모에서는 아무 이메일과 비밀번호로 들어가요. 모르는 이메일은 조회 전용이에요"
          />
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-sp-4">
            <Input
              label="이메일"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              placeholder="name@pibook.example"
            />
            <Input
              label="비밀번호"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
            />
            <Button type="submit" fullWidth>
              로그인
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-sp-4">
          <CardHeader as="h2" title="데모 운영자" description="역할마다 권한 요약이 달라요" />
          <ul className="flex flex-col gap-sp-1">
            {OPERATOR_ACCOUNTS.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => {
                    signInOps({ operatorId: account.id });
                    go();
                  }}
                  className={cn(
                    "flex min-h-touch w-full flex-wrap items-center justify-between gap-x-sp-3 gap-y-sp-1 rounded-md border border-border-soft bg-bg px-sp-3 py-sp-2 text-start transition-colors duration-press ease-out hover:bg-sunken",
                    focusRing,
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body font-med">
                      {account.name} · {OPERATOR_ROLE_LABEL[account.role]}
                    </span>
                    <span className="break-all text-caption text-subtle">
                      {account.team} · {account.email}
                    </span>
                  </span>
                  <span className="text-label text-muted">이 계정으로 로그인</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
