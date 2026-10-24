import type { Metadata } from "next";
import { PageHeader } from "@/components/ops";
import { A2ALogView } from "./a2a-log-view";

export const metadata: Metadata = { title: "A2A 로그" };

export default function OpsA2ALogPage() {
  return (
    <>
      <PageHeader
        title="A2A 로그"
        description="에이전트 사이의 모든 A2A 호출이에요. 오래된 호출부터 보여주고, 행을 펼치면 요청과 응답 JSON을 볼 수 있어요."
      />
      <A2ALogView />
    </>
  );
}
