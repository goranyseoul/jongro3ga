import type { Locale } from "@/lib/domain/common";

// Copy of the clinic explore screen in the four customer languages. Clinic, procedure, area and standard
// names come from lib/ui-data; only the screen's own words live here.
export type ExploreCopy = {
  metaTitle: string;
  metaDescription: (clinics: number) => string;
  title: string;
  sub: string;
  demoNotice: string;
  orderNote: string;
  filters: {
    toggle: string;
    panel: string;
    group: string;
    procedure: string;
    area: string;
    language: string;
    any: string;
    standards: string;
    standardsHint: string;
    femaleDoctor: string;
  };
  languageNames: Record<Locale, string>;
  active: { remove: (label: string) => string; clearAll: string };
  count: (shown: number, total: number) => string;
  view: { label: string; list: string; map: string };
  card: {
    listLabel: string;
    standards: string;
    standardsAria: (passed: number, total: number) => string;
    signature: string;
    pricePrefix: string;
    priceSuffix: string;
    priceNote: string;
    details: string;
    ask: string;
    showOnMap: string;
  };
  map: {
    label: string;
    caption: string;
    hint: string;
    allAreas: string;
    areaMarker: (area: string, count: number) => string;
    pinMarker: (clinic: string, area: string) => string;
    closeCard: string;
    empty: string;
    zoomed: (area: string) => string;
  };
  empty: { title: string; body: string; clear: string; ask: string; askSentence: string };
  /** The sentence an "Ask my agent" tap on a clinic card sends. */
  askSentence: (clinic: string, procedure: string) => string;
};

