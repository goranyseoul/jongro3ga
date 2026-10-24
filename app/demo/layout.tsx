import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/ops.css";

export const metadata: Metadata = { title: "데모 컨트롤 · Pibu" };

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-sp-6 px-sp-4 py-sp-6 lg:px-sp-8">{children}</main>;
}
