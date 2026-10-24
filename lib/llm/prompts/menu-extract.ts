import type { SystemPrompt } from "../types";
import { PROCEDURE_ID_TABLE } from "./procedures";

// Price list and promotional text extraction (04 "가격표 추출", ops "대행 병원 생성").

export interface MenuExtractInput {
  /** Pasted SMS, KakaoTalk promotion or homepage price text. Images go in the user message as image blocks. */
  text: string;
  clinicName?: string;
  today: string;
}

export const MENU_EXTRACT_STABLE = `You extract a Korean dermatology clinic's price list into rows for an operator to confirm. Copy, never estimate.

- One row per procedure, product and amount. priceKrw as stated (원; "9.9만" = 99000). vatIncluded true only if the text says VAT is included ("VAT 포함", "부가세 포함").
- procedureId: from the master table only, else "unknown".
- product: the brand or product name as written (e.g. "Rejuran Healer"); if none is written use the procedure name.
- An event or discount row gets event.title and whatever of regularPriceKrw, validFrom, validUntil, conditions the text states. Leave out what it does not state.
- foreignerSamePrice only if the text says it.
- sourceText: the line the row came from, verbatim.

## Procedure master
${PROCEDURE_ID_TABLE}`;

export function buildMenuExtractPrompt(input: MenuExtractInput): SystemPrompt {
  return {
    stable: MENU_EXTRACT_STABLE,
    dynamic: `Today: ${input.today}.${input.clinicName ? ` Clinic: ${input.clinicName}.` : ""}`,
  };
}
