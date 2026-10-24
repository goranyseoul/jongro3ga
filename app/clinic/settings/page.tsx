import type { Metadata } from "next";
import { PageHeader } from "@/components/clinic/page-header";
import { ClinicSettingsView } from "./settings-view";

export const metadata: Metadata = { title: "병원 설정" };

export default function ClinicSettingsPage() {
  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader title="병원 설정" description="병원 프로필, 내 계정, 알림, 에이전트 연결을 관리해요" />
      <ClinicSettingsView />
    </div>
  );
}
