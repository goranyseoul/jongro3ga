import { Card, CardHeader } from "@/components/ui";

// Shown when nobody from a clinic is signed in (outside DEMO_MODE there is no demo clinic to fall back to).
export function SignedOut() {
  return (
    <Card className="flex flex-col gap-sp-3">
      <CardHeader as="h2" title="병원 계정으로 로그인해 주세요" description="병원 콘솔은 병원 직원 계정으로만 볼 수 있어요" />
    </Card>
  );
}
