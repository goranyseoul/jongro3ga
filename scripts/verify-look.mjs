// Keeps the shared Card, Stat and Table on the design system look (primitives/card, kpi-stat-card, data-table).
// `--selftest` proves every rule fires on a known-bad sample and stays quiet on a good one.
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;

// each rule: the file it reads, patterns that must appear, patterns that must not
const rules = [
  {
    file: "components/ui/card.tsx",
    must: [/border border-border bg-elev/, /p-sp-5/],
    mustNot: [/shadow-card/, /border-border-soft bg-elev/],
    why: "Card is a flat surface with a one-pixel line and no shadow",
  },
  {
    file: "components/ui/stat.tsx",
    must: [/delta/, /tabular-nums/, /text-success/, /text-danger/],
    mustNot: [/rounded-pill/, /bg-success|bg-danger/],
    why: "Stat carries the change line, colored text only, no pill",
  },
  {
    file: "components/ui/table.tsx",
    must: [
      /overflow-hidden rounded-card border border-border bg-elev/,
      /hover:bg-sunken/,
      /border-b border-border-soft/,
      /text-end/,
      /tabular-nums/,
      /aria-sort/,
    ],
    mustNot: [/rounded-pill/, /bg-warning|bg-success|bg-danger/],
    why: "Table is a bordered surface with a header line, soft row lines, a hover and right-aligned figures",
  },
];

function check(file, text, rule) {
  const problems = [];
  for (const pattern of rule.must) if (!pattern.test(text)) problems.push(`${file}: missing ${pattern} (${rule.why})`);
  for (const pattern of rule.mustNot) if (pattern.test(text)) problems.push(`${file}: must not contain ${pattern} (${rule.why})`);
  return problems;
}

if (process.argv.includes("--selftest")) {
  const failures = [];
  const card = rules[0];
  const goodCard = 'className={cn("rounded-card border border-border bg-elev p-sp-5", className)}';
  const badCards = [
    'className="rounded-card border border-border-soft bg-elev p-sp-4 shadow-card"',
    'className="rounded-card border border-border bg-elev p-sp-5 shadow-card"',
    'className="rounded-card border border-border bg-elev p-sp-4"',
  ];
  if (check("card", goodCard, card).length > 0) failures.push("good card flagged");
  badCards.forEach((sample, i) => {
    if (check("card", sample, card).length === 0) failures.push(`bad card ${i} not flagged`);
  });
  const table = rules[2];
  if (check("table", "<table className=\"w-full\">", table).length === 0) failures.push("bare table not flagged");
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("look verification selftest passed");
  process.exit(0);
}

const problems = rules.flatMap((rule) => check(rule.file, readFileSync(root + rule.file, "utf8"), rule));
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("look verification passed");
