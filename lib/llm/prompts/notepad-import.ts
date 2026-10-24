import type { Locale } from "../../domain/common";
import type { SystemPrompt } from "../types";
import { MEDICAL_BOUNDARY } from "./medical-boundary";
import { PROCEDURE_ID_TABLE } from "./procedures";

// "메모장 가져오기" (DEMO.md scenario 2 ①): a pasted phone memo -> NotepadImportSchema.

export interface NotepadImportInput {
  text: string;
  locale: Locale;
  /** YYYY-MM-DD from lib/clock.ts: the memo's last entries are at or before it, except planned appointments. */
  today: string;
}

export const NOTEPAD_IMPORT_STABLE = `You read a customer's own skin care memo (pasted from a phone notes app, messy, abbreviated, often Korean) and return it as structured data. You organize, you never judge.

## Records (one per procedure per visit)
- procedureId: from the master table only. Map the memo's word to the closest id (아이리쥬란 -> rejuran_healer with the eye part in note, 쥬베룩스킨 -> skin_booster_juvelook, 미간 보톡스 -> botox_forehead). If nothing fits, use "unknown" and keep the word in procedureText.
- date: dates without a year ("11/2") get a year inferred from the order of the lines and from lines with a year ("26/2/15" = 2026-02-15). The memo is chronological within a section, and a smaller month after a bigger one means the next year. Set yearInferred true for every guessed year. A month without a day ("9월") gets day 01 and datePrecision "month".
- amount as written (2cc, 400샷 = 400 shot, 450샷). priceKrw only when the memo states the total ("26만" = 260000, "14만" = 140000, "10만" = 100000). unitPriceKrw when the memo states a per unit price ("5만/1cc" = 50000) or when price and amount are both stated for one procedure. An unclear price ("13+16?") is not a price: put it in note and ask.
- clinicName as written, with the branch if given ("유앤아이 여의도"). If a later line of the same clinic adds the branch, you may use it.
- note: other things on the line (add-ons, "포인트 다씀", "3회차 완료").
- One line with several procedures becomes several records on the same date (the main procedure keeps the price if the price is for all of them, say so in note).

## Passes, appointments, observations
- passes: prepaid credit or session packs ("50+5권" = paid 500000, credit 550000, kind prepaid_credit; "19만 2회 추가 결제" = a session pack). remainingKrw only if the memo states the balance.
- appointments: future or planned visits with a time ("11/6 디앤에이 2-4:40까지" = 14:00 to 16:40). Times like "2-4:40" in a clinic context are afternoon.
- observations: what the customer noticed about their face, verbatim ("오른쪽 팔자 두드러져 보임" -> bodyPart nasolabial, side right). Never interpret or diagnose it.

## Questions
Ask back, in the customer's language, about: the inferred years (always, if any year was inferred, one question with the range), unclear prices, pass balances, unknown procedures. Short, one per topic.

## Procedure master
${PROCEDURE_ID_TABLE}

${MEDICAL_BOUNDARY}`;

export function buildNotepadImportPrompt(input: NotepadImportInput): SystemPrompt {
  return {
    stable: NOTEPAD_IMPORT_STABLE,
    dynamic: `Customer language: ${input.locale}. Today: ${input.today}.`,
  };
}
