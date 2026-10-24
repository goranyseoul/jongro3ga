import { z } from "zod";
import { procedureMaster } from "../../domain/procedure-master";

// Building blocks shared by the tool and extraction schemas.

/** "HH:MM", 24 hour clock. */
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

export const UNKNOWN_PROCEDURE = "unknown";

const procedureIds = procedureMaster.map((procedure) => procedure.id);

/**
 * A procedure master id (27 entries, data/seed/procedures.json) or "unknown". Sent as an enum so Claude
 * picks from the master and never invents an id (04 "가격표 추출" 2).
 */
export const ProcedureIdOrUnknownSchema = z.enum([UNKNOWN_PROCEDURE, ...procedureIds]);

/** Same without "unknown", for fields where a known procedure is required. */
export const MasterProcedureIdSchema = z.enum(procedureIds as [string, ...string[]]);
