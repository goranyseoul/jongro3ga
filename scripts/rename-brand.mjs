// Brand name: PibooK (decided 2026-10-24). Writes the new spelling over the old ones, or with --check
// only reports where an old spelling is left and exits 1, which is how prebuild uses it.
//
// Only display spellings are touched. Protocol identifiers (pibu/*@1 schema names, pibu.app extension
// URIs, pibuBearer) never match, and the spec under docs/spec keeps its own wording.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const BRAND = "PibooK";
const OLD = [/PiBoo-K/g, /Pibu-k/g, /Pibuk/g];

const roots = ["app", "components", "lib", "messages", "i18n", "styles", "README.md", "CLAUDE.md", "PLANNING.md", "DEMO.md"];
const extensions = /\.(tsx?|css|json|mjs|md)$/;
const skipDirs = new Set(["node_modules", ".next"]);

function* walk(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isFile()) {
    if (extensions.test(path)) yield path;
    return;
  }
  for (const name of readdirSync(path)) {
    if (skipDirs.has(name)) continue;
    yield* walk(join(path, name));
  }
}

const check = process.argv.includes("--check");
let changed = 0;
const leftovers = [];

for (const entry of roots) {
  for (const file of walk(join(root, entry))) {
    const text = readFileSync(file, "utf8");
    if (check) {
      text.split("\n").forEach((line, index) => {
        if (OLD.some((re) => new RegExp(re.source).test(line))) leftovers.push(`${relative(root, file)}:${index + 1} ${line.trim().slice(0, 100)}`);
      });
      continue;
    }
    const next = OLD.reduce((acc, re) => acc.replace(re, BRAND), text);
    if (next !== text) {
      writeFileSync(file, next);
      changed += 1;
      console.log(`rewrote ${relative(root, file)}`);
    }
  }
}

if (check) {
  if (leftovers.length > 0) {
    console.error(leftovers.join("\n"));
    console.error(`brand check failed: ${leftovers.length} line(s) still use an old spelling, run: node scripts/rename-brand.mjs`);
    process.exit(1);
  }
  console.log(`brand check passed (${BRAND})`);
} else {
  console.log(`${changed} file(s) rewritten`);
}
