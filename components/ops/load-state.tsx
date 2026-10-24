import { Button } from "@/components/ui";

export type LoadStateProps = {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** What is loading, e.g. "병원 목록". */
  what: string;
};

// Loading and failure text for a block that waits on the ops API: plain muted text, no banner.
export function LoadState({ loading, error, onRetry, what }: LoadStateProps) {
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-sp-3">
        <p className="text-body text-danger">
          {what}을 불러오지 못했어요. {error}
        </p>
        {onRetry ? (
          <Button variant="ghost" onClick={onRetry}>
            다시 불러오기
          </Button>
        ) : null}
      </div>
    );
  }
  if (loading) return <p className="text-body text-muted">{what}을 불러오는 중이에요.</p>;
  return null;
}
