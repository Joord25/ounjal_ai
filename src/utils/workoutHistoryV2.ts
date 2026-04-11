/**
 * 기존 WorkoutHistory → 신규 스키마 (WorkoutSessionV2 + DailySnapshotV2) 변환 (회의 52, 트랙 C Step 3).
 *
 * **순수 함수 모듈** — 외부 I/O 없음, 같은 입력에 항상 같은 출력.
 * 아직 어느 곳에서도 호출되지 않음 (앱 동작 0 영향).
 * 트랙 C Phase 1 (dual write)에서 처음으로 호출 시작 예정.
 *
 * 처리 규칙:
 * 1. id, date, coachMessages, runningStats → 그대로 이월
 * 2. stats → 그대로 이월 (단, totalDurationSec는 number로 강제 (undefined → 0))
 * 3. sessionData.exercises[] + exerciseTimings[] → ExerciseSnapshotV2[] (durationSec 합체)
 * 4. logs: Record<number, ExerciseLog[]> → executions: ExecutionLogV2[] (평면 배열)
 * 5. weight 문자열 → number (파싱 가능 시) + label (가이드 텍스트)
 * 6. reportTabs.status + reportTabs.nutrition → dailySnapshot
 * 7. reportTabs.today + reportTabs.next + reportTabs.goal → session.reportSnapshot
 * 8. dataQuality 계산 (79초/303회 같은 조작/오류 데이터 식별)
 *
 * 이화식 전문가 권고 적용:
 * - 기존 필드 절대 삭제 없음 (모두 이월)
 * - logs 맵 → 평면 배열 (exerciseOrder FK 명시)
 * - weight 타입 혼재 해결
 * - 로컬 타임존 기준 yyyy-mm-dd (기존 workout_history.date 규칙 승계)
 *
 * 황보현우 전문가 권고 적용:
 * - dataQuality 필드로 오염 데이터 통계 집계 가능
 */

import type {
  WorkoutHistory,
  ExerciseLog,
  ExerciseTiming,
} from "@/constants/workout";
import type {
  WorkoutSessionV2,
  ExerciseSnapshotV2,
  ExecutionLogV2,
  DailySnapshotV2,
  DataQuality,
  DataQualityReason,
  TransformResult,
} from "@/constants/workoutV2";
import { FIXTURE_HISTORY_01 } from "./workoutHistoryV2.fixture";

// ============================================================================
// Pure helpers (no side effects)
// ============================================================================

/**
 * weight 문자열을 숫자로 파싱.
 * "10" → 10
 * "12.5" → 12.5
 * "10회가 힘든 무게" → undefined (숫자 아님)
 * "가볍게 반복 가능한 무게" → undefined
 * 빈 문자열 → undefined
 */
function parseWeightNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // 엄격한 숫자 패턴만 허용 (한글/영어 섞인 문자열은 제외)
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * 숫자로 파싱되지 않는 weight 가이드 문자열을 label로 보존.
 * "10" → undefined (숫자는 label 아님)
 * "10회가 힘든 무게" → "10회가 힘든 무게"
 * "가볍게 반복 가능한 무게" → "가볍게 반복 가능한 무게"
 * 빈 문자열 → undefined
 */
