// Masks sensitive values before a payload is stored in the A2A log or shown on an ops screen.
// Fields from 06-data-model.md "A2ALogEntry": safetyInfo.*, guest.contactHandle, passportName, contact.*.
export const MASK = "[masked]";

/** Objects whose every field is sensitive: the keys stay visible, the values do not. */
const SENSITIVE_OBJECTS = new Set(["safety", "safetyInfo", "contact"]);

/** Fields that are sensitive wherever they appear. */
const SENSITIVE_FIELDS = new Set(["passportName", "contactHandle"]);

export interface MaskOptions {
  /**
   * More field names to treat as sensitive, for example the keys a clinic flagged `sensitive: true`
   * in a pibu/input-request@1 and that now come back inside input-response values.
   */
  extraFields?: readonly string[];
}

/** Returns a masked deep copy. The input is never modified, and masking twice changes nothing. */
export function maskSensitive<T>(value: T, options: MaskOptions = {}): T {
  const extra = new Set(options.extraFields ?? []);
  return walk(value, extra) as T;
}

function walk(value: unknown, extra: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => walk(item, extra));
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (SENSITIVE_FIELDS.has(key) || extra.has(key)) return [key, MASK];
      if (SENSITIVE_OBJECTS.has(key)) return [key, maskLeaves(child)];
      return [key, walk(child, extra)];
    }),
  );
}

function maskLeaves(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return MASK;
  return Object.fromEntries(Object.keys(value).map((key) => [key, MASK]));
}
