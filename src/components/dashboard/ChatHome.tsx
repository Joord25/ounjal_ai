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
type ChipIconType = "chest" | "home" | "run" | "legs" | "diet" | "back" | "full" | "cycle" | "shoulder" | "posture" | "calendar" | "creatine" | "pump" | "sleep" | "food" | "plateau" | "split" | "protein" | "flame" | "swap" | "timer";
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
    creatine: "M9 3h6v4l3 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V9l3-2V3zM9 13h6",
    pump: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    sleep: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    food: "M3 8h18M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12",
    plateau: "M3 17l6-6 4 4 8-8M14 7h7v7",
    split: "M4 6h6v4H4zM14 6h6v4h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    protein: "M12 2a3 3 0 00-3 3v2H6a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3V5a3 3 0 00-3-3z",
    flame: "M8.5 14.5A2.5 2.5 0 0011 17c1 0 1.8-.5 2.5-1.5C14 12 12 10 14 8c0-1.5-.5-3-2-4.5-.5 2-1 3-2 4s-2 2.5-2 4 .5 2 1 3zM12 2v3",
    swap: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
    timer: "M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z",
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

/** 심화 후속 질문 카탈로그 — Phase 6B (마누스식 아이콘 + 세로 리스트) */
type DeepFollowup = {
  id: string;
  icon: ChipIconType;
  labelKo: string;
  labelEn: string;
  promptKo: string;
  promptEn: string;
  /** 컨텍스트 매칭 태그. "any" 항상 매칭 */
  tags: string[];
};

const DEEP_FOLLOWUPS: DeepFollowup[] = [
  {
    id: "pump",
    icon: "pump",
    labelKo: "자극 제대로 느끼는 법",
    labelEn: "Mind-muscle connection",
    promptKo: "이 운동할 때 자극 제대로 느끼는 법 알려줘",
    promptEn: "How do I feel the target muscle properly during this workout?",
    tags: ["any"],
  },
  {
    id: "creatine",
    icon: "creatine",
    labelKo: "크레아틴 언제 얼마나 먹어?",
    labelEn: "How to take creatine",
    promptKo: "크레아틴 언제 얼마나 어떻게 먹어야 효과적인지 알려줘",
    promptEn: "When and how much creatine should I take for best results?",
    tags: ["any", "bulk", "strength", "chest", "back", "legs", "arms"],
  },
  {
    id: "protein",
    icon: "protein",
    labelKo: "단백질 얼마나 먹어야 해?",
    labelEn: "How much protein do I need?",
    promptKo: "내 몸무게 기준으로 단백질 하루에 얼마나 먹어야 해?",
    promptEn: "How much protein per day should I eat for my body weight?",
    tags: ["any", "bulk", "diet"],
  },
  {
    id: "food",
    icon: "food",
    labelKo: "운동 끝나고 뭐 먹지?",
    labelEn: "What to eat after workout",
    promptKo: "운동 끝나고 회복에 좋은 음식 추천해줘",
    promptEn: "What should I eat after this workout to recover?",
    tags: ["any"],
  },
  {
    id: "sleep",
    icon: "sleep",
    labelKo: "회복과 수면 관리",
    labelEn: "Recovery & sleep tips",
    promptKo: "근육 회복이랑 수면 어떻게 관리해야 해?",
    promptEn: "How should I manage muscle recovery and sleep?",
    tags: ["any"],
  },
  {
    id: "plateau",
    icon: "plateau",
    labelKo: "정체기 돌파법",
    labelEn: "Breaking plateaus",
    promptKo: "벤치/스쿼트/데드리프트 정체된 거 어떻게 뚫어?",
    promptEn: "How do I break through bench/squat/deadlift plateaus?",
    tags: ["bulk", "strength", "chest", "back", "legs"],
  },
  {
    id: "split",
    icon: "split",
    labelKo: "3분할 vs 5분할 뭐가 나아?",
    labelEn: "3-day vs 5-day split",
    promptKo: "3분할이랑 5분할 중 뭐가 더 나아?",
    promptEn: "Which is better: 3-day split or 5-day split?",
    tags: ["any"],
  },
  {
    id: "posture",
    icon: "posture",
    labelKo: "자세 교정 운동",
    labelEn: "Posture correction",
    promptKo: "거북목이랑 굽은등 교정하는 10분 루틴 알려줘",
    promptEn: "Give me a 10-min routine to fix text neck and hunched back",
    tags: ["any", "rehab", "posture"],
  },
];

/** 메시지 컨텍스트에서 태그 추출 */
function extractTagsFromContent(content: string): string[] {
  const tags: string[] = ["any"];
  if (/다이어트|감량|체지방|살\s*빼/.test(content)) tags.push("diet");
  if (/증량|벌크|근육.*키|늘리/.test(content)) tags.push("bulk");
  if (/1rm|벤치|스쿼트|데드|프레스|맥스/i.test(content)) tags.push("strength");
  if (/가슴|chest/i.test(content)) tags.push("chest");
  if (/등|back/i.test(content)) tags.push("back");
  if (/어깨|shoulder/i.test(content)) tags.push("shoulders");
  if (/팔|이두|삼두|arm/i.test(content)) tags.push("arms");
  if (/하체|다리|legs?/i.test(content)) tags.push("legs");
  if (/부상|회피|통증|재활/.test(content)) tags.push("rehab");
  if (/거북목|굽은등|자세/.test(content)) tags.push("posture");
  return tags;
}

