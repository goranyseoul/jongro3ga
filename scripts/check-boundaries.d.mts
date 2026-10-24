// Types for check-boundaries.mjs so the vitest positive controls can import it (tsconfig has allowJs: false).
export interface BoundaryViolation {
  file: string;
  kind: "import" | "store";
  detail: string;
}
export declare const IMPORT_RULES: ReadonlyArray<{ from: string; deny: readonly string[] }>;
export declare const STORE_RULES: ReadonlyArray<{ from: string; allow: string }>;
export declare function resolveImport(fromFile: string, specifier: string): string | null;
export declare function violationsFor(file: string, source: string): BoundaryViolation[];
export declare function checkRepo(): { scanned: number; violations: BoundaryViolation[] };
