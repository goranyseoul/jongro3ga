import type { Metadata } from "next";
import { InboxBoard } from "@/components/clinic/inbox-board";
import { PageHeader } from "@/components/clinic/page-header";
import { SignedOut } from "@/components/clinic/signed-out";
import { getInbox } from "@/lib/agents/clinic/console";
import { currentClinicId } from "../console-session";

export const metadata: Metadata = { title: "요청함" };

export default async function ClinicInboxPage() {
  const clinicId = await currentClinicId();

  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader
        title="요청함"
        description="고객 에이전트가 보낸 견적·예약 요청이에요. 견적은 메뉴 데이터로 자동 응답하고, 예약은 직접 확정해요"
      />
      {clinicId ? <InboxBoard initialTasks={await getInbox(clinicId)} /> : <SignedOut />}
    </div>
  );
}
