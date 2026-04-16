"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { getAuth } from "firebase/auth";
import { AssistantMiniHeader } from "@/components/chat/AssistantMiniHeader";
import { QuickFollowupList, type FollowupItem } from "@/components/chat/QuickFollowupList";

interface NutritionGuide {
  dailyCalorie: number;
  goalBasis: string;
  macros: { protein: number; carb: number; fat: number };
  meals: { time: string; menu: string }[];
  keyTip: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NutritionTabProps {
  bodyWeightKg: number;
  heightCm?: number;
  age: number;
  gender: "male" | "female";
  goal: string;
  weeklyFrequency: number;
  todaySession: {
    type: string;
    durationMin: number;
    bodyPart?: string;
    estimatedCalories: number;
  };
  /** 부모에서 캐시된 가이드 (탭 전환 시 리셋 방지) */
  cachedGuide?: NutritionGuide | null;
  /** 가이드 로드 완료 시 부모에 전달 */
  onGuideLoaded?: (guide: NutritionGuide) => void;
  /** 유료 회원 여부 (채팅 무제한) */
  isPremium?: boolean;
  /** 읽기 전용 모드 (히스토리 뷰) */
  readOnly?: boolean;
  /** 히스토리에서 저장된 채팅 기록 */
  savedChatHistory?: ChatMessage[];
  /** 채팅 변경 시 부모에 전달 (저장용) */
  onChatHistoryChange?: (messages: ChatMessage[]) => void;
}

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken();
}

/** 시간대별 영양 코치 Quick Chips (룰베이스, Gemini 호출 없음) */
function getNutritionChips(locale: "ko" | "en", hour: number): FollowupItem[] {
  if (locale === "en") {
    if (hour < 10) return [
      { icon: "food", label: "Quick protein breakfast", prompt: "How to hit protein fast at breakfast?" },
      { icon: "diet", label: "Lunch out picks", prompt: "What should I eat for lunch out?" },
      { icon: "protein", label: "Protein timing", prompt: "When should I take protein around workouts?" },
      { icon: "sleep", label: "Fasted coffee OK?", prompt: "Is fasted morning coffee OK?" },
    ];
    if (hour < 14) return [
      { icon: "food", label: "Lunch out menu", prompt: "Lunch options for busy office workers" },
      { icon: "diet", label: "Under 400kcal ideas", prompt: "Lunch ideas under 400kcal" },
      { icon: "plateau", label: "Daily carb target", prompt: "How much carbs per day for my weight?" },
      { icon: "protein", label: "Afternoon snack", prompt: "Protein-focused afternoon snack ideas" },
    ];
    if (hour < 18) return [
      { icon: "food", label: "I'm hungry now", prompt: "Healthy snack right now while keeping on track" },
      { icon: "protein", label: "Pre-workout meal", prompt: "What to eat 1 hour before workout?" },
      { icon: "sleep", label: "Caffeine limit", prompt: "Safe daily caffeine limit?" },
      { icon: "diet", label: "Hydration check", prompt: "Am I drinking enough water?" },
    ];
    if (hour < 22) return [
      { icon: "food", label: "Dinner protein focus", prompt: "High-protein dinner ideas" },
      { icon: "flame", label: "Drinking tonight", prompt: "I'm drinking tonight, how to minimize damage?" },
      { icon: "sleep", label: "Late-night snack?", prompt: "OK to snack after dinner?" },
      { icon: "posture", label: "Recovery foods", prompt: "Best recovery foods before sleep?" },
    ];
    return [
      { icon: "sleep", label: "Late-night limit", prompt: "What's safe to eat this late?" },
      { icon: "diet", label: "Water intake", prompt: "Should I drink more water before bed?" },
      { icon: "food", label: "Tomorrow's breakfast", prompt: "Plan tomorrow's breakfast for me" },
      { icon: "calendar", label: "Log today's meals", prompt: "How do I track today's meals?" },
    ];
  }
  // ko
  if (hour < 10) return [
    { icon: "food", label: "아침 단백질 빨리", prompt: "아침에 단백질 빨리 채우는 법 알려줘" },
    { icon: "diet", label: "점심 외식 메뉴", prompt: "점심 외식할 때 뭘 먹을까?" },
    { icon: "protein", label: "프로틴 타이밍", prompt: "운동 전후 프로틴 언제 먹어?" },
    { icon: "sleep", label: "공복 커피 괜찮?", prompt: "아침 공복에 커피 마셔도 돼?" },
  ];
  if (hour < 14) return [
    { icon: "food", label: "점심 외식 추천", prompt: "직장인 점심 외식 추천해줘" },
    { icon: "diet", label: "400kcal 이하", prompt: "점심 400kcal로 끊고 싶어" },
    { icon: "plateau", label: "탄수 적정량", prompt: "내 몸무게 기준 탄수 하루 얼마?" },
    { icon: "protein", label: "오후 간식", prompt: "오후 간식 단백질 위주로 추천" },
  ];
  if (hour < 18) return [
    { icon: "food", label: "지금 배고픈데", prompt: "지금 배고픈데 건강한 간식 추천" },
    { icon: "protein", label: "운동 전 식사", prompt: "운동 1시간 전에 뭐 먹어?" },
    { icon: "sleep", label: "카페인 한도", prompt: "하루 카페인 얼마까지 괜찮아?" },
    { icon: "diet", label: "물 얼마나?", prompt: "오늘 물 충분히 마셨나?" },
  ];
  if (hour < 22) return [
    { icon: "food", label: "저녁 단백질", prompt: "저녁 단백질 위주 메뉴 추천" },
    { icon: "flame", label: "술 약속인데", prompt: "오늘 술 약속인데 어떻게 조절해?" },
    { icon: "sleep", label: "야식 괜찮?", prompt: "저녁 먹고 야식 먹어도 돼?" },
    { icon: "posture", label: "회복 음식", prompt: "잠들기 전 회복에 좋은 음식?" },
  ];
  return [
    { icon: "sleep", label: "야식 한계", prompt: "이 시간엔 뭐 먹어도 돼?" },
    { icon: "diet", label: "수분 섭취", prompt: "자기 전 물 더 마셔야 해?" },
    { icon: "food", label: "내일 아침 준비", prompt: "내일 아침 식단 미리 짜줘" },
    { icon: "calendar", label: "오늘 식단 기록", prompt: "오늘 뭐 먹었는지 기록하는 법" },
  ];
}

