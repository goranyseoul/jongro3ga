"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { Button } from "./button";
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
  /** Makes the header a sort button. The value orders the rows; empty values go last. */
  sort?: (row: Row) => string | number | null | undefined;
};

export type TablePagination = {
  pageSize: number;
  labels: {
    previous: string;
    next: string;
    /** "1 / 3 페이지 · 24행" */
    summary: (page: number, pages: number, total: number) => string;
  };
};

export type TableProps<Row> = {
  /** Accessible name, not rendered. */
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
  /** Order the rows start in; the column needs a `sort` value. */
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Shows the rows a page at a time with a footer to move between pages. */
  pagination?: TablePagination;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

// Line carets of the design system data grid: both lines while unsorted, one while sorted.
function SortGlyph({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-sp-3 shrink-0", dir ? "text-text" : "text-subtle")}
    >
      {dir === "asc" ? <path d="M7 14l5-5 5 5" /> : dir === "desc" ? <path d="M7 10l5 5 5-5" /> : <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />}
    </svg>
  );
}

function ordered<Row>(rows: Row[], columns: TableColumn<Row>[], sort: Sort): Row[] {
  const column = sort ? columns.find((candidate) => candidate.key === sort.key) : undefined;
  if (!sort || !column?.sort) return rows;
  const value = column.sort;
  const factor = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: value(row) }))
    .sort((a, b) => {
      const aEmpty = a.key === null || a.key === undefined;
      const bEmpty = b.key === null || b.key === undefined;
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const diff = typeof a.key === "number" && typeof b.key === "number" ? a.key - b.key : String(a.key).localeCompare(String(b.key));
      return diff * factor || a.index - b.index;
    })
    .map((entry) => entry.row);
}

// Data table of the design system (PA BaseDataTable, primitives/data-table): a bordered surface, a hairline under
// small muted headers, soft row lines with a hover, numbers on the right in tabular figures. Below md the rows
// become cards.
export function Table<Row>({ caption, columns, rows, rowKey, empty, defaultSort, pagination }: TableProps<Row>) {
  const [sort, setSort] = useState<Sort>(defaultSort ?? null);
  const [page, setPage] = useState(0);

  if (rows.length === 0) {
    return empty ? (
      <div className="rounded-card border border-border bg-elev px-sp-4 py-sp-8 text-center text-body text-muted">{empty}</div>
    ) : null;
  }

  const sorted = ordered(rows, columns, sort);
  const pages = pagination ? Math.max(1, Math.ceil(sorted.length / pagination.pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pagination ? sorted.slice(current * pagination.pageSize, (current + 1) * pagination.pageSize) : sorted;

  const byRole = (role: CardRole) => columns.filter((column) => (column.card ?? "row") === role);

  const toggle = (key: string) =>
    setSort((previous) => (previous?.key === key ? (previous.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  return (
    <div className="flex flex-col gap-sp-3">
      <div className="hidden overflow-hidden rounded-card border border-border bg-elev md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body tabular-nums">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-border">
                {columns.map((column) => {
                  const direction = sort?.key === column.key ? sort.dir : null;
                  const end = column.align === "end";
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={column.sort ? (direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none") : undefined}
                      className={cn("px-sp-3 py-sp-3 text-label font-med text-subtle", end ? "text-end" : "text-start")}
                    >
                      {column.sort ? (
                        <button
                          type="button"
                          onClick={() => toggle(column.key)}
                          className={cn(
                            "inline-flex min-h-touch items-center gap-sp-1 rounded-sm hover:text-text",
                            end && "flex-row-reverse",
                            focusRing,
                          )}
                        >
                          {column.header}
                          <SortGlyph dir={direction} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={rowKey(row)} className="border-b border-border-soft align-top transition-colors duration-press last:border-b-0 hover:bg-sunken">
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
      </div>

      <ul aria-label={caption} className="flex flex-col gap-sp-3 tabular-nums md:hidden">
        {visible.map((row) => (
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

      {pagination && pages > 1 ? (
        <div className="flex items-center justify-between gap-sp-3 text-label text-subtle">
          <span className="tabular-nums" aria-live="polite">
            {pagination.labels.summary(current + 1, pages, sorted.length)}
          </span>
          <div className="flex gap-sp-2">
            <Button variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>
              {pagination.labels.previous}
            </Button>
            <Button variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              {pagination.labels.next}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
