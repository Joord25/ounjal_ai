/**
 * 회의 64-ζ-γ (2026-04-21): 장기 프로그램 세션 완료 판정을 workout_history 기준 렌더 타임 매칭으로 이전.
 *
 * 배경 (대표 분석):
 * - 다이어트 플랜 = "연결 안 됨": markSessionCompleted가 불려도 syncSavedPlansFromServer가 서버 null로
 *   로컬 completedAt을 덮어씀 → 체크마크 사라짐
 * - 러닝 10K S16 = "순서 오류": 4/19 당시 markSessionCompleted 없었고, 4/20 backfill v1이 sessionNumber
 *   정렬 없이 Firestore 문서 순서대로 매칭 → S1과 S16(둘 다 tt_2k)이 동일 exerciseSet이라 S16에 잘못 저장
 *
 * 해결: saved_plans.completedAt 필드 의존을 버리고 workout_history를 source-of-truth로 사용.
 * 각 프로그램 내에서 sessionNumber ASC 순서로 matching key(exerciseNameSet) 비교, 1:1 소비.
 *
 * 알고리즘 = backfill v2 와 동일하되 렌더 타임에서 돌림:
 * 1) sessions: programId 기준 그룹화, sessionNumber ASC 정렬
 * 2) workoutHistory: date ASC 정렬, 각 엔트리 1회만 소비
 * 3) exerciseKey(session) == exerciseKey(history) 인 첫 미매칭 세션에 history 매칭
 * 4) 매칭된 세션 id → history.date 의 Map 반환
 */
import type { SavedPlan } from "./savedPlans";
import type { WorkoutHistory, ExerciseStep } from "@/constants/workout";

/**
 * 매칭 키 = 운동 이름 정렬 후 pipe 연결.
 * warmup/mobility 등 type 무관하게 전체 포함 (backfill v2 와 동일 기준).
 */
function exerciseKey(exercises: ExerciseStep[] | undefined): string {
  if (!exercises || exercises.length === 0) return "";
  return exercises
    .map(e => (e.name ?? "").trim())
    .filter(n => n.length > 0)
    .sort()
    .join("|");
}

function historyDateMs(h: WorkoutHistory): number {
  const t = new Date(h.date).getTime();
  return Number.isFinite(t) ? t : 0;
}

export interface CompletionEntry {
  /** 매칭된 workout_history 의 timestamp (ms) */
  completedAtMs: number;
  /** 매칭된 history id (디버그·네비게이션용) */
  historyId: string;
  /** 회의 64-M3: 해당 history 가 중도 종료 기록이면 true. MyPlans 에서 아이콘 분기용. */
  abandoned?: boolean;
}

/**
 * 특정 프로그램(같은 programId) 세션들에 대해 workout_history 를 매칭해 완료 map 반환.
 *
 * @param sessions 해당 programId 의 모든 SavedPlan (순서 무관, 내부에서 sessionNumber ASC 정렬)
 * @param history 전체 workout_history (내부에서 date ASC 정렬)
 * @returns planId → { completedAtMs, historyId }
 */
export function deriveProgramCompletions(
  sessions: SavedPlan[],
  history: WorkoutHistory[],
): Map<string, CompletionEntry> {
  const result = new Map<string, CompletionEntry>();
  if (sessions.length === 0) return result;

  // 세션을 exerciseKey별 큐(ASC)로 재구성
  const queues = new Map<string, SavedPlan[]>();
  const sortedSessions = [...sessions].sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
  for (const s of sortedSessions) {
    const key = exerciseKey(s.sessionData?.exercises);
    if (!key) continue;
    const arr = queues.get(key) ?? [];
    arr.push(s);
    queues.set(key, arr);
  }

  // 프로그램 생성 시점(가장 이른 createdAt) — 그보다 이전 history는 이 프로그램 기록이 아님
  const minCreatedAt = Math.min(...sortedSessions.map(s => s.createdAt ?? 0).filter(n => n > 0));

  // 히스토리 ASC 정렬 후 순차 매칭
  const sortedHistory = [...history]
    .filter(h => {
      const ms = historyDateMs(h);
      return ms >= minCreatedAt;
    })
    .sort((a, b) => historyDateMs(a) - historyDateMs(b));

  for (const h of sortedHistory) {
    const key = exerciseKey(h.sessionData?.exercises);
    if (!key) continue;
    const queue = queues.get(key);
    if (!queue || queue.length === 0) continue;
    const nextSession = queue.shift()!; // 가장 이른 미매칭 세션 소비
    result.set(nextSession.id, {
      completedAtMs: historyDateMs(h),
      historyId: h.id,
      abandoned: h.abandoned === true,
    });
  }

  return result;
}

/**
 * 프로그램 진행률 — workout_history 매칭 기준.
 */
export function getProgramProgressFromHistory(
  sessions: SavedPlan[],
  history: WorkoutHistory[],
): { completed: number; total: number; completionMap: Map<string, CompletionEntry> } {
  const completionMap = deriveProgramCompletions(sessions, history);
  return {
    completed: completionMap.size,
    total: sessions.length,
    completionMap,
  };
}

/**
 * 다음 미완료 세션 — sessionNumber ASC 순서로 첫 번째 미매칭.
 */
export function getNextProgramSessionFromHistory(
  sessions: SavedPlan[],
  history: WorkoutHistory[],
): SavedPlan | null {
  const { completionMap } = getProgramProgressFromHistory(sessions, history);
  const sorted = [...sessions].sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
  return sorted.find(s => !completionMap.has(s.id)) ?? null;
}
