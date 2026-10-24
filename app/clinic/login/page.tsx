import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicLoginView } from "./login-view";

export const metadata: Metadata = { title: "로그인" };

export default function ClinicLoginPage() {
  return (
    <Suspense fallback={null}>
      <ClinicLoginView />
    </Suspense>
  );
}
