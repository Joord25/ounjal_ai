/**
 * predictionUtils.ts
 * Phase 1/2/3 예측 모델에 필요한 유틸리티 함수
 * - 선형 회귀, 일관성 점수, 볼륨 성장률, 칼로리 추정 등
 */

import { WorkoutHistory } from "@/constants/workout";
import { estimate1RM } from "./workoutMetrics";

/* ─── 선형 회귀 (Phase 2/3 공통) ─── */

export interface RegressionResult {
  slope: number;       // 기울기 (단위/일)
  intercept: number;
  r2: number;          // 결정계수 (0~1)
  predict: (x: number) => number;
}

/**
 * 단순 선형 회귀
 * points: [{ x, y }] — x는 보통 날짜(dayIndex), y는 값
 */
export function linearRegression(points: { x: number; y: number }[]): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = points.reduce((s, p) => s + p.y * p.y, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² 계산
  const meanY = sumY / n;
  const ssTot = sumY2 - n * meanY * meanY;
  const ssRes = points.reduce((s, p) => {
    const pred = slope * p.x + intercept;
    return s + (p.y - pred) ** 2;
  }, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2, predict: (x: number) => slope * x + intercept };
}

/* ─── 날짜 유틸 ─── */

/** 날짜 문자열을 dayIndex로 변환 (기준점 대비 일수) */
export function dateToDayIndex(dateStr: string, baseDate: string): number {
  const d = new Date(dateStr).getTime();
  const b = new Date(baseDate).getTime();
  return Math.round((d - b) / (1000 * 60 * 60 * 24));
}

/* ─── Phase 1: 일관성 점수 ─── */

/**
 * 운동 일관성 점수 (0~100)
 * 목표 주간 빈도 대비 실제 운동 빈도를 주차별로 비교
 */
