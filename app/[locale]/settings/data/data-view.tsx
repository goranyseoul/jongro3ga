"use client";

import { useState, type ReactNode } from "react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { AgentCardView, Button, Card, CardHeader, ConsentCard, Sheet, buttonStyles } from "@/components/ui";
import { resetDemoState, updateDemoState } from "@/components/customer/demo-state";
import { useCustomer } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COPY } from "../../onboarding/copy";
import { buildAgentCard } from "../../onboarding/mock";
import { ZK_CHAIN, consentsFor, shortHex, walletFor, type ConsentType } from "@/lib/ui-data/customer";

const REQUIRED: ConsentType[] = ["terms", "privacy"];

export function DataView() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const { locale, profile, demo, records } = useCustomer();
  const copy = COPY[locale];

  const [confirming, setConfirming] = useState(false);

  const consents = consentsFor(profile);
  const granted = (type: ConsentType, seed: boolean) => demo.consents[type] ?? seed;
  const wallet = walletFor(profile.id, records);

  // The onboarding card carries the demo agent id; the customer's own id replaces it here
  const card = (() => {
    const base = buildAgentCard(true);
    return {
      ...base,
      name: `PibooK Customer Agent ${profile.agentId}`,
      supportedInterfaces: base.supportedInterfaces.map((entry) => ({
        ...entry,
        url: `https://pibu.example/a2a/customers/${profile.agentId}/rpc`,
      })),
    };
  })();

  const exportJson = () => {
    const data = {
      profile,
      consents: consents.map((c) => ({ ...c, granted: granted(c.type, c.granted) })),
      records,
      wallet: wallet ? { ...wallet, chainId: ZK_CHAIN.chainId, registry: ZK_CHAIN.registry } : null,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pibu-export-${profile.agentId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const remove = () => {
    resetDemoState();
    updateDemoState((state) => ({ ...state, deleted: true }));
    setConfirming(false);
  };

  const text = (type: ConsentType) =>
    type === "shareWithClinic"
      ? { title: t("consents.shareWithClinic.title"), description: t("consents.shareWithClinic.description") }
      : copy.consents[type];

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>

      {demo.deleted ? (
        <Card className="flex flex-col gap-sp-3">
          <p className="text-body">{t("remove.done")}</p>
          <Link href="/" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
            {t("remove.top")}
          </Link>
        </Card>
      ) : null}

      <section aria-labelledby="set-agent" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="set-agent" className="text-title font-semi">
            {t("agent.title")}
          </h2>
          <p className="text-label text-muted">{t("agent.lead")}</p>
        </div>
        <AgentCardView card={card} labels={copy.agentCard} />
      </section>

      {wallet ? (
        <section aria-labelledby="set-wallet" className="flex flex-col gap-sp-3">
          <div className="flex flex-col gap-sp-1">
            <h2 id="set-wallet" className="text-title font-semi">
              {t("wallet.title")}
            </h2>
            <p className="text-label text-muted">{t("wallet.lead")}</p>
          </div>
          <Card className="flex flex-col gap-sp-4">
            <dl className="flex flex-col gap-sp-2">
              <WalletRow term={t("wallet.subject")}>
                <span title={wallet.subjectId}>{shortHex(wallet.subjectId)}</span>
              </WalletRow>
              <WalletRow term={t("wallet.commitment")}>
                {wallet.commitment ? <span title={wallet.commitment}>{shortHex(wallet.commitment)}</span> : t("wallet.none")}
              </WalletRow>
              <WalletRow term={t("wallet.version")}>{wallet.version}</WalletRow>
              <WalletRow term={t("wallet.anchored")}>{t("wallet.anchoredValue", { n: wallet.anchoredRecords })}</WalletRow>
            </dl>
            <p className="text-caption text-subtle">{t("wallet.network", { network: ZK_CHAIN.name })}</p>
            {/* /demo/ledger sits outside the locale segment, so the plain Next.js link is used here */}
            <NextLink href="/demo/ledger" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
              {t("wallet.ledger")}
            </NextLink>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="set-consents" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="set-consents" className="text-title font-semi">
            {t("consents.title")}
          </h2>
          <p className="text-label text-muted">{t("consents.lead")}</p>
        </div>
        <ul className="flex flex-col gap-sp-3">
          {consents.map((entry) => {
            const info = text(entry.type);
            const fixed = REQUIRED.includes(entry.type);
            return (
              <li key={entry.id} className="flex flex-col gap-sp-2">
                {fixed ? (
                  <Card className="flex flex-col gap-sp-2">
                    <CardHeader title={info.title} description={t("consents.fixed")} />
                    <p className="text-body text-muted">{info.description}</p>
                  </Card>
                ) : (
                  <ConsentCard
                    title={info.title}
                    description={info.description}
                    agreeLabel={t("consents.on")}
                    declineLabel={t("consents.off")}
                    value={granted(entry.type, entry.granted)}
                    onChange={(value) => updateDemoState((state) => ({ ...state, consents: { ...state.consents, [entry.type]: value } }))}
                  />
                )}
                <p className="px-sp-1 text-caption text-subtle">
                  {t("consents.scope")}: {entry.scope.join(", ")} · {t("consents.version", { version: entry.textVersion })} ·{" "}
                  <span className="tabular-nums">{t("consents.at", { date: entry.at.slice(0, 10) })}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("export.title")} description={t("export.body")} as="h2" />
        <Button variant="secondary" className="self-start" onClick={exportJson}>
          {t("export.button")}
        </Button>
      </Card>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("remove.title")} description={t("remove.body")} as="h2" />
        <Button variant="secondary" className="self-start" onClick={() => setConfirming(true)}>
          {t("remove.button")}
        </Button>
      </Card>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={t("remove.confirmTitle")} closeLabel={common("close")}>
        <div className="flex flex-col gap-sp-4">
          <p className="text-body text-muted">{t("remove.confirmBody")}</p>
          <div className="flex flex-col gap-sp-2 sm:flex-row-reverse">
            <Button fullWidth onClick={remove}>
              {t("remove.confirm")}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setConfirming(false)}>
              {common("cancel")}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function WalletRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-sp-3">
      <dt className="shrink-0 text-label text-muted">{term}</dt>
      <dd className="min-w-0 break-all text-end text-body tabular-nums">{children}</dd>
    </div>
  );
}
