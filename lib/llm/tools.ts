import { z } from "zod";
import type { ToolSpec } from "./index";

// Tool definitions are written once as zod schemas: the JSON Schema sent to Claude is generated from
// them, and the same schema validates what Claude sends back (09: "도구 ... (zod 검증)").

export interface ZodTool<S extends z.ZodType> {
  spec: ToolSpec;
  schema: S;
}

export function zodTool<S extends z.ZodType>(name: string, description: string, schema: S): ZodTool<S> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input", unrepresentable: "any" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return { spec: { name, description, inputSchema: json }, schema };
}

export type ToolInputResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates a tool input. The error text goes back to Claude as the tool error, so it names paths. */
export function parseToolInput<S extends z.ZodType>(tool: ZodTool<S>, input: unknown): ToolInputResult<z.infer<S>> {
  const parsed = tool.schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: formatZodError(parsed.error) };
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.map(String).join(".") : "(input)"}: ${issue.message}`)
    .join("; ");
}
