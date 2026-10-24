import type { Metadata } from "next";
import { PageHeader } from "@/components/ops";
import { OPS_TODAY } from "@/lib/ui-data/ops";
import { ClinicsView } from "./clinics-view";

export const metadata: Metadata = { title: "병원 레지스트리" };

export default function OpsClinicsPage() {
  return (
    <>
      <PageHeader
        title="병원 레지스트리"
        description={`병원별 운영 모드, 등록 상태, 데이터 신선도예요. 기준일은 데모 시계 ${OPS_TODAY}입니다.`}
      />
      <ClinicsView />
    </>
  );
}
