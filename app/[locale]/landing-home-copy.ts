import type { Locale } from "@/lib/domain/common";

// Copy of the landing sections under the hero. Every tile, card and chip sends a sentence to the agent,
// so each section also carries the sentence it sends.
export type LandingHomeCopy = {
  categories: { title: string; sub: string; count: (n: number) => string };
  overview: { eyebrow: string; title: (clinics: number, areas: number) => string; ask: string };
  treatments: { title: string; sub: string; count: (n: number) => string; noDowntime: string; downtime: (range: string) => string };
  courses: {
    title: string;
    sub: string;
    open: string;
    note: string;
    items: { key: "weekend" | "series" | "first"; title: string; note: string }[];
  };
  standards: { eyebrow: string; title: (n: number) => string; sub: string; principles: { title: string; body: string }[] };
  stats: { items: { value: string; caption: string }[]; source: string };
  areas: { title: string };
  closing: { eyebrow: string; title: string; body: string; cta: string };
  ask: {
    category: (name: string) => string;
    procedure: (name: string) => string;
    course: (names: string) => string;
    area: (name: string) => string;
  };
};

export const LANDING_HOME_COPY: Record<Locale, LandingHomeCopy> = {
  ko: {
    categories: { title: "어떤 고민이세요?", sub: "누르면 에이전트가 기준을 통과한 클리닉을 보여 드려요", count: (n) => `${n}곳` },
    overview: {
      eyebrow: "기준을 통과한 클리닉 전체",
      title: (c, a) => `${a}개 지역, ${c}곳을 에이전트와 함께 보기`,
      ask: "기준을 통과한 클리닉을 모두 보여 주세요",
    },
    treatments: {
      title: "해외 방문객이 찾는 시술",
      sub: "환자들이 실제로 쓰는 이름 그대로",
      count: (n) => `${n}곳`,
      noDowntime: "다운타임 거의 없음",
      downtime: (r) => `다운타임 ${r}일`,
    },
    courses: {
      title: "방문객별 시작 코스",
      sub: "누르면 그 조건으로 에이전트가 찾아요",
      open: "에이전트에게 묻기",
      note: "데모용 패턴이에요. 실제 기록이 쌓이면 바뀝니다.",
      items: [
        { key: "weekend", title: "주말 2박 3일", note: "다운타임이 짧아 바로 일정을 이어갈 수 있는 조합" },
        { key: "series", title: "방한할 때마다 이어서", note: "회차를 나눠 받는 리프팅과 재생 시술" },
        { key: "first", title: "처음 받는 K시술", note: "부담이 적은 피부결·톤 관리부터" },
      ],
    },
    standards: {
      eyebrow: "검증 기준",
      title: (n) => `등록된 수많은 병원 중, PibooK은 기준을 통과한 ${n}곳만 연결해요`,
      sub: "적게 보이는 것은 빈틈이 아니라 심사의 결과예요",
      principles: [
        { title: "광고 순위가 없어요", body: "병원이 낸 돈은 매칭 점수와 가격 판정 어디에도 들어가지 않아요." },
        { title: "가격은 기록과 견줘요", body: "견적을 실제 결제 기록과 비교해 적정한지 알려 드려요." },
        { title: "기준은 다시 확인해요", body: "모든 기준에는 재확인 주기가 있고, 미달하면 연결에서 빠져요." },
      ],
    },
    stats: {
      items: [
        { value: "201만", caption: "2025년 한국을 찾은 외국인 환자" },
        { value: "62.9%", caption: "그중 피부과 진료 비중" },
        { value: "8", caption: "주기적으로 다시 확인하는 기준" },
        { value: "0", caption: "광고로 올린 순위" },
      ],
      source: "환자 수치: 보건복지부 2026-04-24 발표 기준.",
    },
    areas: { title: "지역으로 찾기" },
    closing: {
      eyebrow: "PibooK",
      title: "기준을 통과한 클리닉만.",
      body: "할인 광고도, 광고 순위도 없어요. 에이전트가 기록과 견주어 확인한 곳만 보여 드려요.",
      cta: "에이전트와 이야기하기",
    },
    ask: {
      category: (n) => `${n} 시술을 알아보고 싶어요`,
      procedure: (n) => `${n} 받고 싶어요`,
      course: (n) => `${n} 코스로 알아보고 싶어요`,
      area: (n) => `${n}에서 클리닉을 찾고 싶어요`,
    },
  },
  ja: {
    categories: { title: "どんなお悩みですか？", sub: "タップすると、基準を通過したクリニックをエージェントがお見せします", count: (n) => `${n}院` },
    overview: {
      eyebrow: "基準を通過したクリニックすべて",
      title: (c, a) => `${a}つのエリア、${c}院をエージェントと一緒に見る`,
      ask: "基準を通過したクリニックをすべて見せてください",
    },
    treatments: {
      title: "海外からの方が選ぶ施術",
      sub: "患者さんが実際に使う名前のまま",
      count: (n) => `${n}院`,
      noDowntime: "ダウンタイムほぼなし",
      downtime: (r) => `ダウンタイム ${r}日`,
    },
    courses: {
      title: "旅のスタイル別スタートコース",
      sub: "タップすると、その条件でエージェントが探します",
      open: "エージェントに聞く",
      note: "デモ用のパターンです。実際の記録が増えると変わります。",
      items: [
        { key: "weekend", title: "週末の2泊3日", note: "ダウンタイムが短く、すぐに予定を続けられる組み合わせ" },
        { key: "series", title: "来韓のたびに続けて", note: "回数を分けて受けるリフトアップと再生施術" },
        { key: "first", title: "はじめてのK施術", note: "負担の少ない肌質・トーンケアから" },
      ],
    },
    standards: {
      eyebrow: "確認の基準",
      title: (n) => `登録されている多くの医院のうち、PibooKがつなぐのは基準を通過した${n}院だけです`,
      sub: "少なく見えるのは抜けではなく、審査の結果です",
      principles: [
        { title: "広告の順位はありません", body: "医院が払うお金は、マッチングの点数にも価格の判定にも入りません。" },
        { title: "価格は記録と比べます", body: "見積もりを実際の支払い記録と比べて、適正かどうかをお伝えします。" },
        { title: "基準は定期的に再確認", body: "すべての基準に再確認の周期があり、満たさなければ紹介から外れます。" },
      ],
    },
    stats: {
      items: [
        { value: "201万", caption: "2025年に韓国を訪れた外国人患者" },
        { value: "62.9%", caption: "そのうち皮膚科の割合" },
        { value: "8", caption: "定期的に再確認する基準" },
        { value: "0", caption: "広告で上げた順位" },
      ],
      source: "患者数: 韓国保健福祉部 2026-04-24 発表による。",
    },
    areas: { title: "エリアで探す" },
    closing: {
      eyebrow: "PibooK",
      title: "基準を通過したクリニックだけ。",
      body: "割引広告も、広告の順位もありません。エージェントが記録と照らして確かめた医院だけをお見せします。",
      cta: "エージェントと話す",
    },
    ask: {
      category: (n) => `${n}の施術を知りたいです`,
      procedure: (n) => `${n}を受けたいです`,
      course: (n) => `${n}のコースで探したいです`,
      area: (n) => `${n}でクリニックを探したいです`,
    },
  },
  "zh-CN": {
    categories: { title: "您有哪方面的困扰?", sub: "点一下,代理就会列出通过标准的诊所", count: (n) => `${n}家` },
    overview: {
      eyebrow: "全部通过标准的诊所",
      title: (c, a) => `和代理一起看 ${a} 个地区的 ${c} 家诊所`,
      ask: "请列出所有通过标准的诊所",
    },
    treatments: {
      title: "海外访客常选的项目",
      sub: "用患者实际使用的名称",
      count: (n) => `${n}家`,
      noDowntime: "几乎没有恢复期",
      downtime: (r) => `恢复期 ${r} 天`,
    },
    courses: {
      title: "按行程选择的入门组合",
      sub: "点一下,代理就按这个条件查找",
      open: "问问代理",
      note: "这是演示用的组合,实际记录增加后会更新。",
      items: [
        { key: "weekend", title: "周末三天两夜", note: "恢复期短,做完可以继续行程的组合" },
        { key: "series", title: "每次来韩接着做", note: "分次完成的提拉与修护项目" },
        { key: "first", title: "第一次做韩国项目", note: "从负担较小的肤质与肤色管理开始" },
      ],
    },
    standards: {
      eyebrow: "核查标准",
      title: (n) => `在众多登记的医院中,PibooK 只连接通过标准的 ${n} 家`,
      sub: "数量少不是缺漏,而是审核的结果",
      principles: [
        { title: "没有广告排名", body: "医院支付的费用不会进入匹配分数,也不会影响价格判定。" },
        { title: "价格对照记录", body: "把报价与实际支付记录对比,告诉您是否合理。" },
        { title: "标准定期复查", body: "每项标准都有复查周期,不达标就不再推荐。" },
      ],
    },
    stats: {
      items: [
        { value: "201万", caption: "2025 年来韩的外国患者" },
        { value: "62.9%", caption: "其中皮肤科的比例" },
        { value: "8", caption: "定期复查的标准" },
        { value: "0", caption: "靠广告提升的排名" },
      ],
      source: "患者数据: 韩国保健福祉部 2026-04-24 发布。",
    },
    areas: { title: "按地区查找" },
    closing: {
      eyebrow: "PibooK",
      title: "只有通过标准的诊所。",
      body: "没有折扣广告,也没有广告排名。只展示代理对照记录确认过的诊所。",
      cta: "和代理聊聊",
    },
    ask: {
      category: (n) => `想了解${n}类项目`,
      procedure: (n) => `想做${n}`,
      course: (n) => `想按${n}的组合查找`,
      area: (n) => `想在${n}找诊所`,
    },
  },
  en: {
    categories: { title: "What would you like to work on?", sub: "Tap one and your agent shows the clinics that pass our standards", count: (n) => `${n} clinics` },
    overview: {
      eyebrow: "Every clinic that passes",
      title: (c, a) => `Browse ${c} clinics in ${a} areas with your agent`,
      ask: "Show me every clinic that passes the standards",
    },
    treatments: {
      title: "What visitors come for",
      sub: "In the names patients actually use",
      count: (n) => `${n} clinics`,
      noDowntime: "Little to no downtime",
      downtime: (r) => `${r} days downtime`,
    },
    courses: {
      title: "Where visitors like you begin",
      sub: "Tap one and your agent searches with those conditions",
      open: "Ask your agent",
      note: "Demo patterns. They change as real records come in.",
      items: [
        { key: "weekend", title: "A weekend in Seoul", note: "Short downtime, so the rest of the trip goes on" },
        { key: "series", title: "A little more every visit", note: "Lifting and renewal done in sessions across trips" },
        { key: "first", title: "Your first K-treatment", note: "Start gently with texture and tone care" },
      ],
    },
    standards: {
      eyebrow: "Our standards",
      title: (n) => `Of the many registered clinics, PibooK connects you only to the ${n} that pass`,
      sub: "A short list is the result of vetting, not a gap in coverage",
      principles: [
        { title: "No paid rankings", body: "Money a clinic pays never enters the match score or the price check." },
        { title: "Prices checked against records", body: "Quotes are compared with real payment records to tell you whether they are fair." },
        { title: "Standards are rechecked", body: "Every standard has a recheck cycle. Miss one and the clinic is no longer suggested." },
      ],
    },
    stats: {
      items: [
        { value: "2.01M", caption: "international patients came to Korea in 2025" },
        { value: "62.9%", caption: "of them for dermatology" },
        { value: "8", caption: "standards rechecked on a schedule" },
        { value: "0", caption: "rankings bought with ads" },
      ],
      source: "Patient figures: Korea Ministry of Health and Welfare, announced 2026-04-24.",
    },
    areas: { title: "Browse by area" },
    closing: {
      eyebrow: "PibooK",
      title: "Only the clinics that pass.",
      body: "No discount ads and no paid rankings. Your agent shows only the clinics it checked against real records.",
      cta: "Talk to your agent",
    },
    ask: {
      category: (n) => `I'd like to look into ${n} treatments`,
      procedure: (n) => `I want ${n}`,
      course: (n) => `I'd like to look for ${n}`,
      area: (n) => `I'd like to find a clinic in ${n}`,
    },
  },
};

/** Procedure ids of each visitor course, from the procedure master. */
export const COURSE_PROCEDURES: Record<"weekend" | "series" | "first", string[]> = {
  weekend: ["rejuran", "skin_booster", "skin_botox"],
  series: ["ulthera", "thermage", "rejuran"],
  first: ["aqua_peel", "pico_toning", "skin_booster"],
};

/** Procedures in the treatment rail, in display order. */
export const FEATURED_PROCEDURES = [
  "ulthera",
  "thermage",
  "shrink",
  "rejuran",
  "juvelook",
  "skin_booster",
  "skin_botox",
  "pico_toning",
  "potenza_secret",
  "exosome",
];
