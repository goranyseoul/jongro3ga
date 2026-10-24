// Guards the token contract: 05-screens.md names must exist in globals.css and
// tailwind.config.ts may only reference variables that globals.css defines.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const config = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");

const defined = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));

// docs/spec/05-screens.md, UI rules item 2
const required = [
  "--bg", "--bg-elev", "--bg-sunken", "--border", "--border-soft",
  "--text", "--text-muted", "--text-subtle",
  "--brand", "--highlight", "--success", "--warning", "--danger", "--info",
  "--t-display", "--t-h1", "--t-h2", "--t-title", "--t-body", "--t-sm", "--t-xs",
  "--w-reg", "--w-med", "--w-semi",
  "--sp-1", "--sp-2", "--sp-3", "--sp-4", "--sp-5", "--sp-6", "--sp-8", "--sp-12", "--sp-16",
  "--r-sm", "--r-md", "--r-card", "--r-xl", "--r-pill",
  "--sh-card", "--sh-pop",
];

const problems = [];

for (const name of required) {
  if (!defined.has(name)) problems.push(`globals.css does not define ${name}`);
}

const used = new Set([...config.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
for (const name of used) {
  if (!defined.has(name)) problems.push(`tailwind.config.ts uses ${name} but globals.css does not define it`);
}

// font variables come from next/font at runtime, everything else must be literal-free
const literal = config.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/);
if (literal) problems.push(`tailwind.config.ts contains a literal color: ${literal[0]}`);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`token map check passed (${required.length} required, ${used.size} mapped)`);
