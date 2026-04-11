/**
 * 신규 데이터 스키마 (회의 52, 트랙 C).
 *
 * 기존 `src/constants/workout.ts`의 `WorkoutHistory`를 대체하는 구조.
 * Strangler Fig 패턴으로 기존 타입과 병행 존재하며, 트랙 C Phase 완료 후 병합 예정.
 *
 * 엔티티 분리:
 * - WorkoutSessionV2: 세션 자체 + 세션별 리포트 스냅샷 (today/next/goal)
 * - DailySnapshotV2: 하루 단위 유저 상태 (fitness/nutrition)
 *
 * 이화식 전문가 설계 원칙:
 * 1. 기존 필드 절대 삭제/이름 변경 금지
 * 2. 4개 엔티티 분리 (세션 / 수행 / 유저 상태 / 집계)
 * 3. logs: Record<number> → executions: Array (명시적 FK)
 * 4. 문자열/숫자 혼재 해결 (weight, weightUsed)
 * 5. dataQuality 필드로 오염 데이터 식별
 */

import type {
  WorkoutGoal,
  RunningStats,
  ExercisePhase,
  ExerciseType,
} from "./workout";

// ============================================================================
// Data Quality
// ============================================================================

export type DataQualityReason =
  | "duration_too_short"    // 총 운동 시간이 세트 × 5초 미만 (물리적 불가능)
  | "missing_duration"      // reps는 있는데 duration이 없음
  | "missing_timings"       // exerciseTimings 자체가 없음
  | "zero_reps_zero_sets";  // reps, sets 둘 다 0 (실제 운동 안 함)

export interface DataQuality {
  isValid: boolean;
  reasons?: DataQualityReason[];
}

// ============================================================================
// Session Entity — sessions/{sessionId}
// ============================================================================

/**
 * 운동 세션 — 기존 workout_history의 대체 엔티티.
 *
 * Firestore 위치: `users/{uid}/sessions/{sessionId}`
 * Doc ID는 기존 `workout_history.id` 그대로 재사용 (1:1 매핑 보장).
 */
export interface WorkoutSessionV2 {
  id: string;
  createdAt: number;     // ms epoch
  date: string;          // ISO 8601, 로컬 타임존 자정 기준

  meta: {
    title: string;
    description: string;
    intendedIntensity?: "high" | "moderate" | "low";
    goal?: WorkoutGoal | string;
    durationSec: number; // stats.totalDurationSec 미러
  };

  exercises: ExerciseSnapshotV2[];
  executions: ExecutionLogV2[];

  stats: {
    totalVolume: number;
    totalSets: number;
    totalReps: number;
    totalDurationSec: number;
    bestE1RM?: number;
    bwRatio?: number;
    successRate?: number;
    loadScore?: number;
  };

  runningStats?: RunningStats;
  coachMessages?: string[];

  /** 세션별 리포트 스냅샷 — 과거 세션 열람 시 "그 당시의 추천/오늘 요약" 복원용 */
  reportSnapshot?: {
    today?: {
      volumeChangePercent: number | null;
      caloriesBurned: number;
      foodAnalogy: string;
      recoveryHours: string;
      stimulusMessage: string;
    };
    next?: {
      message: string;
      recommendedPart: string;
      recommendedIntensity: string;
      weightGoal?: { exerciseName: string; targetWeight: number };
      questProgress?: {
        high: { done: number; target: number };
        moderate: { done: number; target: number };
        low: { done: number; target: number };
        total: { done: number; target: number };
      };
      weekSessions?: { dayLabel: string; desc: string }[];
    };
    goal?: string;
  };

  dataQuality: DataQuality;
}

/**
 * 운동 스냅샷 — 세션 시작 시점 sessionData.exercises[i]의 정규화 버전.
 * 배열의 order와 필드 `order`가 항상 일치 (명시적 FK 키).
 */
export interface ExerciseSnapshotV2 {
  order: number;              // 0-indexed
  name: string;
  phase: ExercisePhase;
  type: ExerciseType;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;      // 파싱 가능한 숫자 (예: "10" → 10)
  targetWeightLabel?: string; // 가이드 문자열 (예: "10회가 힘든 무게")
  tempoGuide?: string;
  durationSec: number;        // exerciseTimings에서 흡수 (없으면 0)
}

/**
 * 세트 수행 기록 — 기존 `logs: Record<number, ExerciseLog[]>`의 평면 배열 버전.
 * exerciseOrder로 ExerciseSnapshotV2와 조인.
 */
export interface ExecutionLogV2 {
  exerciseOrder: number;      // FK to ExerciseSnapshotV2.order
  setNumber: number;
  repsCompleted: number;
  weightUsed?: number;        // 숫자로 정규화
  weightUsedLabel?: string;   // 가이드 문자열
  feedback: "fail" | "target" | "easy" | "too_easy";
  completedAt?: number;       // ms epoch
}

// ============================================================================
// Daily Snapshot — daily_snapshots/{yyyy-mm-dd}
// ============================================================================

/**
 * 하루 단위 유저 상태 스냅샷 — fitness/nutrition은 세션마다 같으므로 분리.
 *
 * Firestore 위치: `users/{uid}/daily_snapshots/{yyyy-mm-dd}`
 * Doc ID는 로컬 타임존 자정 기준 날짜 (예: "2026-04-07").
 * 같은 날 여러 세션이 있어도 문서는 1개 (마지막 세션의 snapshot이 덮어씀).
 */
export interface DailySnapshotV2 {
  date: string;       // "yyyy-mm-dd"
  updatedAt: number;  // ms epoch

  fitness: {
    percentiles: { category: string; rank: number; percentile: number; hasData: boolean }[];
    overallRank: number;
    fitnessAge: number;
    ageGroupLabel: string;
    genderLabel: string;
  } | null;

  nutrition: {
    dailyCalorie: number;
    goalBasis: string;
    macros: { protein: number; carb: number; fat: number };
    meals: { time: string; menu: string }[];
    keyTip: string;
    chatHistory?: { role: "user" | "assistant"; content: string }[];
  } | null;
}

// ============================================================================
// Transform Result
// ============================================================================

/**
 * `transformToNewSchema()`의 반환 타입.
 * 하나의 기존 WorkoutHistory → 신규 스키마 2개 문서로 분리된 결과.
 */
export interface TransformResult {
  session: WorkoutSessionV2;
  dailySnapshot: DailySnapshotV2;
}