export const EXPLORE_COPY: Record<Locale, ExploreCopy> = {
  ko: {
    metaTitle: "클리닉 찾기",
    metaDescription: (n) => `시술, 지역, 언어, 통과한 기준으로 ${n}곳의 데모 클리닉을 좁혀 보세요. 모든 클리닉은 가상이에요.`,
    title: "클리닉 찾기",
    sub: "시술, 지역, 언어와 클리닉이 통과한 기준으로 좁혀 보세요.",
    demoNotice: "데모예요. 이 화면의 클리닉, 의사, 주소, 가격은 모두 가상이에요.",
    orderNote: "통과한 기준이 많은 순서예요. 비용을 내도 순서는 바뀌지 않고, 순서가 한 곳이 다른 곳보다 낫다는 뜻도 아니에요.",
    filters: {
      toggle: "필터",
      panel: "클리닉 필터",
      group: "시술 분류",
      procedure: "시술",
      area: "지역",
      language: "상담 언어",
      any: "전체",
      standards: "통과한 기준",
      standardsHint: "고른 기준을 모두 통과한 클리닉만 보여요",
      femaleDoctor: "여성 의사 근무",
    },
    languageNames: { ja: "일본어", "zh-CN": "중국어", en: "영어", ko: "한국어" },
    active: { remove: (label) => `필터 해제: ${label}`, clearAll: "모두 지우기" },
    count: (shown, total) => `${total}곳 중 ${shown}곳`,
    view: { label: "목록 또는 지도 보기", list: "목록", map: "지도" },
    card: {
      listLabel: "클리닉 목록",
      standards: "기준",
      standardsAria: (passed, total) => `기준 ${total}개 중 ${passed}개 통과`,
      signature: "대표 시술",
      pricePrefix: "",
      priceSuffix: "부터",
      priceNote: "참고용 데모 가격",
      details: "자세히",
      ask: "내 에이전트에게 묻기",
      showOnMap: "지도에서 보기",
    },
    map: {
      label: "클리닉 위치 지도",
      caption: "개략 지도예요. 위치는 대략적이고 데모용이에요.",
      hint: "지역을 누르면 확대돼요",
      allAreas: "전체 지역",
      areaMarker: (area, n) => `${area}, ${n}곳. 눌러서 확대`,
      pinMarker: (clinic, area) => `${clinic}, ${area}`,
      closeCard: "닫기",
      empty: "지도에 보여 줄 클리닉이 없어요",
      zoomed: (area) => `${area} 확대 중`,
    },
    empty: {
      title: "조건에 맞는 클리닉이 없어요",
      body: "필터를 하나 풀어 보거나, 에이전트에게 맡겨 보세요.",
      clear: "필터 모두 지우기",
      ask: "에이전트에게 묻기",
      askSentence: "제가 고른 조건에 맞는 클리닉을 찾아 주세요",
    },
    askSentence: (clinic, procedure) => `${procedure} 견적을 요청해 주세요. 클리닉은 ${clinic}도 포함해 주세요.`,
  },
  ja: {
    metaTitle: "クリニックを探す",
    metaDescription: (n) => `施術、エリア、言語、通過した基準で${n}院のデモクリニックを絞り込めます。すべて架空のクリニックです。`,
    title: "クリニックを探す",
    sub: "施術、エリア、言語と、クリニックが通過した基準で絞り込めます。",
    demoNotice: "デモです。この画面のクリニック、医師、住所、価格はすべて架空のものです。",
    orderNote: "通過した基準の数が多い順です。費用を払っても順番は変わらず、順番は特定の医院が他より優れているという意味ではありません。",
    filters: {
      toggle: "絞り込み",
      panel: "クリニックの絞り込み",
      group: "施術カテゴリ",
      procedure: "施術",
      area: "エリア",
      language: "相談できる言語",
      any: "すべて",
      standards: "通過した基準",
      standardsHint: "選んだ基準をすべて通過した医院だけを表示します",
      femaleDoctor: "女性医師が在籍",
    },
    languageNames: { ja: "日本語", "zh-CN": "中国語", en: "英語", ko: "韓国語" },
    active: { remove: (label) => `絞り込みを解除: ${label}`, clearAll: "すべて解除" },
    count: (shown, total) => `${total}院中 ${shown}院を表示`,
    view: { label: "リストと地図の切り替え", list: "リスト", map: "地図" },
    card: {
      listLabel: "クリニック一覧",
      standards: "基準",
      standardsAria: (passed, total) => `${total}つの基準のうち${passed}つを通過`,
      signature: "代表施術",
      pricePrefix: "",
      priceSuffix: "から",
      priceNote: "参考用デモ価格",
      details: "詳細",
      ask: "エージェントに聞く",
      showOnMap: "地図で見る",
    },
    map: {
      label: "クリニックの位置を示す地図",
      caption: "簡易地図です。位置はおおよそで、デモ用です。",
      hint: "エリアをタップすると拡大します",
      allAreas: "すべてのエリア",
      areaMarker: (area, n) => `${area}、${n}院。タップして拡大`,
      pinMarker: (clinic, area) => `${clinic}、${area}`,
      closeCard: "閉じる",
      empty: "地図に表示できるクリニックがありません",
      zoomed: (area) => `${area}を拡大中`,
    },
    empty: {
      title: "条件に合うクリニックがありません",
      body: "絞り込みを1つ外すか、エージェントにお任せください。",
      clear: "絞り込みをすべて解除",
      ask: "エージェントに聞く",
      askSentence: "私が選んだ条件に合うクリニックを探してください",
    },
    askSentence: (clinic, procedure) => `${procedure}の見積もりをお願いします。${clinic}も含めてください。`,
  },
  "zh-CN": {
    metaTitle: "查找诊所",
    metaDescription: (n) => `按项目,地区,语言和通过的标准筛选 ${n} 家演示诊所。所有诊所均为虚构。`,
    title: "查找诊所",
    sub: "可按项目,地区,语言以及诊所通过的标准来筛选。",
    demoNotice: "演示版本。本页的诊所,医生,地址和价格均为虚构。",
    orderNote: "按通过标准的数量排序。付费不会改变顺序,排序也不代表某家诊所优于其他诊所。",
    filters: {
      toggle: "筛选",
      panel: "诊所筛选",
      group: "项目分类",
      procedure: "项目",
      area: "地区",
      language: "咨询语言",
      any: "全部",
      standards: "通过的标准",
      standardsHint: "只显示通过所选全部标准的诊所",
      femaleDoctor: "有女医生",
    },
    languageNames: { ja: "日语", "zh-CN": "中文", en: "英语", ko: "韩语" },
    active: { remove: (label) => `取消筛选: ${label}`, clearAll: "清除全部" },
    count: (shown, total) => `共 ${total} 家,显示 ${shown} 家`,
    view: { label: "切换列表或地图", list: "列表", map: "地图" },
    card: {
      listLabel: "诊所列表",
      standards: "标准",
      standardsAria: (passed, total) => `${total} 项标准中通过 ${passed} 项`,
      signature: "代表项目",
      pricePrefix: "",
      priceSuffix: "起",
      priceNote: "参考用演示价格",
      details: "详情",
      ask: "问问代理",
      showOnMap: "在地图上查看",
    },
    map: {
      label: "诊所位置地图",
      caption: "简易示意图。位置仅为大致范围,仅供演示。",
      hint: "点一下地区即可放大",
      allAreas: "全部地区",
      areaMarker: (area, n) => `${area},${n} 家。点击放大`,
      pinMarker: (clinic, area) => `${clinic},${area}`,
      closeCard: "关闭",
      empty: "没有可在地图上显示的诊所",
      zoomed: (area) => `正在放大 ${area}`,
    },
    empty: {
      title: "没有符合条件的诊所",
      body: "可以取消一项筛选,或交给代理帮您找。",
      clear: "清除全部筛选",
      ask: "问问代理",
      askSentence: "请帮我找符合我所选条件的诊所",
    },
    askSentence: (clinic, procedure) => `请帮我询问${procedure}的报价,并包括${clinic}。`,
  },
  en: {
    metaTitle: "Find clinics",
    metaDescription: (n) => `Narrow ${n} demo clinics by treatment, area, language and the standards each passes. Every clinic is fictional.`,
    title: "Find clinics",
    sub: "Narrow by treatment, area, language and the standards each clinic passes.",
    demoNotice: "Demo: every clinic, doctor, address and price on this page is fictional.",
    orderNote:
      "Ordered by the number of standards passed. A fee never changes the order, and the order does not mean one clinic is better than another.",
    filters: {
      toggle: "Filters",
      panel: "Clinic filters",
      group: "Treatment group",
      procedure: "Procedure",
      area: "Area",
      language: "Language of care",
      any: "Any",
      standards: "Standards passed",
      standardsHint: "Shows only clinics that pass every standard you pick",
      femaleDoctor: "Female doctor on staff",
    },
    languageNames: { ja: "Japanese", "zh-CN": "Chinese", en: "English", ko: "Korean" },
    active: { remove: (label) => `Remove filter: ${label}`, clearAll: "Clear all" },
    count: (shown, total) => `Showing ${shown} of ${total} clinics`,
    view: { label: "Show list or map", list: "List", map: "Map" },
    card: {
      listLabel: "Clinics",
      standards: "standards",
      standardsAria: (passed, total) => `${passed} of ${total} standards passed`,
      signature: "Signature procedure",
      pricePrefix: "from ",
      priceSuffix: "",
      priceNote: "Reference demo price",
      details: "Details",
      ask: "Ask my agent",
      showOnMap: "Show on map",
    },
    map: {
      label: "Map of clinic locations",
      caption: "Schematic map. Positions are approximate and for the demo only.",
      hint: "Tap an area to zoom in",
      allAreas: "All areas",
      areaMarker: (area, n) => `${area}, ${n} clinics. Zoom in`,
      pinMarker: (clinic, area) => `${clinic}, ${area}`,
      closeCard: "Close",
      empty: "No clinics to show on the map",
      zoomed: (area) => `Zoomed to ${area}`,
    },
    empty: {
      title: "No clinic matches these filters",
      body: "Try removing a filter, or let your agent look for you.",
      clear: "Clear all filters",
      ask: "Ask my agent",
      askSentence: "Please find clinics that match the filters I chose",
    },
    askSentence: (clinic, procedure) => `Could you request quotes for ${procedure}, including ${clinic}?`,
  },
};
