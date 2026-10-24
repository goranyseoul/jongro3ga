import type { I18nText, Locale } from "../../domain";
import { clinicName } from "./clinic-names";

// Progress lines for the request steps that are not A2A calls (orchestrator.ts `CustomerRequest.steps`).
// Template sentences in the four customer languages. No history detail ever goes into them: a line says that an
// offer condition holds, never which past visit made it hold.

const LOCALES: readonly Locale[] = ["ko", "ja", "en", "zh-CN"];

type Template = Record<Locale, string>;

export const STEP_COPY = {
  not_eligible: {
    ko: "한국 국적이거나 국내에 거주하는 고객에게는 병원 매칭과 예약을 열지 않아요 (의료법 제27조)",
    ja: "韓国籍の方、韓国にお住まいの方にはクリニックの紹介と予約をご案内できません(医療法第27条)",
    en: "Clinic matching and booking are not available to Korean nationals or residents of Korea (Medical Service Act art. 27)",
    "zh-CN": "韩国国籍或在韩居住的客户无法使用诊所匹配和预约(医疗法第27条)",
  },
  consent_missing: {
    ko: "개인정보 처리 동의가 없어 요청을 보내지 않았어요",
    ja: "個人情報の取り扱いへの同意がないため、リクエストを送っていません",
    en: "No consent to process personal data, so nothing was sent",
    "zh-CN": "未同意处理个人信息，因此没有发送请求",
  },
  offer_eligible: {
    ko: "{clinic}: 기록 기반 오퍼 조건을 기기 안에서 확인했어요. 해당돼요",
    ja: "{clinic}: 記録に基づく特典の条件を端末内で確認しました。対象です",
    en: "{clinic}: checked the record based offer on this device. You qualify",
    "zh-CN": "{clinic}: 已在设备内核对基于记录的优惠条件。符合条件",
  },
  offer_not_eligible: {
    ko: "{clinic}: 기록 기반 오퍼 조건에 해당하지 않아 증명을 요청하지 않아요",
    ja: "{clinic}: 記録に基づく特典の対象ではないため、証明は求めません",
    en: "{clinic}: the record based offer does not apply, so no proof is requested",
    "zh-CN": "{clinic}: 不符合基于记录的优惠条件，因此不申请证明",
  },
  proof_attached: {
    ko: "{clinic} 견적 요청에 오퍼 조건 증명을 붙였어요 (이력 원본은 보내지 않아요)",
    ja: "{clinic}への見積もり依頼に特典条件の証明を添付しました(履歴そのものは送りません)",
    en: "Attached the offer proof to the quote request for {clinic} (your history itself is not sent)",
    "zh-CN": "已在发给{clinic}的报价请求中附上优惠条件证明(不发送原始记录)",
  },
  proof_skipped: {
    ko: "{clinic} 오퍼 증명을 만들지 못해 정가로 견적을 받아요",
    ja: "{clinic}の特典証明を作成できなかったため、通常価格で見積もりを受けます",
    en: "Could not make the offer proof for {clinic}, so the quote will be at the regular price",
    "zh-CN": "无法生成{clinic}的优惠证明，将按原价获取报价",
  },
  quote_timeout: {
    ko: "{clinic}이 응답하지 않아 나머지 병원으로 진행해요",
    ja: "{clinic}から応答がないため、他のクリニックで進めます",
    en: "{clinic} did not answer in time, continuing with the other clinics",
    "zh-CN": "{clinic}未及时回复，继续处理其他诊所",
  },
  quote_rejected: {
    ko: "{clinic}은 이 요청을 받을 수 없어요",
    ja: "{clinic}はこのリクエストを受けられません",
    en: "{clinic} cannot take this request",
    "zh-CN": "{clinic}无法接受此请求",
  },
  record_anchored: {
    ko: "{clinic} 시술 기록을 체인에 앵커했어요 (병원 확인 기록)",
    ja: "{clinic}での施術記録をチェーンに記録しました(クリニック確認済み)",
    en: "Anchored the visit at {clinic} on chain (clinic confirmed record)",
    "zh-CN": "已将{clinic}的治疗记录锚定到链上(诊所确认记录)",
  },
  anchor_skipped: {
    ko: "기록 지갑에 연결하지 못해 체인 기록은 나중에 해요",
    ja: "記録ウォレットにつながらないため、チェーンへの記録は後で行います",
    en: "Could not reach the record wallet, the on-chain record will be made later",
    "zh-CN": "无法连接记录钱包，稍后再上链记录",
  },
} satisfies Record<string, Template>;

export type StepCopyKey = keyof typeof STEP_COPY;

/** The template in every language, with `{clinic}` replaced by the clinic's name in that language. */
export function stepText(key: StepCopyKey, vars: { clinicId?: string } = {}): I18nText {
  const out: I18nText = {};
  for (const locale of LOCALES) {
    const template = STEP_COPY[key][locale];
    out[locale] = vars.clinicId ? template.replaceAll("{clinic}", clinicName(vars.clinicId, locale)) : template;
  }
  return out;
}
