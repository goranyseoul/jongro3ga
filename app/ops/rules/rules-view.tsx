"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { LoadState, PageHeader, StatusText, Tabs, describeAction, describeCondition, panelId, tabId, useApi } from "@/components/ops";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  changeRule,
  errorText,
  fetchRules,
  formatDate,
  runRuleProposal,
  type ClinicNames,
  type OpsRule,
} from "@/lib/ui-data/ops";

type RulesTab = "proposed" | "active" | "closed";

const ID_PREFIX = "rules";

const EVENT_LABEL: Record<string, string> = { proposed: "제안", approved: "승인", rejected: "반려", retired: "폐기", expired: "만료" };

const EMPTY: Record<RulesTab, string> = {
  proposed: "제안된 규칙이 없어요. 오른쪽 위 [규칙 제안 실행]으로 최근 결과 신호에서 후보를 만들 수 있어요.",
  active: "활성 규칙이 없어요.",
  closed: "반려하거나 폐기한 규칙이 아직 없어요.",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-1 sm:flex-row sm:gap-sp-4">
      <dt className="text-label text-muted sm:w-sp-16 sm:shrink-0">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-sp-1">{children}</dd>
    </div>
  );
}

type RuleCardProps = {
  rule: OpsRule;
  clinics: ClinicNames;
  excludeTtlDays: number;
  busy: boolean;
  confirmingRetire: boolean;
  onApprove: () => void;
  onReject: () => void;
  onAskRetire: () => void;
  onConfirmRetire: () => void;
  onCancelRetire: () => void;
};

function periodText(rule: OpsRule, excludeTtlDays: number): ReactNode {
  if (rule.status === "proposed") {
    return rule.then.kind === "exclude_clinic"
      ? `승인하면 바로 활성화되고 ${excludeTtlDays}일 뒤 만료돼요.`
      : "승인하면 바로 활성화돼요.";
  }
  if (!rule.activatedAt) return "활성화된 적이 없어요.";
  const from = `${formatDate(rule.activatedAt)}부터`;
  if (!rule.expiresAt) return `${from} 활성, 만료 없음`;
  return (
    <>
      <span>
        {from} 활성, {formatDate(rule.expiresAt)} 만료
      </span>
      {rule.reviewDue && rule.daysToExpiry !== null ? (
        <StatusText tone="warning">만료 {rule.daysToExpiry}일 전이에요. 재검토해 주세요.</StatusText>
      ) : null}
    </>
  );
}

