"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageHeader, StatusText } from "@/components/ops";
import { Button, Card, CardHeader, JsonViewer } from "@/components/ui";
import { matchesOffer, type PublicOffer } from "@/lib/zk/browser/offers";
import {
  browserProofSupport,
  commitmentOf,
  disposeProver,
  proveOffer,
  warmUpProver,
  type ProverOptions,
} from "@/lib/zk/browser/prover";
import { loadOrCreateWallet, recordCount, resetWallet, type BrowserWallet } from "@/lib/zk/browser/wallet";
import type { ProofBundle, VerifyResult } from "@/lib/zk/types";
import { ZK_SERVER_URL, fetchChainToday, fetchOffers, requestVerification } from "./zk-server";

type Support = ReturnType<typeof browserProofSupport>;

/** A proof made in this browser, kept with how long the engine took to load. */
type MadeProof = { bundle: ProofBundle; loadMs: number; threads: number };

type OfferRun =
  | { status: "proving"; stage: string }
  | ({ status: "proved" | "verifying" } & MadeProof)
  | ({ status: "verified"; result: VerifyResult } & MadeProof)
  | { status: "error"; message: string; proof?: MadeProof };

const madeProof = (run: OfferRun | undefined): MadeProof | undefined => {
  if (!run || run.status === "proving") return undefined;
  if (run.status === "error") return run.proof;
  return { bundle: run.bundle, loadMs: run.loadMs, threads: run.threads };
};

// Labels for the eligibility circuit's public inputs, in circuit order (zk/eligibility/src/main.nr).
const PUBLIC_INPUT_LABELS = ["차트 해시", "체인 날짜", "시술 코드", "병원 코드", "최소 경과일", "최대 경과일", "최소 횟수", "최대 횟수"];

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split("\n")[0];

const shortHex = (hex: string, head = 6, tail = 4): string =>
  hex.length > head + tail + 2 ? `${hex.slice(0, head + 2)}…${hex.slice(-tail)}` : hex;

const proofBytes = (hex: string): number => (hex.length - 2) / 2;

const formatInput = (value: string, index: number): string =>
  index === 0 ? shortHex(value, 8, 6) : BigInt(value).toString(10);

// What the clinic receives, with the proof bytes shortened the way the A2A log stores them.
const bundleForDisplay = (bundle: ProofBundle) => ({
  ...bundle,
  proofs: bundle.proofs.map((proof) => ({
    ...proof,
    proof: `[proof ${Math.round(proofBytes(proof.proof) / 1024)}KB]`,
  })),
});

function Field({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <div className="flex flex-col gap-sp-1">
      <dt className="text-label text-muted">{label}</dt>
      <dd className="break-all text-body tabular-nums" title={title}>
        {value}
      </dd>
    </div>
  );
}

