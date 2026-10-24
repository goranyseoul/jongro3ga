import { procedureMaster } from "../../domain/procedure-master";

// Deterministic procedure lookup for fixture mode: aliases people actually type (the master only has ko and
// en names for most procedures) plus every master name. Longest match wins, so "스킨보톡스" is skin_botox and
// "쥬베룩 볼륨" is juvelook_volume, not botox or plain Juvelook.

const ALIASES: Record<string, string[]> = {
  rejuran_healer: ["リジュラン", "rejuran", "리쥬란", "리주란", "丽珠兰", "아이리쥬란"],
  thermage_flx: ["サーマジ", "サーマクール", "써마지", "thermage", "热玛吉"],
  ulthera: ["ウルセラ", "울쎄라", "ulthera", "超声刀"],
  shrink_universe: ["シュリンク", "슈링크", "shrink"],
  botox_forehead: ["ボトックス", "보톡스", "보톡", "botox", "肉毒"],
  skin_botox: ["スキンボトックス", "스킨보톡스", "skin botox"],
  skin_booster_juvelook: ["ジュベルック", "쥬베룩", "쥬베룩스킨", "juvelook"],
  juvelook_eye: ["쥬베룩아이", "쥬베룩 아이", "눈밑 쥬베룩"],
  juvelook_volume: ["쥬베룩 볼륨", "쥬베룩볼륨"],
  inmode: ["インモード", "인모드", "inmode"],
  pico_toning: ["ピコトーニング", "피코토닝", "pico toning"],
  aqua_peel: ["アクアピール", "아쿠아필", "aqua peel"],
  exosome: ["エクソソーム", "엑소좀", "exosome"],
};

const entries: Array<{ key: string; id: string }> = [];
for (const procedure of procedureMaster) {
  for (const name of Object.values(procedure.name)) if (name) entries.push({ key: name.toLowerCase(), id: procedure.id });
}
for (const [id, aliases] of Object.entries(ALIASES)) for (const alias of aliases) entries.push({ key: alias.toLowerCase(), id });
entries.sort((a, b) => b.key.length - a.key.length);

/** The master id named in `text`, or undefined. */
export function matchProcedure(text: string): string | undefined {
  const lower = text.toLowerCase();
  return entries.find((entry) => lower.includes(entry.key))?.id;
}
