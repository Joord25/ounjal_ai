/**
 * Quest-based Season Tier System
 * ACSM 2025 weekly intensity distribution → gamified quests → EXP → tier progression
 */

import { WorkoutHistory } from "@/constants/workout";
import { classifySessionIntensity, getWeeklyIntensityTarget, type IntensityLevel, type WeeklyIntensityTarget } from "@/utils/workoutMetrics";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";

function getUserDocRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return doc(db, "users", uid);
}

// ─── Types ───────────────────────────────────────────────────────

export type QuestType = "intensity_high" | "intensity_moderate" | "intensity_low" | "consistency" | "bonus_streak" | "bonus_new_exercise";

export interface QuestDefinition {
  id: string;
  type: QuestType;
  label: string;
  description: string;
  target: number;
  exp: number;
  isBonus: boolean;
}

export interface QuestProgress {
  questId: string;
  current: number;
  completed: boolean;
  completedAt?: string;
}

export interface WeeklyQuestState {
  weekStart: string;
  quests: QuestProgress[];
  allCoreCompleted: boolean;
  weeklyBonusClaimed: boolean;
}

export interface SeasonInfo {
  year: number;
  season: 1 | 2 | 3;
  startDate: string;
  endDate: string;
  label: string;
}

export interface SeasonExpState {
  seasonKey: string;
  totalExp: number;
  expLog: ExpLogEntry[];
}

export interface ExpLogEntry {
  date: string;
  source: "workout" | "quest" | "weekly_bonus";
  amount: number;
  detail: string;
}

export interface TierDef {
  name: string;
  minExp: number;
  color: string;
}

export interface TierResult {
  tier: TierDef;
  nextTier: TierDef | null;
  progress: number;
  remaining: number;
  tierIdx: number;
}

// ─── Constants ───────────────────────────────────────────────────

export const TIERS: readonly TierDef[] = [
  { name: "Iron",       minExp: 0,   color: "#6b7280" },
  { name: "Bronze",     minExp: 15,  color: "#cd7f32" },
  { name: "Silver",     minExp: 40,  color: "#94b8d0" },
  { name: "Gold",       minExp: 80,  color: "#ffd700" },
  { name: "Platinum",   minExp: 110, color: "#e5e4e2" },
  { name: "Emerald",    minExp: 160, color: "#34d399" },
  { name: "Diamond",    minExp: 240, color: "#60a5fa" },
  { name: "Master",     minExp: 340, color: "#a78bfa" },
  { name: "Challenger", minExp: 470, color: "#f87171" },
];

const QUEST_EXP = {
  intensity_high: 3,
  intensity_moderate: 3,
  intensity_low: 2,
  consistency: 5,
  bonus_streak: 3,
  bonus_new_exercise: 2,
  weekly_all_clear: 5,
  base_workout: 1,
} as const;

// ─── Season ──────────────────────────────────────────────────────

export function getCurrentSeason(date = new Date()): SeasonInfo {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const season = (Math.floor(month / 4) + 1) as 1 | 2 | 3;
  const startMonth = (season - 1) * 4; // 0, 4, 8
  const endMonth = startMonth + 4; // 4, 8, 12
  const startDate = new Date(year, startMonth, 1).toISOString().slice(0, 10);
  const endDate = new Date(year, endMonth, 0).toISOString().slice(0, 10); // last day of end month - 1
  const labels = ["1~4월", "5~8월", "9~12월"];
  return {
    year,
    season,
    startDate,
    endDate,
    label: `${year} 시즌 ${season}`,
  };
}

export function getSeasonKey(date = new Date()): string {
  const s = getCurrentSeason(date);
  return `${s.year}-${s.season}`;
}

// ─── Week ────────────────────────────────────────────────────────

