import type { Metadata } from "next";
import { AgentCardView, Card, CardHeader, JsonViewer } from "@/components/ui";
import { CopyButton } from "@/components/clinic/copy-button";
import { daysBetween, formatDate } from "@/components/clinic/format";
import { PageHeader } from "@/components/clinic/page-header";
import {
  AGENT_CARD,
  AGENT_ENDPOINT,
  CLINIC_OPERATION,
  OPERATION_MODE_TEXT,
  OPERATION_SOURCE_TEXT,
  TODAY,
} from "@/lib/ui-data/clinic";

export const metadata: Metadata = { title: "내 에이전트" };

const CARD_LABELS = { version: "버전", skills: "스킬", endpoint: "엔드포인트", json: "Agent Card JSON 펼치기" };

// 02-agents.md: clinic.quote answers from menu data, clinic.book waits for the clinic (direct mode).
const MODE_NOTE: Record<typeof CLINIC_OPERATION.mode, string> = {
  clinic: "병원이 직접 운영해요. 견적은 메뉴·가격 데이터로 자동 응답하고, 예약은 요청함에서 직접 확정해요",
  proxy: "Pibuk이 대신 운영해요. 가격은 참고가로 안내되고, 예약은 병원 확인 뒤 확정돼요",
};

export default function ClinicAgentPage() {
  const age = daysBetween(CLINIC_OPERATION.lastVerifiedAt, TODAY);
  const json = JSON.stringify(AGENT_CARD, null, 2);

  const rows: { label: string; value: string }[] = [
    { label: "운영 모드", value: OPERATION_MODE_TEXT[CLINIC_OPERATION.mode] },
    {
      label: "데이터 출처",
      value: CLINIC_OPERATION.dataSources.map((source) => OPERATION_SOURCE_TEXT[source] ?? source).join(", "),
    },
    {
      label: "마지막 확인",
      value: `${formatDate(CLINIC_OPERATION.lastVerifiedAt)} (${age === 0 ? "오늘" : `${age}일 전`})`,
    },
    { label: "외국인환자 유치 등록", value: CLINIC_OPERATION.foreignPatientFacilityRegistered ? "등록됨" : "미등록" },
    { label: "호출 인증", value: "Pibuk 발급 토큰과 추천 토큰" },
  ];

  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader
        title="내 에이전트"
        description="고객 에이전트와 플랫폼이 보는 우리 병원 에이전트의 Agent Card예요"
      />

      <div className="grid grid-cols-1 items-start gap-sp-4 lg:grid-cols-2">
        <AgentCardView card={AGENT_CARD} labels={CARD_LABELS} />

        <div className="flex flex-col gap-sp-4">
          <Card className="flex flex-col gap-sp-4">
            <CardHeader as="h2" title="운영" description={MODE_NOTE[CLINIC_OPERATION.mode]} />
            <dl className="flex flex-col">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-sp-4 border-b border-border-soft py-sp-2 last:border-b-0"
                >
                  <dt className="text-label text-muted">{row.label}</dt>
                  <dd className="text-end text-body font-med">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="flex flex-col gap-sp-3">
            <CardHeader as="h2" title="엔드포인트 URL" description="다른 에이전트가 JSON-RPC로 호출하는 주소예요" />
            <p className="break-all text-body tabular-nums">{AGENT_ENDPOINT}</p>
            <CopyButton text={AGENT_ENDPOINT} label="URL 복사" />
          </Card>

          <Card className="flex flex-col gap-sp-3">
            <CardHeader as="h2" title="Agent Card JSON" description="공개 카드 원문이에요" />
            <JsonViewer value={AGENT_CARD} />
            <CopyButton text={json} label="JSON 복사" />
          </Card>
        </div>
      </div>
    </div>
  );
}