export function calcConsistencyScore(
  sessions: WorkoutHistory[],
  expectedWeeklyFreq: number
): { score: number; avgWeeklyFreq: number; weeks: number } {
  if (sessions.length === 0 || expectedWeeklyFreq <= 0) {
    return { score: 0, avgWeeklyFreq: 0, weeks: 0 };
  }

  const dates = sessions.map(s => new Date(s.date).getTime()).sort((a, b) => a - b);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const totalDays = Math.max(7, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
  const weeks = Math.max(1, Math.ceil(totalDays / 7));

  // 주차별 운동 횟수
  const weekCounts: number[] = Array(weeks).fill(0);
  for (const d of dates) {
    const weekIdx = Math.min(weeks - 1, Math.floor((d - firstDate) / (7 * 24 * 60 * 60 * 1000)));
    weekCounts[weekIdx]++;
  }

  // 각 주차 달성률 평균 (100% 초과 cap)
  const weekScores = weekCounts.map(count => Math.min(1, count / expectedWeeklyFreq));
  const avgScore = weekScores.reduce((s, v) => s + v, 0) / weekScores.length;
  const avgWeeklyFreq = Math.round((sessions.length / weeks) * 10) / 10;

  return {
    score: Math.round(avgScore * 100),
    avgWeeklyFreq,
    weeks,
  };
}

/* ─── Phase 1: 볼륨 성장률 ─── */

/**
 * 세션 간 총 볼륨 변화율 (%)
 * 최초 세션 대비 최근 세션 볼륨 비교
 */
export function calcVolumeGrowthRate(sessions: WorkoutHistory[]): {
  growthPct: number;
  firstVolume: number;
  lastVolume: number;
  trend: "up" | "down" | "flat";
} | null {
  const withVolume = sessions
    .filter(s => s.stats.totalVolume > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (withVolume.length < 2) return null;

  const firstVolume = withVolume[0].stats.totalVolume;
  const lastVolume = withVolume[withVolume.length - 1].stats.totalVolume;
  const growthPct = Math.round(((lastVolume - firstVolume) / firstVolume) * 100);

  return {
    growthPct,
    firstVolume,
    lastVolume,
    trend: growthPct > 5 ? "up" : growthPct < -5 ? "down" : "flat",
  };
}

/* ─── Mifflin-St Jeor 기초대사량 (BMR) — ACSM/ISSN 권장 ─── */

export function calcBMR(gender: "male" | "female", weightKg: number, heightCm: number, age: number): number {
  if (gender === "male") {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
}

/** 다이어트 가정 섭취 칼로리 (한국영양학회 권장 - 감량분 적용) */
export function getDietIntake(gender: "male" | "female", age: number): number {
  if (gender === "male") {
    if (age < 30) return 2000;
    if (age < 50) return 1900;
    return 1800;
  }
  if (age < 30) return 1700;
  if (age < 50) return 1600;
  return 1500;
}

/** 세션별 칼로리 밸런스 계산 (섭취 - BMR - 운동소모) */
export function calcCalorieBalance(
  session: WorkoutHistory,
  gender: "male" | "female",
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const intake = getDietIntake(gender, age);
  const bmr = calcBMR(gender, weightKg, heightCm, age);
  const exerciseCal = calcSessionCalories(session, weightKg);
  return intake - bmr - exerciseCal;
}

/** 칼로리 밸런스 트렌드 (회귀분석용) */
export function calcCalorieBalanceTrend(
  sessions: WorkoutHistory[],
  gender: "male" | "female",
  weightKg: number,
  heightCm: number,
  age: number
): { points: { x: number; y: number; label: string }[]; cumulative: number } | null {
  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sorted.length < 2) return null;

  const baseDate = sorted[0].date;
  let cumulative = 0;
  const points = sorted.map(s => {
    const balance = calcCalorieBalance(s, gender, weightKg, heightCm, age);
    cumulative += balance;
    return {
      x: dateToDayIndex(s.date, baseDate),
      y: Math.round(cumulative),
      label: `${Math.round(cumulative)}kcal`,
    };
  });

  return { points, cumulative };
}

/* ─── Phase 1: 세션별 칼로리 추정 (실제 볼륨 기반) ─── */

/** 운동 타입별 기본 MET 값 (ACSM Compendium of Physical Activities) */
const EXERCISE_TYPE_MET: Record<string, number> = {
  warmup: 2.5,
  mobility: 2.5,
  core: 3.5,
  strength: 5.0,
  cardio: 6.5,
};

/**
 * 운동 이름 기반 정밀 MET 매핑 (ACSM Compendium 2024)
 * 고중량 컴파운드 5.5~6.0 / 중량 아이솔레이션 3.5~4.5 / 맨몸 3.8~4.5 / 머신 3.0~4.0
 */
function getExerciseMET(name: string, type: string): number {
  const lower = name.toLowerCase();

  // 고중량 컴파운드 (MET 5.5~6.0)
  if (/스쿼트|squat|데드리프트|deadlift|클린|clean|스내치|snatch|쓰러스터|thruster/.test(lower)) return 6.0;
  if (/벤치\s*프레스|bench\s*press|오버헤드\s*프레스|overhead\s*press|밀리터리|military|숄더\s*프레스|shoulder\s*press|아놀드|arnold|플로어\s*프레스|floor\s*press|인클라인.*프레스|incline.*press|랜드마인|landmine|바텀스업|bottoms.?up/.test(lower)) return 5.5;
  if (/로우|row|풀업|pull.?up|풀다운|pulldown|턱걸이|chin.?up|딥스|dip|랙\s*풀|rack\s*pull/.test(lower)) return 5.5;
  if (/힙\s*쓰러스트|hip\s*thrust|런지|lunge|레그\s*프레스|leg\s*press/.test(lower)) return 5.5;

  // 중량 아이솔레이션 (MET 3.5~4.5)
  if (/컬|curl|레이즈|raise|플라이|fly|익스텐션|extension|킥백|kickback|푸쉬\s*다운|pushdown|크로스오버|crossover/.test(lower)) return 4.0;
  if (/레그\s*컬|leg\s*curl|레그\s*익스텐션|leg\s*extension|카프|calf|글루트|glute|페이스\s*풀|face\s*pull/.test(lower)) return 3.8;
  if (/사이드\s*벤드|side\s*bend|슈러그|shrug|밴드\s*풀\s*어파트|band\s*pull.?apart/.test(lower)) return 3.5;

  // 맨몸 운동 (MET 3.5~5.5)
  if (/푸시업|push.?up|푸쉬업/.test(lower)) return 4.0;
  if (/니\s*푸시업|니\s*푸쉬업|knee\s*push/.test(lower)) return 3.5;
  if (/다이아몬드|diamond|아처|archer|힌두|hindu/.test(lower)) return 4.5;
  if (/웨이티드\s*푸쉬업|weighted\s*push/.test(lower)) return 5.0;
  if (/인버티드|inverted|버피|burpee/.test(lower)) return 5.0;
  if (/마운틴\s*클라이머|mountain\s*climber/.test(lower)) return 4.5;
  if (/피스톨\s*스쿼트|pistol\s*squat/.test(lower)) return 5.5;
  if (/에어\s*스쿼트|air\s*squat|스쿼트\s*점프|squat\s*jump/.test(lower)) return 5.0;
  if (/글루트\s*브릿지|glute\s*bridge/.test(lower)) return 3.5;
  if (/스텝\s*업|step.?up/.test(lower)) return 4.5;
  if (/중량\s*딥스|weighted\s*dip/.test(lower)) return 6.0;

  // 머신 운동 (MET 3.0~4.0)
  if (/머신|machine|스미스|smith|케이블|cable|펙\s*덱|pec\s*deck|체스트\s*프레스|chest\s*press/.test(lower)) return 3.5;

  // 코어 (MET 3.0~4.0)
  if (/플랭크|plank/.test(lower)) return 3.0;
  if (/크런치|crunch|시저|scissor|플러터|flutter|v.?up|브이\s*업/.test(lower)) return 3.5;
  if (/행잉|hanging|Ab\s*휠|ab\s*wheel|Ab\s*슬라이드|ab\s*slide|롤아웃|rollout|우드찹|woodchop/.test(lower)) return 4.0;
  if (/러시안\s*트위스트|russian\s*twist|버드\s*독|bird\s*dog|슈퍼맨|superman/.test(lower)) return 3.5;
  if (/데드버그|deadbug|레그\s*레이즈|leg\s*raise|싱글\s*레그|single\s*leg\s*raise/.test(lower)) return 3.5;

  // 머신 보충 (MET 3.0~3.5)
  if (/백\s*익스텐션|back\s*extension|힙\s*어덕션|hip\s*abduction|프리쳐\s*컬\s*머신|preacher\s*curl\s*machine/.test(lower)) return 3.0;
  if (/하이\s*로우|high\s*row|원\s*암.*머신|one\s*arm.*machine/.test(lower)) return 3.5;

  // 카디오 (MET 6.0~10.0)
  if (/스프린트|sprint/.test(lower)) return 10.0;
  if (/파틀렉|fartlek/.test(lower)) return 8.5;
  if (/인터벌|interval|워크런|walkrun/.test(lower)) return 7.0;
  if (/템포|tempo/.test(lower)) return 7.5;
  if (/이지런|easy\s*run|조깅|jog/.test(lower)) return 6.0;
  if (/장거리|long\s*distance|long\s*run/.test(lower)) return 6.5;
  if (/케틀벨\s*스윙|kettlebell\s*swing/.test(lower)) return 6.0;
  if (/점프|jump|점핑|jumping|박스\s*점프|box\s*jump/.test(lower)) return 7.0;

  // 폴백: 타입 기반
  return EXERCISE_TYPE_MET[type] || 4.0;
}

/**
 * 회의 55 (2026-04-12): 칼로리 로직 재설계
 *
 * 새 공식 = 기본 MET 계산 × 볼륨 강도 보정 × EPOC 보정
 *   1. 기본 kcal = MET × 체중 × 전체시간 (MET 자체가 세트간 휴식 포함 대사율)
 *   2. 볼륨 강도 보정: volumeIntensity = totalVolume / (BW × 활동분)
 *      - 활동분 = 전체시간 × 60% (휴식 제외, 강도 밀도 계산용)
 *      - > 1.5 (고강도): × 1.25
 *      - 1.0~1.5 (중강도): × 1.10
 *      - < 1.0 (저강도): × 1.00
 *   3. EPOC 보정 × 1.15 (근력 세션 후 48h 추가 소모, Schuenke 2002 / Paoli 2012)
 *
 * 폴백 제거: 5분 미만 45분 폴백 삭제. 실제 시간 우선, 누락 시 세트 × 90초 추정.
 *
 * 목표 레퍼런스 — 30대 남자 75kg / 5500kg 볼륨 / 45분:
 *   기존 309 kcal → 새 로직 ≈ 420 kcal (+36%, 성취감 ↑)
 *
 * 버그 수정 (2026-04-12):
 *   - ACTIVITY_TIME_RATIO는 volumeIntensity 분모에만 적용 (base MET에 미적용)
 *   - exerciseTimings 경로: 개별 타이밍 합 대신 wall-clock 전체 시간 사용
 */
const EPOC_MULTIPLIER = 1.15;
const ACTIVITY_TIME_RATIO = 0.6; // 볼륨 강도 계산용 — base MET에는 미적용

function computeIntensityMultiplier(totalVolume: number, bodyWeightKg: number, totalMin: number): number {
  if (totalMin <= 0 || bodyWeightKg <= 0) return 1.0;
  // 활동 밀도 = 볼륨 / (체중 × 순수 활동 시간)
  const activityMin = totalMin * ACTIVITY_TIME_RATIO;
  const volumeIntensity = totalVolume / (bodyWeightKg * activityMin);
  if (volumeIntensity > 1.5) return 1.25;
  if (volumeIntensity > 1.0) return 1.10;
  return 1.0;
}

export function calcSessionCalories(
  session: WorkoutHistory,
  bodyWeightKg: number
): number {
  const exercises = session.sessionData?.exercises || [];
  const rawDuration = session.stats.totalDurationSec || 0;
  const totalSets = session.stats.totalSets || 0;
  const totalVolume = session.stats.totalVolume || 0;

  // 러닝 세션: runningStats 기반 (기존 유지 — 러닝은 MET 정확도 높음)
  const rs = session.runningStats;
  if (rs && rs.duration > 0) {
    const runMET: Record<string, number> = {
      sprint: 10.0, fartlek: 8.5, tempo: 7.5, interval: 7.0, walkrun: 7.0,
      easy: 6.0, long: 6.5,
    };
    const met = runMET[rs.runningType] || 6.5;
    return Math.round(met * bodyWeightKg * (rs.duration / 3600));
  }

  // 회의 55: 5분 미만 45분 폴백 제거. 실제 기록 우선, 누락 시 세트 기반 추정.
  const baseDurationSec = rawDuration > 0 ? rawDuration : totalSets * 90;
  if (baseDurationSec <= 0 || bodyWeightKg <= 0) return 0;

  // 전체 시간 (MET는 세트간 휴식 포함 대사율이므로 wall-clock 그대로 사용)
  const totalTimeH = baseDurationSec / 3600;
  const totalMin = baseDurationSec / 60;

  // 1. 기본 MET 계산 — wall-clock 전체 시간 기준
  let baseKcal: number;
  if (exercises.length > 0) {
    const avgMET = exercises.reduce((sum, ex) => sum + getExerciseMET(ex.name, ex.type), 0) / exercises.length;
    baseKcal = avgMET * bodyWeightKg * totalTimeH;
  } else {
    baseKcal = 4.5 * bodyWeightKg * totalTimeH;
  }

  // 2. 볼륨 강도 보정 (ACTIVITY_TIME_RATIO는 여기 분모에만 적용)
  const intensityMult = computeIntensityMultiplier(totalVolume, bodyWeightKg, totalMin);

  // 3. EPOC 보정
  const totalKcal = baseKcal * intensityMult * EPOC_MULTIPLIER;

  return Math.round(totalKcal);
}

/**
 * 여러 세션의 칼로리 추이 계산
 */
export function calcCaloriesTrend(
  sessions: WorkoutHistory[],
  bodyWeightKg: number
): { date: string; calories: number }[] {
  return sessions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(s => ({
      date: s.date,
      calories: calcSessionCalories(s, bodyWeightKg),
    }));
}

/* ─── Phase 1: 3대 운동 볼륨 밸런스 ─── */

const BIG3_KEYWORDS = {
  bench: ["벤치 프레스", "벤치프레스", "bench press", "인클라인 벤치", "인클라인벤치"],
  squat: ["스쿼트", "squat", "프론트 스쿼트", "프론트스쿼트", "레그 프레스", "레그프레스"],
  deadlift: ["데드리프트", "deadlift", "루마니안 데드리프트", "루마니안데드리프트"],
};

function matchBig3(name: string): "bench" | "squat" | "deadlift" | null {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(BIG3_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return cat as "bench" | "squat" | "deadlift";
    }
  }
  return null;
}

/**
 * 3대 운동별 총 볼륨 비율 계산
 */
export function calcBig3VolumeBalance(sessions: WorkoutHistory[]): {
  bench: number;
  squat: number;
  deadlift: number;
  total: number;
  percentages: { bench: number; squat: number; deadlift: number };
  weakest: "bench" | "squat" | "deadlift" | null;
} | null {
  const volumes: Record<string, number> = { bench: 0, squat: 0, deadlift: 0 };

  for (const session of sessions) {
    const exercises = session.sessionData?.exercises || [];
    const logs = session.logs || {};

    exercises.forEach((ex, idx) => {
      const cat = matchBig3(ex.name);
      if (!cat) return;

      const exLogs = logs[idx] || [];
      for (const log of exLogs) {
        const weight = parseFloat(log.weightUsed || ex.weight || "0");
        if (!isNaN(weight) && weight > 0 && log.repsCompleted > 0) {
          volumes[cat] += weight * log.repsCompleted;
        }
      }
    });
  }

  const total = volumes.bench + volumes.squat + volumes.deadlift;
  if (total === 0) return null;

  const pct = {
    bench: Math.round((volumes.bench / total) * 100),
    squat: Math.round((volumes.squat / total) * 100),
    deadlift: Math.round((volumes.deadlift / total) * 100),
  };

  // 가장 약한 종목 (볼륨 비율이 가장 낮은)
  const entries = Object.entries(pct) as [string, number][];
  const nonZero = entries.filter(([, v]) => v > 0);
  const weakest = nonZero.length > 0
    ? (nonZero.sort((a, b) => a[1] - b[1])[0][0] as "bench" | "squat" | "deadlift")
    : null;

  return {
    bench: volumes.bench,
    squat: volumes.squat,
    deadlift: volumes.deadlift,
    total,
    percentages: pct,
    weakest,
  };
}

/* ─── Phase 1: 운동 패턴 분석 (강도 분포) ─── */

/**
 * 세션별 강도 분포 (high/moderate/low)
 * workoutMetrics의 classifySessionIntensity와 동일 로직 간략 버전
 */
export function calcIntensityDistribution(
  sessions: WorkoutHistory[],
  bodyWeightKg?: number
): { high: number; moderate: number; low: number; balance: "good" | "skewed" } | null {
  if (sessions.length === 0) return null;

  let high = 0, moderate = 0, low = 0;

  for (const session of sessions) {
    const exercises = session.sessionData?.exercises || [];
    const logs = session.logs || {};
    const allPercentiles: number[] = [];

    exercises.forEach((ex, idx) => {
      const exLogs = logs[idx] || [];
      for (const log of exLogs) {
        const weight = parseFloat(log.weightUsed || ex.weight || "0");
        if (!isNaN(weight) && weight > 0 && log.repsCompleted > 0) {
          const e1rm = estimate1RM(weight, log.repsCompleted);
          if (e1rm > 0) allPercentiles.push((weight / e1rm) * 100);
        }
      }
    });

    if (allPercentiles.length > 0) {
      const avg = allPercentiles.reduce((s, v) => s + v, 0) / allPercentiles.length;
      if (avg >= 80) high++;
      else if (avg >= 60) moderate++;
      else low++;
    } else {
      // 렙수 기반 추정
      const avgReps = session.stats.totalReps / Math.max(1, session.stats.totalSets);
      if (avgReps <= 6) high++;
      else if (avgReps <= 12) moderate++;
      else low++;
    }
  }

  const total = high + moderate + low;
  const pctHigh = Math.round((high / total) * 100);
  const pctMod = Math.round((moderate / total) * 100);
  const pctLow = Math.round((low / total) * 100);

  // DUP 기준 균형 판단: 이상적으로 High 20-30%, Mod 40-50%, Low 20-30%
  const balance = pctMod >= 30 && pctMod <= 60 && pctHigh <= 50 && pctLow <= 50 ? "good" : "skewed";

  return { high: pctHigh, moderate: pctMod, low: pctLow, balance };
}

/* ─── Phase 1: 세션 시간 변화 (체력 목표용) ─── */

export function calcDurationTrend(sessions: WorkoutHistory[]): {
  firstMin: number;
  lastMin: number;
  changePct: number;
} | null {
  const withDuration = sessions
    .filter(s => s.stats.totalDurationSec && s.stats.totalDurationSec > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (withDuration.length < 2) return null;

  const firstMin = Math.round(withDuration[0].stats.totalDurationSec! / 60);
  const lastMin = Math.round(withDuration[withDuration.length - 1].stats.totalDurationSec! / 60);
  const changePct = firstMin > 0 ? Math.round(((lastMin - firstMin) / firstMin) * 100) : 0;

  return { firstMin, lastMin, changePct };
}

/* ─── Phase 1: 세션별 회복 속도 (상급자 체력 목표) ─── */

/**
 * 세션 간 볼륨 회복 패턴
 * 연속 세션에서 볼륨이 유지/회복되는 속도를 측정
 */
export function calcRecoveryPattern(sessions: WorkoutHistory[]): {
  avgRecoveryPct: number; // 평균 볼륨 회복률 (이전 세션 대비)
  trend: "improving" | "stable" | "declining";
} | null {
  const sorted = sessions
    .filter(s => s.stats.totalVolume > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 3) return null;

  const recoveries: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].stats.totalVolume;
    const curr = sorted[i].stats.totalVolume;
    if (prev > 0) {
      recoveries.push((curr / prev) * 100);
    }
  }

  if (recoveries.length === 0) return null;

  const avg = Math.round(recoveries.reduce((s, v) => s + v, 0) / recoveries.length);

  // 트렌드: 전반 vs 후반 비교
  const mid = Math.floor(recoveries.length / 2);
  const firstHalf = recoveries.slice(0, mid || 1);
  const secondHalf = recoveries.slice(mid || 1);
  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  const trend = avgSecond > avgFirst + 3 ? "improving"
    : avgSecond < avgFirst - 3 ? "declining"
    : "stable";

  return { avgRecoveryPct: avg, trend };
}

