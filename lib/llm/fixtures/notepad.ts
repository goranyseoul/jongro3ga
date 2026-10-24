import type { NotepadImport, NotepadRecord } from "../tools/notepad";
import { UNKNOWN_PROCEDURE } from "../tools/common";
import { matchProcedure } from "./keywords";

// Fixture "메모장 가져오기". Jisu's memo (DEMO.md scenario 2 ①, the planner's real phone memo) has a hand
// checked answer; any other text goes through a small line parser so fixture mode still returns something.
//
// Years: the memo is chronological per section and the first dated line with a year is 26/2/15. The rejuran
// section (12/7, 1/11, 4/21, 8/3, 8/9, then 26/2/15) pins 12/7 to 2024 and the rest to 2025, and 4/21 is the same
// 데이뷰 visit in the Juvelook section, so 11/2 and 12/21 are 2024, 1/25 to 12/16 are 2025, 1/6 and 5/4 are 2026.
// The 11/6 appointment comes after 26/9/11, so 2026.

export const JISU_MEMO = `피부 리포트

쥬베룩 볼륨
11/2 2cc 플래져
12/21 2 cc 플레져
1/25 2cc 플레져 강남

4/21 3 cc 데이뷰 여의도 (보톡스)

9/9 3cc 뷰티라운지 잠실 (5만/1cc)

9월 뷰티라운지 눈밑 쥬베룩

10/24 3cc 뷰티라운지 잠실

12/16 쥬베룩아이 뷰티라운지 (19만 2회 추가 결제)

1/6 쥬베룩아이 뷰티라운지 2회
    볼륨 3cc.
    미간 보톡

5/4 쥬베룩아이 3회차 (완 포)

리쥬란
12/7 2cc 밴스(쥬베룩스킨 1 피코토닝)
1/11 밴스
4/21 2 cc 데이뷰(+ ldm)

8/3 아이리쥬란 1cc 10만 닥터쁘띠의원 홍대입구역
8/9 리쥬란 4cc 13+16? 유앤아이

26/2/15 리쥬란 2cc 14만 나비존 밴스 일산 ( 아쿠아필 포인트 다씀)
26/2/24 아이리쥬란 1cc 10만 닥터에버스 잠실

26/4/30 리쥬란 2cc 밴스성수( 스킨보톡스 3cc 슈링크 400샷 )

26/9/11 리쥬란 2cc 아이리쥬란 1cc 26만유앤아이 여의도 (50+5권 끊음)

그 외
8/9 슈링크 400샷 대략 7만 유앤아이
8/9 인모드 포마 유앤아이

26/3/21 써마지 450샷 툰페이스 쪼굼 릴팅의원

보톡스 (미간)
4/21 데이뷰
8/9 유앤 아이

유앤아이 여의도 59500원

뷰티라운지 잠실 51만원 무이자 3개월 결제

11/6
디앤에이 2-4:40까지
튠페이스 엑소좀 두피등 (오른쪽 팔자 두드러져 보임)`;

/** Lines the memo wrote with a year ("26/2/15"). Every other date had its year inferred. */
const WRITTEN_WITH_YEAR = new Set(["2026-02-15", "2026-02-24", "2026-03-21", "2026-04-30", "2026-09-11"]);

type R = NotepadRecord;
const rec = (
  procedureId: string,
  procedureText: string,
  date: string,
  rest: Partial<Omit<R, "procedureId" | "procedureText" | "date">> = {},
): R => ({
  procedureId,
  procedureText,
  date,
  datePrecision: "day",
  yearInferred: !WRITTEN_WITH_YEAR.has(date),
  ...rest,
});
const cc = (value: number) => ({ value, unit: "cc" as const });
const shot = (value: number) => ({ value, unit: "shot" as const });

