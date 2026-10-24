import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * How a column is laid out once the table turns into cards (below md):
 * title: card heading, row: "label / value" pair, caption: small footer line,
 * action: full-width footer, hidden: table only.
 */
export type CardRole = "title" | "row" | "caption" | "action" | "hidden";

export type TableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "start" | "end";
  card?: CardRole;
};

export type TableProps<Row> = {
  /** Accessible name, not rendered. */
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
};

export function Table<Row>({ caption, columns, rows, rowKey, empty }: TableProps<Row>) {
  if (rows.length === 0) {
    return empty ? <div className="text-body text-muted">{empty}</div> : null;
  }

  const byRole = (role: CardRole) => columns.filter((column) => (column.card ?? "row") === role);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-body tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-sp-3 py-sp-2 text-label font-med text-muted",
                    column.align === "end" ? "text-end" : "text-start",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border-soft align-top">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-sp-3 py-sp-3", column.align === "end" ? "text-end" : "text-start")}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={caption} className="flex flex-col gap-sp-3 tabular-nums md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <Card className="flex flex-col gap-sp-3">
              {byRole("title").map((column) => (
                <div key={column.key} className="text-title font-semi">
                  {column.cell(row)}
                </div>
              ))}
              {byRole("row").length > 0 ? (
                <dl className="flex flex-col gap-sp-2">
                  {byRole("row").map((column) => (
                    <div key={column.key} className="flex items-baseline justify-between gap-sp-3">
                      <dt className="text-label text-muted">{column.header}</dt>
                      <dd className="text-end text-body">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {byRole("caption").map((column) => (
                <p key={column.key} className="text-caption text-subtle">
                  {column.cell(row)}
                </p>
              ))}
              {byRole("action").map((column) => (
                <div key={column.key} className="flex flex-col">
                  {column.cell(row)}
                </div>
              ))}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
