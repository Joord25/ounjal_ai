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

/**
 * 룰베이스 첫 인사. 최근 운동 이력에 따라 오늘 추천을 동적으로 생성.
 * LLM 호출 없음 — 채팅창 진입 시 즉시 노출.
 */
export function buildInitialGreeting(input: WorkoutHistory[], locale: "ko" | "en" = "ko"): string {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (!input || input.length === 0) {
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

  // 부위 상반 매핑 (룰베이스 추천)
  const oppositePart = (() => {
    if (/가슴|chest|상체|push|등|back/i.test(lastPart)) {
      return locale === "en" ? "legs" : "하체";
    }
    if (/하체|legs|lower|leg/i.test(lastPart)) {
      return locale === "en" ? "upper body" : "상체";
    }
    if (/러닝|run|cardio/i.test(lastPart)) {
      return locale === "en" ? "strength" : "근력 운동";
    }
    return locale === "en" ? "full body" : "전신";
  })();

  // 케이스별 인사
  if (daysSince === 0) {
    return locale === "en"
      ? `Already trained today! Another round? Or rest up and come back tomorrow.`
      : `오늘 이미 ${lastPart || "운동"} 하셨네요. 더 하실래요, 아니면 내일 만나요?`;
  }
  if (daysSince === 1 && lastPart) {
    return locale === "en"
      ? `Yesterday was ${lastPart}. Today — how about ${oppositePart}?`
      : `어제 ${lastPart} 하셨으니 오늘은 ${oppositePart} 어떠세요?`;
  }
  if (streak >= 3) {
    return locale === "en"
      ? `${streak}-day streak! Keep it going — which area today?`
      : `연속 ${streak}일째네요! 오늘은 어디 하실래요?`;
  }
  if (daysSince >= 5) {
    return locale === "en"
      ? `${daysSince} days since last session. Let's ease in — 30 min full body?`
      : `${daysSince}일 만에 오셨네요. 가볍게 전신 30분 어때요?`;
  }
  if (lastPart) {
    return locale === "en"
      ? `Last time: ${lastPart} (${daysSince}d ago). Today — ${oppositePart}, or something else?`
      : `${daysSince}일 전 ${lastPart} 하셨어요. 오늘 ${oppositePart} 해볼까요?`;
  }
  return locale === "en"
    ? "Welcome back! What are we doing today?"
    : "다시 오셨네요! 오늘은 뭐 해볼까요?";
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
