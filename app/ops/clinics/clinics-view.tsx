"use client";

import { useState } from "react";
import { ChipGroup, Stat, Table, type TableColumn } from "@/components/ui";
import { LoadState, StatusText, useApi, type StatusTone } from "@/components/ops";
import {
  AREA_LABEL,
  DATA_SOURCE_LABEL,
  LANGUAGE_MODE_LABEL,
  LOCALE_LABEL,
  OPERATION_MODE_LABEL,
  VERIFICATION_LABEL,
  fetchClinics,
  type OpsClinic,
  type VerificationStatus,
} from "@/lib/ui-data/ops";

type ModeFilter = "all" | "proxy" | "clinic";

const VERIFICATION_TONE: Record<VerificationStatus, StatusTone> = {
  verified: "success",
  pending_verification: "warning",
  suspended: "danger",
};

const columnsFor = (staleAfterDays: number): TableColumn<OpsClinic>[] => [
  {
    key: "name",
    header: "병원",
    card: "title",
    cell: (clinic) => (
      <div className="flex flex-col gap-sp-1">
        <span className="font-med">{clinic.displayName}</span>
        <span className="text-caption font-reg text-subtle">{AREA_LABEL[clinic.area]}</span>
      </div>
    ),
  },
  {
    key: "mode",
    header: "운영 모드",
    cell: (clinic) => OPERATION_MODE_LABEL[clinic.operationMode],
  },
  {
    key: "status",
    header: "등록 상태",
    cell: (clinic) => (
      <div className="flex flex-col gap-sp-1 md:items-start">
        <StatusText tone={VERIFICATION_TONE[clinic.verificationStatus]}>{VERIFICATION_LABEL[clinic.verificationStatus]}</StatusText>
        <span className="text-caption text-subtle">
          외국인환자 유치기관 {clinic.foreignPatientFacilityRegistered ? "등록" : "미등록"}
        </span>
      </div>
    ),
  },
  {
    key: "freshness",
    header: "데이터 신선도",
    cell: (clinic) => (
      <div className="flex flex-col gap-sp-1 md:items-start">
        <span>
          {clinic.lastVerifiedAt} <span className="text-muted">({clinic.daysSinceVerified}일 전)</span>
        </span>
        {clinic.stale ? (
          <StatusText tone="warning" className="text-caption">
            {staleAfterDays}일 넘게 확인하지 않았어요. 가격과 이벤트를 다시 확인해 주세요.
          </StatusText>
        ) : null}
      </div>
    ),
  },
  {
    key: "languages",
    header: "응대 언어",
    cell: (clinic) =>
      clinic.languages.map((language) => `${LOCALE_LABEL[language.locale]} ${LANGUAGE_MODE_LABEL[language.mode]}`).join(" · "),
  },
  {
    key: "sources",
    header: "데이터 출처",
    card: "caption",
    cell: (clinic) => clinic.dataSources.map((source) => DATA_SOURCE_LABEL[source]).join(" · "),
  },
];

export function ClinicsView() {
  const [mode, setMode] = useState<ModeFilter>("all");
  const { data, error, loading, reload } = useApi(fetchClinics);

  const clinics = data?.clinics ?? [];
  const staleAfterDays = data?.staleAfterDays ?? 30;
  const proxyCount = clinics.filter((clinic) => clinic.operationMode === "proxy").length;
  const directCount = clinics.length - proxyCount;
  const staleCount = clinics.filter((clinic) => clinic.stale).length;
  const rows = mode === "all" ? clinics : clinics.filter((clinic) => clinic.operationMode === mode);

  return (
    <>
      <LoadState what="병원 레지스트리" loading={loading && !data} error={error} onRetry={reload} />
      <section aria-label="요약" className="grid grid-cols-2 gap-sp-4 lg:grid-cols-4">
        <Stat label="등록 병원" value={clinics.length} caption={data ? `기준일 ${data.today}` : undefined} />
        <Stat label="대행 운영" value={proxyCount} caption="운영자가 가격과 시간을 관리" />
        <Stat label="직접 운영" value={directCount} caption="병원이 직접 입력" />
        <Stat label="신선도 경고" value={staleCount} caption={`${staleAfterDays}일 넘게 확인하지 않음`} />
      </section>

      <section aria-label="병원 목록" className="flex flex-col gap-sp-3">
        <ChipGroup
          label="운영 모드 필터"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: `전체 ${clinics.length}` },
            { value: "proxy", label: `대행 ${proxyCount}` },
            { value: "clinic", label: `직접 ${directCount}` },
          ]}
        />
        <Table
          caption="병원 레지스트리"
          columns={columnsFor(staleAfterDays)}
          rows={rows}
          rowKey={(clinic) => clinic.id}
          empty="등록된 병원이 없어요. 데모라면 시드 리셋으로 병원 시드를 불러와 주세요."
        />
      </section>
    </>
  );
}
