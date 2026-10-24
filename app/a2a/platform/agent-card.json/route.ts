import { platformCard } from "../../../../lib/a2a/cards";

// Public platform Agent Card (03 "바인딩과 엔드포인트"). /.well-known/agent-card.json rewrites here (next.config.ts).
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(platformCard());
}
