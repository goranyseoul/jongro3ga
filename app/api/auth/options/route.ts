import { authOptions } from "@/lib/auth/handlers";

// Which sign-in methods the UI shows: Google only with GOOGLE_CLIENT_ID/SECRET, demo accounts only in DEMO_MODE.
export const dynamic = "force-dynamic";
export const GET = authOptions;
