import { redirect } from "next/navigation";

// The landing is the onboarding chat now (owner decision 2026-10-24); keep old links working.
export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
