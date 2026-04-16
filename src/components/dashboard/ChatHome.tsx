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
import { trackEvent } from "@/utils/analytics";

interface ChatHomeProps {
  userName?: string;
  isGuest?: boolean;
  isLoggedIn?: boolean;
  isPremium?: boolean;
  onOpenMyPlans?: () => void;
  savedPlansCount?: number;
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
  /**
   * canSubmit이 false 반환했을 때 이유 조회용. 결과가 null이 아니면
   * ChatHome이 채팅 히스토리에 인라인 업그레이드 카드 추가 (모달은 부모가 이미 띄움).
   * Phase 4 (회의 60).
   */
  getBlockReason?: () => UpgradeTrigger | null;
  onRequestLogin?: () => void;
  onRequestPaywall?: () => void;
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

// 예시 프롬프트 (마누스식 칩). key = i18n 프롬프트, label = 짧은 칩 라벨, icon = SVG path
type ExampleChip = { key: string; labelKo: string; labelEn: string; icon: ChipIconType };
type ChipIconType = "chest" | "home" | "run" | "legs" | "diet" | "back" | "full" | "cycle" | "shoulder" | "posture" | "calendar";
// 기본 노출 (4개 — 가벼운 진입용)
const EXAMPLE_CHIPS: ExampleChip[] = [
  { key: "chat_home.example.short_chest", labelKo: "가슴 30분", labelEn: "Chest 30m", icon: "chest" },
  { key: "chat_home.example.medium_legs", labelKo: "하체 40분", labelEn: "Legs 40m", icon: "legs" },
  { key: "chat_home.example.short_run", labelKo: "러닝 10km", labelEn: "Run 10km", icon: "run" },
  { key: "chat_home.example.short_home", labelKo: "홈트 30분", labelEn: "Home 30m", icon: "home" },
];
// 더보기 팝오버 — 심화/특수 요청
const EXAMPLE_CHIPS_MORE: ExampleChip[] = [
  { key: "chat_home.example.summer_diet", labelKo: "여름 다이어트 3개월", labelEn: "3-mo summer diet", icon: "diet" },
  { key: "chat_home.example.menstrual_diet", labelKo: "생리주기 다이어트 3개월", labelEn: "Cycle-synced diet", icon: "cycle" },
  { key: "chat_home.example.advanced_back", labelKo: "상급자 등 루틴", labelEn: "Advanced back", icon: "back" },
  { key: "chat_home.example.shoulder_rehab", labelKo: "어깨 부상 회피 가슴", labelEn: "Shoulder-safe chest", icon: "shoulder" },
  { key: "chat_home.example.desk_posture", labelKo: "거북목·굽은등 교정", labelEn: "Desk posture fix", icon: "posture" },
  { key: "chat_home.example.vacation_7day", labelKo: "휴가 전 7일 팔뚝", labelEn: "7-day arm plan", icon: "calendar" },
  { key: "chat_home.example.long_full", labelKo: "내 스펙 맞춤 플랜", labelEn: "Full profile plan", icon: "full" },
];
const ChipIcon: React.FC<{ type: ChipIconType }> = ({ type }) => {
  const paths: Record<ChipIconType, string> = {
    chest: "M12 3l8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z",
    legs: "M6 3v8l2 10h3l-1-10h2l-1 10h3l2-10V3",
    run: "M13 4a2 2 0 110 4 2 2 0 010-4zM8 21l3-7 2 3 4-1",
    home: "M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V10z",
    diet: "M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    back: "M6 3v18M10 6h8M10 10h8M10 14h8M10 18h8",
    full: "M12 2l2.4 5.4L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-1.6L12 2z",
    cycle: "M12 4a8 8 0 11-8 8M4 4v5h5M20 4l-8 8",
    shoulder: "M4 14c2-6 6-8 8-8s6 2 8 8M4 14v4h16v-4",
    posture: "M8 3a2 2 0 104 0 2 2 0 00-4 0zM10 7c-2 2-4 3-4 6l2 0 1 8h3l-1-8h2l1 8h3l-1-8 2 0c0-3-2-4-4-6",
    calendar: "M4 6h16v14H4V6zM8 3v4M16 3v4M4 10h16",
  };
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[type]} />
    </svg>
  );
};

