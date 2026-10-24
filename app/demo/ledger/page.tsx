import type { Metadata } from "next";
import "@/styles/ops.css";
import { LedgerView } from "./ledger-view";

export const metadata: Metadata = { title: "공개 원장 · PibooK" };

// Same frame as /demo: the public view of the record registry that anyone can read from the chain.
export default function LedgerPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-sp-6 px-sp-4 py-sp-6 lg:px-sp-8">
      <LedgerView />
    </main>
  );
}
