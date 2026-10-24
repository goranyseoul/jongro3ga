// The component list is fixed by docs/spec/05-screens.md "공통 컴포넌트"; each needs a file and an export.
import { existsSync, readFileSync } from "node:fs";

const dir = new URL("../components/ui/", import.meta.url);

const expected = {
  Button: "button",
  Input: "input",
  Chip: "chip",
  ChipGroup: "chip-group",
  Card: "card",
  Sheet: "sheet",
  Table: "table",
  Label: "label",
  Stat: "stat",
  Timeline: "timeline",
  ChatBubble: "chat-bubble",
  ChatInput: "chat-input",
  WidgetDateRange: "widget-date-range",
  WidgetSlider: "widget-slider",
  WidgetCurrency: "widget-currency",
  ConsentCard: "consent-card",
  AgentCardView: "agent-card-view",
  JsonViewer: "json-viewer",
  Money: "money",
};

const index = readFileSync(new URL("index.ts", dir), "utf8");
const problems = [];

for (const [name, file] of Object.entries(expected)) {
  const path = new URL(`${file}.tsx`, dir);
  if (!existsSync(path)) {
    problems.push(`${name}: components/ui/${file}.tsx is missing`);
    continue;
  }
  if (!new RegExp(`export function ${name}\\b`).test(readFileSync(path, "utf8"))) {
    problems.push(`${name}: components/ui/${file}.tsx does not export function ${name}`);
  }
  if (!index.includes(`"./${file}"`)) problems.push(`${name}: index.ts does not re-export ./${file}`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`components check passed (${Object.keys(expected).length} components)`);