type UpgradeTrigger = "guest_exhausted" | "free_limit" | "high_value";

type ChatMsg =
  | { role: "user"; kind?: "text"; content: string }
  | { role: "assistant"; kind?: "text"; content: string; tone?: "info" | "error" }
  | { role: "assistant"; kind: "advice"; advice: AdviceContent }
  | { role: "assistant"; kind: "upgrade"; trigger: UpgradeTrigger };

// view 전환 시 언마운트되더라도 세션 내 대화 유지 (새로고침 시 리셋).
let sessionCachedMessages: ChatMsg[] = [];

/** advice 변종은 content 없으므로 history 전달 시 문자열 요약으로 대체 */
function msgToHistoryContent(m: ChatMsg): string {
  if ("content" in m) return m.content;
  if ("kind" in m && m.kind === "upgrade") return "[upgrade card shown]";
  return "[advice card shown]";
}

/** 각 assistant 메시지 상단에 붙는 미니 헤더 — 마누스 스타일 (회의 60) */
const AssistantMiniHeader: React.FC<{ locale: "ko" | "en"; planLabel?: string }> = ({ locale, planLabel }) => (
  <div className="flex items-center gap-1.5 mb-1">
    <img src="/favicon_backup.png" alt="AI" className="w-5 h-5 rounded-full" />
    <span className="text-[11.5px] font-black text-[#1B4332]">{locale === "en" ? "Ohunjal" : "오운잘"}</span>
    {planLabel && (
      <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[9px] font-bold">
        {planLabel}
      </span>
    )}
  </div>
);

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

