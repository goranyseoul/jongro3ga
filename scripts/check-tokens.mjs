// Design token check (docs/spec/05-screens.md UI rules, 10-build-plan.md T01).
// Scans app/ and components/ for hardcoded colors, arbitrary px, default palette classes,
// emoji, em dash and en dash. Hex values are allowed only inside the token definition file.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PALETTE =
  "red|pink|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|slate|gray|zinc|neutral|stone";
const UTILS = "bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|decoration|accent|caret";

export const RULES = [
  { id: "hex-color", re: /#[0-9a-fA-F]{3,8}\b/g, message: "hardcoded hex color", tokenFileExempt: true },
  { id: "arbitrary-px", re: /\[\d+(?:\.\d+)?px\]/g, message: "arbitrary px value" },
  {
    id: "default-palette",
    re: new RegExp(`\\b(?:${UTILS})-(?:${PALETTE})-\\d`, "g"),
    message: "default Tailwind palette color class",
  },
  {
    id: "default-black-white",
    re: new RegExp(`\\b(?:bg|text|border)-(?:white|black)\\b`, "g"),
    message: "default Tailwind black/white class",
  },
  {
    id: "emoji",
    re: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]/gu,
    message: "emoji",
  },
  { id: "em-dash", re: /—/g, message: "em dash (U+2014)" },
  { id: "en-dash", re: /–/g, message: "en dash (U+2013)" },
];

/**
 * Scan one text and return violations.
 * @param {string} text
 * @param {{ isTokenFile?: boolean }} [opts] isTokenFile: hex colors are allowed (token definitions)
 * @returns {{ rule: string; message: string; line: number; match: string }[]}
 */
export function scanText(text, opts = {}) {
  const violations = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.tokenFileExempt && opts.isTokenFile) continue;
      rule.re.lastIndex = 0;
      for (const m of line.matchAll(rule.re)) {
        violations.push({ rule: rule.id, message: rule.message, line: i + 1, match: m[0] });
      }
    }
  });
  return violations;
}

const EXT = new Set([".ts", ".tsx", ".css", ".mdx", ".js", ".jsx", ".mjs"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.has(name.slice(name.lastIndexOf(".")))) yield p;
  }
}

export function checkTree(root, dirs = ["app", "components"]) {
  const tokenFile = join(root, "app", "globals.css");
  const out = [];
  for (const d of dirs) {
    const base = join(root, d);
    try {
      statSync(base);
    } catch {
      continue;
    }
    for (const file of walk(base)) {
      const text = readFileSync(file, "utf8");
      for (const v of scanText(text, { isTokenFile: file === tokenFile })) {
        out.push({ file: relative(root, file).split(sep).join("/"), ...v });
      }
    }
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const violations = checkTree(root);
  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line} ${v.rule}: ${v.message} (${JSON.stringify(v.match)})`);
    console.error(`check-tokens: ${violations.length} violation(s)`);
    process.exit(1);
  }
  console.log("check-tokens: passed (app/, components/)");
}
