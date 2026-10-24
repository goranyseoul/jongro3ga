import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";
import { z } from "zod";

// zod 4 -> JSON Schema for strict tools and structured outputs.
//
// z.toJSONSchema does the conversion. Strict mode accepts types, enum, const, anyOf, allOf, a few string
// formats, minItems 0 or 1, and requires additionalProperties: false on every object; it rejects numeric and
// string length constraints. This pass keeps what strict mode takes, closes every object, and moves the rest
// into the description so Claude still reads it. Nothing is lost on our side: every tool input and extraction
// output is validated again with the original zod schema.
//
// The SDK's own transformJSONSchema (used by zodOutputFormat) also moves `enum` and `const` into the
// description, which drops the very constraint that keeps procedure ids inside the master. Hence this file.

export type JsonSchema = Record<string, unknown>;

const SUPPORTED_FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"]);
/** z.int() emits these bounds on every integer; they say nothing to the model. */
const NOISE_BOUNDS = new Set([Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]);

function describe(base: unknown, extra: Record<string, unknown>): string | undefined {
  const entries = Object.entries(extra).filter(([, value]) => value !== undefined && !(typeof value === "number" && NOISE_BOUNDS.has(value)));
  const note = entries.length > 0 ? `(${entries.map(([key, value]) => `${key} ${JSON.stringify(value)}`).join(", ")})` : "";
  const text = [typeof base === "string" ? base : "", note].filter(Boolean).join(" ");
  return text === "" ? undefined : text;
}

function strictNode(node: JsonSchema): JsonSchema {
  const { description, title: _title, $schema: _schema, ...rest } = node;
  void _title;
  void _schema;

  if (Array.isArray(rest.anyOf) || Array.isArray(rest.oneOf)) {
    const variants = (rest.anyOf ?? rest.oneOf) as JsonSchema[];
    return clean({ anyOf: variants.map(strictNode), description });
  }
  if (Array.isArray(rest.allOf)) return clean({ allOf: (rest.allOf as JsonSchema[]).map(strictNode), description });

  const { type, enum: enumValues, const: constValue } = rest;
  const out: JsonSchema = { type };
  if (enumValues !== undefined) out.enum = enumValues;
  if (constValue !== undefined) out.const = constValue;

  if (type === "object") {
    const properties = (rest.properties ?? {}) as Record<string, JsonSchema>;
    out.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, strictNode(value)]));
    out.additionalProperties = false;
    out.required = Array.isArray(rest.required) ? rest.required : [];
    out.description = describe(description, {});
  } else if (type === "array") {
    if (rest.items !== undefined) out.items = strictNode(rest.items as JsonSchema);
    const minItems = rest.minItems as number | undefined;
    if (minItems === 0 || minItems === 1) out.minItems = minItems;
    out.description = describe(description, {
      minItems: minItems !== undefined && minItems > 1 ? minItems : undefined,
      maxItems: rest.maxItems,
    });
  } else if (type === "string") {
    const format = rest.format as string | undefined;
    const formatKept = format !== undefined && SUPPORTED_FORMATS.has(format);
    if (formatKept) out.format = format;
    out.description = describe(description, {
      format: formatKept ? undefined : format,
      // A kept format already says it all (zod adds a long regex to iso dates).
      pattern: formatKept || enumValues !== undefined || constValue !== undefined ? undefined : rest.pattern,
      minLength: rest.minLength === 1 ? undefined : rest.minLength,
      maxLength: rest.maxLength,
    });
  } else if (type === "number" || type === "integer") {
    out.description = describe(description, {
      minimum: rest.minimum,
      exclusiveMinimum: rest.exclusiveMinimum,
      maximum: rest.maximum,
      exclusiveMaximum: rest.exclusiveMaximum,
    });
  } else {
    out.description = describe(description, {});
  }
  return clean(out);
}

function clean(node: JsonSchema): JsonSchema {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined));
}

export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { io: "input", reused: "inline", unrepresentable: "any" }) as JsonSchema;
  return strictNode(raw);
}

/**
 * Structured output format for client.messages.parse: our strict schema, parsed back with the zod schema.
 * A zod failure throws inside the SDK as an AnthropicError, which llm.extract retries once.
 */
export function strictOutputFormat<T>(schema: z.ZodType<T>): AutoParseableOutputFormat<T> {
  return {
    type: "json_schema",
    schema: toStrictJsonSchema(schema),
    parse: (content: string) => schema.parse(JSON.parse(content)),
  };
}

/** Walks a schema and returns the paths of object nodes that are not closed or lack `required`. Used by tests. */
export function openObjectPaths(schema: unknown, path = "$"): string[] {
  if (Array.isArray(schema)) return schema.flatMap((item, index) => openObjectPaths(item, `${path}[${index}]`));
  if (schema === null || typeof schema !== "object") return [];
  const record = schema as Record<string, unknown>;
  const own =
    record.type === "object" && (record.additionalProperties !== false || !Array.isArray(record.required)) ? [path] : [];
  return [...own, ...Object.entries(record).flatMap(([key, value]) => openObjectPaths(value, `${path}.${key}`))];
}

/** Keywords strict mode rejects. Used by tests to prove the transform removed them. */
export const UNSUPPORTED_KEYWORDS = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "pattern", "multipleOf", "propertyNames", "patternProperties"] as const;

export function unsupportedKeywordPaths(schema: unknown, path = "$"): string[] {
  if (Array.isArray(schema)) return schema.flatMap((item, index) => unsupportedKeywordPaths(item, `${path}[${index}]`));
  if (schema === null || typeof schema !== "object") return [];
  const record = schema as Record<string, unknown>;
  // A `properties` map holds property names, not keywords.
  const isPropertyMap = path.endsWith(".properties");
  const own = isPropertyMap ? [] : UNSUPPORTED_KEYWORDS.filter((keyword) => keyword in record).map((keyword) => `${path}.${keyword}`);
  const tooManyItems = typeof record.minItems === "number" && record.minItems > 1 ? [`${path}.minItems`] : [];
  return [
    ...own,
    ...tooManyItems,
    ...Object.entries(record).flatMap(([key, value]) => unsupportedKeywordPaths(value, `${path}.${key}`)),
  ];
}
