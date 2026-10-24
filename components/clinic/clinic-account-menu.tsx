"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui";
import { StaffMenu } from "@/components/ui/staff-menu";
import { CLINIC, STAFF_ROLE_TEXT } from "@/lib/ui-data/clinic";
import { CLINIC_LOGIN_PATH, signOutClinic, useClinicSession } from "./clinic-session";

// Shell account menu. Signed out (and on the server render) it is a plain 로그인 link that
// remembers the current page as ?next=.
export function ClinicAccountMenu() {
  const { session, clinic } = useClinicSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!session) {
    return (
      <Link
        href={`${CLINIC_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`}
        className={buttonStyles({ variant: "secondary", fullWidth: true })}
      >
        로그인
      </Link>
    );
  }

  const role = STAFF_ROLE_TEXT[session.role];
  const clinicName = clinic?.name ?? CLINIC.name;

  return (
    <StaffMenu
      label={`계정 메뉴: ${session.staffName}, ${clinicName}`}
      trigger={
        <>
          <span className="truncate text-body font-med">{session.staffName}</span>
          <span className="truncate text-caption text-subtle">{role}</span>
        </>
      }
      header={
        <>
          <p className="text-body font-semi">{clinicName}</p>
          <p className="text-label text-muted">
            {session.staffName} · {role}
          </p>
          <p className="break-all text-caption text-subtle">{session.email}</p>
        </>
      }
      items={[
        { id: "account", label: "내 계정", href: "/clinic/settings#account" },
        { id: "settings", label: "병원 설정", href: "/clinic/settings" },
        {
          id: "logout",
          label: "로그아웃",
          onSelect: () => {
            signOutClinic();
            router.push(CLINIC_LOGIN_PATH);
          },
        },
      ]}
      popoverClassName="end-0 top-full mt-sp-2 lg:bottom-full lg:end-auto lg:start-0 lg:top-auto lg:mb-sp-2 lg:mt-0 lg:w-full"
    />
  );
}
