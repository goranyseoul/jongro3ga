import type { Metadata } from "next";
import { Suspense } from "react";
import { OpsLoginView } from "./login-view";

export const metadata: Metadata = { title: "로그인" };

export default function OpsLoginPage() {
  return (
    <Suspense fallback={null}>
      <OpsLoginView />
    </Suspense>
  );
}