/* ─── Phase 2: e1RM 트렌드 ─── */

/**
 * 세션별 best e1RM 트렌드 (선형 회귀)
 */
/** 3대 운동 패턴 (벤치/스쿼트/데드) */
const BIG3_LIFT_PATTERNS: { name: string; label: string; match: string[]; exclude: string[] }[] = [
  { name: "bench", label: "벤치프레스", match: ["벤치 프레스", "벤치프레스", "bench press", "flat bench"], exclude: ["덤벨", "dumbbell", "인클라인", "incline", "디클라인", "decline"] },
  { name: "squat", label: "스쿼트", match: ["스쿼트", "squat", "백 스쿼트", "백스쿼트"], exclude: ["프론트", "front", "고블릿", "goblet", "덤벨", "dumbbell"] },
  { name: "deadlift", label: "데드리프트", match: ["데드리프트", "deadlift"], exclude: ["트랩바", "trap bar", "케틀벨", "kettlebell"] },
];

function matchBig3Lift(exerciseName: string): string | null {
  const lower = exerciseName.toLowerCase();
  for (const p of BIG3_LIFT_PATTERNS) {
    if (p.match.some(m => lower.includes(m.toLowerCase())) && !p.exclude.some(ex => lower.includes(ex.toLowerCase()))) {
      return p.name;
    }
  }
  return null;
}

