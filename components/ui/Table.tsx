import type { ReactNode } from "react";

export interface TableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** Right-align numeric columns. */
  numeric?: boolean;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Column key shown as the card title below md. Defaults to the first column. */
  titleKey?: string;
  empty?: string;
}

/** Table from md up, stacked cards below md (05-screens.md UI rule 4). */
export function Table<Row>({ columns, rows, rowKey, titleKey, empty = "No rows" }: TableProps<Row>) {
  if (rows.length === 0) return <p className="text-body text-subtle">{empty}</p>;
  const titleCol = columns.find((c) => c.key === titleKey) ?? columns[0];
  const rest = columns.filter((c) => c !== titleCol);
  return (
    <div>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-elev md:block">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-line bg-sunken text-left text-sm text-muted">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-sp-4 py-sp-3 font-med ${c.numeric ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line-soft last:border-b-0">
                {columns.map((c) => (
                  <td key={c.key} className={`px-sp-4 py-sp-3 align-top text-text ${c.numeric ? "text-right" : ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-sp-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-card border border-line bg-elev p-sp-4 shadow-card">
            <div className="text-title font-semi text-text">{titleCol.render(r)}</div>
            <dl className="mt-sp-3 flex flex-col gap-sp-2">
              {rest.map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-sp-4">
                  <dt className="text-sm text-muted">{c.header}</dt>
                  <dd className="text-right text-body text-text">{c.render(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