export const JISU_NOTEPAD_IMPORT: NotepadImport = {
  records: [
    rec("juvelook_volume", "쥬베룩 볼륨", "2024-11-02", { amount: cc(2), clinicName: "플래져" }),
    rec("juvelook_volume", "쥬베룩 볼륨", "2024-12-21", { amount: cc(2), clinicName: "플레져" }),
    rec("juvelook_volume", "쥬베룩 볼륨", "2025-01-25", { amount: cc(2), clinicName: "플레져 강남" }),
    rec("juvelook_volume", "쥬베룩 볼륨", "2025-04-21", { amount: cc(3), clinicName: "데이뷰 여의도", note: "같은 날 보톡스" }),
    rec("juvelook_volume", "쥬베룩 볼륨", "2025-09-09", { amount: cc(3), unitPriceKrw: 50000, clinicName: "뷰티라운지 잠실" }),
    rec("juvelook_eye", "눈밑 쥬베룩", "2025-09-01", { datePrecision: "month", clinicName: "뷰티라운지 잠실" }),
    rec("juvelook_volume", "쥬베룩 볼륨", "2025-10-24", { amount: cc(3), clinicName: "뷰티라운지 잠실" }),
    rec("juvelook_eye", "쥬베룩아이", "2025-12-16", { clinicName: "뷰티라운지 잠실", note: "19만 원에 2회 추가 결제" }),
    rec("juvelook_eye", "쥬베룩아이", "2026-01-06", { clinicName: "뷰티라운지 잠실", note: "2회차" }),
    rec("juvelook_volume", "볼륨", "2026-01-06", { amount: cc(3), clinicName: "뷰티라운지 잠실" }),
    rec("botox_forehead", "미간 보톡", "2026-01-06", { clinicName: "뷰티라운지 잠실", note: "미간" }),
    rec("juvelook_eye", "쥬베룩아이", "2026-05-04", { clinicName: "뷰티라운지 잠실", note: "3회차, 완료 (병원은 회차권 기준 추정)" }),
    rec("rejuran_healer", "리쥬란", "2024-12-07", { amount: cc(2), clinicName: "밴스" }),
    rec("skin_booster_juvelook", "쥬베룩스킨", "2024-12-07", { clinicName: "밴스", note: "쥬베룩스킨 1" }),
    rec("pico_toning", "피코토닝", "2024-12-07", { clinicName: "밴스" }),
    rec("rejuran_healer", "리쥬란", "2025-01-11", { clinicName: "밴스" }),
    rec("rejuran_healer", "리쥬란", "2025-04-21", { amount: cc(2), clinicName: "데이뷰 여의도", note: "LDM 함께" }),
    rec("rejuran_healer", "아이리쥬란", "2025-08-03", {
      amount: cc(1),
      priceKrw: 100000,
      unitPriceKrw: 100000,
      clinicName: "닥터쁘띠의원 홍대입구역",
      note: "눈가",
    }),
    rec("rejuran_healer", "리쥬란", "2025-08-09", { amount: cc(4), clinicName: "유앤아이", note: "금액 메모 13+16?" }),
    rec("rejuran_healer", "리쥬란", "2026-02-15", {
      amount: cc(2),
      priceKrw: 140000,
      unitPriceKrw: 70000,
      clinicName: "밴스 일산",
      note: "나비존",
    }),
    rec("aqua_peel", "아쿠아필", "2026-02-15", { clinicName: "밴스 일산", note: "포인트 사용" }),
    rec("rejuran_healer", "아이리쥬란", "2026-02-24", {
      amount: cc(1),
      priceKrw: 100000,
      unitPriceKrw: 100000,
      clinicName: "닥터에버스 잠실",
      note: "눈가",
    }),
    rec("rejuran_healer", "리쥬란", "2026-04-30", { amount: cc(2), clinicName: "밴스 성수" }),
    rec("skin_botox", "스킨보톡스", "2026-04-30", { amount: cc(3), clinicName: "밴스 성수" }),
    rec("shrink_universe", "슈링크", "2026-04-30", { amount: shot(400), clinicName: "밴스 성수" }),
    rec("rejuran_healer", "리쥬란", "2026-09-11", {
      amount: cc(2),
      priceKrw: 260000,
      clinicName: "유앤아이 여의도",
      note: "아이리쥬란 1cc 함께, 26만 원은 합계",
    }),
    rec("shrink_universe", "슈링크", "2025-08-09", { amount: shot(400), priceKrw: 70000, clinicName: "유앤아이", note: "금액은 대략" }),
    rec("inmode", "인모드", "2025-08-09", { clinicName: "유앤아이", note: "포마" }),
    rec("thermage_flx", "써마지", "2026-03-21", { amount: shot(450), clinicName: "릴팅의원", note: "툰페이스 조금 (메모 그대로)" }),
    rec("botox_forehead", "보톡스 (미간)", "2025-04-21", { clinicName: "데이뷰 여의도", note: "미간" }),
    rec("botox_forehead", "보톡스 (미간)", "2025-08-09", { clinicName: "유앤아이", note: "미간" }),
  ],
  passes: [
    {
      clinicName: "유앤아이 여의도",
      description: "50+5권",
      kind: "prepaid_credit",
      purchasedOn: "2026-09-11",
      paidKrw: 500000,
      creditKrw: 550000,
    },
    {
      clinicName: "뷰티라운지 잠실",
      description: "쥬베룩아이 2회 추가 (19만)",
      kind: "session_pack",
      purchasedOn: "2025-12-16",
      paidKrw: 190000,
      procedureId: "juvelook_eye",
      sessionsTotal: 2,
      sessionsUsed: 2,
    },
  ],
  appointments: [
    {
      date: "2026-11-06",
      yearInferred: true,
      startTime: "14:00",
      endTime: "16:40",
      clinicName: "디앤에이",
      plannedText: "튠페이스, 엑소좀, 두피",
    },
  ],
  observations: [{ text: "오른쪽 팔자 두드러져 보임", bodyPart: "nasolabial", side: "right" }],
  questions: [
    { kind: "year_inference", text: "연도가 없는 기록은 메모 순서를 보고 2024~2026년으로 추정했어요. 맞나요?" },
    { kind: "price_unclear", text: "2025년 8월 9일 유앤아이 리쥬란 4cc의 \"13+16?\"은 결제 금액인가요?" },
    { kind: "pass_balance", text: "\"유앤아이 여의도 59500원\"은 50+5권의 남은 금액인가요?" },
    { kind: "other", text: "뷰티라운지 잠실 51만 원 3개월 무이자 결제는 어떤 시술 비용인가요?" },
  ],
};

