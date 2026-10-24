import type { Metadata } from "next";
import { AgentCardView, Card, CardHeader, JsonViewer } from "@/components/ui";
import { CopyButton } from "@/components/clinic/copy-button";
import { daysBetween, formatDate } from "@/components/clinic/format";
import { PageHeader } from "@/components/clinic/page-header";
import { SignedOut } from "@/components/clinic/signed-out";
import { getAgentView } from "@/lib/agents/clinic/console";
import { OPERATION_MODE_TEXT, OPERATION_SOURCE_TEXT, type ClinicOperationMode } from "@/lib/ui-data/clinic";
import { currentClinicId, requestBaseUrl } from "../console-session";

export const metadata: Metadata = { title: "내 에이전트" };

const CARD_LABELS = { version: "버전", skills: "스킬", endpoint: "엔드포인트", json: "Agent Card JSON 펼치기" };

// 02-agents.md: clinic.quote answers from menu data, clinic.book waits for the clinic (direct mode).
const MODE_NOTE: Record<ClinicOperationMode, string> = {
  clinic: "병원이 직접 운영해요. 견적은 메뉴·가격 데이터로 자동 응답하고, 예약은 요청함에서 직접 확정해요",
  proxy: "PibooK이 대신 운영해요. 가격은 참고가로 안내되고, 예약은 병원 확인 뒤 확정돼요",
};

export default async function ClinicAgentPage() {
  const clinicId = await currentClinicId();
  if (!clinicId) return <SignedOut />;

  const view = await getAgentView(clinicId, await requestBaseUrl());
  const { card, operation } = view;
  const age = daysBetween(operation.lastVerifiedAt, view.today);
  const json = JSON.stringify(card, null, 2);

  const rows: { label: string; value: string }[] = [
    { label: "운영 모드", value: OPERATION_MODE_TEXT[operation.mode] },
    {
      label: "데이터 출처",
      value: operation.dataSources.map((source) => OPERATION_SOURCE_TEXT[source] ?? source).join(", "),
    },
    {
      label: "마지막 확인",
      value: `${formatDate(operation.lastVerifiedAt)} (${age === 0 ? "오늘" : `${age}일 전`})`,
    },
    { label: "외국인환자 유치 등록", value: operation.foreignPatientFacilityRegistered ? "등록됨" : "미등록" },
    { label: "호출 인증", value: "PibooK 발급 토큰과 추천 토큰" },
  ];

  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader
        title="내 에이전트"
        description="고객 에이전트와 플랫폼이 보는 우리 병원 에이전트의 Agent Card예요"
      />

      <div className="grid grid-cols-1 items-start gap-sp-4 lg:grid-cols-2">
        <AgentCardView card={card} labels={CARD_LABELS} />

        <div className="flex flex-col gap-sp-4">
          <Card className="flex flex-col gap-sp-4">
            <CardHeader as="h2" title="운영" description={MODE_NOTE[operation.mode]} />
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
            <p className="break-all text-body tabular-nums">{view.endpoint}</p>
            <CopyButton text={view.endpoint} label="URL 복사" />
          </Card>

          <Card className="flex flex-col gap-sp-3">
            <CardHeader
              as="h2"
              title="Agent Card JSON"
              description={view.source === "a2a" ? "공개 카드 주소에서 받은 원문이에요" : "공개 카드 주소와 같은 내용이에요"}
            />
            <p className="break-all text-caption text-subtle">{view.cardUrl}</p>
            <JsonViewer value={card} />
            <CopyButton text={json} label="JSON 복사" />
          </Card>
        </div>
      </div>
    </div>
  );
}
