"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, buttonStyles, Card, CardHeader, Input } from "@/components/ui";
import {
  CLINIC_HOME_PATH,
  CLINIC_LOGIN_PATH,
  signInClinic,
  signOutClinic,
  useClinicSession,
} from "@/components/clinic/clinic-session";
import { cn } from "@/lib/cn";
import { safeNextPath } from "@/lib/safe-next";
import { focusRing } from "@/lib/ui";
import { CLINIC_ACCOUNTS, OPERATION_MODE_TEXT, STAFF_ROLE_TEXT } from "@/lib/ui-data/clinic";

export function ClinicLoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), CLINIC_HOME_PATH, CLINIC_LOGIN_PATH);
  const { session, clinic } = useClinicSession();

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
    signInClinic({ email });
    go();
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-sp-6">
      <header className="flex flex-col gap-sp-1">
        <p className="text-label text-muted">PibooK 병원 콘솔</p>
        <h1 className="text-h2 font-semi">로그인</h1>
        <p className="text-body text-muted">예약 확정과 메뉴·가격 편집은 병원 직원 계정으로 해요</p>
      </header>

      {session ? (
        <Card className="flex flex-col gap-sp-3 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="text-body">
            {session.staffName} 님({clinic?.name ?? "병원"})으로 로그인돼 있어요
          </p>
          <div className="flex flex-wrap gap-sp-2">
            <Link href={next} className={buttonStyles({ variant: "primary" })}>
              콘솔로 이동
            </Link>
            <Button variant="secondary" onClick={signOutClinic}>
              로그아웃
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-sp-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-sp-4">
          <CardHeader as="h2" title="이메일로 로그인" description="데모에서는 아무 이메일과 비밀번호로 들어갈 수 있어요" />
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
              placeholder="name@clinic.example"
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
          <CardHeader as="h2" title="데모 계정" description="병원과 직원을 고르면 바로 들어가요" />
          <div className="flex flex-col gap-sp-4">
            {CLINIC_ACCOUNTS.map((account) => (
              <section key={account.id} aria-labelledby={`demo-${account.id}`} className="flex flex-col gap-sp-2">
                <div className="flex flex-wrap items-baseline justify-between gap-sp-2">
                  <h3 id={`demo-${account.id}`} className="text-body font-semi">
                    {account.name}
                  </h3>
                  <p className="text-caption text-subtle">
                    {account.area} · {OPERATION_MODE_TEXT[account.operationMode]}
                  </p>
                </div>
                <ul className="flex flex-col gap-sp-1">
                  {account.staff.map((staff) => (
                    <li key={staff.id}>
                      <button
                        type="button"
                        onClick={() => {
                          signInClinic({ clinicId: account.id, staffId: staff.id });
                          go();
                        }}
                        className={cn(
                          "flex min-h-touch w-full flex-wrap items-center justify-between gap-x-sp-3 gap-y-sp-1 rounded-md border border-border-soft bg-bg px-sp-3 py-sp-2 text-start transition-colors duration-press ease-out hover:bg-sunken",
                          focusRing,
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="text-body font-med">
                            {staff.name} · {STAFF_ROLE_TEXT[staff.role]}
                          </span>
                          <span className="break-all text-caption text-subtle">{staff.email}</span>
                        </span>
                        <span className="text-label text-muted">이 계정으로 로그인</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
