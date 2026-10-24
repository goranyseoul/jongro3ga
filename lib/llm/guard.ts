// Output guards for customer facing text: style (no emoji, no em or en dash) and the medical boundary
// (08-compliance.md section 6). Live model output that trips the medical check is replaced by the
// fixture for that turn; fixtures themselves are checked by lib/llm/medical-boundary.test.ts.

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;
/** En dash (0x2013) and em dash (0x2014), built from code points so this file never contains them. */
const DASH_CHARS = String.fromCharCode(0x2013, 0x2014);
const DASH_RUN = new RegExp(`\\s*[${DASH_CHARS}]\\s*`, "g");
const DASH_ANY = new RegExp(`[${DASH_CHARS}]`);

/** Removes emoji and replaces em and en dashes with a comma. Keeps everything else as written. */
export function sanitizeText(text: string): string {
  return text
    .replace(EMOJI, "")
    .replace(DASH_RUN, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function hasStyleViolation(text: string): boolean {
  EMOJI.lastIndex = 0;
  const emoji = EMOJI.test(text);
  EMOJI.lastIndex = 0;
  return emoji || DASH_ANY.test(text);
}

export interface MedicalViolation {
  kind: "diagnosis" | "contraindication" | "recommendation" | "guarantee";
  pattern: string;
  match: string;
}

// Phrases that cross the boundary, per language. Kept concrete on purpose: a broad pattern would also
// catch the allowed data citations ("가장 많이 받은 조합").
const PATTERNS: Array<[MedicalViolation["kind"], RegExp]> = [
  // diagnosis
  ["diagnosis", /(이건|그건|그거)\s*(기미|주근깨|여드름|홍조|주사|색소)(예요|이에요|입니다)/],
  ["diagnosis", /(それは|これは)(肝斑|シミ|ニキビ|酒さ|赤ら顔)(です|ですね)/],
  ["diagnosis", /\byou (have|got) (melasma|rosacea|acne|hyperpigmentation)\b/i],
  ["diagnosis", /\bthis (is|looks like) (melasma|rosacea|acne)\b/i],
  ["diagnosis", /(你|这)(是|有)(黄褐斑|玫瑰痤疮|痤疮)/],
  ["diagnosis", /진단(해 드릴게요|하면|결과)/],
  ["diagnosis", /診断(します|すると|結果)/],
  // contraindication judgment
  ["contraindication", /(임신|수유).{0,12}(안 돼요|안 됩니다|못 받아요|불가능해요)/],
  ["contraindication", /(妊娠|授乳).{0,12}(できません|受けられません|だめです)/],
  ["contraindication", /\b(pregnan\w*|breastfeeding).{0,30}\b(can't|cannot|must not|shouldn't)\b/i],
  ["contraindication", /\b(can't|cannot|must not|shouldn't) (get|have) (it|this|that).{0,20}\b(pregnan\w*|breastfeeding)/i],
  ["contraindication", /(怀孕|哺乳).{0,12}(不能做|不可以做|不行)/],
  // procedure recommendation
  ["recommendation", /(받으세요|받으시는 게 좋아요|받는 게 좋아요|받아 보세요|해 보세요)/],
  ["recommendation", /(잘 맞아요|딱 맞아요|좋은 선택이에요)/],
  ["recommendation", /(受けてください|受けるべき|受けたほうがいい|試してみてください|おすすめします|ぴったりです|いい選択です)/],
  ["recommendation", /\byou should (get|have|try|do)\b/i],
  ["recommendation", /\bI (would )?recommend (getting|that you|you get|trying)\b/i],
  ["recommendation", /\b(perfect|best|great) (choice|fit|match) for you\b/i],
  ["recommendation", /(你应该|建议你)(做|打|试试)/],
  ["recommendation", /(很适合你|最适合你|好的选择)/],
  // guaranteed results
  ["guarantee", /(효과(를|가)? 보장|없어져요|사라져요|확실히 좋아져요)/],
  ["guarantee", /(効果を保証|効果が保証|消えます|なくなります|必ず良くなります)/],
  ["guarantee", /\b(guarantee[ds]?|will (disappear|go away|be gone))\b/i],
  ["guarantee", /(保证(效果|有效)|会消失|一定会变好)/],
];

export function findMedicalViolations(text: string): MedicalViolation[] {
  const found: MedicalViolation[] = [];
  for (const [kind, pattern] of PATTERNS) {
    const match = text.match(pattern);
    if (match) found.push({ kind, pattern: pattern.source, match: match[0] });
  }
  return found;
}

/** Topics that need the sensitiveHealth consent first (04 rule 3). Catches a live model that asks too early. */
const SENSITIVE_TOPIC = [
  /(임신|수유|알레르기|항응고|이소트레티노인|켈로이드|피부 고민|피부 타입|받아 본 시술|과거 시술)/,
  /(妊娠|授乳|アレルギー|抗凝固|イソトレチノイン|ケロイド|肌の悩み|肌質|受けた施術)/,
  /\b(pregnan\w*|breastfeeding|allerg\w*|anticoagulant\w*|isotretinoin|keloid|skin concerns?|skin type|past (procedures?|treatments?))\b/i,
  /(怀孕|哺乳|过敏|抗凝|异维A酸|疤痕疙瘩|皮肤问题|肤质|做过的项目)/,
];

export function mentionsSensitiveTopic(text: string): boolean {
  return SENSITIVE_TOPIC.some((pattern) => pattern.test(text));
}
