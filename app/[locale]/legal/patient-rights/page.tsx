import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { focusRing } from "@/lib/ui";
import { LOCALES, isLocale, wordBreak } from "../../locales";
import { SiteFooter, SiteNav, container } from "../../site-chrome";

// Foreign patient rights notice (08-compliance.md 1절): service terms, dispute resolution and privacy,
// in English always, with the reader's language alongside. Demo draft until legal review.
type Section = { title: string; body: string };
type RightsCopy = { title: string; notice: string; sections: Section[]; kmedi: string };

const KMEDI_URL = "https://www.k-medi.or.kr/";

const COPY: Record<Locale, RightsCopy> = {
  en: {
    title: "Foreign patient rights",
    notice:
      "Demo draft. This page has not been reviewed by legal counsel, and PibooK is not yet a registered foreign patient attraction agency.",
    sections: [
      {
        title: "What PibooK does",
        body: "PibooK runs a personal agent for you. It records your conditions, requests quotes from clinics, compares quoted prices and doses with recorded paid prices, and forwards your booking requests. PibooK is not a medical provider and does not diagnose or recommend treatment.",
      },
      {
        title: "Terms",
        body: "Using the agent is free for customers. Before any procedure, the clinic must explain the diagnosis, treatment method, side effects, the treatment contract and the expected cost.",
      },
      {
        title: "Disputes",
        body: "Contact PibooK first so we can relay the issue to the clinic. Disputes about medical treatment can be brought to the Korea Medical Dispute Mediation and Arbitration Agency.",
      },
      {
        title: "Personal information",
        body: "Skin, procedure and safety information is collected only with your separate consent. Processing outside Korea, for example by an AI provider, also needs your consent. Safety information and contact details are masked in agent logs, and clinics receive only the fields you agreed to share.",
      },
    ],
    kmedi: "Korea Medical Dispute Mediation and Arbitration Agency",
  },
  ja: {
    title: "外国人患者の権利保護について",
    notice: "デモ用の草案です。法律の専門家による確認前で、PibooKはまだ外国人患者誘致事業者として登録されていません。",
    sections: [
      {
        title: "PibooKが行うこと",
        body: "PibooKはあなた専用のエージェントを運用します。条件を記録し、クリニックに見積もりを依頼し、見積もりの価格と量を実際の支払い記録と比べ、予約の依頼を伝えます。PibooKは医療機関ではなく、診断や施術の推奨は行いません。",
      },
      {
        title: "条件",
        body: "エージェントの利用は無料です。施術の前に、クリニックが診断、治療方法、副作用、診療契約、予想される費用を説明します。",
      },
      {
        title: "紛争の解決",
        body: "まずPibooKにご連絡ください。クリニックへお伝えします。診療に関する紛争は、韓国医療紛争調停仲裁院に申し立てることができます。",
      },
      {
        title: "個人情報",
        body: "肌、施術、安全に関する情報は、別途の同意がある場合にのみ取得します。AIの利用など国外での処理にも同意が必要です。安全情報と連絡先はエージェントの記録で伏せられ、クリニックには共有に同意した項目だけが届きます。",
      },
    ],
    kmedi: "韓国医療紛争調停仲裁院",
  },
  "zh-CN": {
    title: "外国患者权益保护说明",
    notice: "演示草案。本页面尚未经过法律专业人士审核，PibooK 尚未登记为外国患者招揽业者。",
    sections: [
      {
        title: "PibooK 提供的服务",
        body: "PibooK 为你运行专属代理：记录你的条件，向诊所询价，将报价的价格和用量与实际支付记录比较，并转达你的预约请求。PibooK 不是医疗机构，不做诊断，也不推荐项目。",
      },
      {
        title: "条件",
        body: "代理对顾客免费。在任何项目之前，诊所需要说明诊断、治疗方法、副作用、诊疗合同和预计费用。",
      },
      {
        title: "纠纷解决",
        body: "请先联系 PibooK，我们会转达给诊所。与诊疗相关的纠纷可以向韩国医疗纠纷调解仲裁院申请。",
      },
      {
        title: "个人信息",
        body: "皮肤、项目和安全信息仅在你单独同意后收集。在境外处理（例如 AI 服务）也需要你的同意。代理日志会隐藏安全信息和联系方式，诊所只会收到你同意共享的字段。",
      },
    ],
    kmedi: "韩国医疗纠纷调解仲裁院",
  },
  ko: {
    title: "외국인환자 권익 보호 안내",
    notice: "데모용 초안이에요. 법률 검토 전이며, PibooK은 아직 외국인환자 유치사업자로 등록되지 않았어요.",
    sections: [
      {
        title: "PibooK이 하는 일",
        body: "PibooK은 고객 전용 에이전트를 운영해요. 조건을 기록하고, 병원에 견적을 요청하고, 견적의 가격과 용량을 실제 결제 기록과 비교하고, 예약 요청을 전달해요. PibooK은 의료기관이 아니며 진단하거나 시술을 권하지 않아요.",
      },
      {
        title: "이용 조건",
        body: "에이전트 이용은 무료예요. 시술 전에 병원이 진단, 치료 방법, 부작용, 진료 계약, 예상 비용을 설명해요.",
      },
      {
        title: "분쟁 해결",
        body: "먼저 PibooK에 알려 주시면 병원에 전달해요. 진료에 관한 분쟁은 한국의료분쟁조정중재원에 신청할 수 있어요.",
      },
      {
        title: "개인정보",
        body: "피부, 시술, 안전 정보는 따로 동의했을 때만 수집해요. AI 처리처럼 국외에서 처리할 때도 동의가 필요해요. 안전 정보와 연락처는 에이전트 기록에서 가려지고, 병원에는 공유에 동의한 항목만 전달돼요.",
      },
    ],
    kmedi: "한국의료분쟁조정중재원",
  },
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${isLocale(locale) ? COPY[locale].title : COPY.en.title} · PibooK` };
}

function RightsBlock({ copy, lang }: { copy: RightsCopy; lang: Locale }) {
  const kw = wordBreak(lang);
  return (
    <article lang={lang} className="flex flex-col gap-sp-4">
      <h2 className={cn(kw, "text-h2 font-semi")}>{copy.title}</h2>
      <Card>
        <p className={cn(kw, "text-body text-muted")}>{copy.notice}</p>
      </Card>
      {copy.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-sp-2">
          <h3 className={cn(kw, "text-title font-semi")}>{section.title}</h3>
          <p className={cn(kw, "text-body text-muted")}>{section.body}</p>
        </section>
      ))}
      <a
        href={KMEDI_URL}
        target="_blank"
        rel="noreferrer"
        className={cn("inline-flex min-h-touch items-center self-start text-body text-text underline", focusRing)}
      >
        {copy.kmedi}
      </a>
    </article>
  );
}

export default async function PatientRightsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav locale={locale} />
      <main className={cn(container, "flex flex-1 flex-col gap-sp-12 py-sp-12")}>
        <h1 className="sr-only">{COPY[locale].title}</h1>
        {/* English is the required version, the reader's language follows it */}
        <div className="grid grid-cols-1 gap-sp-12 lg:grid-cols-2">
          <RightsBlock copy={COPY.en} lang="en" />
          {locale !== "en" ? <RightsBlock copy={COPY[locale]} lang={locale} /> : null}
        </div>
      </main>
      <SiteFooter locale={locale} path="/legal/patient-rights" />
    </div>
  );
}
