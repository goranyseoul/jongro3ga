"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Table, buttonStyles, type TableColumn } from "@/components/ui";
import { Switch } from "@/components/clinic/switch";
import { PageHeader } from "@/components/ops";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { LEDGER_EVENTS, ZK_CHAIN, addressUrl, shortHex, txUrl, type LedgerEvent } from "@/lib/ui-data/customer";

// Set at build time; without it the page shows the events read from Base Sepolia when the mock was made.
const ZK_SERVER_URL = process.env.NEXT_PUBLIC_ZK_SERVER_URL?.replace(/\/+$/, "");

/** One row of GET /api/ledger on the glowpass server (docs/INTEGRATION.md section 5). */
type LiveLedgerRow = {
  tx: string;
  block?: number;
  timestamp: number;
  subjectId: string;
  commitment: string;
  version: number;
  day: number;
};

const externalLink = cn("tabular-nums text-text underline", focusRing);

/** Block time as a KST timestamp, the same shape as the mock rows. Accepts seconds or milliseconds. */
function kstIso(timestamp: number): string {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return `${new Date(ms + 9 * 3_600_000).toISOString().slice(0, 19)}+09:00`;
}

const toEvent = (row: LiveLedgerRow): LedgerEvent => ({
  at: kstIso(row.timestamp),
  subjectId: row.subjectId,
  commitment: row.commitment,
  version: row.version,
  tx: row.tx,
  day: row.day,
});

const columns: TableColumn<LedgerEvent>[] = [
  {
    key: "at",
    header: "시각",
    card: "title",
    cell: (event) => (
      <div className="flex flex-col gap-sp-1">
        <span className="font-med tabular-nums">
          {event.at.slice(0, 10)} {event.at.slice(11, 19)}
        </span>
        <span className="text-caption font-reg text-subtle tabular-nums">체인 날짜 {event.day}</span>
      </div>
    ),
  },
  {
    key: "subject",
    header: "가명",
    cell: (event) => (
      <span className="tabular-nums" title={event.subjectId}>
        {shortHex(event.subjectId)}
      </span>
    ),
  },
  {
    key: "commitment",
    header: "차트 해시",
    cell: (event) => (
      <span className="tabular-nums" title={event.commitment}>
        {shortHex(event.commitment)}
      </span>
    ),
  },
  { key: "version", header: "버전", cell: (event) => <span className="tabular-nums">v{event.version}</span> },
  {
    key: "tx",
    header: "tx",
    cell: (event) => (
      <a href={txUrl(event.tx)} target="_blank" rel="noreferrer" className={externalLink} aria-label={`tx ${shortHex(event.tx)}, 익스플로러에서 보기`}>
        {shortHex(event.tx)}
      </a>
    ),
  },
];

export function LedgerView() {
  const [live, setLive] = useState(false);
  const [reload, setReload] = useState(0);
  const [liveRows, setLiveRows] = useState<LedgerEvent[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!live || !ZK_SERVER_URL) return;
    let cancelled = false;
    setStatus("loading");
    fetch(`${ZK_SERVER_URL}/api/ledger`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ ledger?: LiveLedgerRow[] }>;
      })
      .then((body) => {
        if (cancelled) return;
        setLiveRows((body.ledger ?? []).map(toEvent));
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [live, reload]);

  const showingLive = live && liveRows !== null && status !== "error";
  const rows = showingLive ? liveRows : LEDGER_EVENTS;

  const caption = !ZK_SERVER_URL
    ? `데모 데이터 · 2026-10-24에 ${ZK_CHAIN.name}에서 읽은 이벤트예요. NEXT_PUBLIC_ZK_SERVER_URL을 설정하면 glowpass 서버의 원장을 읽어요`
    : status === "error"
      ? "실시간 원장을 불러오지 못했어요. 데모 데이터를 보여줘요"
      : status === "loading"
        ? "실시간 원장을 불러오는 중이에요"
        : showingLive
          ? `실시간 · ${ZK_SERVER_URL}/api/ledger`
          : `데모 데이터 · 2026-10-24에 ${ZK_CHAIN.name}에서 읽은 이벤트예요`;

  return (
    <>
      <PageHeader
        title="공개 원장"
        description="체인에 있는 것은 가명, 차트 해시, 버전, 날짜뿐이에요. 시술 종류, 병원, 이름은 없어요."
        action={
          <Link href="/demo" className={buttonStyles({ variant: "secondary" })}>
            데모 컨트롤
          </Link>
        }
      />

      <p className="text-label text-muted">
        레지스트리{" "}
        <a href={addressUrl(ZK_CHAIN.registry)} target="_blank" rel="noreferrer" className={externalLink} title={ZK_CHAIN.registry}>
          {shortHex(ZK_CHAIN.registry)}
        </a>{" "}
        · {ZK_CHAIN.name} (chainId {ZK_CHAIN.chainId}) · 체인 날짜는 {ZK_CHAIN.secondsPerDay}초가 하루예요
      </p>

      <Card className="flex flex-col gap-sp-4">
        <div className="flex flex-wrap items-center justify-between gap-sp-3">
          <div className="flex min-w-0 flex-col gap-sp-1">
            <h2 className="text-title font-semi">기록 이벤트</h2>
            <p role="status" aria-live="polite" className="text-caption text-subtle tabular-nums">
              {rows.length}건 · {caption}
            </p>
          </div>
          <div className="flex items-center gap-sp-2">
            {showingLive ? (
              <Button variant="ghost" onClick={() => setReload((count) => count + 1)} disabled={status === "loading"}>
                새로고침
              </Button>
            ) : null}
            <span className="text-label text-muted" aria-hidden>
              실시간 원장
            </span>
            <Switch checked={live} onChange={setLive} label="실시간 원장" disabled={!ZK_SERVER_URL} />
          </div>
        </div>
        <Table caption="체인에 기록된 이벤트" columns={columns} rows={rows} rowKey={(event) => event.tx} empty="아직 기록된 이벤트가 없어요" />
      </Card>
    </>
  );
}
