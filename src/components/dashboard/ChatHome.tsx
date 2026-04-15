"use client";

/**
 * ChatHome — 회의 57 (2026-04-15) LLM 채팅형 홈.
 * Phase 2: 기존 홈/온보딩/ConditionCheck와 병행. feature flag(ENABLE_CHAT_HOME 또는 ?chat_home=1)로 노출.
 *
 * 흐름:
 *   유저 자연어 입력 → /api/parseIntent → condition/goal/session 추출
 *     → onSubmit(condition, goal, session) 호출 (기존 handleConditionComplete 재사용)
 *     → 기존 master_plan_preview 경로 탑재
 *
 * 예시 프롬프트 탭 → 채팅창에 자동 입력 → 유저 수정/전송.
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { UserCondition, WorkoutGoal, SessionSelection } from "@/constants/workout";
import { getTrialStatus } from "@/utils/trialStatus";
import { getPlanCount } from "@/utils/userProfile";
import { getCachedWorkoutHistory } from "@/utils/workoutHistory";
import { buildHistoryDigest, buildInitialGreeting } from "@/utils/historyDigest";
import { AdviceCard, type AdviceContent } from "./AdviceCard";

interface ChatHomeProps {
  userName?: string;
  isGuest?: boolean;
  isLoggedIn?: boolean;
  isPremium?: boolean;
  onSubmit: (condition: UserCondition, goal: WorkoutGoal, session: SessionSelection, opts?: { skipLoadingAnim?: boolean }) => void | Promise<void>;
  userProfile?: {
    gender?: "male" | "female";
    birthYear?: number;
    bodyWeightKg?: number;
    heightCm?: number;
    goal?: "fat_loss" | "muscle_gain" | "endurance" | "health";
    weeklyFrequency?: number;
    bench1RM?: number;
    squat1RM?: number;
    deadlift1RM?: number;
  };
  /**
   * 전송 직전 호출되는 사전 가드. true 반환 시 parseIntent/onSubmit 진행,
   * false 반환 시 ChatHome은 아무것도 안 함 (부모가 로그인 모달/페이월 표시).
   */
  canSubmit?: () => boolean;
}

interface ParsedIntent {
  condition: UserCondition;
  goal: WorkoutGoal;
  sessionMode: "balanced" | "split" | "running" | "home_training";
  targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
  runType?: "interval" | "easy" | "long";
  intensityOverride?: "high" | "moderate" | "low";
  recentGymFrequency?: "none" | "1_2_times" | "regular";
  pushupLevel?: "zero" | "1_to_5" | "10_plus";
  confidence: number;
  missingCritical: string[];
  clarifyQuestion?: string;
}

// 예시 프롬프트 (길이별 스펙트럼). i18n 키로 관리 — ko/en 양쪽에서 번역.
const EXAMPLE_KEYS = [
  "chat_home.example.summer_diet",
  "chat_home.example.advanced_back",
  "chat_home.example.short_chest",
  "chat_home.example.short_home",
  "chat_home.example.short_run",
  "chat_home.example.medium_legs",
  "chat_home.example.long_full",
] as const;

type ChatMsg =
  | { role: "user"; kind?: "text"; content: string }
  | { role: "assistant"; kind?: "text"; content: string; tone?: "info" | "error" }
  | { role: "assistant"; kind: "advice"; advice: AdviceContent };

// view 전환 시 언마운트되더라도 세션 내 대화 유지 (새로고침 시 리셋).
let sessionCachedMessages: ChatMsg[] = [];

/** advice 변종은 content 없으므로 history 전달 시 문자열 요약으로 대체 */
function msgToHistoryContent(m: ChatMsg): string {
  if ("content" in m) return m.content;
  return "[advice card shown]";
}

