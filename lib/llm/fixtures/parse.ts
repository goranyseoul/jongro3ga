import type { AgeBand, Area, Concern, IsoDate, Locale } from "../../domain/common";
import type { Channel, Residency } from "../onboarding/slots";

// Small deterministic readers the fixture agent uses in place of Claude's language understanding.
// They cover the scripted demo inputs (DEMO.md, 04 example) and plain answers in ja, ko, en and zh-CN;
// anything else falls through to "please pick from the options" so the widgets keep the flow going.

const norm = (text: string) => text.normalize("NFKC").trim().toLowerCase();

function findKey<T extends string>(text: string, table: Record<T, string[]>): T | undefined {
  const t = norm(text);
  for (const [key, words] of Object.entries(table) as [T, string[]][]) {
    if (words.some((word) => t.includes(norm(word)))) return key;
  }
  return undefined;
}

export const LOCALE_WORDS: Record<Locale, string[]> = {
  ja: ["日本語", "japanese", "にほんご"],
  "zh-CN": ["中文", "chinese", "中国語", "汉语"],
  en: ["english", "英語", "영어", "英语"],
  ko: ["한국어", "korean", "韓国語", "韩语"],
};

export function parseLocale(text: string): Locale | undefined {
  return findKey(text, LOCALE_WORDS);
}

const NATIONALITY_WORDS: Record<"JP" | "CN" | "US" | "KR", string[]> = {
  JP: ["日本", "東京", "大阪", "京都", "福岡", "japan", "tokyo", "osaka", "일본", "도쿄"],
  CN: ["中国", "上海", "北京", "广州", "深圳", "china", "shanghai", "beijing", "중국", "상하이"],
  US: ["アメリカ", "america", "united states", "usa", "new york", "los angeles", "미국", "뉴욕", "美国", "纽约"],
  KR: ["韓国", "korea", "한국", "서울", "韩国", "首尔"],
};

/** Nationality from a country or home city. "韓国に行きます" style sentences are not read as KR here. */
export function parseNationality(text: string): string | undefined {
  const t = norm(text);
  const visiting = /(韓国|한국|korea|韩国)(に|へ|에|to|去)/i.test(text) || /to korea|visit korea|韩国旅游/i.test(t);
  for (const [code, words] of Object.entries(NATIONALITY_WORDS) as ["JP" | "CN" | "US" | "KR", string[]][]) {
    if (code === "KR" && visiting) continue;
    if (words.some((word) => t.includes(norm(word)))) return code;
  }
  if (/^(other|その他|기타|其他)$/.test(t)) return "ZZ";
  return undefined;
}

export function ageBandOf(age: number): AgeBand | undefined {
  if (age < 20) return undefined;
  if (age <= 24) return "20-24";
  if (age <= 29) return "25-29";
  if (age <= 34) return "30-34";
  if (age <= 39) return "35-39";
  return "40+";
}

