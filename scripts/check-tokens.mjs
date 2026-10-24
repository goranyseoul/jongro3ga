// Fails on values that bypass the design tokens (05-screens.md UI rules 1 and 3).
// `--selftest` proves each detector fires on a known-bad line and stays quiet on a good one.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const scanDirs = ["app", "components", "lib"];
const skipFiles = new Set(["app/globals.css"]);
const monoAllowed = new Set(["components/ui/json-viewer.tsx"]);

// built from code points so this file itself carries no banned characters
const EN_DASH = String.fromCodePoint(0x2013);
const EM_DASH = String.fromCodePoint(0x2014);
const GRINNING_FACE = String.fromCodePoint(0x1f600);

const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const colorUtil =
  "bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|shadow|decoration|caret|placeholder";

const detectors = [
  { id: "hex-color", re: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/ },
  { id: "color-function", re: /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/ },
  { id: "arbitrary-value", re: /-\[\s*(?:-?\d|#|rgb|hsl|oklch)/ },
  { id: "default-palette", re: new RegExp(`\\b(?:${colorUtil})-(?:${palette})(?:-\\d{2,3})?(?![\\w-])`) },
  { id: "emoji", re: /\p{Extended_Pictographic}/u },
  { id: "em-or-en-dash", re: new RegExp(`[${EN_DASH}${EM_DASH}]`) },
  { id: "uppercase", re: /\buppercase\b/ },
  { id: "thick-left-border", re: /\bborder-l-(?:[2-9]|\[)/ },
];

function scanLine(line, file) {
  const hits = detectors.filter((d) => d.re.test(line)).map((d) => d.id);
  if (/\bfont-mono\b/.test(line) && !monoAllowed.has(file)) hits.push("ui-monospace");
  return hits;
}

if (process.argv.includes("--selftest")) {
  const bad = {
    "hex-color": 'const c = "#1a2b3c";',
    "color-function": 'style={{ color: "oklch(0.5 0 0)" }}',
    "arbitrary-value": 'className="w-[37px]"',
    "default-palette": 'className="bg-pink-500"',
    emoji: `const s = "${GRINNING_FACE}";`,
    "em-or-en-dash": `// a ${EM_DASH} b ${EN_DASH} c`,
    uppercase: 'className="uppercase tracking-widest"',
    "thick-left-border": 'className="border-l-4"',
    "ui-monospace": 'className="font-mono"',
  };
  const good = 'className="bg-elev p-sp-4 text-muted rounded-card min-h-touch" href="#main"';
  const failures = [];
  for (const [id, line] of Object.entries(bad)) {
    if (!scanLine(line, "components/ui/x.tsx").includes(id)) failures.push(`detector ${id} missed: ${line}`);
  }
  const falsePositives = scanLine(good, "components/ui/x.tsx");
  if (falsePositives.length > 0) failures.push(`good line flagged: ${falsePositives.join(", ")}`);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`token check selftest passed (${Object.keys(bad).length} detectors)`);
  process.exit(0);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(tsx?|css)$/.test(name)) yield full;
  }
}

let files = 0;
const violations = [];
for (const dir of scanDirs) {
  const abs = join(root, dir);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of walk(abs)) {
    const rel = relative(root, file);
    if (skipFiles.has(rel)) continue;
    files += 1;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const id of scanLine(line, rel)) violations.push(`${rel}:${i + 1} ${id}: ${line.trim()}`);
      });
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  console.error(`token check failed: ${violations.length} violation(s)`);
  process.exit(1);
}
console.log(`token check passed (${files} files)`);