export const ChatHome: React.FC<ChatHomeProps> = ({ userName, onSubmit, userProfile, isLoggedIn, isPremium, canSubmit, getBlockReason, onRequestLogin, onRequestPaywall, onOpenMyPlans, savedPlansCount = 0 }) => {
  const { t, locale } = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => sessionCachedMessages);
  useEffect(() => { sessionCachedMessages = messages; }, [messages]);
  const [pendingIntent, setPendingIntent] = useState<ParsedIntent | null>(null);
  const [routing, setRouting] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);

  // 미니 헤더 옆 플랜 라벨 — 프리미엄/무료/체험 구분 (회의 60 대표 피드백)
  const miniPlanLabel = (() => {
    if (isPremium) return locale === "en" ? "Premium" : "프리미엄";
    const trial = getTrialStatus(isLoggedIn ?? false, isPremium ?? false, getPlanCount());
    if (trial.stage === "premium") return undefined;
    if (trial.stage === "guest") return locale === "en" ? "Trial" : "체험";
    if (trial.stage === "exhausted") return locale === "en" ? "Trial done" : "무료 완료";
    return locale === "en" ? "Free" : "무료";
  })();
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

  // 메시지 추가 시 자동 스크롤 (routing 추가 — 플랜 시작 후 로딩 카드 가시화)
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, routing, pendingIntent]);

  // 로딩 메시지 순차 cycling — 마누스 스타일 (회의 60 Phase 2)
  const LOADING_STAGES_KO = ["생각 중입니다", "의도 파악 중", "운동 이력 확인 중", "맞춤 플랜 짜는 중", "거의 다 됐어요"];
  const LOADING_STAGES_EN = ["Thinking", "Reading your intent", "Checking your history", "Building your plan", "Almost done"];
  const [loadingStage, setLoadingStage] = useState(0);
  useEffect(() => {
    if (!busy) { setLoadingStage(0); return; }
    const stages = locale === "en" ? LOADING_STAGES_EN : LOADING_STAGES_KO;
    const timer = setInterval(() => {
      setLoadingStage((s) => Math.min(s + 1, stages.length - 1));
    }, 900);
    return () => clearInterval(timer);
  }, [busy, locale]);

  const [routingStage, setRoutingStage] = useState(0);
  useEffect(() => {
    if (!routing) { setRoutingStage(0); return; }
    const stages = locale === "en" ? LOADING_STAGES_EN : LOADING_STAGES_KO;
    const timer = setInterval(() => {
      setRoutingStage((s) => Math.min(s + 1, stages.length - 1));
    }, 900);
    return () => clearInterval(timer);
  }, [routing, locale]);

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
    if (canSubmit && !canSubmit()) {
      // Phase 4: 차단 시 인라인 업그레이드 카드 삽입 (모달은 부모가 이미 띄움)
      const reason = getBlockReason?.();
      if (reason) {
        // 중복 방지: 마지막 메시지가 같은 trigger upgrade면 스킵
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && "kind" in last && last.kind === "upgrade" && last.trigger === reason) return prev;
          return [...prev, { role: "user", content: trimmed }, { role: "assistant", kind: "upgrade", trigger: reason }];
        });
        setText("");
        trackEvent("paywall_view", { surface: "chat_inline", trigger: reason });
      }
      return;
    }

    trackEvent("chat_submit", { char_length: trimmed.length });
    const submitStart = Date.now();

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
        trackEvent("chat_plan_failed", { reason: `http_${res.status}`, latency_ms: Date.now() - submitStart });
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
      trackEvent("chat_plan_generated", {
        latency_ms: Date.now() - submitStart,
        session_mode: intent.sessionMode,
        goal: intent.goal,
      });
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
      trackEvent("chat_plan_failed", { reason: "exception", latency_ms: Date.now() - submitStart });
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
        <div className="flex items-center justify-between mt-1">
          <p className="text-[12px] font-medium text-gray-400">{dateStr}</p>
          {(() => {
            const trial = getTrialStatus(isLoggedIn ?? false, isPremium ?? false, getPlanCount());
            if (isPremium) {
              return (
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#2D6A4F] text-white text-[10px] font-bold whitespace-nowrap">
                  {locale === "en" ? "Premium" : "프리미엄"}
                </span>
              );
            }
            if (trial.stage === "premium") return null;
            const isGuest = trial.stage === "guest";
            const label = locale === "ko"
              ? (trial.stage === "exhausted" ? "무료 완료" : (isGuest ? "체험" : "무료") + ` ${trial.currentCompleted}/${trial.currentLimit}`)
              : (trial.stage === "exhausted" ? "Trial done" : (isGuest ? "Trial" : "Free") + ` ${trial.currentCompleted}/${trial.currentLimit}`);
            const warn = trial.remaining <= 1;
            return (
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
                warn ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-[#1B4332]"
              }`}>
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* 채팅 섹션 — 상단 고정 헤더 제거. 각 메시지에 미니 헤더 표시 (회의 60 Phase 2). */}
      <div className="mt-3 border-t border-gray-200 flex-1 flex flex-col min-h-0">
        {/* 메시지 영역 */}
        <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
          {/* 최초 안내 (항상 노출) — 운동 이력 기반 룰베이스 인사 */}
          <div>
            <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
            <p className="text-[13px] text-[#1B4332] leading-[1.55] whitespace-pre-wrap break-keep">
              {renderMarkdownBold(buildInitialGreeting(getCachedWorkoutHistory(), locale, {
                goal: userProfile?.goal,
                weeklyFrequency: userProfile?.weeklyFrequency,
                bench1RM: userProfile?.bench1RM,
                squat1RM: userProfile?.squat1RM,
                deadlift1RM: userProfile?.deadlift1RM,
              }, userName))}
            </p>
          </div>

          {/* 대화 히스토리 */}
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex gap-2.5 mt-2 justify-end">
                  <div className="max-w-[85%] bg-[#1B4332] text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 shadow-sm text-[13px] leading-relaxed whitespace-pre-wrap break-keep">
                    {msg.content}
                  </div>
                </div>
              );
            }
            if ("kind" in msg && msg.kind === "upgrade") {
              const trig = msg.trigger;
              const isGuest = trig === "guest_exhausted";
              const title = locale === "en"
                ? (isGuest ? "Free trial done" : trig === "high_value" ? "This needs Premium" : "Free plans used up")
                : (isGuest ? "오늘 체험 다 썼어요" : trig === "high_value" ? "프리미엄이 더 잘 맞아요" : "이번 달 무료 플랜 다 썼어요");
              const body = locale === "en"
                ? (isGuest ? "Sign in to keep planning free for today." : "Unlock unlimited plans for 6,900 KRW/month.")
                : (isGuest ? "로그인하면 오늘 계속 무료로 이어서 짜드릴 수 있어요." : "프리미엄이면 지금 바로 이어서 짜드릴 수 있어요. (월 6,900원)");
              const ctaLabel = locale === "en"
                ? (isGuest ? "Sign in with Google" : "Unlock Premium")
                : (isGuest ? "Google로 로그인" : "프리미엄 열기");
              const ctaAction = () => {
                trackEvent("paywall_tap_subscribe", { source: "chat_inline", trigger: trig, plan: "monthly", value: 6900, currency: "KRW" });
                if (isGuest) onRequestLogin?.(); else onRequestPaywall?.();
              };
              return (
                <div key={i} className="mt-3">
                  <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                  <div className="bg-gradient-to-br from-[#F0FDF4] to-white border border-[#2D6A4F]/30 rounded-2xl px-3.5 py-3">
                    <p className="text-[13px] font-black text-[#1B4332] mb-1">{title}</p>
                    <p className="text-[12px] text-gray-600 leading-[1.5] mb-2.5">{body}</p>
                    <button
                      onClick={ctaAction}
                      className="w-full py-2.5 rounded-xl bg-[#1B4332] text-white text-[13px] font-bold active:scale-[0.97] transition-all hover:bg-[#2D6A4F]"
                    >
                      {ctaLabel}
                    </button>
                  </div>
                </div>
              );
            }
            if ("kind" in msg && msg.kind === "advice") {
              return (
                <div key={i} className="mt-3">
                  <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
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
              <div key={i} className="mt-3">
                <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                <p
                  className={`text-[13px] leading-[1.55] whitespace-pre-wrap break-keep ${
                    textMsg.tone === "error" ? "text-amber-700" : "text-[#1B4332]"
                  }`}
                >
                  {renderMarkdownBold(textMsg.content)}
                </p>
              </div>
            );
          })}

          {/* 플랜 확인 카드 — 자동 전환 대신 유저 탭 요구. busy 중이면 숨김 (새 분석 중) */}
          {pendingIntent && !routing && !busy && (
            <div className="mt-3">
              <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
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
              {/* Phase 3: 후속 질문 칩 — 탭 시 입력창에 채워서 재조정 유도 */}
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {(locale === "en"
                  ? ["go harder", "different body part", "make it shorter", "add cardio"]
                  : ["강도 세게", "다른 부위로", "시간 줄여서", "유산소 추가"]
                ).map((hint) => (
                  <button
                    key={hint}
                    onClick={() => {
                      setText(hint);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95 transition-all hover:border-[#2D6A4F]/40 hover:text-[#1B4332]"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 로딩 인라인 카드 — 순차 메시지 cycling (회의 60 Phase 2) */}
          {busy && (
            <div className="mt-3">
              <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
              <div className="inline-flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                <svg className="w-4 h-4 animate-spin text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 60" />
                </svg>
                <span key={loadingStage} className="text-[12px] font-medium text-[#1B4332] animate-[fadeIn_220ms_ease-out]">
                  {(locale === "en" ? LOADING_STAGES_EN : LOADING_STAGES_KO)[loadingStage]}…
                </span>
                <span className="flex gap-0.5 ml-0.5">
                  <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}

          {/* 플랜 라우팅 인라인 카드 (확인 버튼 탭 후 master_plan_preview 이동 대기) */}
          {routing && (
            <div className="mt-3">
              <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
              <div className="inline-flex items-center gap-2.5 bg-[#F0FDF4] border border-[#2D6A4F]/20 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 animate-spin text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 60" />
                </svg>
                <span key={routingStage} className="text-[12px] font-medium text-[#1B4332] animate-[fadeIn_220ms_ease-out]">
                  {(locale === "en" ? LOADING_STAGES_EN : LOADING_STAGES_KO)[Math.max(routingStage, 3)]}…
                </span>
              </div>
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* 입력 */}
        {/* 입력창 — 마누스식 2단 구조 (회의 60 대표 지시): 위=입력, 아래=도구+전송 */}
        <div className="px-4 pt-2 pb-3">
          <div className="bg-white border border-gray-200 rounded-3xl px-4 pt-3 pb-2 shadow-sm focus-within:border-[#2D6A4F]/50 transition-colors">
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
              className="w-full text-[14px] bg-transparent px-0 py-1 border-0 focus:outline-none text-[#1B4332] placeholder-gray-400 disabled:opacity-50"
            />
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5">
                {onOpenMyPlans && (
                  <button
                    onClick={onOpenMyPlans}
                    className="relative w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1B4332] hover:border-[#2D6A4F]/40 active:scale-95 transition-all"
                    aria-label={locale === "en" ? "My Plans" : "내 플랜"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    {savedPlansCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-[#2D6A4F] text-white text-[8px] font-black flex items-center justify-center">
                        {savedPlansCount}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    const container = document.querySelector<HTMLElement>("[data-examples-container]");
                    container?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }}
                  className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1B4332] hover:border-[#2D6A4F]/40 active:scale-95 transition-all"
                  aria-label={locale === "en" ? "Examples" : "예시"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || busy}
                className="w-9 h-9 bg-[#1B4332] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:bg-gray-300 active:scale-95 transition-all shrink-0"
                aria-label={t("chat_home.send")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 예시 프롬프트 — 기본 4개 칩 + 더보기(팝오버로 심화 예시). 회의 60 대표 지시. */}
      <div className="shrink-0 pt-2 pb-4 px-4 relative" data-examples-container>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => fillExample(chip.key)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-[#2D6A4F]/40 hover:bg-emerald-50/40 active:scale-[0.97] transition-all text-[12px] font-medium text-gray-700 disabled:opacity-50 whitespace-nowrap"
            >
              <ChipIcon type={chip.icon} />
              {locale === "en" ? chip.labelEn : chip.labelKo}
            </button>
          ))}
          <button
            onClick={() => setShowMoreExamples(true)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-[#2D6A4F]/40 active:scale-[0.97] transition-all text-[12px] font-medium text-gray-500 whitespace-nowrap"
          >
            {locale === "en" ? "More" : "더보기"}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 더보기 팝오버 — 심화 예시 (마누스 스타일 세로 리스트) */}
      {showMoreExamples && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMoreExamples(false)}
          />
          <div className="fixed right-4 bottom-24 z-50 w-[220px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden py-1.5">
            {EXAMPLE_CHIPS_MORE.map((chip) => (
              <button
                key={chip.key}
                onClick={() => {
                  fillExample(chip.key);
                  setShowMoreExamples(false);
                }}
                disabled={busy}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 active:bg-emerald-50/40 transition-colors disabled:opacity-50"
              >
                <span className="text-[#1B4332] shrink-0">
                  <ChipIcon type={chip.icon} />
                </span>
                <span className="text-[12.5px] text-[#1B4332] whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                  {locale === "en" ? chip.labelEn : chip.labelKo}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