/** **bold** 마크다운만 렌더링. 나머지는 평문. */
function renderMarkdownBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export const ChatHome: React.FC<ChatHomeProps> = ({ userName, onSubmit, userProfile, isLoggedIn, isPremium, canSubmit }) => {
  const { t, locale } = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => sessionCachedMessages);
  useEffect(() => { sessionCachedMessages = messages; }, [messages]);
  const [pendingIntent, setPendingIntent] = useState<ParsedIntent | null>(null);
  const [routing, setRouting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const buildIntentSummary = (intent: ParsedIntent): string => {
    const goalKo: Record<string, string> = {
      fat_loss: "체지방 감량", muscle_gain: "근비대", strength: "근력", general_fitness: "건강 유지",
    };
    const goalEn: Record<string, string> = {
      fat_loss: "fat loss", muscle_gain: "muscle gain", strength: "strength", general_fitness: "general fitness",
    };
    const muscleKo: Record<string, string> = {
      chest: "가슴", back: "등", shoulders: "어깨", arms: "팔", legs: "하체",
    };
    const muscleEn: Record<string, string> = {
      chest: "chest", back: "back", shoulders: "shoulders", arms: "arms", legs: "legs",
    };
    const runTypeKo: Record<string, string> = { interval: "인터벌", easy: "쉬운 러닝", long: "롱런" };
    const runTypeEn: Record<string, string> = { interval: "interval", easy: "easy run", long: "long run" };

    let part = "";
    if (intent.sessionMode === "running") {
      part = locale === "en"
        ? (intent.runType ? runTypeEn[intent.runType] : "run")
        : (intent.runType ? runTypeKo[intent.runType] : "러닝");
    } else if (intent.sessionMode === "home_training") {
      part = locale === "en" ? "home workout" : "홈트";
    } else if (intent.sessionMode === "split" && intent.targetMuscle) {
      part = locale === "en" ? muscleEn[intent.targetMuscle] : muscleKo[intent.targetMuscle];
    } else {
      part = locale === "en" ? "full body" : "전신";
    }
    const time = `${intent.condition.availableTime}${locale === "en" ? " min" : "분"}`;
    const goal = locale === "en" ? goalEn[intent.goal] : goalKo[intent.goal];
    return `${part} · ${time} · ${goal}`;
  };

  const confirmPlan = async () => {
    if (!pendingIntent || routing) return;
    setRouting(true);
    const session: SessionSelection = {
      goal: pendingIntent.goal,
      sessionMode: pendingIntent.sessionMode,
      targetMuscle: pendingIntent.targetMuscle,
      runType: pendingIntent.runType,
    };
    try {
      // 채팅에서 이미 확인했으므로 PlanLoadingOverlay 스킵 (대표 지시)
      await onSubmit(pendingIntent.condition, pendingIntent.goal, session, { skipLoadingAnim: true });
    } catch (e) {
      console.error("ChatHome confirmPlan error:", e);
      setRouting(false);
    }
  };

  const cancelPlan = () => {
    setPendingIntent(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: locale === "en" ? "No problem — tell me what to change." : "알겠어요! 뭘 바꿀까요?" },
    ]);
  };

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const displayName = userName || t("home.defaultName");

  // 회의 57: HomeScreen과 동일한 상단 CTA(인사 + 날짜) 고정 재사용.
  const greetingMsg = (() => {
    const hour = new Date().getHours();
    if (hour < 6) return t("home.greeting.dawn");
    if (hour < 10) return t("home.greeting.morning");
    if (hour < 12) return t("home.greeting.preLunch");
    if (hour < 15) return t("home.greeting.lunch");
    if (hour < 18) return t("home.greeting.afternoon");
    if (hour < 21) return t("home.greeting.evening");
    return t("home.greeting.night");
  })();

  const dateStr = (() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = locale === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["일", "월", "화", "수", "목", "금", "토"];
    if (locale === "en") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[month - 1]} ${date} (${days[now.getDay()]})`;
    }
    return `${month}월 ${date}일 (${days[now.getDay()]})`;
  })();

  useEffect(() => {
    // 초기 포커스는 주지 않음 (모바일 키보드 강제 팝업 방지)
  }, []);

  const fillExample = (key: string) => {
    const example = t(key);
    setText(example);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(example.length, example.length);
    });
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // 회의 57 Phase 3: 체험 소진/페이월 사전 가드 — Gemini 호출 전에 차단
    if (canSubmit && !canSubmit()) return;

    // 유저 메시지 먼저 채팅에 반영 (대표 지시: 내 입력이 보여야 대화 느낌)
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setText("");
    setBusy(true);
    // 새 입력이 들어오면 이전 확인 카드 즉시 제거 (유저가 마음 바꾼 상태로 간주)
    setPendingIntent(null);

    try {
      const { auth } = await import("@/lib/firebase");
      const user = auth.currentUser;
      if (!user) {
        setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.auth"), tone: "error" }]);
        setBusy(false);
        return;
      }
      const token = await user.getIdToken();

      // 같은 질문 반복 방지를 위해 최근 대화 8개까지 전달
      const recentHistory = messages.slice(-8).map((m) => ({
        role: m.role,
        content: msgToHistoryContent(m),
      }));

      // 운동 이력 요약 (localStorage 캐시 기반, 0~50ms) — 개인화 추천용
      const workoutDigest = buildHistoryDigest(getCachedWorkoutHistory(), locale);

      const res = await fetch("/api/parseIntent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: trimmed, locale, userProfile, history: recentHistory, workoutDigest }),
      });

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.generic"), tone: "error" }]);
        setBusy(false);
        return;
      }

      const data = (await res.json()) as
        | { mode: "chat"; reply: string }
        | { mode: "plan"; intent: ParsedIntent }
        | { mode: "advice"; advice: AdviceContent };

      if (data.mode === "chat") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setBusy(false);
        return;
      }

      if (data.mode === "advice") {
        setMessages((prev) => [...prev, { role: "assistant", kind: "advice", advice: data.advice }]);
        setBusy(false);
        return;
      }

      // plan 모드 — 유저 확인 버튼 제시 (자동 전환 아님, 대표 지시)
      const intent = data.intent;
      const summary = buildIntentSummary(intent);
      setPendingIntent(intent);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: locale === "en"
          ? `Got it! ${summary} — ready when you are.`
          : `이해했어요! ${summary} — 준비됐어요.` },
      ]);
      setBusy(false);
    } catch (e) {
      console.error("ChatHome submit error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.generic"), tone: "error" }]);
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFBF9] relative overflow-hidden">
      {/* 상단 CTA — HomeScreen과 동일 형태로 고정 */}
      <div className="pt-[max(2.5rem,env(safe-area-inset-top))] px-6 pb-2 shrink-0">
        <h1 className="font-black leading-snug">
          <span className={`text-[#2D6A4F] ${displayName.length > 6 ? "text-2xl" : "text-3xl"}`}>{displayName}</span>
          <span className={`text-[#1B4332] ${greetingMsg.length > 14 ? "text-base" : "text-xl"}`}> {locale === "en" ? "" : "님, "}{greetingMsg}</span>
        </h1>
        <p className="text-[12px] font-medium text-gray-400 mt-1">{dateStr}</p>
      </div>

      {/* 채팅 섹션 — Kenko 스타일: 플랫 + 얇은 라인 구분 */}
      <div className="mt-4 border-t border-gray-200 flex-1 flex flex-col min-h-0">
        {/* 헤더 — 우측에 무료 체험 배지 인라인 (회의 57 대표 지시) */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200">
          <img src="/favicon_backup.png" alt="AI" className="w-7 h-7 rounded-full shrink-0" />
          <div>
            <p className="text-xs font-black text-[#1B4332]">{locale === "en" ? "AI Coach" : "AI 코치"}</p>
            <p className="text-[9px] text-[#2D6A4F] font-medium">{locale === "en" ? "Online" : "온라인"}</p>
          </div>
          {!isPremium && (() => {
            const trial = getTrialStatus(isLoggedIn ?? false, isPremium ?? false, getPlanCount());
            if (trial.stage === "premium") return null;
            const dots = Array.from({ length: trial.currentLimit });
            const label = locale === "ko"
              ? (trial.stage === "guest"
                  ? `무료 체험 ${trial.currentCompleted}/${trial.currentLimit}${trial.remaining === 0 ? " · 로그인 필요" : trial.remaining === 1 ? " · 1회 남음" : ""}`
                  : trial.stage === "exhausted"
                  ? "무료 체험 완료"
                  : `무료 체험 ${trial.currentCompleted}/${trial.currentLimit}${trial.remaining === 1 ? " · 1회 남음" : ""}`)
              : (trial.stage === "guest"
                  ? `Free ${trial.currentCompleted}/${trial.currentLimit}${trial.remaining === 0 ? " · sign in" : trial.remaining === 1 ? " · 1 left" : ""}`
                  : trial.stage === "exhausted"
                  ? "Trial done"
                  : `Free ${trial.currentCompleted}/${trial.currentLimit}${trial.remaining === 1 ? " · 1 left" : ""}`);
            return (
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <div className="flex gap-0.5">
                  {dots.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-1 rounded-full transition-colors ${
                        i < trial.currentCompleted ? "bg-[#2D6A4F]" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-[#1B4332] whitespace-nowrap">{label}</span>
              </div>
            );
          })()}
        </div>

        {/* 메시지 영역 */}
        <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
          {/* 최초 안내 (항상 노출) — 운동 이력 기반 룰베이스 인사 */}
          <p className="text-[13px] text-[#1B4332] leading-relaxed whitespace-pre-wrap break-keep">
            {renderMarkdownBold(buildInitialGreeting(getCachedWorkoutHistory(), locale, {
              goal: userProfile?.goal,
              weeklyFrequency: userProfile?.weeklyFrequency,
              bench1RM: userProfile?.bench1RM,
              squat1RM: userProfile?.squat1RM,
              deadlift1RM: userProfile?.deadlift1RM,
            }, userName))}
          </p>

          {/* 대화 히스토리 */}
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex gap-2.5 mt-3 justify-end">
                  <div className="max-w-[85%] bg-[#1B4332] text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 shadow-sm text-[13px] leading-relaxed whitespace-pre-wrap break-keep">
                    {msg.content}
                  </div>
                </div>
              );
            }
            if ("kind" in msg && msg.kind === "advice") {
              return (
                <div key={i} className="mt-3">
                  <div className="min-w-0">
                    <AdviceCard
                      advice={msg.advice}
                      onStartRecommended={async () => {
                        if (canSubmit && !canSubmit()) return;
                        setRouting(true);
                        try {
                          await onSubmit(
                            msg.advice.recommendedWorkout.condition,
                            msg.advice.recommendedWorkout.goal,
                            {
                              goal: msg.advice.recommendedWorkout.goal,
                              sessionMode: msg.advice.recommendedWorkout.sessionMode,
                              targetMuscle: msg.advice.recommendedWorkout.targetMuscle,
                              runType: msg.advice.recommendedWorkout.runType,
                            },
                            { skipLoadingAnim: true },
                          );
                        } catch (e) {
                          console.error("AdviceCard start error:", e);
                          setRouting(false);
                        }
                      }}
                      starting={routing}
                    />
                  </div>
                </div>
              );
            }
            // 남은 variant: { role: "assistant"; content: string; tone?: ... }
            const textMsg = msg as { role: "assistant"; content: string; tone?: "info" | "error" };
            return (
              <p
                key={i}
                className={`mt-3 text-[13px] leading-relaxed whitespace-pre-wrap break-keep ${
                  textMsg.tone === "error" ? "text-amber-700" : "text-[#1B4332]"
                }`}
              >
                {renderMarkdownBold(textMsg.content)}
              </p>
            );
          })}

          {/* 플랜 확인 카드 — 자동 전환 대신 유저 탭 요구. busy 중이면 숨김 (새 분석 중) */}
          {pendingIntent && !routing && !busy && (
            <div className="mt-3">
              <div className="bg-white rounded-2xl px-3.5 py-3 border border-[#2D6A4F]/20">
                <p className="text-[12px] text-gray-500 mb-2">
                  {locale === "en" ? "Ready to build this plan?" : "이 플랜으로 시작할까요?"}
                </p>
                <p className="text-[14px] font-bold text-[#1B4332] mb-3">
                  {buildIntentSummary(pendingIntent)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={confirmPlan}
                    className="flex-1 py-2.5 rounded-xl bg-[#1B4332] text-white text-[13px] font-bold active:scale-[0.97] transition-all hover:bg-[#2D6A4F]"
                  >
                    {locale === "en" ? "Start plan" : "플랜 시작"}
                  </button>
                  <button
                    onClick={cancelPlan}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-bold active:scale-[0.97] transition-all"
                  >
                    {locale === "en" ? "Change" : "다시"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 플랜 이동 중 표시 */}
          {routing && (
            <p className="mt-3 text-[13px] text-[#1B4332] leading-relaxed break-keep">
              {t("chat_home.confirm.routing")}
            </p>
          )}

          {/* 생각 중 — busy일 때만 */}
          {busy && (
            <div className="mt-3 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* 입력 */}
        <div className="px-6 py-1.5 border-t border-gray-200">
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={t("chat_home.placeholder")}
              disabled={busy}
              className="flex-1 text-sm bg-transparent px-0 py-1 border-0 focus:outline-none text-[#1B4332] placeholder-gray-400 disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || busy}
              className="w-7 h-7 bg-[#1B4332] text-white rounded-lg flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
              aria-label={t("chat_home.send")}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.2L4.5 11l7.5 1-7.5 1-2.49 6.2a1 1 0 001.39 1.2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 예시 프롬프트 — 가로 스와이프 (우측 fade로 추가 내용 힌트) */}
      <div className="shrink-0 pt-3 pb-4 border-t border-gray-200 relative">
        <p className="px-6 text-[11px] font-medium text-gray-400 tracking-wider uppercase mb-2">
          {t("chat_home.examples.title")}
        </p>
        <div
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-scroll-container
        >
          {EXAMPLE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => fillExample(key)}
              disabled={busy}
              className="snap-start shrink-0 text-left px-3.5 py-2 rounded-full bg-white border border-gray-200 hover:border-[#2D6A4F]/40 hover:bg-emerald-50/40 active:scale-[0.97] transition-all text-[12.5px] text-gray-700 disabled:opacity-50 whitespace-nowrap"
            >
              {t(key)}
            </button>
          ))}
        </div>
        {/* 좌우 fade — 양쪽에 더 있음 힌트 */}
        <div className="pointer-events-none absolute left-0 top-6 bottom-1 w-8 bg-gradient-to-r from-[#FAFBF9] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-6 bottom-1 w-8 bg-gradient-to-l from-[#FAFBF9] to-transparent" />
      </div>
    </div>
  );
};
