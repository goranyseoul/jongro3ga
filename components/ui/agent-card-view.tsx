import { focusRing } from "@/lib/ui";
import { Card, CardHeader } from "./card";
import { JsonViewer } from "./json-viewer";

// Fields of an A2A 1.0 Agent Card that the view shows; the full object still feeds the JSON toggle.
export type AgentCardSkill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
};

export type AgentCard = {
  name: string;
  description: string;
  version: string;
  provider?: { organization: string; url?: string };
  supportedInterfaces: { url: string; protocolBinding: string; protocolVersion: string }[];
  skills: AgentCardSkill[];
  [key: string]: unknown;
};

export type AgentCardViewProps = {
  card: AgentCard;
  labels: { version: string; skills: string; endpoint: string; json: string };
};

export function AgentCardView({ card, labels }: AgentCardViewProps) {
  return (
    <Card className="flex flex-col gap-sp-4">
      <CardHeader title={card.name} description={`${labels.version} ${card.version}`} />
      <p className="text-body text-muted">{card.description}</p>

      <section className="flex flex-col gap-sp-2">
        <h4 className="text-label font-med text-muted">{labels.skills}</h4>
        <ul className="flex flex-col gap-sp-3">
          {card.skills.map((skill) => (
            <li key={skill.id} className="flex flex-col gap-sp-1">
              <span className="text-body font-med">{skill.name}</span>
              <span className="text-label text-muted">{skill.description}</span>
              <span className="text-caption text-subtle">{skill.tags.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </section>

      {card.supportedInterfaces.length > 0 ? (
        <section className="flex flex-col gap-sp-1">
          <h4 className="text-label font-med text-muted">{labels.endpoint}</h4>
          {card.supportedInterfaces.map((entry) => (
            <p key={entry.url} className="break-all text-label tabular-nums">
              {entry.url}
            </p>
          ))}
        </section>
      ) : null}

      <details>
        <summary
          className={`flex min-h-touch cursor-pointer items-center text-label text-muted hover:text-text ${focusRing}`}
        >
          {labels.json}
        </summary>
        <JsonViewer value={card} />
      </details>
    </Card>
  );
}
