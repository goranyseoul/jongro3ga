import type { Metadata } from "next";
import "@/styles/ops.css";
import { WalletView } from "./wallet-view";

export const metadata: Metadata = { title: "브라우저 지갑 · PibooK" };

// The wallet reads localStorage and loads the WASM prover, so everything below the frame is client side.
export default function DemoWalletPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-sp-6 px-sp-4 py-sp-6 lg:px-sp-8">
      <WalletView />
    </main>
  );
}