export function WalletView() {
  const [support, setSupport] = useState<Support | null>(null);
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [proverOptions, setProverOptions] = useState<ProverOptions>({});
  const [offers, setOffers] = useState<PublicOffer[] | null>(null);
  const [today, setToday] = useState<number | null>(null);
  const [offersBusy, setOffersBusy] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, OfferRun>>({});
  const [busyOffer, setBusyOffer] = useState<string | null>(null);

  useEffect(() => {
    setSupport(browserProofSupport());
    setWallet(loadOrCreateWallet());
    // ?mt=1 asks for every core; it only takes effect when the page is crossOriginIsolated (COOP/COEP)
    setProverOptions({ multithread: new URLSearchParams(window.location.search).get("mt") === "1" });
    return () => {
      void disposeProver();
    };
  }, []);

  useEffect(() => {
    if (!wallet || !support?.ok) return;
    let cancelled = false;
    setCommitment(null);
    setCommitError(null);
    commitmentOf(wallet.chart)
      .then((value) => {
        if (!cancelled) setCommitment(value);
      })
      .catch((error: unknown) => {
        if (!cancelled) setCommitError(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, support]);

  const setRun = (offerId: string, run: OfferRun) => setRuns((current) => ({ ...current, [offerId]: run }));

  const reset = () => {
    setWallet(resetWallet());
    setRuns({});
  };

  const loadOffers = async () => {
    setOffersBusy(true);
    setOffersError(null);
    try {
      const [list, day] = await Promise.all([fetchOffers(), fetchChainToday()]);
      setOffers(list);
      setToday(day);
    } catch (error) {
      setOffersError(errorText(error));
    } finally {
      setOffersBusy(false);
    }
  };

  const prove = async (offer: PublicOffer) => {
    if (!wallet || !commitment) return;
    setBusyOffer(offer.id);
    let failure = "브라우저 증명 실패";
    try {
      // the verifier accepts today or yesterday only (1 chain day = 60 s), so read the clock right before proving
      setRun(offer.id, { status: "proving", stage: "체인 날짜 확인 중" });
      const day = await fetchChainToday();
      setToday(day);
      // never build a proof the chart cannot back: a failed proof request is itself a signal
      if (!matchesOffer(wallet.chart, day, offer)) throw new Error("이 차트는 오퍼 조건을 만족하지 않아요");
      setRun(offer.id, { status: "proving", stage: "증명 엔진 준비 중 (처음 한 번 WASM과 CRS를 받아요)" });
      failure = "브라우저 증명 미지원 환경";
      const info = await warmUpProver(proverOptions);
      failure = "브라우저 증명 실패";
      setRun(offer.id, { status: "proving", stage: "브라우저에서 증명 중" });
      const result = await proveOffer(wallet.chart, commitment, day, offer.clauses, proverOptions);
      const bundle: ProofBundle = {
        subjectId: wallet.subjectId,
        offerId: offer.id,
        today: day,
        unanchored: true,
        provingMs: result.provingMs,
        proofs: result.proofs,
      };
      setRun(offer.id, { status: "proved", bundle, loadMs: info.loadMs, threads: info.threads });
    } catch (error) {
      setRun(offer.id, { status: "error", message: `${failure}: ${errorText(error)}` });
    } finally {
      setBusyOffer(null);
    }
  };

  const verify = async (offer: PublicOffer, proof: MadeProof) => {
    setBusyOffer(offer.id);
    setRun(offer.id, { status: "verifying", ...proof });
    try {
      const result = await requestVerification(offer.clinicId, proof.bundle);
      setRun(offer.id, { status: "verified", ...proof, result });
    } catch (error) {
      setRun(offer.id, { status: "error", message: `검증 요청 실패: ${errorText(error)}`, proof });
    } finally {
      setBusyOffer(null);
    }
  };

  const proverReady = Boolean(support?.ok && commitment);

  return (
    <>
      <PageHeader
        title="브라우저 지갑"
        description="차트와 솔트는 이 브라우저의 localStorage에만 있어 밖으로 나가지 않고, 체인에 앵커된 적 없는 새 가명이라 첫 방문 오퍼만 증명할 수 있어요."
        action={
          <Button variant="secondary" onClick={reset} disabled={!wallet || busyOffer !== null}>
            가명 새로 만들기
          </Button>
        }
      />

      {support && !support.ok ? (
        <Card className="flex flex-col gap-sp-2">
          <CardHeader title="브라우저 증명 미지원 환경" description={support.reason} />
          <p className="text-label text-muted">오퍼 매칭은 그대로 되지만 증명은 만들 수 없어요.</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title="기기 지갑" description="이 브라우저에만 저장된 가명과 차트예요. 서버로 보내지 않아요." as="h2" />
        {wallet ? (
          <dl className="grid grid-cols-1 gap-sp-4 sm:grid-cols-2">
            <Field label="가명" value={shortHex(wallet.subjectId)} title={wallet.subjectId} />
            <Field
              label="로컬 차트 해시"
              title={commitment ?? undefined}
              value={
                commitment ? (
                  shortHex(commitment)
                ) : commitError ? (
                  <StatusText tone="danger">계산 실패: {commitError}</StatusText>
                ) : support && !support.ok ? (
                  "·"
                ) : (
                  <span className="text-muted">계산 중</span>
                )
              }
            />
            <Field label="병원 확인 기록" value={`${recordCount(wallet.chart)}건`} />
            <Field label="체인 상태" value="앵커된 적 없음 (빈 차트로 간주)" />
          </dl>
        ) : (
          <p className="text-label text-muted">지갑을 여는 중</p>
        )}
      </Card>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader
          title="오퍼"
          description={`공개 오퍼 규칙만 ${ZK_SERVER_URL}에서 받아요. 매칭은 이 기기 안에서만 해요.`}
          as="h2"
          action={
            <Button variant="secondary" onClick={loadOffers} disabled={offersBusy}>
              {offersBusy ? "불러오는 중" : offers ? "다시 불러오기" : "오퍼 불러오기"}
            </Button>
          }
        />
        {offersError ? <StatusText tone="danger">오퍼를 불러오지 못했어요: {offersError}</StatusText> : null}
        {today !== null ? <p className="text-caption text-subtle tabular-nums">체인 날짜 {today}</p> : null}
        {offers && wallet && today !== null ? (
          <ul className="flex flex-col">
            {offers.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                eligible={matchesOffer(wallet.chart, today, offer)}
                run={runs[offer.id]}
                canProve={proverReady && busyOffer === null}
                busy={busyOffer === offer.id}
                onProve={() => void prove(offer)}
                onVerify={(run) => void verify(offer, run)}
              />
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}

type OfferRowProps = {
  offer: PublicOffer;
  eligible: boolean;
  run: OfferRun | undefined;
  canProve: boolean;
  busy: boolean;
  onProve: () => void;
  onVerify: (proof: MadeProof) => void;
};

function OfferRow({ offer, eligible, run, canProve, busy, onProve, onVerify }: OfferRowProps) {
  const proved = madeProof(run);
  return (
    <li className="flex flex-col gap-sp-3 border-t border-border-soft py-sp-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-sp-3">
        <div className="flex min-w-0 flex-col gap-sp-1">
          <p className="text-body font-semi">
            {offer.clinic} · {offer.title}
          </p>
          <p className="text-label text-muted">{offer.benefit}</p>
          {offer.conditions.length ? <p className="text-caption text-subtle">조건: {offer.conditions.join(", ")}</p> : null}
        </div>
        <StatusText tone={eligible ? "success" : "muted"} className="shrink-0 text-label">
          {eligible ? "대상" : "해당 없음"}
        </StatusText>
      </div>

      {eligible ? (
        <div className="flex flex-wrap items-center gap-sp-2">
          <Button onClick={onProve} disabled={!canProve}>
            {busy && run?.status === "proving" ? "증명 중" : proved ? "다시 증명하기" : "브라우저에서 증명 만들기"}
          </Button>
          {proved ? (
            <Button variant="secondary" disabled={busy} onClick={() => onVerify(proved)}>
              {run?.status === "verifying" ? "검증 요청 중" : "병원 검증 요청"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {run?.status === "proving" ? <p className="text-label text-muted">{run.stage}</p> : null}
      {run?.status === "error" ? <StatusText tone="danger" className="text-label">{run.message}</StatusText> : null}

      {proved ? <ProofDetails {...proved} /> : null}

      {run?.status === "verified" ? (
        <div className="flex flex-col gap-sp-1">
          <p className="flex items-baseline gap-sp-2">
            <span className="text-label text-muted">{offer.clinic} 검증</span>
            <StatusText tone={run.result.ok ? "success" : "danger"}>{run.result.ok ? "통과" : "실패"}</StatusText>
            {run.result.unanchored ? <span className="text-caption text-subtle">앵커 안 된 가명</span> : null}
          </p>
          <p className="text-caption text-muted">{run.result.reason}</p>
        </div>
      ) : null}
    </li>
  );
}

function ProofDetails({ bundle, loadMs, threads }: MadeProof) {
  const totalBytes = bundle.proofs.reduce((sum, proof) => sum + proofBytes(proof.proof), 0);
  return (
    <div className="flex flex-col gap-sp-3 rounded-md bg-sunken p-sp-3">
      <dl className="grid grid-cols-2 gap-sp-3 sm:grid-cols-4">
        <Field label="증명 시간" value={`${(bundle.provingMs ?? 0).toLocaleString("ko-KR")}ms`} />
        <Field label="엔진 준비 (첫 증명)" value={`${loadMs.toLocaleString("ko-KR")}ms`} />
        <Field label="증명 크기" value={`${totalBytes.toLocaleString("ko-KR")} bytes`} />
        <Field label="스레드" value={threads} />
      </dl>
      {bundle.proofs.map((proof, index) => (
        <div key={index} className="flex flex-col gap-sp-2">
          <p className="text-label text-muted">
            증명 {index + 1} · {shortHex(proof.proof, 10, 8)}
          </p>
          <dl className="grid grid-cols-2 gap-sp-2 sm:grid-cols-4">
            {proof.publicInputs.map((value, inputIndex) => (
              <div key={inputIndex} className="flex flex-col">
                <dt className="text-caption text-subtle">{PUBLIC_INPUT_LABELS[inputIndex] ?? `입력 ${inputIndex + 1}`}</dt>
                <dd className="break-all text-label tabular-nums" title={value}>
                  {formatInput(value, inputIndex)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div className="flex flex-col gap-sp-1">
        <p className="text-label text-muted">병원에 가는 번들 (차트 없음)</p>
        <JsonViewer value={bundleForDisplay(bundle)} />
      </div>
    </div>
  );
}