function extractWeightLabel(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // 숫자 형태면 label이 아님
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * 데이터 품질 검증 — 물리적으로 불가능/의심스러운 조합 감지.
 *
 * Rule 1 (duration_too_short): 총 운동 시간 < 총 세트 × 5초
 *   → 세트당 최소 5초는 필요 (0.5초 수행 자체가 불가능)
 *   → 예: 36세트 × 5초 = 180초 필요, 79초는 플래그
 *
 * Rule 2 (missing_duration): reps 있는데 duration 0 or undefined
 *   → 운동 기록 파이프라인 버그 의심
 *
 * Rule 3 (missing_timings): exerciseTimings 배열 자체 없음
 *   → 구버전 앱 or 기록 실패
 *
 * Rule 4 (zero_reps_zero_sets): reps와 sets 모두 0
 *   → 실제 운동 안 한 문서 (저장만 됨)
 */
function validateDataQuality(h: WorkoutHistory): DataQuality {
  const reasons: DataQualityReason[] = [];
  const stats = h.stats;

  // Rule 1
  if (
    typeof stats.totalDurationSec === "number" &&
    stats.totalDurationSec > 0 &&
    stats.totalSets > 0 &&
    stats.totalDurationSec < stats.totalSets * 5
  ) {
    reasons.push("duration_too_short");
  }

  // Rule 2
  if (
    stats.totalReps > 0 &&
    (stats.totalDurationSec === undefined || stats.totalDurationSec === 0)
  ) {
    reasons.push("missing_duration");
  }

  // Rule 3
  if (!h.exerciseTimings || h.exerciseTimings.length === 0) {
    reasons.push("missing_timings");
  }

  // Rule 4
  if (stats.totalReps === 0 && stats.totalSets === 0) {
    reasons.push("zero_reps_zero_sets");
  }

  return {
    isValid: reasons.length === 0,
    reasons: reasons.length > 0 ? reasons : undefined,
  };
}

/**
 * ISO 날짜 문자열을 로컬 타임존 기준 yyyy-mm-dd로 변환.
 *
 * 기존 workout_history.date는 이미 로컬 타임존 자정 기준 ISO로 저장됨
 * ([page.tsx] `new Date(Date.now() - tz offset).toISOString()` 패턴).
 * 따라서 단순히 앞 10자리만 잘라도 로컬 날짜가 맞음.
 */
function toLocalDateKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

// ============================================================================
// Main transform
// ============================================================================

/**
 * 기존 WorkoutHistory 문서 하나를 신규 스키마 2개 문서로 변환.
 *
 * @param h 기존 workout_history 문서
 * @returns { session: WorkoutSessionV2, dailySnapshot: DailySnapshotV2 }
 */
export function transformToNewSchema(h: WorkoutHistory): TransformResult {
  const createdAtMs = new Date(h.date).getTime();
  const dateKey = toLocalDateKey(h.date);

  // 1. exerciseTimings를 index별 맵으로 변환 (효율적 조회)
  const timingByIndex = new Map<number, ExerciseTiming>();
  (h.exerciseTimings ?? []).forEach((t) => timingByIndex.set(t.exerciseIndex, t));

  // 2. exercises → ExerciseSnapshotV2[] (timings 합체 + weight 정규화)
  const exercises: ExerciseSnapshotV2[] = h.sessionData.exercises.map((ex, idx) => {
    const timing = timingByIndex.get(idx);
    return {
      order: idx,
      name: ex.name,
      phase: ex.phase ?? "main",
      type: ex.type,
      targetSets: ex.sets,
      targetReps: ex.reps,
      targetWeight: parseWeightNumber(ex.weight),
      targetWeightLabel: extractWeightLabel(ex.weight),
      tempoGuide: ex.tempoGuide,
      durationSec: timing?.durationSec ?? 0,
    };
  });

  // 3. logs → ExecutionLogV2[] (평면 배열 + 정렬)
  const executions: ExecutionLogV2[] = [];
  for (const [indexStr, logs] of Object.entries(h.logs)) {
    const exerciseOrder = parseInt(indexStr, 10);
    if (!Number.isFinite(exerciseOrder)) continue;
    logs.forEach((log: ExerciseLog) => {
      executions.push({
        exerciseOrder,
        setNumber: log.setNumber,
        repsCompleted: log.repsCompleted,
        weightUsed: parseWeightNumber(log.weightUsed),
        weightUsedLabel: extractWeightLabel(log.weightUsed),
        feedback: log.feedback,
        completedAt: log.timestamp,
      });
    });
  }
  // exerciseOrder 오름차순 → setNumber 오름차순으로 정렬 (일관된 조회 순서)
  executions.sort((a, b) => {
    if (a.exerciseOrder !== b.exerciseOrder) return a.exerciseOrder - b.exerciseOrder;
    return a.setNumber - b.setNumber;
  });

  // 4. reportSnapshot 추출 (today + next + goal)
  const reportSnapshot: WorkoutSessionV2["reportSnapshot"] | undefined = h.reportTabs
    ? {
        today: h.reportTabs.today
          ? {
              volumeChangePercent: h.reportTabs.today.volumeChangePercent,
              caloriesBurned: h.reportTabs.today.caloriesBurned,
              foodAnalogy: h.reportTabs.today.foodAnalogy,
              recoveryHours: h.reportTabs.today.recoveryHours,
              stimulusMessage: h.reportTabs.today.stimulusMessage,
            }
          : undefined,
        next: h.reportTabs.next
          ? {
              message: h.reportTabs.next.message,
              recommendedPart: h.reportTabs.next.recommendedPart,
              recommendedIntensity: h.reportTabs.next.recommendedIntensity,
              weightGoal: h.reportTabs.next.weightGoal,
              questProgress: h.reportTabs.next.questProgress,
              weekSessions: h.reportTabs.next.weekSessions,
            }
          : undefined,
        goal: h.reportTabs.goal,
      }
    : undefined;

  // 5. 데이터 품질 검증
  const dataQuality = validateDataQuality(h);

  // 6. WorkoutSessionV2 조립
  const session: WorkoutSessionV2 = {
    id: h.id,
    createdAt: createdAtMs,
    date: h.date,
    meta: {
      title: h.sessionData.title,
      description: h.sessionData.description,
      intendedIntensity: h.sessionData.intendedIntensity,
      goal: h.reportTabs?.goal,
      durationSec: h.stats.totalDurationSec ?? 0,
    },
    exercises,
    executions,
    stats: {
      totalVolume: h.stats.totalVolume,
      totalSets: h.stats.totalSets,
      totalReps: h.stats.totalReps,
      totalDurationSec: h.stats.totalDurationSec ?? 0,
      bestE1RM: h.stats.bestE1RM,
      bwRatio: h.stats.bwRatio,
      successRate: h.stats.successRate,
      loadScore: h.stats.loadScore,
    },
    runningStats: h.runningStats,
    coachMessages: h.coachMessages,
    reportSnapshot,
    dataQuality,
  };

  // 7. DailySnapshotV2 추출 (status + nutrition)
  const dailySnapshot: DailySnapshotV2 = {
    date: dateKey,
    updatedAt: createdAtMs,
    fitness: h.reportTabs?.status
      ? {
          percentiles: h.reportTabs.status.percentiles ?? [],
          overallRank: h.reportTabs.status.overallRank ?? 0,
          fitnessAge: h.reportTabs.status.fitnessAge ?? 0,
          ageGroupLabel: h.reportTabs.status.ageGroupLabel ?? "",
          genderLabel: h.reportTabs.status.genderLabel ?? "",
        }
      : null,
    nutrition: h.reportTabs?.nutrition
      ? {
          dailyCalorie: h.reportTabs.nutrition.dailyCalorie,
          goalBasis: h.reportTabs.nutrition.goalBasis,
          macros: h.reportTabs.nutrition.macros,
          meals: h.reportTabs.nutrition.meals,
          keyTip: h.reportTabs.nutrition.keyTip,
          chatHistory: h.reportTabs.nutrition.chatHistory,
        }
      : null,
  };

  return { session, dailySnapshot };
}

// ============================================================================
// Verification (Step 3: 육안 검증용)
// ============================================================================

export interface VerificationCheck {
  name: string;
  pass: boolean;
  actual: unknown;
  expected: unknown;
}

export interface VerificationReport {
  passCount: number;
  failCount: number;
  checks: VerificationCheck[];
  result: TransformResult;
}

/**
 * 픽스처로 transformToNewSchema를 실행하고 10가지 체크를 수행.
 *
 * 호출 방법 (대표님 Chrome DevTools 콘솔):
 * ```
 * import("@/utils/workoutHistoryV2").then(m => {
 *   const r = m.runTransformVerification();
 *   console.log(`PASS: ${r.passCount}/${r.passCount + r.failCount}`);
 *   console.table(r.checks);
 *   console.log("FULL RESULT:", r.result);
 * });
 * ```
 */
export function runTransformVerification(): VerificationReport {
  const result = transformToNewSchema(FIXTURE_HISTORY_01);
  const { session, dailySnapshot } = result;

  const checks: VerificationCheck[] = [
    {
      name: "session.id === fixture.id (1:1 매핑)",
      pass: session.id === FIXTURE_HISTORY_01.id,
      actual: session.id,
      expected: FIXTURE_HISTORY_01.id,
    },
    {
      name: "session.exercises.length === 12",
      pass: session.exercises.length === 12,
      actual: session.exercises.length,
      expected: 12,
    },
    {
      name: "session.executions.length === 36 (총 세트)",
      pass: session.executions.length === 36,
      actual: session.executions.length,
      expected: 36,
    },
    {
      name: "dataQuality.isValid === false (79초 세션은 오염)",
      pass: session.dataQuality.isValid === false,
      actual: session.dataQuality.isValid,
      expected: false,
    },
    {
      name: "dataQuality.reasons includes duration_too_short",
      pass: session.dataQuality.reasons?.includes("duration_too_short") === true,
      actual: session.dataQuality.reasons,
      expected: "[duration_too_short, ...]",
    },
    {
      name: "exercises[4].targetWeight === undefined + label === '10회가 힘든 무게' (가이드 문자열 보존)",
      pass:
        session.exercises[4].targetWeight === undefined &&
        session.exercises[4].targetWeightLabel === "10회가 힘든 무게",
      actual: {
        weight: session.exercises[4].targetWeight,
        label: session.exercises[4].targetWeightLabel,
      },
      expected: { weight: undefined, label: "10회가 힘든 무게" },
    },
    {
      name: "executions[exerciseOrder=4, set=1].weightUsed === 10 (숫자 파싱)",
      pass:
        session.executions.find((e) => e.exerciseOrder === 4 && e.setNumber === 1)
          ?.weightUsed === 10,
      actual: session.executions.find(
        (e) => e.exerciseOrder === 4 && e.setNumber === 1
      ),
      expected: { weightUsed: 10, weightUsedLabel: undefined },
    },
    {
      name: "executions[exerciseOrder=8, set=1].weightUsedLabel === '가볍게 반복 가능한 무게' (label 보존)",
      pass:
        session.executions.find((e) => e.exerciseOrder === 8 && e.setNumber === 1)
          ?.weightUsedLabel === "가볍게 반복 가능한 무게",
      actual: session.executions.find(
        (e) => e.exerciseOrder === 8 && e.setNumber === 1
      ),
      expected: { weightUsed: undefined, weightUsedLabel: "가볍게 반복 가능한 무게" },
    },
    {
      name: "exercises[4].durationSec === 19 (exerciseTimings 흡수)",
      pass: session.exercises[4].durationSec === 19,
      actual: session.exercises[4].durationSec,
      expected: 19,
    },
    {
      name: "dailySnapshot.date === '2026-04-07' (로컬 타임존 date key)",
      pass: dailySnapshot.date === "2026-04-07",
      actual: dailySnapshot.date,
      expected: "2026-04-07",
    },
    {
      name: "dailySnapshot.nutrition.dailyCalorie === 2258",
      pass: dailySnapshot.nutrition?.dailyCalorie === 2258,
      actual: dailySnapshot.nutrition?.dailyCalorie,
      expected: 2258,
    },
    {
      name: "session.reportSnapshot.today.caloriesBurned === 7",
      pass: session.reportSnapshot?.today?.caloriesBurned === 7,
      actual: session.reportSnapshot?.today?.caloriesBurned,
      expected: 7,
    },
    {
      name: "session.reportSnapshot.next.questProgress.moderate.done === 2",
      pass: session.reportSnapshot?.next?.questProgress?.moderate?.done === 2,
      actual: session.reportSnapshot?.next?.questProgress?.moderate?.done,
      expected: 2,
    },
    {
      name: "dailySnapshot에는 nutrition만, session에는 없음 (중복 제거 확인)",
      pass:
        dailySnapshot.nutrition !== null &&
        // @ts-expect-error — session에는 nutrition 필드 자체가 없어야 함 (타입상 확인)
        session.nutrition === undefined,
      actual: "session has no 'nutrition' field at top level",
      expected: "dailySnapshot.nutrition !== null AND session has no nutrition field",
    },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.length - passCount;

  return { passCount, failCount, checks, result };
}
