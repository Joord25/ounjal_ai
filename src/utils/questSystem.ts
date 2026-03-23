/**
 * Quest-based Season Tier System
 * ACSM 2025 weekly intensity distribution → gamified quests → EXP → tier progression
 */

import { WorkoutHistory } from "@/constants/workout";
import { classifySessionIntensity, getWeeklyIntensityTarget, type IntensityLevel, type WeeklyIntensityTarget } from "@/utils/workoutMetrics";

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
  { name: "Emerald",    minExp: 140, color: "#34d399" },
  { name: "Diamond",    minExp: 220, color: "#60a5fa" },
  { name: "Master",     minExp: 320, color: "#a78bfa" },
  { name: "Challenger", minExp: 450, color: "#f87171" },
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

export function generateWeeklyQuests(birthYear?: number, gender?: "male" | "female"): QuestDefinition[] {
  const target: WeeklyIntensityTarget = getWeeklyIntensityTarget(birthYear, gender);

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
  quests.push({
    id: "bonus_streak_5",
    type: "bonus_streak",
    label: "5일 연속 운동",
    description: "연속 기록 도전!",
    target: 5,
    exp: QUEST_EXP.bonus_streak,
    isBonus: true,
  });

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

// ─── Quest Progress Evaluation ───────────────────────────────────

function getWeekSessions(history: WorkoutHistory[], weekStart: Date): WorkoutHistory[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return history.filter(h => {
    const d = new Date(h.date);
    return d >= weekStart && d < weekEnd;
  });
}

function classifySession(h: WorkoutHistory): IntensityLevel {
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
): ExpLogEntry[] {
  const entries: ExpLogEntry[] = [];
  const now = new Date().toISOString();

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

const STORAGE_KEY_QUEST = "alpha_quest_progress";
const STORAGE_KEY_EXP = "alpha_season_exp";

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

  // Find all unique weeks in the season
  const weeks = new Map<string, Date>(); // weekStartStr → weekStart
  seasonHistory.forEach(h => {
    const ws = getWeekStartMonday(new Date(h.date));
    const wsStr = toDateStr(ws);
    if (!weeks.has(wsStr)) weeks.set(wsStr, ws);
  });

  // Sort weeks chronologically
  const sortedWeeks = Array.from(weeks.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const allExpLog: ExpLogEntry[] = [];
  const questDefs = generateWeeklyQuests(birthYear, gender);

  for (const [, weekStart] of sortedWeeks) {
    const weekSessions = getWeekSessions(seasonHistory, weekStart);

    // Process sessions one by one to detect quest completions
    let prevState: WeeklyQuestState = {
      weekStart: toDateStr(weekStart),
      quests: questDefs.map(q => ({ questId: q.id, current: 0, completed: false })),
      allCoreCompleted: false,
      weeklyBonusClaimed: false,
    };

    // Sort sessions by date within the week
    const sorted = [...weekSessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sorted.length; i++) {
      const sessionsUpToNow = sorted.slice(0, i + 1);
      const afterState = evaluateQuestProgress(questDefs, sessionsUpToNow, history, weekStart);
      const entries = calculateSessionExp(prevState, afterState, questDefs);
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
): { questDefs: QuestDefinition[]; questState: WeeklyQuestState } {
  const currentMonday = getWeekStartMonday();
  const currentMondayStr = toDateStr(currentMonday);
  const saved = loadWeeklyQuestState();

  const questDefs = generateWeeklyQuests(birthYear, gender);

  // If saved state is from a different week, create fresh
  if (!saved || saved.weekStart !== currentMondayStr) {
    const weekSessions = getWeekSessions(history, currentMonday);
    const questState = evaluateQuestProgress(questDefs, weekSessions, history, currentMonday);
    saveWeeklyQuestState(questState);
    return { questDefs, questState };
  }

  return { questDefs, questState: saved };
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

  // If we have saved data for this season, use it
  if (saved.totalExp > 0 || saved.expLog.length > 0) {
    return saved;
  }

  // Rebuild from history
  const rebuilt = rebuildFromHistory(history, birthYear, gender);
  if (rebuilt.totalExp > 0) {
    saveSeasonExp(rebuilt);
  }
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
  const currentMonday = getWeekStartMonday();
  const questDefs = generateWeeklyQuests(birthYear, gender);

  // History without the new session = "before" state
  const historyBefore = allHistory.filter(h => h.id !== newSession.id);
  const weekSessionsBefore = getWeekSessions(historyBefore, currentMonday);
  const questsBefore = evaluateQuestProgress(questDefs, weekSessionsBefore, historyBefore, currentMonday);

  // History with the new session = "after" state
  const weekSessionsAfter = getWeekSessions(allHistory, currentMonday);
  const questsAfter = evaluateQuestProgress(questDefs, weekSessionsAfter, allHistory, currentMonday);

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
