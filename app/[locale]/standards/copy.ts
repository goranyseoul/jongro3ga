import type { Locale } from "@/lib/domain/common";
import type { StandardKey } from "@/lib/ui-data/directory";

// Copy of the public standards page (/[locale]/standards). The names of the eight standards and their
// recheck cycles come from STANDARD_TEXT in lib/ui-data/directory.ts; this file adds what is checked.

export type StandardsCopy = {
  metaTitle: string;
  title: string;
  intro: string;
  principles: { title: string; items: { title: string; body: string }[] };
  standards: { title: string; lead: string; checks: string; cycle: string; items: Record<StandardKey, string> };
  failure: { title: string; steps: string[] };
  cta: { title: string; body: string; button: string };
  notice: string;
};

export const STANDARDS_COPY: Record<Locale, StandardsCopy> = {
  en: {
    metaTitle: "How PibooK checks clinics · PibooK",
    title: "How PibooK checks clinics",
    intro:
      "Before your agent suggests a clinic, PibooK checks it against eight standards. Each clinic page shows what was checked and when.",
    principles: {
      title: "Three principles",
      items: [
        {
          title: "No paid rankings",
          body: "Payments from a clinic never enter matching or price checks. A clinic cannot buy a place in your agent's suggestions.",
        },
        {
          title: "Prices checked against payment records",
          body: "A quote is compared with the amounts patients actually paid, as recorded after their procedures.",
        },
        {
          title: "Standards are rechecked",
          body: "Every standard has a recheck cycle. A clinic that fails is no longer suggested.",
        },
      ],
    },
    standards: {
      title: "The eight standards",
      lead: "Each standard lists what is checked and how often it is rechecked.",
      checks: "What is checked",
      cycle: "Recheck cycle",
      items: {
        registered: "The clinic's registration number is matched against the official register of foreign patient agencies.",
        namedDoctor: "The consent form names the doctor who performs the procedure.",
        dermatologist: "The doctor's dermatology board certification is matched against license records.",
        genuineProduct: "Outcome records show whether the patient saw the product opened.",
        priceAsQuoted: "The quoted price is compared with the amount paid, as recorded in outcome records.",
        languageSupport: "The working hours of the staff who consult in other languages are confirmed.",
        explainedBefore: "The pre-procedure sheet covers side effects and cost.",
        aftercare: "The aftercare contact answers a test contact.",
      },
    },
    failure: {
      title: "When a clinic fails a recheck",
      steps: [
        "Your agent stops suggesting the clinic.",
        "Its page shows the standard as not checked yet.",
        "It can be suggested again after it passes a new check.",
      ],
    },
    cta: {
      title: "See the clinics",
      body: "Every clinic page shows which of the eight standards it has passed.",
      button: "Browse clinics",
    },
    notice: "This is a demo. The clinics and check results on PibooK are fictional.",
  },
  ko: {
    metaTitle: "PibooK이 병원을 확인하는 방법 · PibooK",
    title: "PibooK이 병원을 확인하는 방법",
    intro: "에이전트가 병원을 추천하기 전에 PibooK은 8가지 기준으로 병원을 확인해요. 병원 페이지에는 무엇을 언제 확인했는지가 그대로 나와요.",
    principles: {
      title: "세 가지 원칙",
      items: [
        {
          title: "광고 순위가 없어요",
          body: "병원이 낸 돈은 매칭 점수와 가격 확인 어디에도 들어가지 않아요. 돈으로 에이전트의 추천 자리를 살 수 없어요.",
        },
        {
          title: "가격은 결제 기록과 견줘요",
          body: "견적을 시술 뒤에 기록된 실제 결제액과 비교해요.",
        },
        {
          title: "기준은 다시 확인해요",
          body: "모든 기준에는 재확인 주기가 있어요. 미달한 병원은 더 이상 추천하지 않아요.",
        },
      ],
    },
    standards: {
      title: "8가지 기준",
      lead: "기준마다 무엇을 확인하고 얼마나 자주 다시 확인하는지 적었어요.",
      checks: "확인하는 것",
      cycle: "재확인 주기",
      items: {
        registered: "병원의 등록번호를 외국인환자 유치기관 공식 명부와 대조해요.",
        namedDoctor: "시술 동의서에 시술하는 의사의 이름이 적히는지 확인해요.",
        dermatologist: "의사의 피부과 전문의 자격을 면허 기록과 대조해요.",
        genuineProduct: "결과 기록에서 환자가 정품 개봉을 직접 봤는지 확인해요.",
        priceAsQuoted: "견적 금액과 결과 기록에 남은 실제 결제액을 비교해요.",
        languageSupport: "외국어로 상담하는 직원의 근무 시간을 확인해요.",
        explainedBefore: "시술 전 설명서에 부작용과 비용이 들어 있는지 확인해요.",
        aftercare: "시술 후 연락 창구에 테스트 연락을 해서 닿는지 확인해요.",
      },
    },
    failure: {
      title: "병원이 재확인에서 미달하면",
      steps: [
        "에이전트가 그 병원을 더 이상 추천하지 않아요.",
        "병원 페이지에서 해당 기준이 아직 확인 전으로 바뀌어요.",
        "새 확인을 통과하면 다시 추천할 수 있어요.",
      ],
    },
    cta: {
      title: "병원 둘러보기",
      body: "병원 페이지마다 8가지 기준 중 어떤 것을 통과했는지 나와요.",
      button: "병원 보기",
    },
    notice: "데모 화면이에요. PibooK의 병원과 확인 결과는 모두 가상이에요.",
  },
  ja: {
    metaTitle: "PibooKのクリニック確認方法 · PibooK",
    title: "PibooKのクリニック確認方法",
    intro:
      "エージェントがクリニックを紹介する前に、PibooKは8つの基準で確認します。各クリニックのページには、何をいつ確認したかが表示されます。",
    principles: {
      title: "3つの原則",
      items: [
        {
          title: "広告の順位はありません",
          body: "クリニックが払うお金は、マッチングにも価格の確認にも入りません。お金でエージェントの紹介枠は買えません。",
        },
        {
          title: "価格は支払い記録と比べます",
          body: "見積もりを、施術後に記録された実際の支払額と比べます。",
        },
        {
          title: "基準は定期的に再確認",
          body: "すべての基準に再確認の周期があります。満たさなかったクリニックは紹介から外れます。",
        },
      ],
    },
    standards: {
      title: "8つの基準",
      lead: "基準ごとに、確認する内容と再確認の頻度を示しています。",
      checks: "確認する内容",
      cycle: "再確認の周期",
      items: {
        registered: "クリニックの登録番号を、外国人患者誘致機関の公的名簿と照合します。",
        namedDoctor: "同意書に、施術する医師の名前が記載されているかを確認します。",
        dermatologist: "医師の皮膚科専門医の資格を、免許記録と照合します。",
        genuineProduct: "記録をもとに、患者が正規品の開封を目の前で見たかを確認します。",
        priceAsQuoted: "見積もり金額と、記録に残った実際の支払額を比べます。",
        languageSupport: "外国語で相談に応じるスタッフの勤務時間を確認します。",
        explainedBefore: "施術前の説明書に、副作用と費用が含まれているかを確認します。",
        aftercare: "施術後の連絡窓口にテスト連絡をして、つながるかを確認します。",
      },
    },
    failure: {
      title: "再確認で基準を満たさなかった場合",
      steps: [
        "エージェントはそのクリニックを紹介しなくなります。",
        "クリニックのページでは、その基準が未確認の表示になります。",
        "新しい確認を通過すれば、再び紹介できるようになります。",
      ],
    },
    cta: {
      title: "クリニックを見る",
      body: "各クリニックのページに、8つの基準のうち通過したものが表示されます。",
      button: "クリニック一覧へ",
    },
    notice: "デモ画面です。PibooKに表示されるクリニックと確認結果はすべて架空のものです。",
  },
  "zh-CN": {
    metaTitle: "PibooK 如何核查诊所 · PibooK",
    title: "PibooK 如何核查诊所",
    intro: "在您的代理推荐诊所之前，PibooK 会按 8 项标准核查。每家诊所的页面都会写明核查了什么、何时核查。",
    principles: {
      title: "三项原则",
      items: [
        {
          title: "没有广告排名",
          body: "诊所支付的费用不会进入匹配，也不会进入价格核查。诊所无法用钱买到代理的推荐位置。",
        },
        {
          title: "价格对照支付记录",
          body: "把报价与项目结束后记录的实际支付金额进行对比。",
        },
        {
          title: "标准定期复查",
          body: "每项标准都有复查周期。未达标的诊所不再被推荐。",
        },
      ],
    },
    standards: {
      title: "8 项标准",
      lead: "每项标准都写明核查内容和复查频率。",
      checks: "核查内容",
      cycle: "复查周期",
      items: {
        registered: "将诊所的登记号与外国患者接待机构的官方名录核对。",
        namedDoctor: "确认同意书上写明施术医生的姓名。",
        dermatologist: "将医生的皮肤科专科资格与执照记录核对。",
        genuineProduct: "根据结果记录，确认患者是否当面看到正品开封。",
        priceAsQuoted: "将报价金额与结果记录中的实际付款金额进行对比。",
        languageSupport: "确认提供外语咨询的工作人员的工作时间。",
        explainedBefore: "确认术前说明包含副作用与费用。",
        aftercare: "向术后联络窗口发送测试联系，确认可以联系上。",
      },
    },
    failure: {
      title: "诊所复查未达标时",
      steps: [
        "您的代理不再推荐该诊所。",
        "该诊所页面中对应的标准显示为尚未核查。",
        "通过新的核查后，可以再次被推荐。",
      ],
    },
    cta: {
      title: "查看诊所",
      body: "每家诊所的页面都会显示它通过了 8 项标准中的哪几项。",
      button: "浏览诊所",
    },
    notice: "这是演示页面。PibooK 上的诊所和核查结果均为虚构。",
  },
};