/** [영양] 탭 — Gemini 영양 가이드 + 채팅 (회의 37) */
export const NutritionTab: React.FC<NutritionTabProps> = ({
  bodyWeightKg,
  heightCm,
  cachedGuide,
  onGuideLoaded,
  isPremium,
  readOnly,
  savedChatHistory,
  onChatHistoryChange,
  age,
  gender,
  goal,
  weeklyFrequency,
  todaySession,
}) => {
  const { locale } = useTranslation();
  const isKo = locale === "ko";
  const [guide, setGuide] = useState<NutritionGuide | null>(cachedGuide ?? null);
  const [loading, setLoading] = useState(!cachedGuide);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(savedChatHistory ?? []);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [showCalorieHelp, setShowCalorieHelp] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const MAX_FREE_CHATS = 3;

  // 가이드 로드 (캐시 있으면 스킵)
  useEffect(() => {
    if (cachedGuide) return;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/getNutritionGuide", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            locale,
            bodyWeightKg,
            heightCm,
            age,
            gender,
            goal,
            weeklyFrequency,
            todaySession,
          }),
        });
        const data = await res.json();
        setGuide(data);
        onGuideLoaded?.(data);
      } catch (err) {
        console.error("Nutrition guide fetch failed:", err);
        // 폴백
        setGuide({
          dailyCalorie: Math.round(bodyWeightKg * 33),
          goalBasis: isKo ? "일반 기준" : "General",
          macros: {
            protein: Math.round(bodyWeightKg * 1.8),
            carb: Math.round(bodyWeightKg * 4),
            fat: Math.round(bodyWeightKg * 0.9),
          },
          meals: isKo
            ? [
                { time: "아침", menu: "오트밀 + 계란 3개 + 프로틴" },
                { time: "점심", menu: "밥 + 닭가슴살 + 견과류" },
                { time: "간식", menu: "프로틴 쉐이크 + 바나나" },
                { time: "저녁", menu: "밥 + 소고기/생선 200g" },
              ]
            : [
                { time: "Breakfast", menu: "Oatmeal + 3 eggs + protein" },
                { time: "Lunch", menu: "Rice + chicken + nuts" },
                { time: "Snack", menu: "Protein shake + banana" },
                { time: "Dinner", menu: "Rice + beef/fish 200g" },
              ],
          keyTip: isKo ? "단백질만 맞추면 나머지는 유동적으로 OK" : "Hit your protein and the rest is flexible",
        });
        // 폴백도 부모에 전달
        onGuideLoaded?.({
          dailyCalorie: Math.round(bodyWeightKg * 33),
          goalBasis: isKo ? "일반 기준" : "General",
          macros: { protein: Math.round(bodyWeightKg * 1.8), carb: Math.round(bodyWeightKg * 4), fat: Math.round(bodyWeightKg * 0.9) },
          meals: isKo
            ? [{ time: "아침", menu: "오트밀 + 계란 3개 + 프로틴" }, { time: "점심", menu: "밥 + 닭가슴살 + 견과류" }, { time: "간식", menu: "프로틴 쉐이크 + 바나나" }, { time: "저녁", menu: "밥 + 소고기/생선 200g" }]
            : [{ time: "Breakfast", menu: "Oatmeal + 3 eggs + protein" }, { time: "Lunch", menu: "Rice + chicken + nuts" }, { time: "Snack", menu: "Protein shake + banana" }, { time: "Dinner", menu: "Rice + beef/fish 200g" }],
          keyTip: isKo ? "단백질만 맞추면 나머지는 유동적으로 OK" : "Hit your protein and the rest is flexible",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase A CP4: 제출 취소용 AbortController
  const chatAbortRef = useRef<AbortController | null>(null);
  const abortChat = () => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setChatLoading(false);
    // 마지막 user 메시지는 남기되, 정지 안내 추가
    setChatMessages((prev) => [...prev, {
      role: "assistant" as const,
      content: isKo ? "멈췄어요. 다시 말씀해주시면 돼요." : "Stopped. Send again when ready.",
    }]);
  };

  // 채팅 보내기
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || (!isPremium && chatCount >= MAX_FREE_CHATS)) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);
    setChatCount((c) => c + 1);

    try {
      chatAbortRef.current = new AbortController();
      const token = await getIdToken();
      const res = await fetch("/api/nutritionChat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        signal: chatAbortRef.current.signal,
        body: JSON.stringify({
          question,
          locale,
          context: {
            bodyWeightKg,
            age,
            gender,
            goal,
            todaySession: `${todaySession.type} ${todaySession.durationMin}min`,
            currentGuide: guide ? `${guide.dailyCalorie}kcal P${guide.macros.protein}g C${guide.macros.carb}g F${guide.macros.fat}g` : undefined,
          },
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => {
        const updated = [...prev, { role: "assistant" as const, content: data.answer }];
        onChatHistoryChange?.(updated);
        return updated;
      });
    } catch (e) {
      // 유저가 Stop 눌러서 발생한 AbortError는 조용히 종료 (abortChat에서 이미 메시지 추가됨)
      if (e instanceof DOMException && e.name === "AbortError") return;
      setChatMessages((prev) => {
        const updated = [...prev, { role: "assistant" as const, content: isKo ? "잠시 후 다시 시도해주세요" : "Please try again" }];
        onChatHistoryChange?.(updated);
        return updated;
      });
    } finally {
      setChatLoading(false);
      chatAbortRef.current = null;
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#2D6A4F] rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 bg-[#2D6A4F] rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
          <div className="w-2 h-2 bg-[#2D6A4F] rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
        </div>
        <p className="text-sm text-gray-400 font-medium">
          {isKo ? "맞춤 영양 가이드를 준비하고 있어요" : "Preparing your nutrition guide"}
        </p>
      </div>
    );
  }

  /** 간단 마크다운 → JSX 렌더러 (bold, 리스트, 줄바꿈) */
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, li) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={li} />;

      // 리스트 아이템 (* 또는 - 시작)
      const isBullet = /^[*\-]\s+/.test(trimmed);
      const content = isBullet ? trimmed.replace(/^[*\-]\s+/, "") : trimmed;

      // **bold** 처리
      const parts = content.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, pi) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) return <strong key={pi} className="font-bold">{boldMatch[1]}</strong>;
        return <span key={pi}>{part}</span>;
      });

      if (isBullet) {
        return (
          <div key={li} className="flex gap-1.5 mt-1.5 first:mt-0">
            <span className="text-[#2D6A4F] shrink-0 mt-px">&#8226;</span>
            <span>{rendered}</span>
          </div>
        );
      }

      return <p key={li} className={li > 0 ? "mt-1.5" : ""}>{rendered}</p>;
    });
  };

  if (!guide) return null;

  const totalMacroCal = guide.macros.protein * 4 + guide.macros.carb * 4 + guide.macros.fat * 9;
  const proteinPct = Math.round((guide.macros.protein * 4 / totalMacroCal) * 100);
  const carbPct = Math.round((guide.macros.carb * 4 / totalMacroCal) * 100);
  const fatPct = 100 - proteinPct - carbPct;

  return (
    <div className="min-h-full flex flex-col">
      {/* 칼로리 + 목표 — 스크롤 시 상단 고정 */}
      <div className="sticky top-0 z-10 bg-[#FAFBF9] py-5 px-1 relative">
        <button onClick={() => setShowCalorieHelp(true)} className="absolute top-4 right-1 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="text-[11px] font-black text-gray-400">?</span>
        </button>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
          {isKo ? "하루 목표 칼로리" : "Daily Target"}
        </p>
        <p className="text-3xl font-black text-[#1B4332]">
          {guide.dailyCalorie.toLocaleString()} <span className="text-base font-bold text-gray-400">kcal</span>
        </p>
        <p className="text-[10px] text-gray-500 mt-1">{guide.goalBasis}</p>

        {/* 탄단지 바 — 단백질 우선 철학 시각화 (단백질 굵고 진함, 탄단·지 보조로 얇게) */}
        <div className="mt-4">
          {/* 단백질 — 메인 강조 */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-[11px] font-black text-[#1B4332] tracking-wide">{isKo ? "단백질" : "Protein"}</span>
              <span className="text-[11px] font-black text-[#1B4332]">{guide.macros.protein}g</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#1B4332] rounded-full" style={{ width: `${proteinPct}%` }} />
            </div>
          </div>
          {/* 탄수화물 / 지방 — 얇고 옅게 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] font-bold text-gray-400">{isKo ? "탄수화물" : "Carbs"}</span>
                <span className="text-[9px] font-bold text-gray-500">{guide.macros.carb}g</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-300 rounded-full" style={{ width: `${carbPct}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] font-bold text-gray-400">{isKo ? "지방" : "Fat"}</span>
                <span className="text-[9px] font-bold text-gray-500">{guide.macros.fat}g</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-200 rounded-full" style={{ width: `${fatPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 식단 예시 */}
      <div className="py-5 px-1 border-t border-gray-200">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">
          {isKo ? "오늘 이렇게 챙겨보세요" : "Today's meal plan"}
        </p>
        <div className="space-y-3">
          {guide.meals.map((meal, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-[10px] font-bold text-gray-400 min-w-[40px] pt-0.5">{meal.time}</span>
              <span className="text-sm text-[#1B4332] font-medium">{meal.menu}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-[#1B4332]/5 rounded-xl p-3">
          <p className="text-xs font-bold text-[#1B4332]">{guide.keyTip}</p>
        </div>
      </div>

      {/* 채팅 영역 — Phase A: 상단 고정 헤더 제거. 무료 횟수 표시는 우측 상단 배지로 축약. */}
      <div className="border-t border-gray-200 flex-1 flex flex-col min-h-0 relative">
        {chatCount > 0 && !isPremium && (
          <span className="absolute right-1 top-2 z-10 text-[9px] text-gray-400 font-medium">
            {chatCount}/{MAX_FREE_CHATS}
          </span>
        )}

        {/* 채팅 메시지 */}
        <div className="py-4 px-1 flex-1 min-h-0 overflow-y-auto">
          {chatMessages.length === 0 && (
            <p className="text-xs text-gray-500 break-keep">
              {isKo ? "식단이나 영양에 대해 궁금한 거 물어보세요" : "Ask me anything about your diet or nutrition"}
            </p>
          )}
          {chatMessages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className={`flex ${i > 0 ? "mt-3" : ""} justify-end`}>
                  <div className="max-w-[85%] bg-[#1B4332] text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 shadow-sm text-[13px] leading-relaxed whitespace-pre-wrap break-keep">
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={i > 0 ? "mt-3" : ""}
              >
                <AssistantMiniHeader locale={isKo ? "ko" : "en"} />
                <div className="text-[13px] text-[#1B4332] leading-relaxed break-keep">
                  {renderFormattedText(msg.content)}
                </div>
              </div>
            );
          })}
          {chatLoading && (
            <div className="mt-3">
              <AssistantMiniHeader locale={isKo ? "ko" : "en"} />
              <div className="bg-white border border-gray-200 rounded-xl px-3.5 py-3 shadow-sm w-full max-w-[280px]">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 60" />
                  </svg>
                  <span className="text-[12px] font-semibold text-[#1B4332]">
                    {isKo ? "영양 분석 중" : "Analyzing nutrition"}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 시간대별 Quick Chips — 채팅 시작 전에만 노출 */}
        {!readOnly && (isPremium || chatCount < MAX_FREE_CHATS) && chatMessages.length === 0 && !chatLoading && (
          <div className="px-1">
            <QuickFollowupList
              locale={isKo ? "ko" : "en"}
              items={getNutritionChips(isKo ? "ko" : "en", new Date().getHours())}
              onTap={(prompt) => {
                setChatInput(prompt);
                // 입력창에 채워서 유저가 확인 후 보내게 함 (탐색 의도 고려)
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
              }}
            />
          </div>
        )}

        {/* 입력 영역 — ChatHome 스타일 2단 라운드 카드 */}
        <div className="py-2">
          {readOnly ? (
            chatMessages.length === 0 ? null : (
              <p className="text-center text-[10px] text-gray-400 py-1">
                {isKo ? "저장된 대화 기록이에요" : "Saved chat history"}
              </p>
            )
          ) : (isPremium || chatCount < MAX_FREE_CHATS) ? (
            <div className="bg-white border border-gray-200 rounded-3xl px-4 pt-3 pb-2 shadow-sm focus-within:border-[#2D6A4F]/50 transition-colors">
              <textarea
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder={isKo ? "오늘 식단 뭐 궁금하세요?" : "What do you want to know about your diet?"}
                rows={1}
                className="w-full text-[14px] bg-transparent px-0 py-1 border-0 focus:outline-none text-[#1B4332] placeholder-gray-400 disabled:opacity-50 resize-none overflow-y-auto leading-[1.5]"
              />
              <div className="flex items-center justify-end mt-1">
                {chatLoading ? (
                  <button
                    onClick={abortChat}
                    className="w-9 h-9 bg-[#1B4332] text-white rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 hover:bg-[#2D6A4F]"
                    aria-label={isKo ? "정지" : "Stop"}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim()}
                    className="w-9 h-9 bg-[#1B4332] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:bg-gray-300 active:scale-95 transition-all shrink-0"
                    aria-label={isKo ? "보내기" : "Send"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400 py-1">
              {isKo ? "무료 질문 3회를 사용했어요" : "You've used 3 free questions"}
            </p>
          )}
        </div>
      </div>

      {/* 면책조항 */}
      <p className="text-center text-[10px] text-gray-700 font-medium px-4 pt-4">
        {isKo
          ? "일반적인 영양 정보이며 개인 건강 상담을 대체하지 않습니다"
          : "General nutrition information. Not a substitute for professional advice."}
      </p>

      {/* 칼로리 도움말 모달 */}
      {showCalorieHelp && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowCalorieHelp(false)}>
          <div className="bg-white rounded-2xl mx-6 max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-[#1B4332]">
                {isKo ? "칼로리 계산 방법" : "How calories are calculated"}
              </h3>
              <button onClick={() => setShowCalorieHelp(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-bold text-[#1B4332] text-xs mb-1">
                  {isKo ? "1. 기초대사량 (BMR)" : "1. Basal Metabolic Rate (BMR)"}
                </p>
                <p className="text-xs leading-relaxed">
                  {isKo
                    ? "Mifflin-St Jeor 공식으로 계산해요. 성별, 체중, 키, 나이를 기반으로 아무것도 안 해도 몸이 쓰는 에너지예요."
                    : "Calculated using the Mifflin-St Jeor formula based on your gender, weight, height, and age."}
                </p>
              </div>
              <div>
                <p className="font-bold text-[#1B4332] text-xs mb-1">
                  {isKo ? "2. 활동대사량 (TDEE)" : "2. Total Daily Energy Expenditure (TDEE)"}
                </p>
                <p className="text-xs leading-relaxed">
                  {isKo
                    ? "BMR에 주간 운동 횟수에 따른 활동계수를 곱해요. 운동을 많이 할수록 하루에 쓰는 칼로리가 높아져요."
                    : "BMR multiplied by an activity factor based on how often you work out per week."}
                </p>
              </div>
              <div>
                <p className="font-bold text-[#1B4332] text-xs mb-1">
                  {isKo ? "3. 목표 반영" : "3. Goal Adjustment"}
                </p>
                <p className="text-xs leading-relaxed">
                  {isKo
                    ? "감량 목표면 -400kcal, 증량 목표면 +300kcal을 조정해요. 건강/체력 목표는 TDEE를 그대로 유지해요."
                    : "Fat loss: -400kcal, muscle gain: +300kcal. Health/endurance goals maintain TDEE as is."}
                </p>
              </div>
              <div>
                <p className="font-bold text-[#1B4332] text-xs mb-1">
                  {isKo ? "4. 탄단지 배분" : "4. Macro Split"}
                </p>
                <p className="text-xs leading-relaxed">
                  {isKo
                    ? "단백질은 체중 x 1.6~2.0g (목표별), 지방은 체중 x 0.9g, 나머지를 탄수화물로 채워요."
                    : "Protein: 1.6-2.0g/kg (by goal), fat: 0.9g/kg, remaining calories from carbs."}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 mb-2">
                {isKo ? "출처 및 근거" : "Sources & References"}
              </p>
              <div className="space-y-1">
                <p className="text-[9px] text-gray-400">
                  {isKo ? "BMR: Mifflin-St Jeor et al. (1990) — 미국임상영양학회지" : "BMR: Mifflin-St Jeor et al. (1990) — Am J Clin Nutr"}
                </p>
                <p className="text-[9px] text-gray-400">
                  {isKo ? "단백질: ISSN Position Stand (2017) — 체중당 1.6~2.2g 권장" : "Protein: ISSN Position Stand (2017) — 1.6-2.2g/kg recommended"}
                </p>
                <p className="text-[9px] text-gray-400">
                  {isKo ? "활동계수: ACSM Guidelines for Exercise Testing (11th ed.)" : "Activity Factor: ACSM Guidelines for Exercise Testing (11th ed.)"}
                </p>
                <p className="text-[9px] text-gray-400">
                  {isKo ? "감량 적자: ACSM/AHA 공동 성명 — 주 0.5~1kg 감량 권장" : "Deficit: ACSM/AHA Joint Statement — 0.5-1kg/week loss recommended"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