/** 운동별 e1RM 트렌드 (3대 운동 각각 회귀분석) */
export function calcE1RMTrendByExercise(sessions: WorkoutHistory[]): {
  name: string; // bench | squat | deadlift
  label: string; // 벤치프레스 | 스쿼트 | 데드리프트
  regression: RegressionResult;
  firstE1RM: number;
  lastE1RM: number;
  growthPerWeek: number;
  points: { x: number; y: number; label: string }[];
  baseDate: string;
}[] {
  const results: { name: string; label: string; regression: RegressionResult; firstE1RM: number; lastE1RM: number; growthPerWeek: number; points: { x: number; y: number; label: string }[]; baseDate: string }[] = [];

  for (const pattern of BIG3_LIFT_PATTERNS) {
    // 해당 운동의 세션별 최고 e1RM 추출
    const points: { date: string; e1rm: number }[] = [];

    for (const session of sessions) {
      const exercises = session.sessionData?.exercises || [];
      const logs = session.logs || {};
      let bestForSession = 0;

      exercises.forEach((ex, idx) => {
        if (matchBig3Lift(ex.name) !== pattern.name) return;
        const exLogs = logs[idx] || [];
        for (const log of exLogs) {
          const weight = parseFloat(log.weightUsed || ex.weight || "0");
          if (!isNaN(weight) && weight > 0 && log.repsCompleted > 0) {
            const e1rm = estimate1RM(weight, log.repsCompleted);
            if (e1rm > bestForSession) bestForSession = e1rm;
          }
        }
      });

      if (bestForSession > 0) {
        points.push({ date: session.date, e1rm: bestForSession });
      }
    }

    if (points.length < 2) continue;

    const sorted = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const baseDate = sorted[0].date;
    const regPoints = sorted.map(p => ({ x: dateToDayIndex(p.date, baseDate), y: p.e1rm }));
    const reg = linearRegression(regPoints);
    if (!reg) continue;

    const chartPoints = regPoints.map(p => ({ x: p.x, y: Math.round(p.y * 10) / 10, label: `${Math.round(p.y * 10) / 10}kg` }));
    results.push({
      name: pattern.name,
      label: pattern.label,
      regression: reg,
      firstE1RM: Math.round(sorted[0].e1rm),
      lastE1RM: Math.round(sorted[sorted.length - 1].e1rm),
      growthPerWeek: Math.round(reg.slope * 7 * 10) / 10,
      points: chartPoints,
      baseDate,
    });
  }

  return results;
}

