import type { Metadata } from "next";
import { MenuEditor } from "@/components/clinic/menu-editor";
import { PageHeader } from "@/components/clinic/page-header";
import { SignedOut } from "@/components/clinic/signed-out";
import { getMenu } from "@/lib/agents/clinic/console";
import { currentClinicId } from "../console-session";

export const metadata: Metadata = { title: "메뉴·가격" };

export default async function ClinicMenuPage() {
  const clinicId = await currentClinicId();

  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader
        title="메뉴·가격"
        description="여기서 고친 가격과 이벤트가 고객 에이전트의 견적과 이달 이벤트에 그대로 쓰여요"
      />
      {clinicId ? <MenuEditor initial={await getMenu(clinicId)} /> : <SignedOut />}
    </div>
  );
}
