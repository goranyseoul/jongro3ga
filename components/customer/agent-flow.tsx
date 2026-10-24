"use client";

import { useState, type ReactNode } from "react";
import { LOCALE_NAME } from "@/app/[locale]/locales";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { Timeline } from "@/components/ui/timeline";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { STANDARD_ORDER } from "@/lib/ui-data/directory";

export type AgentFlowCopy = {
  steps: { title: string; body: string }[];
  mock: {
    screens: { chat: string; cards: string; plan: string };
    user: string;
    agent: string;
    clinic: (letter: string) => string;
    passed: (checked: number, total: number) => string;
    plan: { at: string; title: string }[];
    booking: string;
  };
};

export type AgentFlowProps = {
  copy: AgentFlowCopy;
  /** The closing call to action, e.g. the "Browse N clinics in M areas" line. */
  cta: { label: string; onClick: () => void };
};

// How the agent works in three steps (after the Content Architect workflow section): a step list on the left,
// one mock screen per step on the right. The mocks are built from the real UI primitives and carry only
// illustrative placeholders (no clinic names, no prices). Phones show each step with its screen right under it.
export function AgentFlow({ copy, cta }: AgentFlowProps) {
  const [active, setActive] = useState(0);
  const { mock } = copy;

  const screens: ReactNode[] = [
    <MockFrame key="chat" title={mock.screens.chat}>
      <ChatBubble from="user">{mock.user}</ChatBubble>
      <ChatBubble from="agent">{mock.agent}</ChatBubble>
    </MockFrame>,
    <MockFrame key="cards" title={mock.screens.cards}>
      {["A", "B"].map((letter) => (
        <div key={letter} className="flex flex-col gap-sp-2 rounded-card border border-border-soft bg-sunken p-sp-4">
          <div className="flex flex-col gap-sp-1">
            <span className="text-title font-semi">{mock.clinic(letter)}</span>
            <span className="text-caption text-muted">{[LOCALE_NAME.ko, LOCALE_NAME.en, LOCALE_NAME.ja].join(" · ")}</span>
          </div>
          <div className="flex gap-sp-1" aria-hidden="true">
            {STANDARD_ORDER.map((key) => (
              <span key={key} className="h-sp-1 flex-1 rounded-pill bg-brand" />
            ))}
          </div>
          <span className="text-caption font-semi tabular-nums text-brand">
            {mock.passed(STANDARD_ORDER.length, STANDARD_ORDER.length)}
          </span>
        </div>
      ))}
    </MockFrame>,
    <MockFrame key="plan" title={mock.screens.plan}>
      <Timeline
        rawLabel=""
        items={mock.plan.map((item, i) => ({
          id: item.at,
          at: item.at,
          title: item.title,
          detail: i === 1 ? mock.clinic("A") : undefined,
        }))}
      />
      <div className="flex min-h-touch items-center justify-center rounded-md bg-brand text-body font-semi text-on-brand">
        {mock.booking}
      </div>
    </MockFrame>,
  ];

  return (
    <div className="flex flex-col gap-sp-6">
      <div className="grid gap-sp-6 md:grid-cols-5 md:items-center">
        <ol className="flex flex-col gap-sp-6 md:col-span-2 md:gap-sp-2">
          {copy.steps.map((step, i) => {
            const on = i === active;
            return (
              <li key={step.title} className="flex flex-col gap-sp-3">
                <button
                  type="button"
                  aria-current={on ? "step" : undefined}
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setActive(i);
                  }}
                  className={cn(
                    "flex min-h-touch w-full items-start gap-sp-3 rounded-2xl border border-transparent p-sp-4 text-start transition duration-dropdown ease-out md:p-sp-5",
                    on ? "md:border-border md:bg-elev md:shadow-card" : "md:hover:bg-sunken",
                    focusRing,
                  )}
                >
                  <span className="w-sp-6 shrink-0 text-title font-semi tabular-nums text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex min-w-0 flex-col gap-sp-1">
                    <span className="text-title font-semi">{step.title}</span>
                    <span className="text-label text-muted">{step.body}</span>
                  </span>
                </button>
                <div inert className="md:hidden">
                  {screens[i]}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="hidden rounded-3xl border border-border-soft bg-gradient-to-br from-sunken to-elev p-sp-6 md:col-span-3 md:grid">
          {screens.map((screen, i) => (
            <div
              key={copy.steps[i].title}
              inert
              className={cn(
                "col-start-1 row-start-1 transition-opacity duration-modal ease-out",
                i === active ? "opacity-100" : "opacity-0",
              )}
            >
              {screen}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={cta.onClick}
        className={cn(
          "group inline-flex min-h-touch items-center justify-between gap-sp-3 self-start rounded-md border border-border bg-elev px-sp-6 text-body font-semi shadow-card transition duration-press ease-out hover:bg-sunken active:scale-press",
          focusRing,
        )}
      >
        {cta.label}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="size-sp-4 shrink-0 transition duration-dropdown ease-out group-hover:translate-x-sp-1"
        >
          <path d="M3 8h9M8.5 4 12.5 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// One illustrative screen: a quiet title line over the real primitives.
function MockFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-4 rounded-2xl border border-border-soft bg-elev p-sp-4 shadow-card">
      <p className="text-label text-muted">{title}</p>
      {children}
    </div>
  );
}
