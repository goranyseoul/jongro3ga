"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui";
import { StaffMenu } from "@/components/ui/staff-menu";
import { OPERATOR_ROLE_LABEL } from "@/lib/ui-data/ops";
import { OPS_LOGIN_PATH, signOutOps, useOpsSession } from "./ops-session";

// Shell account menu. Signed out (and on the server render) it is a 로그인 link with ?next=.
export function OpsAccountMenu() {
  const { session } = useOpsSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!session) {
    return (
      <Link href={`${OPS_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`} className={buttonStyles({ variant: "secondary", fullWidth: true })}>
        로그인
      </Link>
    );
  }

  const role = OPERATOR_ROLE_LABEL[session.role];

  return (
    <StaffMenu
      label={`계정 메뉴: ${session.name}, ${role}`}
      trigger={
        <>
          <span className="truncate text-body font-med">{session.name}</span>
          <span className="truncate text-caption text-subtle">{role}</span>
        </>
      }
      header={
        <>
          <p className="text-body font-semi">{session.name}</p>
          <p className="text-label text-muted">PibooK 운영 · {role}</p>
          <p className="break-all text-caption text-subtle">{session.email}</p>
        </>
      }
      items={[
        { id: "account", label: "내 계정", href: "/ops/account" },
        {
          id: "logout",
          label: "로그아웃",
          onSelect: () => {
            signOutOps();
            router.push(OPS_LOGIN_PATH);
          },
        },
      ]}
      popoverClassName="end-0 top-full mt-sp-2 lg:bottom-full lg:end-auto lg:start-0 lg:top-auto lg:mb-sp-2 lg:mt-0 lg:w-full"
    />
  );
}
