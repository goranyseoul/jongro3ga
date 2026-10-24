export interface JsonViewerProps {
  value: unknown;
  summary?: string;
  /** Start expanded. Default is collapsed. */
  open?: boolean;
}

/** Collapsible pretty-printed JSON, used for raw A2A payloads. Code is the only place monospace is used. */
export function JsonViewer({ value, summary = "JSON", open = false }: JsonViewerProps) {
  return (
    <details open={open} className="rounded-md border border-line bg-sunken">
      <summary className="min-h-touch cursor-pointer px-sp-3 py-sp-3 text-sm text-muted">{summary}</summary>
      <pre className="overflow-x-auto px-sp-3 pb-sp-3 font-code text-xs text-text">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