const isJisuMemo = (text: string) => text.includes("피부 리포트") && text.includes("유앤아이");

const LINE_DATE = /(?:^|\s)(?:(\d{2})\/)?(\d{1,2})\/(\d{1,2})(?=\s|$)/;
const AMOUNT = /(\d+(?:\.\d+)?)\s*(cc|샷|shot)/i;
const MAN_WON = /(\d+(?:\.\d+)?)\s*만/;

/** Small parser for other memos: one record per line with a date and a known procedure. */
function parseLines(text: string, today: string): NotepadImport {
  const records: NotepadRecord[] = [];
  const currentYear = Number(today.slice(0, 4));
  for (const line of text.split("\n")) {
    const date = LINE_DATE.exec(line);
    if (!date) continue;
    const procedureId = matchProcedure(line) ?? UNKNOWN_PROCEDURE;
    const month = Number(date[2]);
    const day = Number(date[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const pad = (n: number) => String(n).padStart(2, "0");
    let year = date[1] ? 2000 + Number(date[1]) : currentYear;
    if (!date[1] && `${year}-${pad(month)}-${pad(day)}` > today) year -= 1;
    const amount = AMOUNT.exec(line);
    const price = MAN_WON.exec(line);
    const record: NotepadRecord = {
      procedureId,
      procedureText: line.trim(),
      date: `${year}-${pad(month)}-${pad(day)}`,
      datePrecision: "day",
      yearInferred: !date[1],
    };
    if (amount) record.amount = { value: Number(amount[1]), unit: /cc/i.test(amount[2]!) ? "cc" : "shot" };
    if (price) record.priceKrw = Math.round(Number(price[1]) * 10000);
    records.push(record);
  }
  const questions: NotepadImport["questions"] = [];
  if (records.some((record) => record.yearInferred)) {
    questions.push({ kind: "year_inference", text: "연도가 없는 기록은 가장 가까운 지난 날짜로 추정했어요. 맞나요?" });
  }
  if (records.some((record) => record.procedureId === UNKNOWN_PROCEDURE)) {
    questions.push({ kind: "unknown_procedure", text: "알아보지 못한 시술이 있어요. 시술 이름을 알려 주시겠어요?" });
  }
  return { records, passes: [], appointments: [], observations: [], questions };
}

export function notepadFixture(text: string, today: string): NotepadImport {
  return isJisuMemo(text) ? JISU_NOTEPAD_IMPORT : parseLines(text, today);
}
