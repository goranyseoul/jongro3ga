import type { ExtractMenuItemsInput, MenuItemExtract } from "../tools/menu";
import { UNKNOWN_PROCEDURE } from "../tools/common";
import { matchProcedure } from "./keywords";

// Fixture "가격표 추출": one row per line that names an amount and a price. Real extraction (images, messy
// promotions) needs Claude; this keeps the ops screen usable without a key.

const AMOUNT = /(\d+(?:\.\d+)?)\s*(cc|샷|shot|유닛|unit|바이알|vial|회)/i;
const WON = /(\d[\d,]*)\s*원/;
const MAN_WON = /(\d+(?:\.\d+)?)\s*만\s*원?/;

const UNIT: Record<string, MenuItemExtract["amount"]["unit"]> = {
  cc: "cc",
  샷: "shot",
  shot: "shot",
  유닛: "unit",
  unit: "unit",
  바이알: "vial",
  vial: "vial",
  회: "session",
};

export function menuFixture(text: string): ExtractMenuItemsInput {
  const items: MenuItemExtract[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const amount = AMOUNT.exec(line);
    const won = WON.exec(line);
    const man = MAN_WON.exec(line);
    if (!amount || (!won && !man)) continue;
    const priceKrw = won ? Number(won[1]!.replace(/,/g, "")) : Math.round(Number(man![1]) * 10000);
    const procedureId = matchProcedure(line) ?? UNKNOWN_PROCEDURE;
    items.push({
      procedureId,
      product: line.slice(0, amount.index).trim() || line,
      amount: { value: Number(amount[1]), unit: UNIT[amount[2]!.toLowerCase()] ?? "session" },
      priceKrw,
      vatIncluded: /VAT\s*포함|부가세\s*포함/i.test(line),
      includes: [],
      sourceText: line,
    });
  }
  return { items };
}