/** 컨텍스트 기반 추천 (최대 4개) */
function selectDeepFollowups(contextTags: string[], limit = 4): DeepFollowup[] {
  const scored = DEEP_FOLLOWUPS.map((f) => {
    let score = 0;
    for (const t of f.tags) {
      if (t === "any") score += 1;
      else if (contextTags.includes(t)) score += 3;
    }
    return { f, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.f);
}

/** 빠른 재조정 후속 — 세로 아이콘 리스트 (마누스식, Phase 7 보완) */
const QuickFollowupList: React.FC<{
  locale: "ko" | "en";
  items: Array<{ icon: ChipIconType; label: string; prompt: string }>;
  onTap: (prompt: string) => void;
}> = ({ locale, items, onTap }) => (
  <div className="mt-2 flex flex-col gap-1">
    <p className="text-[10px] font-black text-gray-400 tracking-wider uppercase mb-0.5 px-0.5">
      {locale === "en" ? "Recommended follow-ups" : "추천 후속 질문"}
    </p>
    {items.map((f) => (
      <button
        key={f.label}
        onClick={() => onTap(f.prompt)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-[#2D6A4F]/40 hover:bg-emerald-50/30 active:scale-[0.98] transition-all text-left"
      >
        <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-[#2D6A4F] shrink-0">
          <ChipIcon type={f.icon} />
        </span>
        <span className="text-[12.5px] font-medium text-[#1B4332] flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {f.label}
        </span>
        <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    ))}
  </div>
);

/** 심화 후속 질문 리스트 — 마누스식 세로 아이콘 리스트 */
const DeepFollowupList: React.FC<{
  contextTags: string[];
  locale: "ko" | "en";
  onTap: (prompt: string) => void;
}> = ({ contextTags, locale, onTap }) => {
  const items = selectDeepFollowups(contextTags);
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-[10px] font-black text-gray-400 tracking-wider uppercase mb-2 px-0.5">
        {locale === "en" ? "Recommended follow-ups" : "추천 후속 질문"}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((f) => (
          <button
            key={f.id}
            onClick={() => onTap(locale === "en" ? f.promptEn : f.promptKo)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-[#2D6A4F]/40 hover:bg-emerald-50/30 active:scale-[0.98] transition-all text-left"
          >
            <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-[#2D6A4F] shrink-0">
              <ChipIcon type={f.icon} />
            </span>
            <span className="text-[12.5px] font-medium text-[#1B4332] flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
              {locale === "en" ? f.labelEn : f.labelKo}
            </span>
            <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

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
  const [ackPending, setAckPending] = useState(false); // 타이핑 지연 중 (Phase 6A 보완)
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

  // routing 단계 메시지 (플랜 시작 후 master_plan_preview 이동 대기)
  const ROUTING_LABEL_KO = "맞춤 플랜 짜는 중";
  const ROUTING_LABEL_EN = "Building your plan";

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

    // Phase 6A: 의도 분류 + Ack 버블 (마누스식 질문 재진술)
    const category = detectCategory(trimmed);
    const { echo, redirect } = buildIntentEcho(trimmed, locale);
    const pivoted = isPivot(trimmed);

    trackEvent("chat_submit", {
      char_length: trimmed.length,
      intent_category: category,
      skipped_parse: redirect,
      pivoted,
    });
    const submitStart = Date.now();

    // 유저 메시지 먼저 추가, Ack은 타이핑 지연 후 (너무 즉시 뜨면 룰베이스 티남)
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setText("");
    setPendingIntent(null);
    setAiFollowups([]); // 새 요청 시 이전 followups 제거
    setAckPending(true);

    // 1.2초 타이핑 지연 후 Ack 삽입 — "유저 메시지 파악 중" 체감 제공 (회의 60 대표 피드백)
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setMessages((prev) => [...prev, { role: "assistant", content: echo, tone: "info" }]);
    setAckPending(false);

    // off_topic이면 parseIntent 건너뜀 (비용 절감)
    if (redirect) {
      return;
    }

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

      const res = await fetch("/api/parseIntent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: trimmed, locale, userProfile, history: recentHistory, workoutDigest, intentDepth: opts?.intentDepth }),
      });

      if (!res.ok) {
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
        | ({ mode: "advice"; advice: AdviceContent } & CommonMeta);

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
        await new Promise((resolve) => setTimeout(resolve, 800));
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

          {/* 후속 질문 — 마지막 메시지 컨텍스트에 따라 노출 (회의 60 Phase 6A+6B) */}
          {(() => {
            if (busy || routing || pendingIntent) return null;
            const last = messages[messages.length - 1];
            if (!last || last.role !== "assistant") return null;
            if ("kind" in last && last.kind === "upgrade") return null;

            const content = "content" in last ? last.content : "";
            const isAdvice = "kind" in last && last.kind === "advice";

            // 컨텍스트 태그 추출 (심화 후속 질문 스코어링용)
            const contextTags = extractTagsFromContent(content);

            // 단축 칩 (빠른 재조정) — advice가 아닌 일반 텍스트일 때만
            const mentionsBack = /등|back/i.test(content);
            const mentionsLegs = /하체|다리|legs?/i.test(content);
            const mentionsChest = /가슴|chest/i.test(content);
            type QuickItem = { icon: ChipIconType; label: string; prompt: string };
            const quickItems: QuickItem[] = isAdvice ? [] : (locale === "en"
              ? (mentionsBack
                  ? [{ icon: "back", label: "Back routine today", prompt: "back routine today" }, { icon: "swap", label: "Different body part", prompt: "different body part" }, { icon: "timer", label: "Make it shorter", prompt: "make it shorter" }]
                  : mentionsLegs
                  ? [{ icon: "legs", label: "Legs 40 min", prompt: "legs 40 min" }, { icon: "swap", label: "Different body part", prompt: "different body part" }, { icon: "run", label: "Add cardio", prompt: "add cardio" }]
                  : mentionsChest
                  ? [{ icon: "chest", label: "Chest 30 min", prompt: "chest 30 min" }, { icon: "swap", label: "Different body part", prompt: "different body part" }, { icon: "run", label: "Add cardio", prompt: "add cardio" }]
                  : [{ icon: "full", label: "Today's workout", prompt: "today's workout" }, { icon: "timer", label: "I'm tired today", prompt: "I'm tired today" }, { icon: "swap", label: "Any body part", prompt: "any body part suggestion" }])
              : (mentionsBack
                  ? [{ icon: "back", label: "등 운동 오늘", prompt: "등 운동 오늘" }, { icon: "swap", label: "다른 부위로", prompt: "다른 부위로" }, { icon: "timer", label: "시간 짧게", prompt: "시간 짧게" }]
                  : mentionsLegs
                  ? [{ icon: "legs", label: "하체 40분", prompt: "하체 40분" }, { icon: "swap", label: "다른 부위로", prompt: "다른 부위로" }, { icon: "run", label: "유산소 추가", prompt: "유산소 추가" }]
                  : mentionsChest
                  ? [{ icon: "chest", label: "가슴 30분", prompt: "가슴 30분" }, { icon: "swap", label: "다른 부위로", prompt: "다른 부위로" }, { icon: "run", label: "유산소 추가", prompt: "유산소 추가" }]
                  : [{ icon: "full", label: "오늘 운동 추천해줘", prompt: "오늘 운동 추천해줘" }, { icon: "timer", label: "오늘은 피곤해", prompt: "오늘은 피곤해" }, { icon: "swap", label: "아무 부위나 골라줘", prompt: "아무 부위나 골라줘" }]));

            // Phase 7C + 10.1 통합: Gemini 개인화 우선, 없으면 카탈로그 폴백 — 섹션 1개로 단일화
            const hasAi = aiFollowups.length > 0;
            const finalItems: Array<{ icon: ChipIconType; label: string; prompt: string }> = hasAi
              ? aiFollowups
              : (quickItems.length > 0 ? quickItems : selectDeepFollowups(contextTags).map((f) => ({
                  icon: f.icon, label: locale === "en" ? f.labelEn : f.labelKo, prompt: locale === "en" ? f.promptEn : f.promptKo,
                })));

            if (finalItems.length === 0) return null;
            return (
              <div className="mt-2">
                <QuickFollowupList
                  locale={locale}
                  items={finalItems}
                  onTap={(p: string) => {
                    trackEvent("chat_submit", { source: hasAi ? "ai_followup" : "rule_followup", char_length: p.length });
                    handleSubmit(p, { intentDepth: "focused_followup" });
                  }}
                />
              </div>
            );
          })()}

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
          {ackPending && (
            <div className="mt-3">
              <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
              <div className="inline-flex items-center gap-1 bg-white border border-gray-100 rounded-full px-3 py-2 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* Phase 7 B-lite + 10.2: 진짜 Gemini reasoning 스트림만 (하드코딩 이력 줄 제거) */}
          {busy && (() => {
            return (
              <div className="mt-3">
                <AssistantMiniHeader locale={locale} planLabel={miniPlanLabel} />
                <div className="bg-white border border-gray-200 rounded-xl px-3.5 py-3 shadow-sm w-full max-w-[320px]">
                  {reasoningLines.map((line, i) => (
                    <ProgressStep key={i} state="done" label={line} />
                  ))}
                  <ProgressStep
                    state="active"
                    label={locale === "en" ? "Analyzing your intent" : "운동 의도 분석 중"}
                    last
                  />
                </div>
              </div>
            );
          })()}

          {/* 플랜 라우팅 인라인 카드 (확인 버튼 탭 후 master_plan_preview 이동 대기) */}
          {routing && (
            <div className="mt-3">
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
                onClick={() => handleSubmit()}
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

      {/* 더보기 팝오버 — 심화 예시 (마누스 스타일 세로 리스트) */}
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
