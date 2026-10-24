import { cn } from "@/lib/cn";

export type JsonViewerProps = {
  value: unknown;
  className?: string;
};

// Monospace is allowed here only because the content is code, not a UI label (BAN-6).
export function JsonViewer({ value, className }: JsonViewerProps) {
  return (
    <pre
      className={cn(
        "max-h-screen overflow-auto rounded-md border border-border-soft bg-bg p-sp-3 font-mono text-label text-muted",
        className,
      )}
    >
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}
