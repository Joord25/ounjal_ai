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

  // 대표 요청 템플릿 — 지난 운동·오늘 추천·목표·무게·확인 질문
  if (lastPart && (lastMovesLabel || lastMovesLabelEn)) {
    const pastLine = locale === "en"
      ? `Your last session (${daysSince} day${daysSince === 1 ? "" : "s"} ago) was mostly **${partLabelEn}**${lastMovesLabelEn ? ` — **${lastMovesLabelEn}**` : ""}.`
      : `지난 마지막 시간 ${lastMovesLabel} **${lastPart} 위주**로 했었네요.`;
    const todayPlanLine = locale === "en"
      ? `Today I'm planning **${oppositePart}**${goalLabel ? `, and since your goal is **${goalLabel}**` : ""},`
      : `오늘은 **${oppositePart}** 계획하고 있으며${goalLabel ? ` ${namePrefix}${goalLabel}을 목적으로 하셨으니,` : ","}`;
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
