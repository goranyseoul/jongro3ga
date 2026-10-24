"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  ChatBubble,
  ChatInput,
  ChipGroup,
  ConsentCard,
  Input,
  Sheet,
  WidgetCurrency,
  WidgetDateRange,
  WidgetSlider,
  type CurrencyAmount,
  type DateRange,
} from "@/components/ui";

const concerns = [
  { value: "elasticity", label: "탄력" },
  { value: "pores", label: "모공" },
  { value: "fine_lines", label: "주름" },
  { value: "pigmentation", label: "색소" },
];

const nationalities = [
  { value: "JP", label: "일본" },
  { value: "CN", label: "중국" },
  { value: "US", label: "미국" },
  { value: "KR", label: "한국" },
];

const downtimeSteps = [0, 1, 3, 7].map((day) => ({ value: day, label: day === 0 ? "없음" : `${day}일` }));

const rates = { KRW: 1, JPY: 9.2, CNY: 190, USD: 1380 };

export function Interactive() {
  const [nationality, setNationality] = useState<string | null>("JP");
  const [picked, setPicked] = useState<string[]>(["elasticity"]);
  const [nickname, setNickname] = useState("");
  const [terms, setTerms] = useState<boolean | null>(null);
  const [sensitive, setSensitive] = useState<boolean | null>(true);
  const [range, setRange] = useState<DateRange>({ start: "2026-11-13", end: "2026-11-15" });
  const [downtime, setDowntime] = useState(3);
  const [budget, setBudget] = useState<CurrencyAmount>({ currency: "JPY", amount: 37000 });
  const [messages, setMessages] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex flex-col gap-sp-6">
      <Card className="flex flex-col gap-sp-4">
        <CardHeader title="Input · Chip · ChipGroup" description="단일 선택과 다중 선택" />
        <Input
          label="닉네임"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          hint="뭐라고 부를까요?"
        />
        <Input label="이메일" defaultValue="invalid" error="이메일 형식이 아니에요" />
        <ChipGroup label="국적" options={nationalities} value={nationality} onChange={setNationality} />
        <ChipGroup multiple label="피부 고민" options={concerns} value={picked} onChange={setPicked} />
      </Card>

      <div className="grid grid-cols-1 gap-sp-4 md:grid-cols-2">
        <ConsentCard
          title="이용약관"
          description="서비스 이용에 필요한 약관에 동의해 주세요."
          requiredLabel="필수"
          agreeLabel="동의"
          declineLabel="동의 안 함"
          value={terms}
          onChange={setTerms}
        />
        <ConsentCard
          title="피부·시술 정보 수집"
          description="매칭에 필요한 피부 상태와 과거 시술 정보를 수집합니다."
          requiredLabel="필수"
          agreeLabel="동의"
          declineLabel="동의 안 함"
          value={sensitive}
          onChange={setSensitive}
        />
      </div>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title="Widget" description="날짜 범위 · 슬라이더 · 금액" />
        <WidgetDateRange value={range} onChange={setRange} startLabel="입국일" endLabel="출국일" min="2026-11-01" />
        <WidgetSlider label="다운타임 허용" steps={downtimeSteps} value={downtime} onChange={setDowntime} />
        <WidgetCurrency
          value={budget}
          onChange={setBudget}
          currencies={["KRW", "JPY", "CNY", "USD"]}
          rates={rates}
          currencyLabel="통화"
          amountLabel="예산"
          rateNote="참고 환율"
        />
      </Card>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title="Chat" description="Enter로 전송, Shift+Enter로 줄바꿈" />
        <div className="flex flex-col gap-sp-3">
          <ChatBubble from="agent" meta="PibooK">
            무엇을 받고 싶으세요?
          </ChatBubble>
          {messages.map((text, index) => (
            <ChatBubble key={`${index}-${text}`} from="user">
              {text}
            </ChatBubble>
          ))}
        </div>
        <ChatInput
          label="메시지"
          sendLabel="보내기"
          placeholder="메시지를 입력하세요"
          onSend={(text) => setMessages((prev) => [...prev, text])}
        />
      </Card>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title="Sheet" description="모바일 하단 시트" />
        <div>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            시트 열기
          </Button>
        </div>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="내 에이전트 카드" closeLabel="닫기">
          <p className="text-body text-muted">채워진 슬롯이 여기에 실시간으로 표시됩니다.</p>
        </Sheet>
      </Card>
    </div>
  );
}
