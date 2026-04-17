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
import { buildIntentEcho, detectCategory, isPivot } from "@/utils/intentEcho";
import { ChipIcon, type ChipIconType } from "@/components/chat/ChipIcon";
import { QuickFollowupList } from "@/components/chat/QuickFollowupList";
import { AssistantMiniHeader } from "@/components/chat/AssistantMiniHeader";

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
  /** 직전 플랜 요약 — 뒤로가기 후 같은 플랜 이어서 하기 (A안) */
  lastPlanSummary?: { title: string; exerciseCount: number } | null;
  onResumeLastPlan?: () => void;
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
type UpgradeTrigger = "guest_exhausted" | "free_limit" | "high_value";

/** 장기 프로그램 Gemini 응답 */
interface ProgramSessionParam {
  weekNumber: number;
  dayInWeek: number;
  sessionMode: "balanced" | "split" | "running" | "home_training";
  targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
  goal: "fat_loss" | "muscle_gain" | "strength" | "general_fitness";
  availableTime: 30 | 50 | 90;
  intensityOverride?: "high" | "moderate" | "low";
  label: string;
}
interface ProgramData {
  name: string;
  totalWeeks: number;
  sessionsPerWeek: number;
  summary: string;
  weekDescriptions: Record<string, string>;
  sessions: ProgramSessionParam[];
}

type ChatMsg =
  | { role: "user"; kind?: "text"; content: string }
  | { role: "assistant"; kind?: "text"; content: string; tone?: "info" | "error" }
  | { role: "assistant"; kind: "advice"; advice: AdviceContent }
  | { role: "assistant"; kind: "upgrade"; trigger: UpgradeTrigger }
  | { role: "assistant"; kind: "program"; program: ProgramData };

// view 전환 시 언마운트되더라도 세션 내 대화 유지 (새로고침 시 리셋).
let sessionCachedMessages: ChatMsg[] = [];

/** advice 변종은 content 없으므로 history 전달 시 문자열 요약으로 대체 */
function msgToHistoryContent(m: ChatMsg): string {
  if ("content" in m) return m.content;
  if ("kind" in m && m.kind === "upgrade") return "[upgrade card shown]";
  if ("kind" in m && m.kind === "program") {
    const p = m.program;
    const sessionList = p.sessions.map((s, i) => `${i + 1}. ${s.label || s.targetMuscle || s.sessionMode} (${s.availableTime}분, ${s.intensityOverride || "moderate"})`).join(", ");
    return `[프로그램 생성됨: ${p.name} / ${p.totalWeeks}주 × 주${p.sessionsPerWeek}회 = ${p.sessions.length}세션 / ${p.summary} / 세션: ${sessionList}]`;
  }
  return "[advice card shown]";
}

