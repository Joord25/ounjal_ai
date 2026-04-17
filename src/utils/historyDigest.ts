/**
 * 회의 57 Phase 5+: Gemini parseIntent에 주입할 운동 이력 요약.
 * 대화 맥락 유지 + raw 로그 대신 압축된 숫자/라벨로 토큰 절약.
 */

import type { WorkoutHistory } from "@/constants/workout";

/** Gemini 프롬프트에 그대로 붙일 요약 블록 (한글 ≈ 150~250자). 이력 없으면 null. */
/** 이력을 최신순으로 정렬 (캐시의 원래 정렬은 보장되지 않음). */
function sortDesc(history: WorkoutHistory[]): WorkoutHistory[] {
  return [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function buildHistoryDigest(input: WorkoutHistory[], locale: "ko" | "en" = "ko"): string | null {
  if (!input || input.length === 0) return null;
  const history = sortDesc(input);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * DAY_MS;
  const thirtyDaysAgo = now - 30 * DAY_MS;

  const recent7 = history.filter((h) => new Date(h.date).getTime() > sevenDaysAgo);
  const recent30 = history.filter((h) => new Date(h.date).getTime() > thirtyDaysAgo);

  // 스트릭: 오늘/어제부터 역순으로 연속일 카운트
  const streak = computeStreak(history);

  // 최근 3회 부위 라벨
  const recent3 = history.slice(0, 3).map((h) => {
    const desc = h.sessionData?.description || h.sessionData?.title || "";
    const firstToken = desc.split("·")[0].trim();
    const daysAgo = Math.max(0, Math.floor((now - new Date(h.date).getTime()) / DAY_MS));
    return { part: firstToken || "운동", daysAgo, duration: h.stats?.totalDurationSec };
  });

  // 부위 커버리지 (최근 30일 기준)
  const partCounts = new Map<string, number>();
  for (const h of recent30) {
    const desc = h.sessionData?.description || h.sessionData?.title || "";
    const part = desc.split("·")[0].trim() || "운동";
    partCounts.set(part, (partCounts.get(part) || 0) + 1);
  }

  // 최근 PR (bestE1RM 기준으로 2주 내 최고)
  const fourteenDaysAgo = now - 14 * DAY_MS;
  const prCandidates = history
    .filter((h) => new Date(h.date).getTime() > fourteenDaysAgo && h.stats?.bestE1RM)
    .sort((a, b) => (b.stats.bestE1RM || 0) - (a.stats.bestE1RM || 0))
    .slice(0, 1);

  if (locale === "en") {
    const lines: string[] = [];
    lines.push(`Last 7d: ${recent7.length} sessions${streak >= 2 ? `, ${streak}-day streak` : ""}`);
    if (recent3.length > 0) {
      lines.push(`Recent: ${recent3.map((r) => `${r.part}(${r.daysAgo}d ago)`).join(", ")}`);
    }
    if (partCounts.size > 0) {
      const top = Array.from(partCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
      lines.push(`30d focus: ${top.map(([p, c]) => `${p}×${c}`).join(", ")}`);
    }
    if (prCandidates[0]) {
      lines.push(`Recent PR e1RM: ${Math.round(prCandidates[0].stats.bestE1RM!)}kg`);
    }
    return lines.join(" | ");
  }

  // ko
  const lines: string[] = [];
  lines.push(`최근 7일 ${recent7.length}회${streak >= 2 ? `, 연속 ${streak}일` : ""}`);
  if (recent3.length > 0) {
    lines.push(`직전 기록: ${recent3.map((r) => `${r.part}(${r.daysAgo === 0 ? "오늘" : r.daysAgo + "일 전"})`).join(", ")}`);
  }
  if (partCounts.size > 0) {
    const top = Array.from(partCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    lines.push(`30일 집중: ${top.map(([p, c]) => `${p} ${c}회`).join(", ")}`);
  }
  if (prCandidates[0]) {
    lines.push(`최근 PR e1RM ${Math.round(prCandidates[0].stats.bestE1RM!)}kg`);
  }
  return lines.join(" | ");
}

export interface GreetingProfile {
  goal?: "fat_loss" | "muscle_gain" | "endurance" | "health";
  weeklyFrequency?: number;
  bench1RM?: number;
  squat1RM?: number;
  deadlift1RM?: number;
}

/**
 * 비로그인·온보딩 미완 유저용 초기 선제안.
 * 회의 62 (2026-04-18) — 욕구 자극 시즌 후킹 + 시간대 룰베이스 추천.
 * Hershey 원칙: AI가 맥락 보고 1개 고름 + 이유 1줄 + CTA 1개.
 */
export interface InitialSuggestion {
  /** 본문 카피 (greeting + 시즌 countdown + AI 추천 + 이유) */
  greeting: string;
  /** CTA 카드 라벨 (예: "하체 40분") — UI 표시용 */
  label: string;
  /**
   * UserCondition.availableTime 필드 — 시스템 표준 30 | 50 | 90 중 하나.
   * UI 라벨의 "40분"은 내부적으로 50으로 매핑 (기존 EXAMPLE_CHIPS 관행과 동일).
   */
  availableTime: 30 | 50;
  sessionMode: "home_training" | "split";
  targetMuscle?: "legs" | "chest";
}

/** 시간대별 기본 추천 (대표 확정 2026-04-18) */
function pickByHour(hour: number, locale: "ko" | "en"): {
  sessionMode: "home_training" | "split";
  targetMuscle?: "legs" | "chest";
  availableTime: 30 | 50;
  label: string;
  reason: string;
} {
  // 새벽 4~6시 — 맨몸 (집에서 조용히)
  if (hour >= 4 && hour < 6) {
    return {
      sessionMode: "home_training",
      availableTime: 30,
      label: locale === "en" ? "Bodyweight 30m" : "맨몸 30분",
      reason: locale === "en"
        ? "Quiet at home, best way to kickstart the day."
        : "조용히 집에서 가능, 하루 시동 걸기 최적이에요.",
    };
  }
  // 아침 6~10시 / 낮 10~16시 — 하체 40분 (내부 50분)
  if (hour >= 6 && hour < 16) {
    return {
      sessionMode: "split",
      targetMuscle: "legs",
      availableTime: 50,
      label: locale === "en" ? "Legs 40m" : "하체 40분",
      reason: locale === "en"
        ? "Hitting big muscles first burns fat the fastest."
        : "대근육부터 건드려야 체지방 태우는 속도가 제일 빨라요.",
    };
  }
  // 저녁 16~21시 — 홈트 30분
  if (hour >= 16 && hour < 21) {
    return {
      sessionMode: "home_training",
      availableTime: 30,
      label: locale === "en" ? "Home workout 30m" : "홈트 30분",
      reason: locale === "en"
        ? "Low barrier after work — no gear needed."
        : "퇴근 후 부담 없이, 기구 없이 가능해요.",
    };
  }
  // 밤 21시+ / 자정~4시 — 홈트 30분
  return {
    sessionMode: "home_training",
    availableTime: 30,
    label: locale === "en" ? "Home workout 30m" : "홈트 30분",
    reason: locale === "en"
      ? "Light close-out session — also boosts sleep quality."
      : "하루 마무리로 가볍게, 수면 질도 올라가요.",
  };
}

/** 시즌 countdown — 봄 시즌 (3~6월) 여름 준비 프레임. 7월 이후는 추후 시즌 전환 로직. */
function getSeasonCountdown(now: Date): { weeksToSummer: number; weeksToShortSleeve: number; opportunities: number } {
  const year = now.getFullYear();
  const DAY_MS = 86400000;
  const summer = new Date(year, 6, 1).getTime(); // 7월 1일
  const shortSleeve = new Date(year, 4, 15).getTime(); // 5월 15일
  const weeksToSummer = Math.max(1, Math.ceil((summer - now.getTime()) / (7 * DAY_MS)));
  const weeksToShortSleeve = Math.max(0, Math.ceil((shortSleeve - now.getTime()) / (7 * DAY_MS)));
  const opportunities = weeksToSummer * 3;
  return { weeksToSummer, weeksToShortSleeve, opportunities };
}

/**
 * 초기 선제안 빌드 — 모든 유저 (비로그인·로그인 공통).
 * 회의 62 v2 (2026-04-18): 로그인·이력 유저도 동일 CTA 구조 적용.
 * - 이력 있으면 부위 교대 로직 (하체↔가슴) + daysSince===0 가벼운 마무리
 * - 목표 있으면 이유 개인화 (fat_loss/muscle_gain/endurance/health)
 * - 둘 다 없으면 시간대 기본 (비로그인 케이스)
 * 봄 시즌 (3~6월) 여름 준비 후킹. 7월 이후는 시즌 전환 필요 (TODO).
 */
export function buildInitialSuggestion(
  history: WorkoutHistory[] = [],
  profile: GreetingProfile | undefined = undefined,
  locale: "ko" | "en" = "ko",
): InitialSuggestion {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;
  const DAY_MS = 86400000;
  const { weeksToSummer, weeksToShortSleeve, opportunities } = getSeasonCountdown(now);
  const isSpring = month >= 3 && month <= 6;

  // 1. 시간대 기본 추천
  let pick = pickByHour(hour, locale);

  const hasHistory = history.length > 0;
  const hasGoal = !!profile?.goal;

  // 2. 이력 기반 개인화 (아침~낮만 부위 교대 적용, 새벽/저녁/밤은 시간대 기본 유지)
  if (hasHistory) {
    const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = sorted[0];
    const daysSince = Math.floor((now.getTime() - new Date(last.date).getTime()) / DAY_MS);
    const lastDesc = last.sessionData?.description || last.sessionData?.title || "";
    const lastPart = lastDesc.split("·")[0].trim();

    if (daysSince === 0) {
      // 오늘 이미 운동 — 가벼운 마무리 톤
      pick = {
        sessionMode: "home_training",
        availableTime: 30,
        label: locale === "en" ? "Light home 30m" : "가벼운 홈트 30분",
        reason: locale === "en"
          ? "One session done today — an easy finisher caps it nicely."
          : "오늘 한 번 하셨으니, 가볍게 마무리 한 세트 어때요?",
      };
    } else if (hour >= 6 && hour < 16) {
      // 아침~낮: 부위 교대
      if (/하체|legs|lower|leg/i.test(lastPart)) {
        // 지난번 하체 → 오늘 가슴
        pick = {
          sessionMode: "split",
          targetMuscle: "chest",
          availableTime: 30,
          label: locale === "en" ? "Chest 30m" : "가슴 30분",
          reason: locale === "en"
            ? "Last session was legs — alternating to chest lets them recover."
            : "지난번 하체 했으니, 오늘은 가슴으로 교대하면 회복이 좋아요.",
        };
      } else if (/가슴|chest|상체|push/i.test(lastPart)) {
        // 지난번 가슴 → 오늘 하체
        pick = {
          sessionMode: "split",
          targetMuscle: "legs",
          availableTime: 50,
          label: locale === "en" ? "Legs 40m" : "하체 40분",
          reason: locale === "en"
            ? "Last session was chest — big muscles next for balanced growth."
            : "지난번 가슴 했으니, 오늘은 하체로 균형 맞추면 성장 효율 최대예요.",
        };
      }
      // 러닝·전신·기타는 시간대 기본(하체 40분) 유지
    }
  } else if (hasGoal && profile?.goal && hour >= 6 && hour < 16) {
    // 이력 없고 goal 있음 + 아침~낮 — 이유만 목표 기반으로 교체 (pick은 기본 하체 40분 유지)
    const goalReasonKo: Record<string, string> = {
      fat_loss: "체지방 감량 목표면 대근육부터 건드려야 태우는 속도가 제일 빨라요.",
      muscle_gain: "근비대 목표면 하체 먼저가 성장 호르몬 최대로 끌어내요.",
      endurance: "지구력 목표면 하체 근력 베이스부터 쌓아야 길게 뛰어요.",
      health: "건강 유지엔 큰 근육 자극이 순환·기초대사에 가장 좋아요.",
    };
    const goalReasonEn: Record<string, string> = {
      fat_loss: "For fat loss, hitting big muscles first burns fat fastest.",
      muscle_gain: "For muscle gain, legs first trigger max growth hormone.",
      endurance: "For endurance, legs are the base for long-distance work.",
      health: "For health, big-muscle work boosts circulation the most.",
    };
    pick = {
      ...pick,
      reason: locale === "en" ? goalReasonEn[profile.goal] : goalReasonKo[profile.goal],
    };
  }

  // 3. greeting 구성
  const greeting = (() => {
    if (!isSpring) {
      return locale === "en"
        ? `Let me pick for you.\nRight now — **${pick.label}**.\n${pick.reason}`
        : `오늘은 제가 골라드릴게요.\n지금 시간엔 **${pick.label}** 추천해요.\n${pick.reason}`;
    }
    const shortSleeveLine = weeksToShortSleeve > 0
      ? (locale === "en"
          ? `Only ${weeksToShortSleeve} week${weeksToShortSleeve === 1 ? "" : "s"} until short sleeves.`
          : `반팔 매일 입는 날까지 ${weeksToShortSleeve}주 남았어요.`)
      : "";
    const closingLine = hasHistory
      ? (locale === "en" ? `today makes one more.` : `오늘이 그 중 한 번이에요.`)
      : (locale === "en" ? `today could be the first.` : `오늘이 그 중 첫 번째입니다.`);

    if (locale === "en") {
      const parts = [
        `**${weeksToSummer} weeks until summer. This one's coming in hot.**`,
        shortSleeveLine,
        ``,
        `3 sessions a week = ${opportunities} chances —`,
        closingLine,
        ``,
        `AI pick: **${pick.label}**`,
        pick.reason,
      ].filter(Boolean);
      return parts.join("\n");
    }
    const parts = [
      `**여름까지 ${weeksToSummer}주. 올여름 더 뜨거워진다는 예보예요.**`,
      shortSleeveLine,
      ``,
      `일주일 3번이면 ${opportunities}번의 기회 —`,
      closingLine,
      ``,
      `AI 추천: **${pick.label}**`,
      pick.reason,
    ].filter(Boolean);
    return parts.join("\n");
  })();

  return {
    greeting,
    label: pick.label,
    availableTime: pick.availableTime,
    sessionMode: pick.sessionMode,
    targetMuscle: pick.targetMuscle,
  };
}

const GOAL_LABEL_KO: Record<string, string> = {
  fat_loss: "체지방 감량",
  muscle_gain: "근비대",
  endurance: "지구력",
  health: "건강 유지",
};
const GOAL_LABEL_EN: Record<string, string> = {
  fat_loss: "fat loss",
  muscle_gain: "muscle gain",
  endurance: "endurance",
  health: "general health",
};

/** 운동명에서 한글만 깔끔하게 추출: "바벨 벤치 프레스 (Barbell Bench Press)" → "바벨 벤치 프레스" */
function cleanExerciseName(name: string): string {
  return name.split("(")[0].trim();
}

/** 부위 → 주 compound 운동명 매핑 (무게 제안용) */
function pickCompoundForPart(part: string): { name: string; key: "bench" | "squat" | "deadlift" } | null {
  if (/가슴|chest/.test(part)) return { name: "벤치프레스", key: "bench" };
  if (/하체|legs|lower|leg/.test(part)) return { name: "스쿼트", key: "squat" };
  if (/등|back/.test(part)) return { name: "데드리프트", key: "deadlift" };
  return null;
}

/** 목표별 1RM 비율 (%) */
function workingWeightPct(goal?: GreetingProfile["goal"]): number {
  if (goal === "muscle_gain") return 0.75;
  if (goal === "endurance") return 0.65;
  if (goal === "fat_loss") return 0.65;
  return 0.70; // health / default
}

/** 2.5kg 단위 반올림 */
function roundTo2_5(n: number): number {
  return Math.round(n / 2.5) * 2.5;
}

/**
 * 룰베이스 첫 인사 — 트레이너 톤.
 * 과거 이력 + 목표 + 오늘 제안을 엮어 전달. LLM 호출 없음.
 */
export function buildInitialGreeting(
  input: WorkoutHistory[],
  locale: "ko" | "en" = "ko",
  profile?: GreetingProfile,
  userName?: string,
): string {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const goalLabel = profile?.goal
    ? (locale === "en" ? GOAL_LABEL_EN[profile.goal] : GOAL_LABEL_KO[profile.goal])
    : null;
  const namePrefix = userName ? `${userName}님 ` : "회원님 ";

  // 이력 없음
  if (!input || input.length === 0) {
    if (goalLabel) {
      return locale === "en"
        ? `${userName ? userName + ", " : ""}welcome aboard! Your goal is ${goalLabel}.\nLet's start easy — chest 30 min, legs 40 min, or a 5km run, whichever feels right.`
        : `${userName ? userName + "님, " : ""}첫 운동이네요! 회원님 목표는 ${goalLabel}로 잡으셨어요.\n첫날은 가볍게 가슴 30분, 하체 40분, 러닝 5km 중 편한 걸로 시작해볼까요?`;
    }
    return locale === "en"
      ? "First workout! Tell me what you want — chest, legs, or a run?"
      : "첫 운동이네요! 가슴·하체·러닝 중 뭐부터 해볼까요?";
  }

  const history = sortDesc(input);
  const last = history[0];
  const daysSince = Math.floor((now - new Date(last.date).getTime()) / DAY_MS);
  const streak = computeStreak(history);
  const desc = last.sessionData?.description || last.sessionData?.title || "";
  const lastPart = desc.split("·")[0].trim() || "";

  // 최근 7일 + 부위 커버리지
  const sevenDaysAgo = now - 7 * DAY_MS;
  const recent7 = history.filter((h) => new Date(h.date).getTime() > sevenDaysAgo);
  const partCounts = new Map<string, number>();
  for (const h of recent7) {
    const d = h.sessionData?.description || h.sessionData?.title || "";
    const p = d.split("·")[0].trim() || "운동";
    partCounts.set(p, (partCounts.get(p) || 0) + 1);
  }
  const focusParts = Array.from(partCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => p);

  // 부위 상반 매핑 — 오늘 추천 부위 결정
  const oppositePart = (() => {
    if (/가슴|chest|상체|push/i.test(lastPart)) return locale === "en" ? "legs" : "하체";
    if (/등|back|pull/i.test(lastPart)) return locale === "en" ? "legs" : "하체";
    if (/하체|legs|lower|leg/i.test(lastPart)) return locale === "en" ? "chest" : "가슴";
    if (/러닝|run|cardio/i.test(lastPart)) return locale === "en" ? "strength" : "근력";
    return locale === "en" ? "full body" : "전신";
  })();

  // 지난 세션 주요 운동 2개 추출 (main phase 중 앞 2개)
  const lastMainExercises = (last.sessionData?.exercises || [])
    .filter((ex) => ex.phase === "main" || ex.type === "strength")
    .slice(0, 2)
    .map((ex) => cleanExerciseName(ex.name));
  const lastMovesLabel = lastMainExercises.length >= 2
    ? `**${lastMainExercises[0]}**랑 **${lastMainExercises[1]}**같은`
    : lastMainExercises.length === 1
    ? `**${lastMainExercises[0]}**같은`
    : "";

  // 오늘 추천 부위용 compound + 무게 계산
  const todayCompound = pickCompoundForPart(oppositePart);
  const today1RM = todayCompound
    ? (todayCompound.key === "bench" ? profile?.bench1RM
      : todayCompound.key === "squat" ? profile?.squat1RM
      : profile?.deadlift1RM)
    : undefined;
  const todayTargetWeight = todayCompound && today1RM
    ? roundTo2_5(today1RM * workingWeightPct(profile?.goal))
    : null;

  // 목표별 톤 스니펫 (freqClause만 현재 사용, goalClause는 goalLine으로 통합됨)
  const freqClause = profile?.weeklyFrequency
    ? (locale === "en"
      ? ` You set ${profile.weeklyFrequency}x/week — this keeps you on track.`
      : ` 주 ${profile.weeklyFrequency}회 페이스 맞추고 계세요.`)
    : "";

  // 최근 흐름 요약 한 줄 (모든 케이스 공통 재활용)
  const recapLine = (() => {
    if (recent7.length === 0) return "";
    const parts = focusParts.length > 0
      ? (locale === "en" ? `${focusParts.join(" · ")}` : `${focusParts.join("·")}`)
      : (locale === "en" ? "mixed" : "혼합");
    return locale === "en"
      ? `Past 7 days: ${recent7.length} sessions (${parts}).`
      : `최근 7일 ${recent7.length}회, ${parts} 위주로 쌓으셨어요.`;
  })();

  const goalLine = goalLabel
    ? (locale === "en" ? `Your goal is ${goalLabel}${profile?.weeklyFrequency ? `, ${profile.weeklyFrequency}x/week pace` : ""}.`
      : `회원님 목표는 ${goalLabel}${profile?.weeklyFrequency ? `, 주 ${profile.weeklyFrequency}회 페이스` : ""}예요.`)
    : "";

  // Phase 10: 목표별 인과관계 reasoning — 왜 오늘 이 부위인가 (마누스식)
  const GOAL_REASONING_KO: Record<string, string> = {
    fat_loss: "**근손실 방지·대사량 유지**",
    muscle_gain: "**전신 균형·회복 최적화**",
    strength: "**주동근 강화·신경 적응**",
    endurance: "**심폐 지구력 강화**",
    health: "**관절·순환 개선**",
    general_fitness: "**전신 균형 개선**",
  };
  const GOAL_REASONING_EN: Record<string, string> = {
    fat_loss: "**prevent muscle loss, keep metabolism up**",
    muscle_gain: "**whole-body balance and recovery**",
    strength: "**prime mover strength, neural adaptation**",
    endurance: "**cardio capacity boost**",
    health: "**joint and circulation health**",
    general_fitness: "**overall balance**",
  };
  const goalReasoning = profile?.goal
    ? (locale === "en" ? GOAL_REASONING_EN[profile.goal] : GOAL_REASONING_KO[profile.goal])
    : "";

  // 줄바꿈으로 3~4문장 조립. 빈 줄은 필터링.
  const join = (lines: (string | "")[]): string => lines.filter(Boolean).join("\n");

  // compound 영문 라벨 매핑 (todayCompound.name은 한글 고정이라 locale별 표시용)
  const compoundLabelEn: Record<string, string> = {
    "벤치프레스": "Bench Press",
    "스쿼트": "Squat",
    "데드리프트": "Deadlift",
  };
  const todayCompoundLabel = todayCompound
    ? (locale === "en" ? (compoundLabelEn[todayCompound.name] || todayCompound.name) : todayCompound.name)
    : "";

  // 오늘 운동 제안 한 줄 생성 (1RM 있으면 무게 포함, 없으면 중강도)
  const todaySuggestion = (() => {
    if (todayCompound && todayTargetWeight) {
      return locale === "en"
        ? `Today's target — **${todayCompoundLabel} ${todayTargetWeight}kg**.`
        : `오늘은 **${todayCompound.name} ${todayTargetWeight}kg** 목표로 입니다!`;
    }
    if (todayCompound) {
      return locale === "en"
        ? `Today's target — **${todayCompoundLabel}** at moderate intensity.`
        : `오늘은 **${todayCompound.name} 중강도** 어떠세요?`;
    }
    return locale === "en"
      ? `Today — **${oppositePart}**, moderate intensity.`
      : `오늘은 **${oppositePart}** 중강도 어떠세요?`;
  })();

  const confirmQuestion = locale === "en"
    ? "Go with this plan, or want a different area?"
    : "혹시 이대로 하시나요? 아니면 다른 부위 하고 싶으신가요?";

  // 영문용 운동명 (괄호 안 영문 우선, 없으면 원문)
  const exerciseNameEn = (raw: string): string => {
    const m = raw.match(/\(([^)]+)\)/);
    return (m ? m[1] : raw).trim();
  };
  const lastMainExercisesEn = (last.sessionData?.exercises || [])
    .filter((ex) => ex.phase === "main" || ex.type === "strength")
    .slice(0, 2)
    .map((ex) => exerciseNameEn(ex.name));
  const lastMovesLabelEn = lastMainExercisesEn.length >= 2
    ? `${lastMainExercisesEn[0]} and ${lastMainExercisesEn[1]}`
    : lastMainExercisesEn.length === 1
    ? lastMainExercisesEn[0]
    : "";

  // 영문 부위 라벨 (lastPart가 한글이라 번역)
  const partLabelEn = (() => {
    if (/가슴|chest/.test(lastPart)) return "chest";
    if (/등|back/.test(lastPart)) return "back";
    if (/하체|legs|lower|leg/.test(lastPart)) return "legs";
    if (/어깨|shoulder/.test(lastPart)) return "shoulders";
    if (/러닝|run|cardio/.test(lastPart)) return "running";
    return "workout";
  })();

  // 케이스별 인사
  if (daysSince === 0) {
    const todayLine = locale === "en"
      ? `${userName ? userName + ", " : ""}you already did ${partLabelEn} today${lastMovesLabelEn ? ` (${lastMovesLabelEn})` : ""}.`
      : `${userName ? userName + "님, " : ""}오늘은 ${lastPart || "운동"} 하셨어요${lastMovesLabel ? ` (${lastMovesLabel} 운동)` : ""}.`;
    const rest = locale === "en"
      ? `Add a light 30-min session, or wrap and come back tomorrow?`
      : `추가로 가볍게 30분 더 할까요, 아니면 내일 다시 만나요?`;
    return join([todayLine, recapLine, goalLine, rest]);
  }

  // 대표 요청 템플릿 — 지난 운동·오늘 추천·목표·무게·확인 질문 (Phase 10: 인과관계 주입)
  if (lastPart && (lastMovesLabel || lastMovesLabelEn)) {
    const pastLine = locale === "en"
      ? `Your last session (${daysSince} day${daysSince === 1 ? "" : "s"} ago) was mostly **${partLabelEn}**${lastMovesLabelEn ? ` — **${lastMovesLabelEn}**` : ""}.`
      : `지난 마지막 시간 ${lastMovesLabel} **${lastPart} 위주**로 했었네요.`;
    const todayPlanLine = locale === "en"
      ? (goalReasoning
          ? `Today's ${oppositePart} — ${goalReasoning} for your ${goalLabel} goal.`
          : `Today I'm planning **${oppositePart}**${goalLabel ? `, and since your goal is **${goalLabel}**` : ""},`)
      : (goalReasoning
          ? `오늘은 ${goalReasoning}를 위해 **${oppositePart}** 추천드려요.`
          : `오늘은 **${oppositePart}** 계획하고 있으며${goalLabel ? ` ${namePrefix}${goalLabel}을 목적으로 하셨으니,` : ","}`);
    return join([pastLine, todayPlanLine, todaySuggestion, confirmQuestion]);
  }

  // 일반 폴백 (운동명 없는 구세션 등)
  if (lastPart) {
    const lastLine = locale === "en"
      ? `Last session: ${partLabelEn} (${daysSince} day${daysSince === 1 ? "" : "s"} ago).`
      : `${daysSince}일 전에는 ${lastPart} 하셨어요.`;
    return join([lastLine, recapLine, goalLine, todaySuggestion, confirmQuestion]);
  }

  if (daysSince >= 5) {
    const gapLine = locale === "en"
      ? `${daysSince} days since your last session.`
      : `${daysSince}일 만에 오셨네요.`;
    const suggestion = locale === "en"
      ? `Ease back in — 30 min full body, no ego lifts today.`
      : `몸이 덜 풀렸으니 오늘은 가볍게 전신 30분, 무리는 금물이에요.`;
    return join([gapLine, goalLine, freqClause.trim(), suggestion]);
  }

  if (streak >= 3) {
    const streakLine = locale === "en"
      ? `${streak}-day streak — solid rhythm.`
      : `연속 ${streak}일째, 리듬 좋아요.`;
    return join([streakLine, recapLine, goalLine, todaySuggestion, confirmQuestion]);
  }

  return locale === "en"
    ? join([`Welcome back${userName ? `, ${userName}` : ""}!`, goalLine, `What are we doing today?`])
    : join([`다시 오셨네요!`, goalLine, `오늘은 뭐 해볼까요?`]);
}

function computeStreak(input: WorkoutHistory[]): number {
  if (input.length === 0) return 0;
  const dates = new Set(input.map((h) => new Date(h.date).toDateString()));
  let streak = 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  let cursor = new Date();
  // 오늘 운동 안 했으면 어제부터 시작
  if (!dates.has(cursor.toDateString())) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  while (dates.has(cursor.toDateString())) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
