"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { PageHeader, StatusText, Tabs, describeAction, describeCondition, panelId, tabId } from "@/components/ops";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  EXCLUDE_RULE_TTL_DAYS,
  OPS_NOW,
  OPS_TODAY,
  RULE_REVIEW_DAYS,
  SEED_RULES,
  addDays,
  buildAraProposal,
  daysUntil,
  formatDate,
  readOutcomesInjected,
  type OpsRule,
} from "@/lib/ui-data/ops";

type RulesTab = "proposed" | "active" | "closed";

const ID_PREFIX = "rules";
// Simulated proposer latency, long enough to show the busy state.
const PROPOSE_DELAY_MS = 700;

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
  confirmingRetire: boolean;
  onApprove: () => void;
  onReject: () => void;
  onAskRetire: () => void;
  onConfirmRetire: () => void;
  onCancelRetire: () => void;
};

function periodText(rule: OpsRule): ReactNode {
  if (rule.status === "proposed") {
    return rule.then.kind === "exclude_clinic"
      ? `승인하면 바로 활성화되고 ${EXCLUDE_RULE_TTL_DAYS}일 뒤 만료돼요.`
      : "승인하면 바로 활성화돼요.";
  }
  if (!rule.activatedAt) return "활성화된 적이 없어요.";
  const from = `${formatDate(rule.activatedAt)}부터`;
  if (!rule.expiresAt) return `${from} 활성, 만료 없음`;
  const left = daysUntil(rule.expiresAt);
  return (
    <>
      <span>
        {from} 활성, {rule.expiresAt} 만료
      </span>
      {rule.status === "active" && left <= RULE_REVIEW_DAYS ? (
        <StatusText tone="warning">만료 {left}일 전이에요. 재검토해 주세요.</StatusText>
      ) : null}
    </>
  );
}

function RuleCard({ rule, confirmingRetire, onApprove, onReject, onAskRetire, onConfirmRetire, onCancelRetire }: RuleCardProps) {
  const source = rule.source === "auto_proposal" ? `자동 제안 · ${rule.proposedBy ?? "플랫폼"}` : "운영자 작성";
  const closed = rule.status === "rejected" || rule.status === "retired";

  return (
    <Card className="flex flex-col gap-sp-4">
      <CardHeader title={rule.reason} description={`${rule.id} · v${rule.version} · ${source}`} />

      <dl className="flex flex-col gap-sp-3 text-body">
        {closed ? (
          <Row label="상태">
            <StatusText tone={rule.status === "rejected" ? "danger" : "muted"}>{rule.status === "rejected" ? "반려" : "폐기"}</StatusText>
            {rule.closedAt ? <span className="text-caption text-subtle">{formatDate(rule.closedAt)}</span> : null}
          </Row>
        ) : null}
        <Row label="조건">{describeCondition(rule.when)}</Row>
        <Row label="행동">{describeAction(rule.then)}</Row>
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
        <Row label="기간">{periodText(rule)}</Row>
      </dl>

      {rule.status === "proposed" ? (
        <div className="flex flex-col gap-sp-2 sm:flex-row">
          <Button onClick={onApprove}>승인</Button>
          <Button variant="secondary" onClick={onReject}>
            반려
          </Button>
        </div>
      ) : null}
      {rule.status === "active" ? (
        confirmingRetire ? (
          <div className="flex flex-col gap-sp-3">
            <p className="text-body text-muted">이 규칙을 폐기할까요? 다음 매칭부터 적용되지 않아요.</p>
            <div className="flex flex-col gap-sp-2 sm:flex-row">
              <Button variant="secondary" onClick={onConfirmRetire}>
                폐기 확정
              </Button>
              <Button variant="ghost" onClick={onCancelRetire}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row">
            <Button variant="secondary" onClick={onAskRetire}>
              폐기
            </Button>
          </div>
        )
      ) : null}
    </Card>
  );
}

export function RulesView() {
  const [rules, setRules] = useState<OpsRule[]>(SEED_RULES);
  const [tab, setTab] = useState<RulesTab>("active");
  const [result, setResult] = useState<ReactNode>(null);
  const [running, setRunning] = useState(false);
  const [retiring, setRetiring] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const byTab: Record<RulesTab, OpsRule[]> = {
    proposed: rules.filter((rule) => rule.status === "proposed"),
    active: rules.filter((rule) => rule.status === "active"),
    closed: rules.filter((rule) => rule.status === "rejected" || rule.status === "retired"),
  };

  const update = (id: string, patch: Partial<OpsRule>, message: string, nextTab?: RulesTab) => {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
    setRetiring(null);
    setResult(message);
    if (nextTab) setTab(nextTab);
  };

  const approve = (rule: OpsRule) =>
    update(
      rule.id,
      {
        status: "active",
        approvedBy: "운영자",
        activatedAt: OPS_NOW,
        expiresAt: rule.then.kind === "exclude_clinic" ? addDays(OPS_TODAY, EXCLUDE_RULE_TTL_DAYS) : undefined,
      },
      `${rule.id} 규칙을 승인했어요. 다음 매칭부터 적용돼요.`,
      "active",
    );

  const reject = (rule: OpsRule) =>
    update(rule.id, { status: "rejected", closedAt: OPS_NOW }, `${rule.id} 제안을 반려했어요. 폐기 탭에서 이력을 볼 수 있어요.`);

  const retire = (rule: OpsRule) =>
    update(rule.id, { status: "retired", closedAt: OPS_NOW }, `${rule.id} 규칙을 폐기했어요. 이력은 폐기 탭에 남아요.`);

  // Stands in for the proposer (07-platform-intelligence.md section 4): it only finds a candidate
  // once the demo has injected the 20 burst outcomes, like the real triggers would.
  const runProposal = () => {
    setRunning(true);
    setResult(null);
    timer.current = setTimeout(() => {
      setRunning(false);
      if (!readOutcomesInjected()) {
        setResult(
          <>
            지금은 제안할 규칙이 없어요. 최근 30일 결과가 기준(표본 5건 이상, 견적 대비 실결제 평균 +20% 초과)에 못 미쳐요. 데모에서 결과 20건을
            주입한 뒤 다시 실행해 보세요.{" "}
            <Link href="/demo" className={cn("text-text underline", focusRing)}>
              데모 컨트롤 열기
            </Link>
          </>,
        );
        return;
      }
      const proposal = buildAraProposal();
      if (rules.some((rule) => rule.id === proposal.id)) {
        setResult("이미 제안한 규칙이에요. 제안 또는 폐기 탭에서 확인해 주세요.");
        return;
      }
      setRules((current) => [...current, proposal]);
      setTab("proposed");
      setResult(`규칙 1건을 제안했어요: ${describeAction(proposal.then)} (${proposal.evidence.summary}). 근거를 확인한 뒤 승인하거나 반려해 주세요.`);
    }, PROPOSE_DELAY_MS);
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
                  confirmingRetire={retiring === rule.id}
                  onApprove={() => approve(rule)}
                  onReject={() => reject(rule)}
                  onAskRetire={() => setRetiring(rule.id)}
                  onConfirmRetire={() => retire(rule)}
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