/** 진행 체크 스텝 — 실제 단계 시각화 (Phase 6A) */
const ProgressStep: React.FC<{ state: "done" | "active" | "pending"; label: string; last?: boolean }> = ({ state, label, last }) => (
  <div className={`flex items-center gap-2 ${last ? "" : "mb-1.5"}`}>
    <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
      {state === "done" && (
        <svg className="w-3.5 h-3.5 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === "active" && (
        <svg className="w-3.5 h-3.5 animate-spin text-[#2D6A4F]" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 60" />
        </svg>
      )}
      {state === "pending" && (
        <span className="w-2.5 h-2.5 rounded-full border border-gray-300" />
      )}
    </span>
    <span className={`text-[12px] ${
      state === "done" ? "text-[#1B4332] font-medium" : state === "active" ? "text-[#1B4332] font-semibold" : "text-gray-400"
    }`}>
      {label}
    </span>
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

export const ChatHome: React.FC<ChatHomeProps> = ({ userName, onSubmit, userProfile, isLoggedIn, isPremium, canSubmit, getBlockReason, onRequestLogin, onRequestPaywall, onOpenMyPlans, lastPlanSummary, onResumeLastPlan }) => {
  const { t, locale } = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => sessionCachedMessages);
  useEffect(() => { sessionCachedMessages = messages; }, [messages]);

  // Phase B: 영양 가이드 백그라운드 프리로드 (프리미엄 + 프로필 완성 + 캐시 없음 → 5초 후)
  useEffect(() => {
    if (!isPremium) return;
    if (typeof window === "undefined") return;
    const hasProfile = !!(userProfile?.gender && userProfile?.bodyWeightKg && userProfile?.goal);
    if (!hasProfile) return;
    // 캐시 체크
    try {
      const cached = localStorage.getItem("ohunjal_nutrition_cache");
      if (cached) {
        const { date, locale: cachedLocale } = JSON.parse(cached);
        if (date === new Date().toDateString() && cachedLocale === locale) return;
      }
    } catch { /* ignore */ }

    const timer = setTimeout(async () => {
      try {
        const { auth } = await import("@/lib/firebase");
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/getNutritionGuide", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            locale,
            bodyWeightKg: userProfile!.bodyWeightKg,
            heightCm: userProfile!.heightCm,
            age: userProfile!.birthYear ? new Date().getFullYear() - userProfile!.birthYear : 30,
            gender: userProfile!.gender,
            goal: userProfile!.goal,
            weeklyFrequency: userProfile!.weeklyFrequency ?? 3,
            todaySession: { type: "general", durationMin: 0, estimatedCalories: 0 },
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        localStorage.setItem("ohunjal_nutrition_cache", JSON.stringify({
          data, date: new Date().toDateString(), locale,
        }));
      } catch { /* 백그라운드 실패는 무해 */ }
    }, 5000); // 5초 ChatHome 머무름 = 관심 유저 신호
    return () => clearTimeout(timer);
  }, [isPremium, userProfile, locale]);
  const [pendingIntent, setPendingIntent] = useState<ParsedIntent | null>(null);
  const [planIconPulse, setPlanIconPulse] = useState(false);
  const [routing, setRouting] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [reasoningLines, setReasoningLines] = useState<string[]>([]); // Phase 7 B-lite 사고 과정 스트림
  const [aiFollowups, setAiFollowups] = useState<Array<{ icon: ChipIconType; label: string; prompt: string }>>([]); // Phase 7C Gemini 개인화 후속 질문

  // 미니 헤더 옆 플랜 라벨 — 프리미엄/무료/체험 구분 (회의 60 대표 피드백)
  const miniPlanLabel = (() => {
    if (isPremium) return locale === "en" ? "Premium" : "프리미엄";
    const trial = getTrialStatus(isLoggedIn ?? false, isPremium ?? false, getPlanCount());
    if (trial.stage === "premium") return undefined;
    if (trial.stage === "guest") return locale === "en" ? "Trial" : "체험";
    if (trial.stage === "exhausted") return locale === "en" ? "Trial done" : "무료 완료";
    return locale === "en" ? "Free" : "무료";
  })();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // 제출 취소 (Stop 버튼)
  const abortSubmit = () => {
    abortCtrlRef.current?.abort();
    abortCtrlRef.current = null;
    setBusy(false);
    setReasoningLines([]);
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: locale === "en" ? "Got it, stopped. Send something else when ready." : "멈췄어요. 다시 말씀해주시면 돼요.",
      tone: "info",
    }]);
  };
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

  /** 프로그램 세션 일괄 생성 공통 함수 */
  const generateAndSaveProgram = async (
    programName: string,
    sessionParams: Array<{ condition: any; goal: string; sessionMode?: string; targetMuscle?: string; intensityOverride?: string }>,
    totalWeeks: number,
  ) => {
    const { auth } = await import("@/lib/firebase");
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const { newPlanId, newProgramId, saveProgramSessions, remoteSaveProgram } = await import("@/utils/savedPlans");

    // 1회 일괄 호출
    const res = await fetch("/api/generateProgramSessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessions: sessionParams }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { sessions: generatedSessions } = await res.json();
    if (!Array.isArray(generatedSessions) || generatedSessions.length === 0) throw new Error("No sessions generated");

    const programId = newProgramId();
    const totalSessions = generatedSessions.length;
    const savedSessions: import("@/utils/savedPlans").SavedPlan[] = generatedSessions
      .filter((sd: any) => sd?.exercises)
      .map((sessionData: any, idx: number) => ({
        id: newPlanId(),
        name: `${programName} ${idx + 1}/${totalSessions}`,
        sessionData,
        createdAt: Date.now(),
        lastUsedAt: null,
        useCount: 0,
        programId,
        sessionNumber: idx + 1,
        totalSessions,
        programName,
        completedAt: null,
      }));

    if (savedSessions.length > 0) {
      saveProgramSessions(savedSessions);
      await remoteSaveProgram(savedSessions);
      trackEvent("chat_program_generated", { total_sessions: savedSessions.length, weeks: totalWeeks });
      // 내 플랜 아이콘 반짝임 유도
      setPlanIconPulse(true);
      setTimeout(() => setPlanIconPulse(false), 3000);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: locale === "en"
          ? `Done! ${savedSessions.length} sessions saved to My Plans.`
          : `완료! ${savedSessions.length}세션 내 플랜에 저장했어요.` },
      ]);
    }
  };

  const handleGenerateProgram = async (prog: ProgramData) => {
    if (routing) return;
    setRouting(true);
    try {
      const sessionParams = prog.sessions.map((s) => ({
        condition: { bodyPart: "good", energyLevel: 3, availableTime: s.availableTime, bodyWeightKg: userProfile?.bodyWeightKg, gender: userProfile?.gender, birthYear: userProfile?.birthYear },
        goal: s.goal,
        sessionMode: s.sessionMode,
        targetMuscle: s.targetMuscle,
        intensityOverride: s.intensityOverride,
      }));
      await generateAndSaveProgram(prog.name, sessionParams, prog.totalWeeks);
    } catch (e) {
      console.error("handleGenerateProgram error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.generic"), tone: "error" }]);
    } finally {
      setRouting(false);
    }
  };

  const handleGenerateProgramFromAdvice = async (advice: AdviceContent) => {
    if (routing) return;
    setRouting(true);
    try {
      const rec = advice.recommendedWorkout;
      // 정보성 advice(recommendedWorkout 없음)는 프로그램 생성 불가 — 초기 가드
      if (!rec) { setRouting(false); return; }

      // Gemini가 sessionParams를 줬으면 그대로 사용, 없으면 폴백 로테이션
      if (advice.sessionParams && advice.sessionParams.length > 0) {
        const sp = advice.sessionParams;
        const totalWeeks = Math.max(...sp.map(s => s.weekNumber));
        const sessionParams = sp.map(s => ({
          condition: { ...rec.condition, availableTime: s.availableTime },
          goal: s.goal,
          sessionMode: s.sessionMode,
          targetMuscle: s.targetMuscle,
          intensityOverride: s.intensityOverride,
        }));
        const programName = advice.headline || (locale === "en" ? `${totalWeeks}-week program` : `${totalWeeks}주 프로그램`);
        await generateAndSaveProgram(programName, sessionParams, totalWeeks);
      } else {
        // 폴백: 고정 로테이션
        const weeklyFreq = userProfile?.weeklyFrequency ?? 3;
        const totalWeeks = 4;
        const totalSessions = totalWeeks * weeklyFreq;
        const splitByFreq: Record<number, Array<{ mode: "split" | "running" | "balanced"; muscle?: "chest" | "back" | "shoulders" | "arms" | "legs" }>> = {
          2: [{ mode: "split", muscle: "legs" }, { mode: "split", muscle: "chest" }],
          3: [{ mode: "split", muscle: "legs" }, { mode: "split", muscle: "chest" }, { mode: "split", muscle: "back" }],
          4: [{ mode: "split", muscle: "legs" }, { mode: "split", muscle: "chest" }, { mode: "split", muscle: "back" }, { mode: "split", muscle: "shoulders" }],
          5: [{ mode: "split", muscle: "legs" }, { mode: "split", muscle: "chest" }, { mode: "split", muscle: "back" }, { mode: "split", muscle: "shoulders" }, { mode: "split", muscle: "arms" }],
          6: [{ mode: "split", muscle: "legs" }, { mode: "split", muscle: "chest" }, { mode: "split", muscle: "back" }, { mode: "split", muscle: "shoulders" }, { mode: "split", muscle: "arms" }, { mode: "running" }],
        };
        const weekPattern = splitByFreq[weeklyFreq] ?? splitByFreq[3];
        const weekIntensity: Array<"moderate" | "moderate" | "high" | "low"> = ["moderate", "moderate", "high", "low"];
        const sessionParams = Array.from({ length: totalSessions }, (_, idx) => {
          const weekIdx = Math.floor(idx / weeklyFreq);
          const dayPattern = weekPattern[idx % weekPattern.length];
          return {
            condition: { ...rec.condition },
            goal: rec.goal,
            sessionMode: dayPattern.mode,
            targetMuscle: dayPattern.muscle,
            intensityOverride: weekIntensity[weekIdx] ?? "moderate",
          };
        });
        const programName = advice.headline || (locale === "en" ? "4-week program" : "4주 프로그램");
        await generateAndSaveProgram(programName, sessionParams, totalWeeks);
      }
    } catch (e) {
      console.error("handleGenerateProgramFromAdvice error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.generic"), tone: "error" }]);
    } finally {
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

  // routing 단계 메시지 (플랜 시작 후 master_plan_preview 이동 대기)
  const ROUTING_LABEL_KO = "맞춤 플랜 짜는 중";
  const ROUTING_LABEL_EN = "Building your plan";

  const displayName = userName || t("home.defaultName");

  // 상단 CTA: 인사 + 날짜 + 상태 pill
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

  // 내 스펙 맞춤 플랜 — 유저 프로필로 동적 생성, 없는 필드는 빈칸 플레이스홀더
  const buildFullProfilePrompt = (): string => {
    const age = userProfile?.birthYear ? new Date().getFullYear() - userProfile.birthYear : null;
    const gender = userProfile?.gender === "female" ? "여" : userProfile?.gender === "male" ? "남" : null;
    const parts: string[] = [];
    parts.push(age ? `${age}살` : "00살");
    parts.push(gender ?? "성별(남/여)");
    parts.push(userProfile?.heightCm ? `${userProfile.heightCm}cm` : "000cm");
    parts.push(userProfile?.bodyWeightKg ? `${userProfile.bodyWeightKg}kg` : "00kg");
    if (userProfile?.bench1RM) parts.push(`벤치 ${userProfile.bench1RM}`);
    if (userProfile?.squat1RM) parts.push(`스쿼트 ${userProfile.squat1RM}`);
    if (userProfile?.deadlift1RM) parts.push(`데드 ${userProfile.deadlift1RM}`);
    if (userProfile?.weeklyFrequency) parts.push(`주 ${userProfile.weeklyFrequency}회`);
    const goalKo: Record<string, string> = { fat_loss: "체지방 감량", muscle_gain: "근비대", endurance: "지구력", health: "건강 유지" };
    const goalStr = userProfile?.goal ? goalKo[userProfile.goal] : "";
    return `${parts.join(" ")} 오늘 추천 운동${goalStr ? ` (${goalStr})` : ""}`;
  };

  const fillExample = (key: string) => {
    const example = key === "chat_home.example.long_full" ? buildFullProfilePrompt() : t(key);
    setText(example);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(example.length, example.length);
    });
  };

  const handleSubmit = async (override?: string, opts?: { intentDepth?: "focused_followup" }) => {
    const trimmed = (override ?? text).trim();
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

    // Phase 11: Ack 버블 제거 — Gemini reasoning 첫 줄이 동일 역할 (중복+오분류 해소)
    const category = detectCategory(trimmed);
    const pivoted = isPivot(trimmed);
    const { echo, redirect } = buildIntentEcho(trimmed, locale);

    trackEvent("chat_submit", {
      char_length: trimmed.length,
      intent_category: category,
      skipped_parse: redirect,
      pivoted,
    });
    const submitStart = Date.now();

    // 유저 메시지 추가
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setText("");
    setPendingIntent(null);
    setAiFollowups([]);

    // off_topic: 리다이렉트 메시지만 추가하고 parseIntent 건너뜀 (비용 절감)
    if (redirect) {
      setMessages((prev) => [...prev, { role: "assistant", content: echo, tone: "info" }]);
      return;
    }

    // fitness/ambiguous: 즉시 진행 카드로 (Gemini reasoning 스트림이 의도 파악 표시)
    setBusy(true);

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
      // 피벗 감지 시 history 비움 — Gemini가 이전 목표/맥락 재소환하는 문제 방지
      const recentHistory = pivoted ? [] : messages.slice(-8).map((m) => ({
        role: m.role,
        content: msgToHistoryContent(m),
      }));

      // 운동 이력 요약 (localStorage 캐시 기반, 0~50ms) — 개인화 추천용
      const workoutDigest = buildHistoryDigest(getCachedWorkoutHistory(), locale);

      // AbortController 등록 — Stop 버튼으로 중단 가능
      abortCtrlRef.current = new AbortController();
      const res = await fetch("/api/parseIntent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: trimmed, locale, userProfile, history: recentHistory, workoutDigest, intentDepth: opts?.intentDepth }),
        signal: abortCtrlRef.current.signal,
      });

      if (!res.ok) {
        // 서버 한도 초과 시 upgrade 카드로 전환 (클라이언트 선제 가드 우회·stale 캐시 대비)
        if (res.status === 429 || res.status === 403) {
          let code: string | undefined;
          try { code = (await res.json())?.code; } catch { /* ignore */ }
          let trig: UpgradeTrigger | null = null;
          if (code === "GUEST_CHAT_LIMIT" || code === "TRIAL_LIMIT") trig = "guest_exhausted";
          else if (code === "FREE_CHAT_LIMIT" || code === "FREE_LIMIT") trig = "free_limit";
          else if (code === "PREMIUM_REQUIRED") trig = "high_value";
          if (trig) {
            trackEvent("chat_plan_failed", { reason: code ?? `http_${res.status}`, latency_ms: Date.now() - submitStart });
            const finalTrig = trig;
            setMessages((prev) => [...prev, { role: "assistant", kind: "upgrade", trigger: finalTrig }]);
            setBusy(false);
            return;
          }
        }
        trackEvent("chat_plan_failed", { reason: `http_${res.status}`, latency_ms: Date.now() - submitStart });
        setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.generic"), tone: "error" }]);
        setBusy(false);
        return;
      }

      type FollowupResp = { icon: string; label: string; prompt: string };
      type SelfCheck = { safety: "ok" | "warning" | "risky"; completeness: number; concerns: string[] };
      type IntentAnalysis = { surface: string; latent: string };
      type SourceRef = { title: string; url: string };
      type CommonMeta = { reasoning?: string[]; followups?: FollowupResp[]; selfCheck?: SelfCheck; intentAnalysis?: IntentAnalysis; sources?: SourceRef[] };
      const data = (await res.json()) as
        | ({ mode: "chat"; reply: string } & CommonMeta)
        | ({ mode: "plan"; intent: ParsedIntent } & CommonMeta)
        | ({ mode: "advice"; advice: AdviceContent } & CommonMeta)
        | ({ mode: "program"; program: ProgramData } & CommonMeta);

      // Phase 7D: selfCheck.safety가 warning/risky면 concerns를 reasoning에 prepend
      const safetyConcerns = data.selfCheck?.safety && data.selfCheck.safety !== "ok"
        ? (data.selfCheck.concerns ?? []).filter(Boolean)
        : [];
      if (safetyConcerns.length > 0 && Array.isArray(data.reasoning)) {
        data.reasoning = [...safetyConcerns.map((c) => `안전 안내: ${c}`), ...data.reasoning];
      }
      // Phase 7E: Google Search 출처가 있으면 reasoning 끝에 "출처 N건" 한 줄 추가
      const sourceRefs = Array.isArray(data.sources) ? data.sources.filter(Boolean) : [];
      if (sourceRefs.length > 0 && Array.isArray(data.reasoning)) {
        const srcMsg = locale === "en"
          ? `Cross-referenced ${sourceRefs.length} external sources`
          : `외부 자료 ${sourceRefs.length}건 교차 검증`;
        data.reasoning = [...data.reasoning, srcMsg];
      }

      // Phase 7 B-lite: Gemini가 반환한 reasoning을 순차로 표시 (800ms 간격)
      const reasoning = Array.isArray(data.reasoning) ? data.reasoning.filter(Boolean) : [];
      for (const line of reasoning) {
        setReasoningLines((prev) => [...prev, line]);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      // Phase 7C: Gemini 개인화 followups 저장 (ChipIconType로 좁혀서)
      const serverFollowups: Array<{ icon: ChipIconType; label: string; prompt: string }> = Array.isArray(data.followups)
        ? data.followups.map((f) => ({ icon: f.icon as ChipIconType, label: f.label, prompt: f.prompt }))
        : [];
      setAiFollowups(serverFollowups);

      if (data.mode === "chat") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setBusy(false);
        setReasoningLines([]);
        return;
      }

      if (data.mode === "advice") {
        setMessages((prev) => [...prev, { role: "assistant", kind: "advice", advice: data.advice }]);
        setBusy(false);
        setReasoningLines([]);
        return;
      }

      if (data.mode === "program") {
        trackEvent("chat_program_generated", {
          latency_ms: Date.now() - submitStart,
          total_sessions: data.program.sessions.length,
          weeks: data.program.totalWeeks,
        });
        setMessages((prev) => [...prev, { role: "assistant", kind: "program", program: data.program }]);
        setBusy(false);
        setReasoningLines([]);
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
      setReasoningLines([]);
    } catch (e) {
      // AbortError는 유저가 Stop 눌러서 발생 — 에러 메시지 없이 조용히 종료
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      console.error("ChatHome submit error:", e);
      trackEvent("chat_plan_failed", { reason: "exception", latency_ms: Date.now() - submitStart });
      setMessages((prev) => [...prev, { role: "assistant", content: t("chat_home.error.generic"), tone: "error" }]);
      setBusy(false);
    } finally {
      abortCtrlRef.current = null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFBF9] relative overflow-hidden">
      {/* 상단 CTA — 인사 + 날짜 + 상태 pill */}
      <div className="pt-[max(2.5rem,env(safe-area-inset-top))] px-6 pb-2 shrink-0 relative">
        {onOpenMyPlans && (
          <button
            onClick={onOpenMyPlans}
            className={`absolute right-5 top-[max(2.5rem,env(safe-area-inset-top))] p-2 transition-colors ${planIconPulse ? "text-[#2D6A4F] animate-bounce" : "text-gray-400 active:text-[#1B4332]"}`}
            aria-label={locale === "en" ? "My Plans" : "내 플랜"}
          >
            <svg className="w-6 h-6" fill={planIconPulse ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}
        <h1 className="font-black leading-snug pr-12">
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
            <p className="text-[15px] text-[#1B4332] leading-[1.55] whitespace-pre-wrap break-keep">
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
                <div key={i} className="flex gap-2.5 mt-12 justify-end">
                  <div className="max-w-[85%] bg-[#1B4332] text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap break-keep">
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
                <div key={i} className="mt-12">
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
                <div key={i} className="mt-12">
                  <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                  <div className="min-w-0">
                    <AdviceCard
                      advice={msg.advice}
                      onStartRecommended={async () => {
                        const rec = msg.advice.recommendedWorkout;
                        if (!rec) return; // 정보성 advice는 시작 버튼 없으므로 도달 불가
                        if (canSubmit && !canSubmit()) return;
                        setRouting(true);
                        try {
                          await onSubmit(
                            rec.condition,
                            rec.goal,
                            {
                              goal: rec.goal,
                              sessionMode: rec.sessionMode,
                              targetMuscle: rec.targetMuscle,
                              runType: rec.runType,
                            },
                            { skipLoadingAnim: true },
                          );
                        } catch (e) {
                          console.error("AdviceCard start error:", e);
                          setRouting(false);
                        }
                      }}
                      starting={routing}
                      onGenerateProgram={msg.advice.goals?.length > 0 ? () => handleGenerateProgramFromAdvice(msg.advice) : undefined}
                      generatingProgram={routing}
                    />
                  </div>
                </div>
              );
            }
            if ("kind" in msg && msg.kind === "program") {
              const prog = msg.program;
              const totalSessions = prog.sessions.length;
              return (
                <div key={i} className="mt-12">
                  <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                  <p className="text-[15px] text-[#1B4332] leading-[1.55] whitespace-pre-wrap break-keep mb-2">
                    {renderMarkdownBold(
                      locale === "en"
                        ? `${prog.totalWeeks}-week program ready! ${prog.sessionsPerWeek}x/week, **${totalSessions} sessions** total.`
                        : `${prog.totalWeeks}주 프로그램 짰어요! 주 ${prog.sessionsPerWeek}회, 총 **${totalSessions}세션** 구성이에요.`
                    )}
                  </p>
                  <div className="bg-white rounded-2xl px-3.5 py-3 border border-[#2D6A4F]/20">
                    <p className="text-[13px] font-black text-[#1B4332] mb-2">{prog.name}</p>
                    <div className="flex flex-col gap-1 mb-3">
                      {Object.entries(prog.weekDescriptions).map(([wk, desc]) => (
                        <div key={wk} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-b-0">
                          <span className="text-[10px] font-bold text-gray-400 w-9 shrink-0">{wk}{locale === "en" ? "wk" : "주"}</span>
                          <span className="text-[12px] text-[#1B4332] flex-1">{desc}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateProgram(prog)}
                        disabled={routing}
                        className="flex-1 py-2.5 rounded-xl bg-[#1B4332] text-white text-[13px] font-bold active:scale-[0.97] transition-all hover:bg-[#2D6A4F] disabled:opacity-50"
                      >
                        {routing
                          ? (locale === "en" ? "Generating..." : "생성 중...")
                          : (locale === "en" ? `Generate ${totalSessions} sessions` : `${totalSessions}세션 생성`)}
                      </button>
                      <button
                        onClick={cancelPlan}
                        className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-bold active:scale-[0.97] transition-all"
                      >
                        {locale === "en" ? "Change" : "수정"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            // 남은 variant: { role: "assistant"; content: string; tone?: ... }
            const textMsg = msg as { role: "assistant"; content: string; tone?: "info" | "error" };
            return (
              <div key={i} className="mt-12">
                <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                <p
                  className={`text-[15px] leading-[1.55] whitespace-pre-wrap break-keep ${
                    textMsg.tone === "error" ? "text-amber-700" : "text-[#1B4332]"
                  }`}
                >
                  {renderMarkdownBold(textMsg.content)}
                </p>
              </div>
            );
          })}

          {/* 후속 질문 — 마지막 메시지 컨텍스트에 따라 노출 (회의 60 Phase 6A+6B) */}
          {(() => {
            if (busy || routing || pendingIntent) return null;
            const last = messages[messages.length - 1];
            if (!last || last.role !== "assistant") return null;
            if ("kind" in last && last.kind === "upgrade") return null;

            // Gemini 개인화만 노출. 없으면 렌더 생략 (카탈로그 폴백 제거 — 대표 지시)
            if (aiFollowups.length === 0) return null;
            return (
              <div className="mt-2">
                <QuickFollowupList
                  locale={locale}
                  items={aiFollowups}
                  onTap={(p: string) => {
                    trackEvent("chat_submit", { source: "ai_followup", char_length: p.length });
                    handleSubmit(p, { intentDepth: "focused_followup" });
                  }}
                />
              </div>
            );
          })()}

          {/* 플랜 확인 카드 — 자동 전환 대신 유저 탭 요구. busy 중이면 숨김 (새 분석 중) */}
          {pendingIntent && !routing && !busy && (
            <div className="mt-12">
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
              {/* 추천 후속 질문 — Gemini 개인화만 (비어있으면 생략) */}
              {aiFollowups.length > 0 && (
                <QuickFollowupList
                  locale={locale}
                  items={aiFollowups}
                  onTap={(p: string) => {
                    trackEvent("chat_submit", { source: "ai_followup", char_length: p.length });
                    handleSubmit(p, { intentDepth: "focused_followup" });
                  }}
                />
              )}
            </div>
          )}

          {/* 타이핑 인디케이터 — Ack 등장 전 분석 중 체감 (Phase 6A 보완) */}
          {/* Phase 7 B-lite + 10.2 + 11: 진짜 Gemini reasoning 스트림만 */}
          {busy && (() => {
            return (
              <div className="mt-12">
                <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                <div className="bg-white border border-gray-200 rounded-xl px-3.5 py-3 shadow-sm w-full max-w-[320px]">
                  {reasoningLines.map((line, i) => (
                    <ProgressStep key={i} state="done" label={line} />
                  ))}
                  <ProgressStep
                    state="active"
                    label={locale === "en" ? "Analyzing your question" : "질문 의도 분석 중"}
                    last
                  />
                </div>
              </div>
            );
          })()}

          {/* 플랜 라우팅 인라인 카드 (확인 버튼 탭 후 master_plan_preview 이동 대기) */}
          {routing && (
            <div className="mt-12">
              <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
              <div className="inline-flex items-center gap-2.5 bg-[#F0FDF4] border border-[#2D6A4F]/20 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 animate-spin text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 60" />
                </svg>
                <span className="text-[12px] font-medium text-[#1B4332]">
                  {locale === "en" ? ROUTING_LABEL_EN : ROUTING_LABEL_KO}…
                </span>
              </div>
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* 입력 */}
        {/* 직전 플랜 이어서 하기 (A안) — 뒤로가기 후 동일 플랜 복원 */}
        {lastPlanSummary && onResumeLastPlan && !busy && !routing && !pendingIntent && (
          <div className="px-4 pt-1 pb-1 shrink-0">
            <button
              onClick={onResumeLastPlan}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F0FDF4] border border-[#2D6A4F]/30 hover:bg-emerald-50 active:scale-[0.98] transition-all text-left"
            >
              <svg className="w-4 h-4 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="flex-1 text-[12px] text-[#1B4332]">
                {locale === "en" ? "Resume last plan" : "이전 플랜 이어서"} · <span className="font-bold">{lastPlanSummary.title}</span>
                <span className="text-gray-400"> ({lastPlanSummary.exerciseCount}{locale === "en" ? " exercises" : "개 운동"})</span>
              </span>
              <svg className="w-3 h-3 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* 입력창 — 2단 구조 (회의 60 대표 지시): 위=입력, 아래=도구+전송 */}
        <div className="px-4 pt-2 pb-3">
          <div className="bg-white border border-gray-200 rounded-3xl px-4 pt-3 pb-2 shadow-sm focus-within:border-[#2D6A4F]/50 transition-colors">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // auto-grow: 최소 1줄, 최대 5줄
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={t("chat_home.placeholder")}
              disabled={busy}
              rows={1}
              className="w-full text-[14px] bg-transparent px-0 py-1 border-0 focus:outline-none text-[#1B4332] placeholder-gray-400 disabled:opacity-50 resize-none overflow-y-auto leading-[1.5]"
            />
            <div className="flex items-center justify-end mt-1">
              {busy ? (
                <button
                  onClick={abortSubmit}
                  className="w-9 h-9 bg-[#1B4332] text-white rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 hover:bg-[#2D6A4F]"
                  aria-label={locale === "en" ? "Stop" : "정지"}
                >
                  <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit()}
                  disabled={!text.trim()}
                  className="w-9 h-9 bg-[#1B4332] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:bg-gray-300 active:scale-95 transition-all shrink-0"
                  aria-label={t("chat_home.send")}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 예시 프롬프트 — 기본 4개 칩 + 더보기(팝오버로 심화 예시). 회의 60: 채팅 시작 후 숨김. */}
      {messages.length === 0 && (
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
      )}

      {/* 더보기 팝오버 — 심화 예시 (세로 리스트) */}
      {showMoreExamples && (
        <>
          <div
            className="absolute inset-0 z-40"
            onClick={() => setShowMoreExamples(false)}
          />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-14 z-50 w-[220px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden py-1.5">
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
