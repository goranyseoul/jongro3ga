import type { Metadata } from "next";
import { PageHeader } from "@/components/ops";
import { OpsAccountView } from "./account-view";

export const metadata: Metadata = { title: "내 계정" };

export default function OpsAccountPage() {
  return (
    <>
      <PageHeader title="내 계정" description="운영자 프로필, 권한, 세션과 보안을 확인해요" />
      <OpsAccountView />
    </>
  );
}
