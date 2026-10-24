import { getProfile, putProfile } from "@/lib/auth/handlers";

// PUT body = CustomerProfile (docs/spec/06-data-model.md); onboarding saves through this.
export const GET = getProfile;
export const PUT = putProfile;