export function parseAgeBand(text: string): AgeBand | undefined {
  const t = text.normalize("NFKC");
  const explicit = t.match(/(\d{2})\s*(歳|才|살|세|岁|years?\s*old|yo\b)/i) ?? t.match(/\b(?:i'?m|age)\s*(\d{2})\b/i);
  if (explicit) return ageBandOf(Number(explicit[1]));
  const band = t.match(/(20-24|25-29|30-34|35-39|40\+)/);
  if (band) return band[1] as AgeBand;
  const decade = t.match(/(\d)0\s*(代|대|多岁|s\b)/);
  if (decade && Number(decade[1]) >= 4) return "40+";
  const listed = t.match(/(?:^|[,，、]\s*)(\d{2})(?=\s*(?:[,，、.。]|$))/);
  if (listed) return ageBandOf(Number(listed[1]));
  const bare = t.trim().match(/^(\d{2})$/);
  return bare ? ageBandOf(Number(bare[1])) : undefined;
}

/** Nickname from "ゆきです", "유키예요", "I'm Yuki", "我叫小林", or a bare short answer when the question was the name. */
export function parseNickname(text: string, bareAllowed: boolean): string | undefined {
  const first = text.normalize("NFKC").split(/[。．.!！?？\n,，、]/)[0]!.trim();
  const patterns = [
    /^(?:私は|わたしは)?\s*(.+?)\s*(?:です|と申します|と呼んでください|でお願いします)$/,
    /^(?:저는\s*)?(.+?)\s*(?:이에요|예요|입니다|라고 불러 주세요|라고 불러줘)$/,
    /^(?:i'?m|i am|my name is|call me|it'?s)\s+(.+)$/i,
    /^(?:我叫|叫我|我是)\s*(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = first.match(pattern);
    if (match && match[1]!.length <= 20) return match[1]!.trim();
  }
  if (bareAllowed && first.length > 0 && first.length <= 20 && !/\d/.test(first)) return first;
  return undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

function yearFor(month: number, day: number, today: IsoDate): number {
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${pad(month)}-${pad(day)}`;
  return candidate < today ? year + 1 : year;
}

const EN_MONTH: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * A date range such as "11月8日から10日", "11월 8일부터 10일", "Nov 8 to 10", "11/8~11/10" or "2026-11-08 ~ 2026-11-10".
 * The year is the next occurrence after `today`.
 */
export function parseDateRange(text: string, today: IsoDate): { arrival: IsoDate; departure: IsoDate } | undefined {
  const t = text.normalize("NFKC");
  const iso = [...t.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)].map((m) => `${m[1]}-${m[2]}-${m[3]}`);
  if (iso.length >= 2) return { arrival: iso[0]!, departure: iso[1]! };

  const build = (m1: number, d1: number, m2: number, d2: number) => {
    const y1 = yearFor(m1, d1, today);
    const y2 = m2 < m1 ? y1 + 1 : y1;
    return { arrival: `${y1}-${pad(m1)}-${pad(d1)}`, departure: `${y2}-${pad(m2)}-${pad(d2)}` };
  };

  const cjk = t.match(/(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일号]?.*?(?:(\d{1,2})\s*[月월]\s*)?(\d{1,2})\s*[日일号]/);
  if (cjk) return build(Number(cjk[1]), Number(cjk[2]), Number(cjk[3] ?? cjk[1]), Number(cjk[4]));

  const slash = t.match(/(\d{1,2})\/(\d{1,2})\s*(?:~|to|-|から|부터|到)\s*(?:(\d{1,2})\/)?(\d{1,2})/i);
  if (slash) return build(Number(slash[1]), Number(slash[2]), Number(slash[3] ?? slash[1]), Number(slash[4]));

  const en = t.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})\s*(?:to|-|~|until|through)\s*(?:([a-z]{3})[a-z]*\.?\s+)?(\d{1,2})\b/i);
  if (en && EN_MONTH[en[1]!.toLowerCase()]) {
    const m1 = EN_MONTH[en[1]!.toLowerCase()]!;
    const m2 = en[3] ? (EN_MONTH[en[3].toLowerCase()] ?? m1) : m1;
    return build(m1, Number(en[2]), m2, Number(en[4]));
  }
  return undefined;
}

const RESIDENCY_WORDS: Record<Residency, string[]> = {
  resident: ["居住", "住んで", "暮らして", "살고", "거주", "live in korea", "resident", "在韩国生活", "住在韩国", "はい", "네", "예", "yes", "是"],
  short_term_visitor: ["旅行", "短期", "観光", "여행", "단기", "visit", "trip", "travel", "tourist", "short", "短途", "いいえ", "아니요", "아니오", "no", "不是", "否"],
};

/** Residency from a yes or no to "do you live in Korea" or from words like 旅行 or resident. Short visit words win. */
export function parseResidency(text: string): Residency | undefined {
  const t = norm(text);
  if (RESIDENCY_WORDS.short_term_visitor.some((w) => t.includes(norm(w)))) return "short_term_visitor";
  if (RESIDENCY_WORDS.resident.some((w) => t.includes(norm(w)))) return "resident";
  return undefined;
}

export function parseYesNo(text: string): boolean | undefined {
  const t = norm(text);
  if (/(いいえ|아니|no\b|not\b|不是|没有|否|ない)/.test(t)) return false;
  if (/(はい|네|예|yes|是|对|そうです)/.test(t)) return true;
  return undefined;
}

const AREA_WORDS: Record<Area, string[]> = {
  gangnam: ["江南", "강남", "gangnam"],
  sinsa: ["新沙", "신사", "sinsa"],
  apgujeong: ["狎鴎亭", "압구정", "apgujeong", "狎鸥亭"],
  myeongdong: ["明洞", "명동", "myeongdong"],
  hongdae: ["弘大", "홍대", "hongdae"],
  other: ["その他", "기타", "other", "其他"],
};

export function parseArea(text: string): Area | undefined {
  return findKey(text, AREA_WORDS);
}

const CONCERN_WORDS: Record<Concern, string[]> = {
  elasticity: ["ハリ", "たるみ", "탄력", "처짐", "elastic", "firm", "sag", "弹性", "松弛"],
  fine_lines: ["しわ", "シワ", "ほうれい線", "주름", "팔자", "wrinkle", "fine line", "smile line", "皱纹", "细纹", "法令纹"],
  pores: ["毛穴", "キメ", "모공", "피부결", "pore", "texture", "毛孔"],
  acne_scars: ["ニキビ跡", "여드름 자국", "acne scar", "痘印", "痘坑"],
  pigmentation: ["シミ", "くすみ", "기미", "잡티", "색소", "pigment", "spot", "色斑", "斑"],
  redness: ["赤み", "홍조", "붉", "redness", "泛红", "红血丝"],
  dryness: ["乾燥", "건조", "dry", "干燥"],
  contour: ["輪郭", "エラ", "윤곽", "사각턱", "contour", "jawline", "轮廓", "下颌"],
};

export function parseConcerns(text: string): Concern[] {
  const t = norm(text);
  return (Object.entries(CONCERN_WORDS) as [Concern, string[]][])
    .filter(([, words]) => words.some((w) => t.includes(norm(w))))
    .map(([concern]) => concern);
}

const CHANNEL_WORDS: Record<Channel, string[]> = {
  line: ["line", "ライン", "라인"],
  wechat: ["wechat", "微信", "위챗"],
  whatsapp: ["whatsapp", "왓츠앱"],
  email: ["mail", "メール", "메일", "이메일", "邮箱", "邮件", "@"],
};

export function parseChannel(text: string): Channel | undefined {
  return findKey(text, CHANNEL_WORDS);
}

/** "なし", "없음", "none", "没有" as the answer to the history question. */
export function parseNone(text: string): boolean {
  return /^(なし|ない|ありません|없음|없어요|없습니다|none|no|nothing|没有|无)$/.test(norm(text).replace(/[。.!！]$/, ""));
}
