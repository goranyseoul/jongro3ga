import type { Metadata } from "next";
import { RulesView } from "./rules-view";

export const metadata: Metadata = { title: "연결 규칙" };

export default function OpsRulesPage() {
  return <RulesView />;
}
