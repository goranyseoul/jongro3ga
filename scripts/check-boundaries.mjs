// Module boundary check, docs/spec/09-architecture.md "모듈 경계" (00-overview.md principle 2).
// Agents talk to each other over A2A HTTP only, so an agent module must never import another one,
// screens and their BFF see only the customer agent, and lib/zk is a shared library below all agents.
// Store access follows the same rule: a module uses only its own namespace string.
// Usage: node scripts/check-boundaries.mjs   (exit 1 on any violation)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "glowpass", "zk", "chain", "public", "out"]);
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

/** Import rules: files matching `from` may not import modules matching any of `deny`. Paths are repo relative, posix. */
export const IMPORT_RULES = [
  { from: "lib/agents/platform/", deny: ["lib/agents/customer/", "lib/agents/clinic/"] },
  { from: "lib/agents/platform/matching", deny: ["lib/agents/platform/settlement"] },
  { from: "lib/agents/platform/fairness", deny: ["lib/agents/platform/settlement"] },
  { from: "lib/agents/customer/", deny: ["lib/agents/platform/", "lib/agents/clinic/"] },
  { from: "lib/agents/clinic/", deny: ["lib/agents/customer/", "lib/agents/platform/"] },
  { from: "app/[locale]/", deny: ["lib/agents/platform/", "lib/agents/clinic/"] },
  { from: "app/api/customer/", deny: ["lib/agents/platform/", "lib/agents/clinic/"] },
  { from: "lib/zk/", deny: ["lib/agents/"] },
];

/** Store namespace rules: files under `from` may use only `allow` among the agent namespaces. "shared" is open to all. */
export const STORE_RULES = [
  { from: "lib/agents/platform/", allow: "platform" },
  { from: "lib/agents/customer/", allow: "customer" },
  { from: "lib/agents/clinic/", allow: "clinic" },
  { from: "app/[locale]/", allow: "customer" },
  { from: "app/api/customer/", allow: "customer" },
  { from: "app/api/clinic/", allow: "clinic" },
  { from: "app/api/ops/", allow: "platform" },
];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const STORE_RE = /\bstore\.(get|list|put|remove)\(\s*"(platform|clinic|customer)"/g;

const toPosix = (p) => p.split("\\").join("/");

/** Resolves an import specifier to a repo relative posix path, or null for packages. */
export function resolveImport(fromFile, specifier) {
  let target;
  if (specifier.startsWith("@/")) target = specifier.slice(2);
  else if (specifier.startsWith(".")) target = toPosix(relative(ROOT, resolve(ROOT, dirname(fromFile), specifier)));
  else return null;
  return posix.normalize(target);
}

/** Violations in one file. `file` is repo relative posix; `source` its text. */
export function violationsFor(file, source) {
  const out = [];
  for (const rule of IMPORT_RULES) {
    if (!file.startsWith(rule.from)) continue;
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      const target = resolveImport(file, specifier);
      if (target === null) continue;
      const hit = rule.deny.find((deny) => target.startsWith(deny));
      if (hit) out.push({ file, kind: "import", detail: `imports ${specifier} (${target}) which is under ${hit}` });
    }
  }
  for (const rule of STORE_RULES) {
    if (!file.startsWith(rule.from)) continue;
    for (const match of source.matchAll(STORE_RE)) {
      if (match[2] !== rule.allow) {
        out.push({ file, kind: "store", detail: `store.${match[1]}("${match[2]}", ...) but this module owns "${rule.allow}"` });
      }
    }
  }
  return out;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((ext) => name.endsWith(ext))) yield full;
  }
}

export function checkRepo() {
  const violations = [];
  let scanned = 0;
  for (const dir of SCAN_DIRS) {
    let entries;
    try {
      entries = [...walk(join(ROOT, dir))];
    } catch {
      continue;
    }
    for (const full of entries) {
      scanned += 1;
      const file = toPosix(relative(ROOT, full));
      violations.push(...violationsFor(file, readFileSync(full, "utf8")));
    }
  }
  return { scanned, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { scanned, violations } = checkRepo();
  for (const v of violations) console.error(`boundary violation (${v.kind}): ${v.file}: ${v.detail}`);
  console.log(`scanned ${scanned} files, ${violations.length} boundary violation(s)`);
  process.exit(violations.length === 0 ? 0 : 1);
}
