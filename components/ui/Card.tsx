import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  caption?: ReactNode;
}

/** Plain elevated surface with a full border. No accent border on a single side. */
export function Card({ title, caption, className, children, ...rest }: CardProps) {
  return (
    <div className={cx("rounded-card border border-line bg-elev p-sp-4 shadow-card", className)} {...rest}>
      {title ? <h3 className="text-title font-semi text-text">{title}</h3> : null}
      {caption ? <p className="mt-sp-1 text-sm text-muted">{caption}</p> : null}
      {children ? <div className={title || caption ? "mt-sp-3" : undefined}>{children}</div> : null}
    </div>
  );
}
