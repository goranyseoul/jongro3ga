import type { Locale } from "@/lib/domain/common";

// Copy of the clinic detail page (/[locale]/clinics/[slug]) in the four customer languages.
// Server components only: several entries are functions, which cannot cross into a client component.
// Fictional clinics throughout; no comparison wording, no discount wording, no medical advice.

export type DetailCopy = {
  metaTitle: (clinic: string) => string;
  notFoundTitle: string;
  back: string;
  openMap: string;
  opensInNewTab: string;
  cta: { row: string; rowFor: (procedure: string) => string };
  /** The sentence handed to the agent, as if the customer typed it. */
  askSentence: (clinic: string, procedure: string) => string;
  facts: {
    title: string;
    languages: string;
    femaleDoctor: string;
    femaleYes: string;
    femaleNo: string;
    listedSince: string;
    year: (year: number) => string;
    operation: string;
    proxyTitle: string;
    proxyNote: string;
    clinicTitle: string;
    clinicNote: string;
    standards: string;
    standardsCount: (passed: number, total: number) => string;
  };
  standards: {
    title: string;
    lead: (passed: number, total: number) => string;
    checked: (date: string) => string;
    notChecked: string;
    statusLabel: string;
    how: string;
  };
  doctors: {
    title: string;
    boardYes: string;
    boardNo: string;
    years: (n: number) => string;
  };
  procedures: {
    title: string;
    lead: string;
    from: string;
    priceNote: string;
    signature: string;
  };
  notice: { demo: string; medical: string };
};

