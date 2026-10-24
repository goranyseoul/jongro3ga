import type { Locale } from "../domain/common";

// Display names in all four languages and the spellings customers type, per procedure master id.
// The master (data/seed/procedures.json) only has ko and en names; ja and zh-CN are added here for chat text.
// Japanese and Chinese names follow common clinic usage and still need a native speaker review.

export interface ProcedureNames {
  name: Record<Locale, string>;
  /** Extra spellings, matched case and width insensitively. Names are matched too. */
  aliases: string[];
}

const n = (ko: string, ja: string, en: string, zh: string, aliases: string[] = []): ProcedureNames => ({
  name: { ko, ja, en, "zh-CN": zh },
  aliases,
});

export const PROCEDURE_NAMES: Record<string, ProcedureNames> = {
  ulthera: n("울쎄라", "ウルセラ", "Ulthera", "超声刀", ["울쎄라", "울세라", "ulthera", "ultherapy", "ウルセラ", "超声刀"]),
  thermage: n("써마지", "サーマージ", "Thermage", "热玛吉", ["서마지", "thermage", "サーマジ", "热玛吉"]),
  shrink: n("슈링크", "シュリンク", "Shrink", "Shrink提升", ["shrink", "슈링크", "シュリンク"]),
  inmode: n("인모드", "インモード", "InMode", "InMode", ["inmode", "인모드", "インモード"]),
  oligio: n("올리지오", "オリジオ", "Oligio", "Oligio", ["oligio", "올리지오", "オリジオ"]),
  thread_lift: n("실리프팅", "糸リフト", "Thread lift", "线雕", ["실리프팅", "thread lift", "糸リフト", "スレッドリフト", "线雕", "埋线"]),
  rejuran: n("리쥬란", "リジュラン", "Rejuran", "丽珠兰", ["리쥬란", "리주란", "아이리쥬란", "rejuran", "リジュラン", "丽珠兰", "婴儿针"]),
  juvelook: n("쥬베룩", "ジュベルック", "Juvelook", "Juvelook", ["쥬베룩", "주베룩", "juvelook", "ジュベルック"]),
  juvelook_eye: n("쥬베룩 아이", "ジュベルックアイ", "Juvelook Eye", "Juvelook眼部", ["쥬베룩 아이", "쥬베룩아이", "juvelook eye", "ジュベルックアイ"]),
  juvelook_volume: n("쥬베룩 볼륨", "ジュベルックボリューム", "Juvelook Volume", "Juvelook Volume", [
    "쥬베룩 볼륨",
    "쥬베룩볼륨",
    "juvelook volume",
    "ジュベルックボリューム",
    "ジュベルック ボリューム",
  ]),
  skin_booster: n("스킨부스터", "スキンブースター", "Skin booster", "水光针", ["스킨부스터", "물광", "skin booster", "スキンブースター", "水光注射", "水光针"]),
  lituo: n("리투오", "リトゥオ", "Lituo", "Lituo", ["리투오", "lituo", "リトゥオ"]),
  exosome: n("엑소좀", "エクソソーム", "Exosome", "外泌体", ["엑소좀", "exosome", "エクソソーム", "外泌体"]),
  filler: n("필러", "フィラー", "Filler", "玻尿酸填充", ["필러", "filler", "ヒアルロン酸", "フィラー", "玻尿酸", "填充"]),
  sculptra: n("스컬트라", "スカルプトラ", "Sculptra", "童颜针", ["스컬트라", "sculptra", "スカルプトラ", "童颜针"]),
  botox_wrinkle: n("보톡스 (주름)", "ボトックス（しわ）", "Botox (wrinkles)", "肉毒素（除皱）", ["보톡스", "미간 보톡스", "botox", "ボトックス", "肉毒素", "除皱针"]),
  botox_square_jaw: n("사각턱 보톡스", "エラボトックス", "Square jaw botox", "瘦脸针", ["사각턱 보톡스", "턱 보톡스", "square jaw botox", "jaw botox", "エラボトックス", "瘦脸针"]),
  skin_botox: n("스킨보톡스", "スキンボトックス", "Skin botox", "微滴肉毒", ["스킨보톡스", "스킨 보톡스", "skin botox", "スキンボトックス", "微滴肉毒", "水光肉毒"]),
  contour_injection: n("윤곽주사", "輪郭注射", "Contouring injection", "溶脂针", ["윤곽주사", "contour injection", "輪郭注射", "溶脂针"]),
  laser_toning: n("레이저토닝", "レーザートーニング", "Laser toning", "激光美白", ["레이저토닝", "laser toning", "レーザートーニング", "激光美白"]),
  pico_toning: n("피코토닝", "ピコトーニング", "Pico toning", "皮秒", ["피코토닝", "피코", "pico toning", "pico", "ピコトーニング", "ピコ", "皮秒"]),
  ipl: n("IPL", "IPL", "IPL", "光子嫩肤", ["ipl", "光子嫩肤", "フォトフェイシャル"]),
  fraxel: n("프락셀", "フラクセル", "Fraxel", "点阵激光", ["프락셀", "fraxel", "フラクセル", "点阵激光"]),
  potenza_secret: n("포텐자·시크릿", "ポテンツァ・シークレット", "Potenza / Secret", "黄金微针", ["포텐자", "시크릿", "potenza", "ポテンツァ", "黄金微针"]),
  agnes: n("아그네스", "アグネス", "Agnes", "Agnes", ["아그네스", "agnes", "アグネス"]),
  vbeam: n("브이빔", "Vビーム", "V-Beam", "V-Beam", ["브이빔", "vbeam", "v-beam", "vビーム"]),
  aqua_peel: n("아쿠아필", "アクアピール", "Aqua peel", "小气泡", ["아쿠아필", "aqua peel", "aquapeel", "アクアピール", "小气泡"]),
};

const fold = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** The procedure a customer named, by the longest matching spelling ("쥬베룩 볼륨" wins over "쥬베룩"). */
export function findProcedureId(text: string): string | undefined {
  const haystack = fold(text);
  const latin = text.normalize("NFKC").toLowerCase();
  let best: { id: string; length: number } | undefined;
  for (const [id, entry] of Object.entries(PROCEDURE_NAMES)) {
    for (const spelling of [...Object.values(entry.name), ...entry.aliases]) {
      const needle = fold(spelling);
      if (needle.length < 2) continue;
      // Latin spellings must stand as words ("ipl" is not inside "multiple"); CJK has no word breaks.
      const found = /^[a-z0-9 ./()-]+$/.test(spelling.toLowerCase())
        ? new RegExp(`(^|[^a-z])${spelling.toLowerCase().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "\\s*")}($|[^a-z])`).test(latin)
        : haystack.includes(needle);
      if (found && (!best || needle.length > best.length)) best = { id, length: needle.length };
    }
  }
  return best?.id;
}

export function procedureName(id: string, locale: Locale): string {
  return PROCEDURE_NAMES[id]?.name[locale] ?? id;
}
