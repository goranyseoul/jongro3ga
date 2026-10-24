import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

// Title, one-line description, optional action: the three levels the UI rules allow.
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-sp-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-sp-1">
        <h1 className="text-h2 font-semi">{title}</h1>
        {description ? <p className="text-body text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