export const DETAIL_COPY: Record<Locale, DetailCopy> = {
  en: {
    metaTitle: (clinic) => `${clinic} · PibooK`,
    notFoundTitle: "Clinic not found · PibooK",
    back: "All clinics",
    openMap: "Open in maps",
    opensInNewTab: "Opens in a new tab",
    cta: {
      row: "Ask my agent for a quote",
      rowFor: (procedure) => `Ask my agent for a quote: ${procedure}`,
    },
    askSentence: (clinic, procedure) => `Please ask ${clinic} for a ${procedure} quote.`,
    facts: {
      title: "At a glance",
      languages: "Languages",
      femaleDoctor: "Female doctor",
      femaleYes: "Available",
      femaleNo: "Not available",
      listedSince: "Listed since",
      year: (year) => `${year}`,
      operation: "Who answers",
      proxyTitle: "PibooK answers for this clinic",
      proxyNote: "Prices are reference prices.",
      clinicTitle: "The clinic answers itself",
      clinicNote: "Quote requests go to the clinic's own staff.",
      standards: "Standards confirmed",
      standardsCount: (passed, total) => `${passed} of ${total}`,
    },
    standards: {
      title: "Standards",
      lead: (passed, total) => `${passed} of ${total} standards confirmed. Each one is rechecked on a fixed cycle.`,
      checked: (date) => `Checked ${date}`,
      notChecked: "Not checked yet",
      statusLabel: "Status",
      how: "How PibooK checks",
    },
    doctors: {
      title: "Doctors",
      boardYes: "Board-certified dermatologist",
      boardNo: "Dermatology board certification not on record",
      years: (n) => `${n} ${n === 1 ? "year" : "years"} of practice`,
    },
    procedures: {
      title: "Procedures",
      lead: "Starting prices are reference demo prices, VAT included. The clinic confirms the actual price in its quote.",
      from: "From",
      priceNote: "Reference demo price",
      signature: "Signature procedure",
    },
    notice: {
      demo: "This is a demo. Every clinic, doctor, address and price on this page is fictional.",
      medical: "PibooK gives no medical advice. The doctor decides whether a procedure suits you.",
    },
  },
  ko: {
    metaTitle: (clinic) => `${clinic} · PibooK`,
    notFoundTitle: "병원을 찾을 수 없어요 · PibooK",
    back: "병원 목록",
    openMap: "지도에서 열기",
    opensInNewTab: "새 탭에서 열려요",
    cta: {
      row: "내 에이전트에게 견적 요청",
      rowFor: (procedure) => `내 에이전트에게 견적 요청: ${procedure}`,
    },
    askSentence: (clinic, procedure) => `${clinic}에 ${procedure} 견적을 문의해 주세요.`,
    facts: {
      title: "한눈에 보기",
      languages: "상담 언어",
      femaleDoctor: "여성 의사",
      femaleYes: "있어요",
      femaleNo: "없어요",
      listedSince: "등록 연도",
      year: (year) => `${year}년`,
      operation: "답변하는 쪽",
      proxyTitle: "PibooK이 이 병원 대신 답해요",
      proxyNote: "가격은 참고 가격이에요.",
      clinicTitle: "병원이 직접 답해요",
      clinicNote: "견적 요청은 병원 직원에게 전달돼요.",
      standards: "확인된 기준",
      standardsCount: (passed, total) => `${total}개 중 ${passed}개`,
    },
    standards: {
      title: "검증 기준",
      lead: (passed, total) => `${total}개 기준 중 ${passed}개를 확인했어요. 각 기준은 정해진 주기로 다시 확인해요.`,
      checked: (date) => `${date} 확인`,
      notChecked: "아직 확인 전",
      statusLabel: "상태",
      how: "PibooK의 확인 방법",
    },
    doctors: {
      title: "의료진",
      boardYes: "피부과 전문의",
      boardNo: "피부과 전문의 자격 기록 없음",
      years: (n) => `진료 경력 ${n}년`,
    },
    procedures: {
      title: "시술",
      lead: "시작 가격은 참고용 데모 가격이며 부가세를 포함해요. 실제 가격은 병원이 견적에서 확정해요.",
      from: "시작가",
      priceNote: "참고용 데모 가격",
      signature: "대표 시술",
    },
    notice: {
      demo: "데모 화면이에요. 이 페이지의 병원, 의사, 주소, 가격은 모두 가상이에요.",
      medical: "PibooK은 의료 상담을 하지 않아요. 시술이 나에게 맞는지는 의사가 판단해요.",
    },
  },
  ja: {
    metaTitle: (clinic) => `${clinic} · PibooK`,
    notFoundTitle: "クリニックが見つかりません · PibooK",
    back: "クリニック一覧",
    openMap: "地図で開く",
    opensInNewTab: "新しいタブで開きます",
    cta: {
      row: "エージェントに見積もりを依頼",
      rowFor: (procedure) => `エージェントに見積もりを依頼: ${procedure}`,
    },
    askSentence: (clinic, procedure) => `${clinic}に${procedure}の見積もりを問い合わせてください。`,
    facts: {
      title: "ひと目でわかる情報",
      languages: "対応言語",
      femaleDoctor: "女性医師",
      femaleYes: "在籍",
      femaleNo: "在籍なし",
      listedSince: "掲載開始",
      year: (year) => `${year}年`,
      operation: "対応する側",
      proxyTitle: "PibooKがこの医院の代わりに回答",
      proxyNote: "価格は参考価格です。",
      clinicTitle: "医院が直接回答",
      clinicNote: "見積もりの依頼は医院のスタッフに届きます。",
      standards: "確認済みの基準",
      standardsCount: (passed, total) => `${total}件中${passed}件`,
    },
    standards: {
      title: "確認の基準",
      lead: (passed, total) => `${total}件の基準のうち${passed}件を確認しました。各基準は決まった周期で再確認します。`,
      checked: (date) => `${date}に確認`,
      notChecked: "未確認",
      statusLabel: "状態",
      how: "PibooKの確認方法",
    },
    doctors: {
      title: "医師",
      boardYes: "皮膚科専門医",
      boardNo: "皮膚科専門医の資格記録なし",
      years: (n) => `診療経験${n}年`,
    },
    procedures: {
      title: "施術",
      lead: "開始価格は参考用のデモ価格で、税込です。実際の価格は医院が見積もりで確定します。",
      from: "開始価格",
      priceNote: "参考用デモ価格",
      signature: "代表的な施術",
    },
    notice: {
      demo: "デモ画面です。このページの医院、医師、住所、価格はすべて架空のものです。",
      medical: "PibooKは医療相談を行いません。施術があなたに合うかどうかは医師が判断します。",
    },
  },
  "zh-CN": {
    metaTitle: (clinic) => `${clinic} · PibooK`,
    notFoundTitle: "找不到该诊所 · PibooK",
    back: "诊所列表",
    openMap: "在地图中打开",
    opensInNewTab: "将在新标签页打开",
    cta: {
      row: "请我的代理询价",
      rowFor: (procedure) => `请我的代理询价: ${procedure}`,
    },
    askSentence: (clinic, procedure) => `请向${clinic}询问${procedure}的报价。`,
    facts: {
      title: "一览",
      languages: "咨询语言",
      femaleDoctor: "女医生",
      femaleYes: "有",
      femaleNo: "没有",
      listedSince: "入驻年份",
      year: (year) => `${year} 年`,
      operation: "回复方",
      proxyTitle: "由 PibooK 代为回复",
      proxyNote: "价格为参考价格。",
      clinicTitle: "由诊所直接回复",
      clinicNote: "报价请求会发给诊所自己的工作人员。",
      standards: "已确认的标准",
      standardsCount: (passed, total) => `${total} 项中的 ${passed} 项`,
    },
    standards: {
      title: "核查标准",
      lead: (passed, total) => `${total} 项标准中已确认 ${passed} 项。每项标准都按固定周期复查。`,
      checked: (date) => `${date} 已核查`,
      notChecked: "尚未核查",
      statusLabel: "状态",
      how: "PibooK 的核查方式",
    },
    doctors: {
      title: "医生",
      boardYes: "皮肤科专科医生",
      boardNo: "无皮肤科专科资格记录",
      years: (n) => `执业 ${n} 年`,
    },
    procedures: {
      title: "项目",
      lead: "起步价为仅供参考的演示价格，含增值税。实际价格以诊所报价为准。",
      from: "起步价",
      priceNote: "演示参考价格",
      signature: "代表项目",
    },
    notice: {
      demo: "这是演示页面。本页的诊所、医生、地址和价格均为虚构。",
      medical: "PibooK 不提供医疗建议。项目是否适合您，由医生判断。",
    },
  },
};
