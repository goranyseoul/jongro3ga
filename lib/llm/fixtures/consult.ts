import type { Locale } from "../../domain/common";
import type { ToolCallResult } from "../index";

// Openers of the four DEMO.md scenarios (the agent's first reply), in all four languages. They keep the
// script's flow but stay inside the medical boundary (08 section 6): data citations instead of "this suits
// you", ranges instead of promises, and the doctor decides. Numbers come from kr-patterns.json and the
// procedure master. Blank lines split chat bubbles.

export type ScenarioId = "yuki" | "jisu" | "grace" | "lin";

export const SCENARIO_OPENERS: Record<ScenarioId | "generic", Record<Locale, string>> = {
  yuki: {
    ko: "반가워요 유키! 피부과가 처음이면 막막하죠. 유키 또래인 한국 30세 전후 여성들이 실제로 많이 하는 고민은 이래요.\n1. 팔자 주름이 파여 보임\n2. 피부결이 거칠어짐\n3. 턱선 탄력이 떨어짐\n4. 눈가 잔주름\n\n유키는 어느 부위가 제일 신경 쓰여요?",
    ja: "はじめまして、ゆきさん。皮膚科が初めてだと不安ですよね。ゆきさんと同世代、韓国の30歳前後の女性が実際によく挙げる悩みはこちらです。\n1. ほうれい線が深く見える\n2. 肌のキメが粗くなった\n3. フェイスラインのハリが落ちた\n4. 目元の小じわ\n\nいちばん気になるのはどこですか？",
    en: "Nice to meet you, Yuki! A first clinic visit can feel like a lot. These are the concerns Korean women around 30 name most often.\n1. Smile lines look deeper\n2. Skin texture feels rough\n3. Jawline is losing firmness\n4. Fine lines around the eyes\n\nWhich area bothers you most?",
    "zh-CN": "你好，Yuki！第一次去皮肤科难免会紧张。和你同龄、30岁左右的韩国女性最常提到的烦恼是这些。\n1. 法令纹看起来变深\n2. 肤质变粗糙\n3. 下颌线松弛\n4. 眼周细纹\n\n你最在意哪个部位？",
  },
  jisu: {
    ko: "정리했어요. 지난 약 2년 동안 시술 30건 이상, 병원 10곳 이상을 다니셨어요.\n- 리쥬란 2cc와 아이리쥬란 1cc: 마지막 2026/9/11 유앤아이 여의도, 다음 시기 12월 중순~1월 중순\n- 써마지 450샷: 마지막 2026/3/21, 다음 시기 2027년 3월\n- 스킨보톡스 3cc와 슈링크 400샷: 마지막 2026/4/30, 이번 달 확인이 필요해요\n- 쥬베룩 볼륨, 쥬베룩 아이, 미간 보톡스: 유지 시기가 지났어요\n\n11/6 디앤에이 14:00~16:40 일정은 하루 전에 알려 드릴게요. 연도가 없는 기록은 2024~2025년으로 추정했어요. 맞나요?",
    ja: "整理しました。この約2年で施術30件以上、クリニック10か所以上に通っています。\n- リジュラン2ccとアイリジュラン1cc: 最後は2026/9/11 ユアンドアイ汝矣島、次は12月中旬~1月中旬\n- サーマージ450ショット: 最後は2026/3/21、次は2027年3月\n- スキンボトックス3ccとシュリンク400ショット: 最後は2026/4/30、今月の確認が必要です\n- ジュベルックボリューム、ジュベルックアイ、眉間ボトックス: メンテナンスの時期を過ぎています\n\n11/6 ディーエンエー 14:00~16:40の予定は前日にお知らせします。年のない記録は2024~2025年と推定しました。合っていますか？",
    en: "Done. Over about two years you had 30+ treatments at 10+ clinics.\n- Rejuran 2cc and eye Rejuran 1cc: last on 2026/9/11 at U&I Yeouido, next window mid December to mid January\n- Thermage 450 shots: last on 2026/3/21, next in March 2027\n- Skin botox 3cc and Shrink 400 shots: last on 2026/4/30, worth checking this month\n- Juvelook Volume, Juvelook Eye, glabella botox: past their usual upkeep time\n\nI'll remind you the day before your 11/6 DNA appointment (14:00 to 16:40). Records without a year I read as 2024 to 2025. Is that right?",
    "zh-CN": "整理好了。大约两年里你做了30次以上项目，去过10家以上诊所。\n- 丽珠兰2cc和眼部丽珠兰1cc：最近一次2026/9/11 U&I汝矣岛，下次在12月中旬~1月中旬\n- 热玛吉450发：最近一次2026/3/21，下次在2027年3月\n- 微滴肉毒3cc和Shrink 400发：最近一次2026/4/30，这个月需要确认\n- Juvelook Volume、Juvelook眼部、眉间肉毒素：已过常规维护时间\n\n11/6 DNA 14:00~16:40的预约我会提前一天提醒你。没有年份的记录我按2024~2025年推算，对吗？",
  },
  grace: {
    en: "Here is how I read your situation, Grace.\n- One visit a year: procedures that are usually repeated about once a year\n- You want to enjoy the trip: almost no downtime\n- Conservative: non-invasive options without needles or threads\n- Consult in person: clinics where you can talk with the doctor in English first\n\nAmong Korean women in their 40s with the same concern, the procedures most often done once a year are Ulthera and Thermage. Effects build gradually over 1 to 3 months with almost no downtime, and whether either is right for you is the doctor's call at your consultation.",
    ko: "그레이스 상황을 정리하면 이래요.\n- 1년에 한 번 방문: 보통 1년에 한 번 받는 시술\n- 여행을 즐겨야 함: 다운타임이 거의 없는 시술\n- 보수적: 바늘이나 실 없이 하는 비침습 시술\n- 직접 상담 원함: 영어로 의사와 먼저 상담할 수 있는 병원\n\n같은 고민의 한국 40대 여성이 1년에 한 번 많이 받는 시술은 울쎄라와 써마지예요. 효과는 1~3개월에 걸쳐 서서히 나타나고 다운타임은 거의 없어요. 받을지는 상담에서 의사가 판단해요.",
    ja: "グレースさんの状況を整理するとこうなります。\n- 年に1回の訪問: 通常年1回受ける施術\n- 旅行を楽しみたい: ダウンタイムがほぼない施術\n- 慎重派: 針や糸を使わない非侵襲の施術\n- 直接相談したい: 英語で先に医師と相談できるクリニック\n\n同じ悩みの韓国40代女性が年1回よく受けている施術は、ウルセラとサーマージです。効果は1~3か月かけて少しずつ現れ、ダウンタイムはほぼありません。受けるかどうかはカウンセリングで医師が判断します。",
    "zh-CN": "Grace，你的情况整理如下。\n- 一年来一次：通常一年做一次的项目\n- 想好好享受旅行：几乎没有恢复期\n- 比较保守：不用针也不用线的无创项目\n- 想当面咨询：可以先用英语和医生面谈的诊所\n\n有同样烦恼的韩国40多岁女性一年做一次最多的是超声刀和热玛吉。效果在1~3个月内逐渐出现，几乎没有恢复期。是否适合由医生在面诊时判断。",
  },
  lin: {
    "zh-CN": "在有同样肤质烦恼的韩国30多岁后半女性中，选择最多的是丽珠兰。不过丽珠兰一开始需要每月一次、连续3次。你每4个月来一次韩国，很难完成最初的3次。\n\n要不要看看和你3月、7月、11月的访韩节奏更合拍的项目？",
    ko: "같은 피부결 고민의 한국 30대 후반 여성 기록에서는 리쥬란이 가장 많이 선택됐어요. 그런데 리쥬란은 처음에 한 달 간격으로 3회를 맞는 일정이에요. 린은 4개월에 한 번 오셔서 초기 3회를 채우기 어려워요.\n\n3월, 7월, 11월 방한 리듬에 맞는 주기의 시술을 볼까요?",
    ja: "同じ肌のキメの悩みを持つ韓国の30代後半女性の記録では、リジュランがいちばん多く選ばれています。ただしリジュランは最初に1か月間隔で3回受ける日程です。リンさんは4か月に1回の来韓なので、最初の3回をそろえるのが難しいです。\n\n3月、7月、11月の来韓リズムに合う周期の施術を見てみますか？",
    en: "Among Korean women in their late 30s with the same texture concern, Rejuran is chosen most often. It starts with three sessions one month apart, though, and with a visit every four months that first series is hard to complete.\n\nShall I look at procedures whose cycle matches your March, July and November visits?",
  },
  generic: {
    ko: "말씀 고마워요. 신경 쓰이는 고민이나 받고 싶은 시술을 조금 더 알려 주시면, 같은 고민의 한국 여성 기록에서 많이 선택된 조합을 찾아 드릴게요.",
    ja: "ありがとうございます。気になる悩みや受けたい施術をもう少し教えていただければ、同じ悩みの韓国女性の記録でよく選ばれている組み合わせをお探しします。",
    en: "Thanks for telling me. Share a bit more about your concern or the treatment you have in mind, and I'll look up what Korean women with the same concern chose most often.",
    "zh-CN": "谢谢你的分享。再多告诉我一些你的烦恼或想做的项目，我会查一下有同样烦恼的韩国女性最常选择的组合。",
  },
};

const fixed = (text: string): ToolCallResult => ({ text, toolCalls: [] });

export const consultFixtures: Record<string, ToolCallResult> = Object.fromEntries([
  ...Object.entries(SCENARIO_OPENERS).flatMap(([scenario, byLocale]) =>
    Object.entries(byLocale).map(([locale, text]) => [`consult.opener.${scenario}.${locale}`, fixed(text)]),
  ),
  ["consult.opener", fixed(SCENARIO_OPENERS.generic.en)],
]);
