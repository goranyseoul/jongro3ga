import type { Metadata } from "next";
import "@/styles/ops.css";
import { DemoConsole } from "./demo-console";

export const metadata: Metadata = { title: "데모 컨트롤 · PibooK" };

// The wrapper lives here, not in a layout, so sibling routes such as /demo/ui keep their own look.
export default function DemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-sp-6 px-sp-4 py-sp-6 lg:px-sp-8">
      <DemoConsole />
    </main>
  );
}
