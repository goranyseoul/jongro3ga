import { z } from "zod";
import raw from "../../data/seed/procedures.json";
import { ProcedureSchema, type Procedure } from "./procedure";

// Read only reference data shared by every agent (06-data-model.md allows reading this seed file directly).
// Validation runs at import, so a broken seed fails at startup and not in the middle of a conversation.
const parsed = z
  .array(ProcedureSchema)
  .refine((list) => new Set(list.map((p) => p.id)).size === list.length, "duplicate procedure id")
  .parse(raw);

export const procedureMaster: readonly Procedure[] = parsed;

const byId = new Map(parsed.map((procedure) => [procedure.id, procedure]));

export function getProcedure(id: string): Procedure | undefined {
  return byId.get(id);
}