/** 기존 호환: 세션 최고 e1RM 트렌드 (deprecated — calcE1RMTrendByExercise 사용 권장) */
export function calcE1RMTrend(sessions: WorkoutHistory[]): {
  regression: RegressionResult;
  firstE1RM: number;
  lastE1RM: number;
  growthPerWeek: number;
} | null {
  // 운동별 트렌드 중 데이터가 가장 많은 종목 반환
  const byEx = calcE1RMTrendByExercise(sessions);
  if (byEx.length === 0) return null;
  return byEx[0]; // 첫 번째 (가장 먼저 매칭된 종목)
}

/* ─── Phase 2: 체중 트렌드 ─── */

export function calcWeightTrend(weightLog: { date: string; weight: number }[]): {
  regression: RegressionResult;
  weeklyChange: number; // kg/주
  predictInWeeks: (weeks: number) => number;
} | null {
  if (weightLog.length < 3) return null;

  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const baseDate = sorted[0].date;
  const points = sorted.map(e => ({
    x: dateToDayIndex(e.date, baseDate),
    y: e.weight,
  }));

  const reg = linearRegression(points);
  if (!reg) return null;

  const lastDay = points[points.length - 1].x;

  return {
    regression: reg,
    weeklyChange: Math.round(reg.slope * 7 * 100) / 100,
    predictInWeeks: (weeks: number) => Math.round(reg.predict(lastDay + weeks * 7) * 10) / 10,
  };
}

/* ─── Phase 3: 정체기 감지 ─── */

/**
 * e1RM 또는 볼륨 정체기 감지
 * 최근 N세션의 변화율이 ±2% 이내면 정체기
 */
export function detectPlateau(
  values: { date: string; value: number }[],
  windowSize: number = 5
): {
  isPlateau: boolean;
  changePct: number;
  durationDays: number;
} | null {
  if (values.length < windowSize) return null;

  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-windowSize);

  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const changePct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  const firstDate = new Date(recent[0].date).getTime();
  const lastDate = new Date(recent[recent.length - 1].date).getTime();
  const durationDays = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));

  return {
    isPlateau: Math.abs(changePct) <= 2,
    changePct,
    durationDays,
  };
}
