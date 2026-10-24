import type { Metadata } from "next";
import { PageHeader } from "@/components/ops";
import { ProxyQueueView } from "./proxy-queue-view";

export const metadata: Metadata = { title: "대행 응답 큐" };

export default function OpsProxyQueuePage() {
  return (
    <>
      <PageHeader
        title="대행 응답 큐"
        description="대행 운영 병원의 예약 요청이에요. 병원에 확인한 뒤 확정하거나 거절해 주세요. 직접 운영 병원은 병원 요청함에서 처리해요."
      />
      <ProxyQueueView />
    </>
  );
}
