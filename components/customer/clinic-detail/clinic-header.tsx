import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import type { DirectoryTopic } from "@/lib/ui-data/directory";
import { AskButton } from "./ask-button";

export function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/clinics"
      className={cn("inline-flex min-h-touch items-center gap-sp-1 self-start text-label text-muted hover:text-text", focusRing)}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-sp-4">
        <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}

export type ClinicHeaderProps = {
  name: string;
  tagline: string;
  areaName: string;
  address: string;
  mapHref: string;
  openMapLabel: string;
  newTabLabel: string;
  ctaLabel: string;
  ctaProcedure: string;
  askText: string;
  askTopic: DirectoryTopic;
};

// Name, one-line introduction, place with a maps link, and the main call to action.
export function ClinicHeader(props: ClinicHeaderProps) {
  return (
    <header className="flex flex-col gap-sp-4">
      <div className="flex flex-col gap-sp-2">
        <h1 className="text-balance text-h1 font-semi">{props.name}</h1>
        <p className="text-title text-muted">{props.tagline}</p>
      </div>
      <div className="flex flex-col gap-x-sp-4 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="cu-wrap min-w-0 text-body text-muted">
          {props.areaName} · {props.address}
        </p>
        <a
          href={props.mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("inline-flex min-h-touch items-center self-start text-body text-text underline", focusRing)}
        >
          {props.openMapLabel}
          <span className="sr-only"> ({props.newTabLabel})</span>
        </a>
      </div>
      <AskButton size="lg" text={props.askText} topic={props.askTopic} className="w-full py-sp-2 text-center sm:w-auto sm:self-start">
        <span className="cd-phrase text-balance">
          {props.ctaLabel}: <span className="whitespace-nowrap">{props.ctaProcedure}</span>
        </span>
      </AskButton>
    </header>
  );
}
