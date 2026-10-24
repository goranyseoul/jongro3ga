import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-border-soft bg-elev p-sp-4 shadow-card", className)} {...rest} />;
}

export type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3" | "h4";
};

// Title, optional description, optional right-side action: three levels at most.
export function CardHeader({ title, description, action, as: Heading = "h3" }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-sp-3">
      <div className="flex min-w-0 flex-col gap-sp-1">
        <Heading className="text-title font-semi">{title}</Heading>
        {description ? <p className="text-label text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
