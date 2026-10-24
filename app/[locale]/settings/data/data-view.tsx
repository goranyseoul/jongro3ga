"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AgentCardView, Button, Card, CardHeader, ConsentCard, Sheet, buttonStyles, type AgentCard } from "@/components/ui";
import { api } from "@/components/customer/api";
import { ApiStatus } from "@/components/customer/api-state";
import { resetDemoState } from "@/components/customer/demo-state";
import { useMe } from "@/components/customer/use-customer";
import type { ConsentEntry } from "@/lib/domain/customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { COPY } from "../../onboarding/copy";

type ConsentType = ConsentEntry["type"];
const REQUIRED: ConsentType[] = ["terms", "privacy"];

export function DataView() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const { data: me, error, loading, reload, locale } = useMe();
  const copy = COPY[locale];

  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (deleted) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <Card className="flex flex-col gap-sp-3">
          <p className="text-body">{t("remove.done")}</p>
          <Link href="/" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
            {t("remove.top")}
          </Link>
        </Card>
      </>
    );
  }

  if (!me) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <ApiStatus error={error} loading={loading} onRetry={reload} />
      </>
    );
  }

  const toggle = async (type: ConsentType, value: boolean) => {
    setNotice(null);
    try {
      await api("/api/customer/consents", { method: "PATCH", json: { type, granted: value } });
      await reload();
    } catch {
      setNotice(t("consents.error"));
    }
  };

  const exportJson = async () => {
    setNotice(null);
    try {
      const response = await fetch("/api/customer/export", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `pibu-export-${me.profile.agentId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t("export.error"));
    }
  };

  const remove = async () => {
    try {
      await api("/api/customer/data", { method: "DELETE" });
      resetDemoState();
      setDeleted(true);
    } catch {
      setNotice(t("remove.error"));
    } finally {
      setConfirming(false);
    }
  };

  const text = (type: ConsentType) =>
    type === "shareWithClinic"
      ? { title: t("consents.shareWithClinic.title"), description: t("consents.shareWithClinic.description") }
      : copy.consents[type];

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>

      <section aria-labelledby="set-agent" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="set-agent" className="text-title font-semi">
            {t("agent.title")}
          </h2>
          <p className="text-label text-muted">{t("agent.lead")}</p>
        </div>
        <AgentCardView card={me.card as AgentCard} labels={copy.agentCard} />
      </section>

      <section aria-labelledby="set-consents" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="set-consents" className="text-title font-semi">
            {t("consents.title")}
          </h2>
          <p className="text-label text-muted">{t("consents.lead")}</p>
        </div>
        {notice ? <p className="text-label text-muted">{notice}</p> : null}
        <ul className="flex flex-col gap-sp-3">
          {me.consents.map((entry) => {
            const info = text(entry.type);
            const fixed = REQUIRED.includes(entry.type);
            return (
              <li key={entry.type} className="flex flex-col gap-sp-2">
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
                    value={entry.granted}
                    onChange={(value) => void toggle(entry.type, value)}
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
        <Button variant="secondary" className="self-start" onClick={() => void exportJson()}>
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
            <Button fullWidth onClick={() => void remove()}>
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
