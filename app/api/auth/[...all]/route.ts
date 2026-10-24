import { authHandler } from "@/lib/auth/handlers";

// Better Auth endpoints under /api/auth (lib/auth/server.ts).
export const GET = authHandler;
export const POST = authHandler;