function RuleCard({ rule, clinics, excludeTtlDays, busy, confirmingRetire, onApprove, onReject, onAskRetire, onConfirmRetire, onCancelRetire }: RuleCardProps) {
  const proposer = rule.proposedBy === "template" ? "템플릿 문장" : (rule.proposedBy ?? "플랫폼");
  const source = rule.source === "auto_proposal" ? `자동 제안 · ${proposer}` : "운영자 작성";
  const closed = rule.status === "rejected" || rule.status === "retired";

  return (
    <Card className="flex flex-col gap-sp-4">
      <CardHeader title={rule.reason} description={`${rule.id} · v${rule.version} · ${source}`} />

      <dl className="flex flex-col gap-sp-3 text-body">
        {rule.urgent && rule.status === "proposed" ? (
          <Row label="상태">
            <StatusText tone="danger">긴급</StatusText>
            <span className="text-caption text-subtle">병원 상태를 이미 정지로 바꿨어요. 반려하면 원래 상태로 돌아가요.</span>
          </Row>
        ) : null}
        {closed ? (
          <Row label="상태">
            <StatusText tone={rule.status === "rejected" ? "danger" : "muted"}>{rule.status === "rejected" ? "반려" : "폐기"}</StatusText>
            {rule.closedAt ? <span className="text-caption text-subtle">{formatDate(rule.closedAt)}</span> : null}
          </Row>
        ) : null}
        <Row label="조건">{describeCondition(rule.when)}</Row>
        <Row label="행동">{describeAction(rule.then, clinics)}</Row>
        <Row label="근거">
          <span>{rule.evidence.summary}</span>
          {rule.evidence.signalIds.length > 0 ? (
            <span className="text-caption text-subtle tabular-nums">신호 {rule.evidence.signalIds.join(", ")}</span>
          ) : null}
          {rule.evidence.outcomeIds.length > 0 ? (
            <details>
              <summary className={cn("flex min-h-touch cursor-pointer items-center text-label text-muted hover:text-text", focusRing)}>
                근거 결과 {rule.evidence.outcomeIds.length}건 보기
              </summary>
              <ul className="flex flex-wrap gap-x-sp-4 gap-y-sp-1 pb-sp-2 text-caption text-subtle tabular-nums">
                {rule.evidence.outcomeIds.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </Row>
        <Row label="적용">{rule.status === "proposed" ? "아직 적용 전이에요." : `${rule.appliedCount}회`}</Row>
        <Row label="기간">{periodText(rule, excludeTtlDays)}</Row>
        {rule.history && rule.history.length > 0 ? (
          <Row label="이력">
            <span className="text-caption text-subtle tabular-nums">
              {rule.history.map((h) => `v${h.version} ${EVENT_LABEL[h.event] ?? h.event} ${formatDate(h.at)}`).join(" · ")}
            </span>
          </Row>
        ) : null}
      </dl>

      {rule.status === "proposed" ? (
        <div className="flex flex-col gap-sp-2 sm:flex-row">
          <Button onClick={onApprove} disabled={busy}>
            승인
          </Button>
          <Button variant="secondary" onClick={onReject} disabled={busy}>
            반려
          </Button>
        </div>
      ) : null}
      {rule.status === "active" ? (
        confirmingRetire ? (
          <div className="flex flex-col gap-sp-3">
            <p className="text-body text-muted">이 규칙을 폐기할까요? 다음 매칭부터 적용되지 않아요.</p>
            <div className="flex flex-col gap-sp-2 sm:flex-row">
              <Button variant="secondary" onClick={onConfirmRetire} disabled={busy}>
                폐기 확정
              </Button>
              <Button variant="ghost" onClick={onCancelRetire}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row">
            <Button variant="secondary" onClick={onAskRetire} disabled={busy}>
              폐기
            </Button>
          </div>
        )
      ) : null}
    </Card>
  );
}

export function RulesView() {
  const { data, error, loading, reload } = useApi(fetchRules);
  const [tab, setTab] = useState<RulesTab>("active");
  const [result, setResult] = useState<ReactNode>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<string | null>(null);

  const rules = data?.rules ?? [];
  const clinics = data?.clinics ?? {};
  const byTab: Record<RulesTab, OpsRule[]> = {
    proposed: rules.filter((rule) => rule.status === "proposed"),
    active: rules.filter((rule) => rule.status === "active"),
    closed: rules.filter((rule) => rule.status === "rejected" || rule.status === "retired"),
  };

  const act = async (rule: OpsRule, action: "approve" | "reject" | "retire") => {
    setBusy(rule.id);
    setRetiring(null);
    try {
      const { rule: next } = await changeRule(rule.id, action);
      if (action === "approve") {
        setResult(`${next.id} 규칙을 승인했어요 (v${next.version}). 다음 매칭부터 적용돼요.`);
        setTab("active");
      } else if (action === "reject") {
        setResult(`${next.id} 제안을 반려했어요 (v${next.version}). 폐기 탭에서 이력을 볼 수 있어요.`);
      } else {
        setResult(`${next.id} 규칙을 폐기했어요 (v${next.version}). 이력은 폐기 탭에 남아요.`);
      }
    } catch (failure) {
      setResult(`처리하지 못했어요. ${errorText(failure)}`);
    } finally {
      setBusy(null);
      await reload();
    }
  };

  // The proposer (07-platform-intelligence.md section 4): deterministic triggers, then Claude wording.
  const runProposal = async () => {
    setRunning(true);
    setResult(null);
    try {
      const run = await runRuleProposal();
      const how = run.mode === "claude" ? "Claude가 근거 문장을 썼어요" : "Claude 응답이 없어 템플릿 문장으로 만들었어요";
      const dropped = run.dropped.length > 0 ? ` 가드레일에 걸린 초안 ${run.dropped.length}건은 버렸어요.` : "";
      const suspended =
        run.suspendedClinicIds.length > 0
          ? ` 긴급: ${run.suspendedClinicIds.map((id) => run.clinics[id] ?? id).join(", ")} 상태를 정지로 바꿨어요.`
          : "";
      if (run.proposed.length === 0) {
        setResult(
          <>
            지금은 제안할 규칙이 없어요. 최근 {run.windowDays}일 결과가 기준(예: 표본 5건 이상, 견적 대비 실결제 평균 +20% 초과)에 못 미치거나 이미
            제안·활성 상태예요.{dropped} 데모에서 결과 20건을 주입한 뒤 다시 실행해 보세요.{" "}
            <Link href="/demo" className={cn("text-text underline", focusRing)}>
              데모 컨트롤 열기
            </Link>
          </>,
        );
      } else {
        const first = run.proposed[0];
        setResult(
          `규칙 ${run.proposed.length}건을 제안했어요 (${how}): ${describeAction(first.then, run.clinics)} (${first.evidence.summary}).${dropped}${suspended} 근거를 확인한 뒤 승인하거나 반려해 주세요.`,
        );
        setTab("proposed");
      }
    } catch (failure) {
      setResult(`규칙 제안을 실행하지 못했어요. ${errorText(failure)}`);
    } finally {
      setRunning(false);
      await reload();
    }
  };

  const visible = byTab[tab];

  return (
    <>
      <PageHeader
        title="연결 규칙"
        description="매칭 결과에 적용하는 규칙이에요. 결과 신호로 만든 제안은 근거를 확인한 뒤 승인하거나 반려해 주세요."
        action={
          <Button onClick={runProposal} disabled={running}>
            {running ? "후보를 모으는 중" : "규칙 제안 실행"}
          </Button>
        }
      />

      <Tabs
        label="연결 규칙 상태"
        idPrefix={ID_PREFIX}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "proposed", label: "제안", count: byTab.proposed.length },
          { value: "active", label: "활성", count: byTab.active.length },
          { value: "closed", label: "폐기", count: byTab.closed.length },
        ]}
      />

      <LoadState what="연결 규칙" loading={loading && !data} error={error} onRetry={reload} />

      <p role="status" aria-live="polite" className={result ? "text-body text-muted" : "sr-only"}>
        {result}
      </p>

      <div role="tabpanel" id={panelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)}>
        {visible.length === 0 ? (
          <p className="text-body text-muted">{EMPTY[tab]}</p>
        ) : (
          <ul className="flex flex-col gap-sp-4">
            {visible.map((rule) => (
              <li key={rule.id}>
                <RuleCard
                  rule={rule}
                  clinics={clinics}
                  excludeTtlDays={data?.excludeTtlDays ?? 90}
                  busy={busy !== null}
                  confirmingRetire={retiring === rule.id}
                  onApprove={() => act(rule, "approve")}
                  onReject={() => act(rule, "reject")}
                  onAskRetire={() => setRetiring(rule.id)}
                  onConfirmRetire={() => act(rule, "retire")}
                  onCancelRetire={() => setRetiring(null)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
