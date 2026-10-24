// GET /api/zk/ledger: public record ledger summary (pseudonym, hash version, tx on Base Sepolia).
// Everything here is already public on chain, so no session is needed.
import { ledgerSummary, zkEnabled } from "../../../../lib/zk";

export async function GET(request: Request) {
  if (!zkEnabled()) return Response.json({ status: "off", ledger: null });
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 10);
  const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 0), 50) : 10;
  const ledger = await ledgerSummary(limit);
  if (!ledger) return Response.json({ status: "unavailable", ledger: null });
  return Response.json({ status: "ok", ledger });
}