export function getWeekStartMonday(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 회의 18: 월 경계 주간 퀘스트 윈도우 결정
 *
 * Case 0 (정상 ISO 주) — 월 경계 안 걸침
 *   → Mon~Sun 7일, ACSM 기본 target
 *
 * Case 1 (이어받기) — 월 경계 걸침 + 지난 달 부분에 활동 있음
 *   → Mon~Sun 7일 유지, ACSM 기본 target, 지난 달 기록 포함해 진행도 카운트
 *
 * Case 2 (새 출발) — 월 경계 걸침 + 지난 달 부분에 활동 없음
 *   → 월1일~ISO일요일 (부분 주), scaleWeeklyTarget으로 축소된 target
 */
export interface WeekQuestWindow {
  start: Date;      // 윈도우 시작 (00:00:00)
  end: Date;        // 윈도우 끝 (포함, 23:59:59)
  days: number;     // 실제 일수 (1~7)
  isScaled: boolean; // Case 2 여부 (스케일된 target)
  case: 0 | 1 | 2;
}

export function getCurrentWeekQuestWindow(
  history: WorkoutHistory[],
  today = new Date(),
): WeekQuestWindow {
  const isoMonday = getWeekStartMonday(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const isoSunday = new Date(isoMonday);
  isoSunday.setDate(isoSunday.getDate() + 6);
  isoSunday.setHours(23, 59, 59, 999);

  // Case 0: 월 경계 안 걸침
  if (isoMonday >= monthStart) {
    return { start: isoMonday, end: isoSunday, days: 7, isScaled: false, case: 0 };
  }

  // 월 경계 걸침 — 지난 달 부분 활동 체크
  const prevMonthEnd = new Date(monthStart);
  prevMonthEnd.setMilliseconds(-1); // 직전 달 마지막 순간
  const hasPrevMonthActivity = history.some(h => {
    const d = new Date(h.date);
    return d >= isoMonday && d <= prevMonthEnd;
  });

  if (hasPrevMonthActivity) {
    // Case 1: 이어받기 — ISO 주 그대로
    return { start: isoMonday, end: isoSunday, days: 7, isScaled: false, case: 1 };
  }

  // Case 2: 새 출발 — 월1일부터
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((isoSunday.getTime() - monthStart.getTime()) / msPerDay) + 1;
  return { start: monthStart, end: isoSunday, days, isScaled: true, case: 2 };
}

/**
 * 부분 주(days < 7) target 축소 테이블 (회의 18, 대표 승인).
 * 이미 나이/성별로 줄어든 base보다 테이블이 크면 base로 캡.
 */
function scaleWeeklyTarget(base: WeeklyIntensityTarget, weekDays: number): WeeklyIntensityTarget {
  if (weekDays >= 7) return base;

  const tables: Record<number, { high: number; moderate: number; low: number }> = {
    6: { high: 2, moderate: 2, low: 1 },
    5: { high: 1, moderate: 2, low: 1 },
    4: { high: 1, moderate: 1, low: 1 },
    3: { high: 1, moderate: 1, low: 1 },
    2: { high: 1, moderate: 1, low: 0 },
    1: { high: 0, moderate: 1, low: 0 },
  };

  const t = tables[weekDays] || { high: 0, moderate: 1, low: 0 };
  const high = Math.min(t.high, base.high);
  const moderate = Math.min(t.moderate, base.moderate);
  const low = Math.min(t.low, base.low);
  return { high, moderate, low, total: high + moderate + low };
}

// ─── Tier ────────────────────────────────────────────────────────

export function getTierFromExp(exp: number): TierResult {
  let tierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (exp >= TIERS[i].minExp) { tierIdx = i; break; }
  }
  const tier = TIERS[tierIdx];
  const nextTier = TIERS[tierIdx + 1] ?? null;
  const progress = nextTier
    ? (exp - tier.minExp) / (nextTier.minExp - tier.minExp)
    : 1;
  const remaining = nextTier ? nextTier.minExp - exp : 0;
  return { tier, nextTier, progress, remaining, tierIdx };
}

// ─── Quest Generation ────────────────────────────────────────────

export function generateWeeklyQuests(
  birthYear?: number,
  gender?: "male" | "female",
  weekDays = 7,
): QuestDefinition[] {
  const baseTarget: WeeklyIntensityTarget = getWeeklyIntensityTarget(birthYear, gender);
  // 회의 18: 부분 주(Case 2)면 target 축소
  const target: WeeklyIntensityTarget = weekDays < 7 ? scaleWeeklyTarget(baseTarget, weekDays) : baseTarget;

  const quests: QuestDefinition[] = [];

  if (target.high > 0) {
    quests.push({
      id: `intensity_high_${target.high}`,
      type: "intensity_high",
      label: `고강도 운동 ${target.high}회`,
      description: "무거운 무게로 힘차게!",
      target: target.high,
      exp: QUEST_EXP.intensity_high,
      isBonus: false,
    });
  }

  if (target.moderate > 0) {
    quests.push({
      id: `intensity_moderate_${target.moderate}`,
      type: "intensity_moderate",
      label: `중강도 운동 ${target.moderate}회`,
      description: "적당한 무게로 꾸준히!",
      target: target.moderate,
      exp: QUEST_EXP.intensity_moderate,
      isBonus: false,
    });
  }

  if (target.low > 0) {
    quests.push({
      id: `intensity_low_${target.low}`,
      type: "intensity_low",
      label: `저강도 운동 ${target.low}회`,
      description: "가볍게 움직이며 회복!",
      target: target.low,
      exp: QUEST_EXP.intensity_low,
      isBonus: false,
    });
  }

  quests.push({
    id: `consistency_${target.total}`,
    type: "consistency",
    label: `이번 주 ${target.total}일 운동`,
    description: "꾸준함이 실력이다!",
    target: target.total,
    exp: QUEST_EXP.consistency,
    isBonus: false,
  });

  // Bonus quests
  // 회의 18: 부분 주(5일 미만)에서는 5일 연속 달성 물리적 불가능 → 숨김
  if (weekDays >= 5) {
    quests.push({
      id: "bonus_streak_5",
      type: "bonus_streak",
      label: "5일 연속 운동",
      description: "연속 기록 도전!",
      target: 5,
      exp: QUEST_EXP.bonus_streak,
      isBonus: true,
    });
  }

  quests.push({
    id: "bonus_new_exercise_3",
    type: "bonus_new_exercise",
    label: "새 운동 3종목 시도",
    description: "새로운 자극!",
    target: 3,
    exp: QUEST_EXP.bonus_new_exercise,
    isBonus: true,
  });

  return quests;
}

// ─── Quest Label / EXP Detail Translation (회의 21) ──────────────
// 저장된 Korean 라벨을 locale에 맞게 렌더 — UI 컴포넌트에서 사용.
// t는 useTranslation()의 번역 함수.
type TranslateFn = (key: string, vars?: Record<string, string>) => string;

/**
 * QuestDefinition의 라벨을 현재 locale로 렌더.
 * id/type 기반 안전 매칭으로 Korean 라벨을 i18n 키로 변환.
 */
export function translateQuestLabel(q: QuestDefinition, t: TranslateFn): string {
  switch (q.type) {
    case "intensity_high":
      return t("quest.highIntensity", { count: String(q.target) });
    case "intensity_moderate":
      return t("quest.moderateIntensity", { count: String(q.target) });
    case "intensity_low":
      return t("quest.lowIntensity", { count: String(q.target) });
    case "consistency":
      return t("quest.consistency", { count: String(q.target) });
    case "bonus_streak":
      return t("quest.streak5");
    case "bonus_new_exercise":
      return t("quest.newExercise3");
    default:
      return q.label;
  }
}

export function translateQuestDescription(q: QuestDefinition, t: TranslateFn): string {
  switch (q.type) {
    case "intensity_high": return t("quest.desc.high");
    case "intensity_moderate": return t("quest.desc.moderate");
    case "intensity_low": return t("quest.desc.low");
    case "consistency": return t("quest.desc.consistency");
    case "bonus_streak": return t("quest.desc.streak");
    case "bonus_new_exercise": return t("quest.desc.newExercise");
    default: return q.description;
  }
}

/**
 * ExpLogEntry.detail (Korean literal) → locale 번역 문자열.
 * calculateSessionExp가 저장한 문자열을 역파싱하여 i18n 키로 매핑.
 */
export function translateExpDetail(entry: ExpLogEntry, t: TranslateFn): string {
  // 확정된 리터럴
  if (entry.detail === "운동 완료") return t("exp.workout");
  if (entry.detail === "주간 올클리어") return t("exp.weeklyBonus");

  // 동적: "${questLabel} 완료" 패턴 역파싱
  const m = entry.detail.match(/^(.+) 완료$/);
  if (m) {
    const questLabel = m[1];
    // questLabel을 로케일 라벨로 재번역 — id/type을 모르므로 패턴 매칭
    // 고강도 운동 N회 / 중강도 운동 N회 / 저강도 운동 N회
    const intensityMatch = questLabel.match(/^(고|중|저)강도 운동 (\d+)회$/);
    if (intensityMatch) {
      const key = intensityMatch[1] === "고" ? "quest.highIntensity"
        : intensityMatch[1] === "중" ? "quest.moderateIntensity"
        : "quest.lowIntensity";
      const localized = t(key, { count: intensityMatch[2] });
      return t("exp.questComplete", { label: localized });
    }
    // 이번 주 N일 운동
    const consistencyMatch = questLabel.match(/^이번 주 (\d+)일 운동$/);
    if (consistencyMatch) {
      const localized = t("quest.consistency", { count: consistencyMatch[1] });
      return t("exp.questComplete", { label: localized });
    }
    if (questLabel === "5일 연속 운동") {
      return t("exp.questComplete", { label: t("quest.streak5") });
    }
    if (questLabel === "새 운동 3종목 시도") {
      return t("exp.questComplete", { label: t("quest.newExercise3") });
    }
  }
  // Unknown pattern → fallback (원본 또는 locale=ko 그대로)
  return entry.detail;
}

// ─── Quest Progress Evaluation ───────────────────────────────────

function getWeekSessions(history: WorkoutHistory[], windowStart: Date, windowEnd?: Date): WorkoutHistory[] {
  const end = windowEnd ?? (() => { const e = new Date(windowStart); e.setDate(e.getDate() + 7); return e; })();
  return history.filter(h => {
    const d = new Date(h.date);
    return d >= windowStart && d <= end;
  });
}

function classifySession(h: WorkoutHistory): IntensityLevel {
  // 1순위: 서버가 플랜 생성 시 찍은 의도 강도 (회의 16)
  //   - 러닝/홈트/부위별 전부 이 필드로 정확히 분류
  //   - 램프업/워밍업 기록 영향 받지 않음
  if (h.sessionData.intendedIntensity) return h.sessionData.intendedIntensity;
  // 2순위: 의도 필드가 없는 과거 세션 → 기존 데이터 기반 분류 (폴백)
  return classifySessionIntensity(h.sessionData.exercises, h.logs).level;
}

function getUniqueDays(sessions: WorkoutHistory[]): number {
  const days = new Set(sessions.map(h => new Date(h.date).toDateString()));
  return days.size;
}

function getConsecutiveDaysInWeek(sessions: WorkoutHistory[], weekStart: Date): number {
  if (sessions.length === 0) return 0;
  const daySet = new Set(sessions.map(h => {
    const d = new Date(h.date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  // Check each day of the week for consecutive streak
  let maxStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    if (daySet.has(key)) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

function getNewExercises(weekSessions: WorkoutHistory[], allHistory: WorkoutHistory[], weekStart: Date): string[] {
  // Exercise names from this week
  const weekExerciseNames = new Set<string>();
  weekSessions.forEach(h => {
    h.sessionData.exercises.forEach(e => {
      if (e.type === "strength") {
        weekExerciseNames.add(e.name);
      }
    });
  });

  // Exercise names from all history before this week
  const pastExerciseNames = new Set<string>();
  allHistory.forEach(h => {
    if (new Date(h.date) < weekStart) {
      h.sessionData.exercises.forEach(e => {
        if (e.type === "strength") {
          pastExerciseNames.add(e.name);
        }
      });
    }
  });

  return Array.from(weekExerciseNames).filter(name => !pastExerciseNames.has(name));
}

export function evaluateQuestProgress(
  quests: QuestDefinition[],
  weekSessions: WorkoutHistory[],
  allHistory: WorkoutHistory[],
  weekStart: Date,
): WeeklyQuestState {
  const intensityCounts = { high: 0, moderate: 0, low: 0 };
  weekSessions.forEach(h => {
    const level = classifySession(h);
    intensityCounts[level]++;
  });

  const uniqueDays = getUniqueDays(weekSessions);
  const consecutiveDays = getConsecutiveDaysInWeek(weekSessions, weekStart);
  const newExercises = getNewExercises(weekSessions, allHistory, weekStart);

  const progress: QuestProgress[] = quests.map(q => {
    let current = 0;
    switch (q.type) {
      case "intensity_high": current = intensityCounts.high; break;
      case "intensity_moderate": current = intensityCounts.moderate; break;
      case "intensity_low": current = intensityCounts.low; break;
      case "consistency": current = uniqueDays; break;
      case "bonus_streak": current = consecutiveDays; break;
      case "bonus_new_exercise": current = newExercises.length; break;
    }
    return {
      questId: q.id,
      current: Math.min(current, q.target),
      completed: current >= q.target,
    };
  });

  const coreQuests = quests.filter(q => !q.isBonus);
  const allCoreCompleted = coreQuests.every(q => {
    const p = progress.find(p => p.questId === q.id);
    return p?.completed;
  });

  return {
    weekStart: toDateStr(weekStart),
    quests: progress,
    allCoreCompleted,
    weeklyBonusClaimed: false, // computed separately
  };
}

// ─── EXP Calculation ─────────────────────────────────────────────

export function calculateSessionExp(
  questsBefore: WeeklyQuestState,
  questsAfter: WeeklyQuestState,
  questDefs: QuestDefinition[],
  dateOverride?: string,
): ExpLogEntry[] {
  const entries: ExpLogEntry[] = [];
  const now = dateOverride || new Date().toISOString();

  // Base workout EXP
  entries.push({
    date: now,
    source: "workout",
    amount: QUEST_EXP.base_workout,
    detail: "운동 완료",
  });

  // Check newly completed quests
  for (const def of questDefs) {
    const before = questsBefore.quests.find(q => q.questId === def.id);
    const after = questsAfter.quests.find(q => q.questId === def.id);
    if (after?.completed && !before?.completed) {
      entries.push({
        date: now,
        source: "quest",
        amount: def.exp,
        detail: `${def.label} 완료`,
      });
    }
  }

  // Weekly all-clear bonus
  if (questsAfter.allCoreCompleted && !questsBefore.allCoreCompleted) {
    entries.push({
      date: now,
      source: "weekly_bonus",
      amount: QUEST_EXP.weekly_all_clear,
      detail: "주간 올클리어",
    });
  }

  return entries;
}

export function sumExp(entries: ExpLogEntry[]): number {
  return entries.reduce((s, e) => s + e.amount, 0);
}

// ─── Persistence ─────────────────────────────────────────────────

const STORAGE_KEY_QUEST = "ohunjal_quest_progress";
const STORAGE_KEY_EXP = "ohunjal_season_exp";

export function loadWeeklyQuestState(): WeeklyQuestState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUEST);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveWeeklyQuestState(state: WeeklyQuestState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_QUEST, JSON.stringify(state));

  // Firestore 동기화
  const ref = getUserDocRef();
  if (ref) {
    setDoc(ref, { questProgress: state, updatedAt: Timestamp.now() }, { merge: true }).catch(() => {});
  }
}

export function loadSeasonExp(seasonKey?: string): SeasonExpState {
  const key = seasonKey ?? getSeasonKey();
  if (typeof window === "undefined") return { seasonKey: key, totalExp: 0, expLog: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXP);
    if (!raw) return { seasonKey: key, totalExp: 0, expLog: [] };
    const parsed: SeasonExpState = JSON.parse(raw);
    // If different season, return fresh
    if (parsed.seasonKey !== key) return { seasonKey: key, totalExp: 0, expLog: [] };
    return parsed;
  } catch { return { seasonKey: key, totalExp: 0, expLog: [] }; }
}

export function saveSeasonExp(state: SeasonExpState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_EXP, JSON.stringify(state));

  // Firestore 동기화
  const ref = getUserDocRef();
  if (ref) {
    setDoc(ref, { seasonExp: state, updatedAt: Timestamp.now() }, { merge: true }).catch(() => {});
  }
}

/** 로그인 시 Firestore → localStorage 동기화 (1회 호출) */
export async function syncExpFromFirestore(): Promise<void> {
  const ref = getUserDocRef();
  if (!ref) return;

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();

    // SeasonExp 동기화: expLog 길이가 더 큰 쪽을 신뢰
    if (data.seasonExp) {
      const firestoreExp: SeasonExpState = data.seasonExp;
      const localExp = loadSeasonExp(firestoreExp.seasonKey);
      if (firestoreExp.expLog.length >= localExp.expLog.length) {
        localStorage.setItem(STORAGE_KEY_EXP, JSON.stringify(firestoreExp));
      }
    }

    // QuestProgress 동기화
    if (data.questProgress) {
      const firestoreQuest: WeeklyQuestState = data.questProgress;
      const localQuest = loadWeeklyQuestState();
      // Firestore의 weekStart가 같거나 더 최신이면 Firestore 신뢰
      if (!localQuest || firestoreQuest.weekStart >= localQuest.weekStart) {
        localStorage.setItem(STORAGE_KEY_QUEST, JSON.stringify(firestoreQuest));
      }
    }
  } catch (e) {
    console.error("Failed to sync EXP from Firestore", e);
  }
}

// ─── Rebuild from History (recovery) ─────────────────────────────

export function rebuildFromHistory(
  history: WorkoutHistory[],
  birthYear?: number,
  gender?: "male" | "female",
): SeasonExpState {
  const season = getCurrentSeason();
  const seasonKey = getSeasonKey();
  const seasonStart = new Date(season.startDate);
  const seasonEnd = new Date(season.endDate);

  // Filter history to current season
  const seasonHistory = history.filter(h => {
    const d = new Date(h.date);
    return d >= seasonStart && d <= seasonEnd;
  });

  if (seasonHistory.length === 0) {
    return { seasonKey, totalExp: 0, expLog: [] };
  }

  // 회의 18: 각 세션 시점의 윈도우 기준으로 그룹화 (Case 0/1/2 적용)
  // key = window.start 날짜 문자열
  const windowMap = new Map<string, { window: WeekQuestWindow; sessions: WorkoutHistory[] }>();
  seasonHistory.forEach(h => {
    const window = getCurrentWeekQuestWindow(seasonHistory, new Date(h.date));
    const key = toDateStr(window.start);
    if (!windowMap.has(key)) {
      windowMap.set(key, { window, sessions: [] });
    }
    windowMap.get(key)!.sessions.push(h);
  });

  // Sort windows chronologically
  const sortedWindows = Array.from(windowMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const allExpLog: ExpLogEntry[] = [];

  for (const [, { window, sessions: winSessions }] of sortedWindows) {
    // Window 길이에 맞는 quest defs (스케일 적용)
    const questDefs = generateWeeklyQuests(birthYear, gender, window.days);

    // Process sessions one by one to detect quest completions
    let prevState: WeeklyQuestState = {
      weekStart: toDateStr(window.start),
      quests: questDefs.map(q => ({ questId: q.id, current: 0, completed: false })),
      allCoreCompleted: false,
      weeklyBonusClaimed: false,
    };

    // Sort sessions by date within the window
    const sorted = [...winSessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sorted.length; i++) {
      const sessionsUpToNow = sorted.slice(0, i + 1);
      const afterState = evaluateQuestProgress(questDefs, sessionsUpToNow, history, window.start);
      const entries = calculateSessionExp(prevState, afterState, questDefs, sorted[i].date);
      allExpLog.push(...entries);
      prevState = afterState;
    }
  }

  return {
    seasonKey,
    totalExp: sumExp(allExpLog),
    expLog: allExpLog,
  };
}

// ─── High-level helpers for components ───────────────────────────

/**
 * Get current quest state, auto-handling week transitions.
 * Call this on mount in ProofTab / WorkoutReport.
 */
export function getOrCreateWeeklyQuests(
  history: WorkoutHistory[],
  birthYear?: number,
  gender?: "male" | "female",
): { questDefs: QuestDefinition[]; questState: WeeklyQuestState; window: WeekQuestWindow } {
  // 회의 18: 월 경계 윈도우 적용
  const window = getCurrentWeekQuestWindow(history);
  const windowStartStr = toDateStr(window.start);
  const saved = loadWeeklyQuestState();

  const questDefs = generateWeeklyQuests(birthYear, gender, window.days);
  const weekSessions = getWeekSessions(history, window.start, window.end);

  // 윈도우 시작이 다르거나, 세션 수 불일치면 다시 계산
  if (!saved || saved.weekStart !== windowStartStr) {
    const questState = evaluateQuestProgress(questDefs, weekSessions, history, window.start);
    saveWeeklyQuestState(questState);
    return { questDefs, questState, window };
  }

  // 캐시된 진행도의 consistency(운동일수) vs 실제 이번 주 세션 수 비교
  const consistencyQuest = saved.quests.find(q => q.questId.startsWith("consistency_"));
  const actualDays = new Set(weekSessions.map(h => new Date(h.date).toDateString())).size;
  if (consistencyQuest && consistencyQuest.current !== Math.min(actualDays, questDefs.find(q => q.type === "consistency")?.target ?? 99)) {
    const questState = evaluateQuestProgress(questDefs, weekSessions, history, window.start);
    saveWeeklyQuestState(questState);
    return { questDefs, questState, window };
  }

  return { questDefs, questState: saved, window };
}

/**
 * Get season EXP, auto-rebuilding if needed.
 */
export function getOrRebuildSeasonExp(
  history: WorkoutHistory[],
  birthYear?: number,
  gender?: "male" | "female",
): SeasonExpState {
  const seasonKey = getSeasonKey();
  const saved = loadSeasonExp(seasonKey);

  // 캐시된 workout 횟수 vs 실제 히스토리 비교
  const season = getCurrentSeason();
  const seasonSessionCount = history.filter(h => {
    const d = new Date(h.date);
    return d >= new Date(season.startDate) && d <= new Date(season.endDate);
  }).length;
  const cachedWorkoutCount = saved.expLog.filter(e => e.source === "workout").length;

  if (saved.totalExp > 0 && cachedWorkoutCount === seasonSessionCount) {
    // 캐시가 history와 정확히 일치하면 캐시 신뢰
    return saved;
  }

  // 캐시와 history가 불일치하면 리빌드 (추가됐거나 삭제됐거나 중복 적립됐거나)
  const rebuilt = rebuildFromHistory(history, birthYear, gender);
  saveSeasonExp(rebuilt);
  return rebuilt;
}

/**
 * Process a newly completed workout: update quest progress + EXP.
 * Returns the EXP entries gained from this session (for RpgResultCard).
 */
export function processWorkoutCompletion(
  newSession: WorkoutHistory,
  allHistory: WorkoutHistory[],
  birthYear?: number,
  gender?: "male" | "female",
): ExpLogEntry[] {
  // 회의 18: allHistory 기준으로 현재 윈도우 결정 (Case 1/2 분기 포함)
  const window = getCurrentWeekQuestWindow(allHistory);
  const questDefs = generateWeeklyQuests(birthYear, gender, window.days);

  // History without the new session = "before" state
  // NOTE: historyBefore 기준으로도 윈도우 재계산해야 Case 1→2 전환 케이스 방지
  // (예: 첫 세션으로 인해 Case 2→1 전환되어 target이 달라질 수 있음)
  const historyBefore = allHistory.filter(h => h.id !== newSession.id);
  const windowBefore = getCurrentWeekQuestWindow(historyBefore);
  const questDefsBefore = generateWeeklyQuests(birthYear, gender, windowBefore.days);
  const weekSessionsBefore = getWeekSessions(historyBefore, windowBefore.start, windowBefore.end);
  const questsBefore = evaluateQuestProgress(questDefsBefore, weekSessionsBefore, historyBefore, windowBefore.start);

  // History with the new session = "after" state
  const weekSessionsAfter = getWeekSessions(allHistory, window.start, window.end);
  const questsAfter = evaluateQuestProgress(questDefs, weekSessionsAfter, allHistory, window.start);

  // Calculate EXP delta
  const entries = calculateSessionExp(questsBefore, questsAfter, questDefs);

  // Persist
  saveWeeklyQuestState(questsAfter);

  const seasonKey = getSeasonKey();
  const seasonExp = loadSeasonExp(seasonKey);
  seasonExp.expLog.push(...entries);
  seasonExp.totalExp += sumExp(entries);
  saveSeasonExp(seasonExp);

  return entries;
}
