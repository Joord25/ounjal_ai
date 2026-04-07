import { WorkoutHistory } from "@/constants/workout";
import {
  calcConsistencyScore,
  calcCaloriesTrend,
  calcCalorieBalanceTrend,
  calcE1RMTrendByExercise,
  calcBig3VolumeBalance,
  linearRegression,
} from "@/utils/predictionUtils";
import { type FitnessProfile } from "./fitnessTypes";

type UserLevel = "beginner" | "advanced";

export interface PredictionItem {
  label: string;
  phase: 0 | 1 | 2 | 3;    // 0=즉시, 1=5회, 2=10회, 3=20회
  source: string;            // 근거 출처
}

export const PHASE_THRESHOLDS = [0, 5, 10, 20]; // 각 Phase별 필요 운동 횟수

export interface GoalPrediction {
  title: string;
  beginner: PredictionItem[];
  advanced: PredictionItem[];
}

export const PREDICTIONS_BY_GOAL: Record<string, GoalPrediction> = {
  fat_loss: {
    title: "체지방 감량",
    beginner: [
      { label: "안전한 주간 체중 감량 속도", phase: 0, source: "Helms et al. 2014 (ISSN)" },
      { label: "1개월 후 예상 체중", phase: 1, source: "칼로리 밸런스 회귀분석" },
      { label: "-5kg 감량 예상 기간", phase: 1, source: "칼로리 밸런스 회귀분석" },
      { label: "2개월 후 예상 체중", phase: 2, source: "칼로리 밸런스 회귀분석" },
      { label: "-10kg 감량 예상 기간", phase: 2, source: "칼로리 밸런스 회귀분석" },
      { label: "4개월 후 예상 체중", phase: 3, source: "칼로리 밸런스 회귀분석" },
      { label: "-20kg 감량 예상 기간", phase: 3, source: "칼로리 밸런스 회귀분석" },
    ],
    advanced: [
      { label: "안전한 주간 체중 감량 속도", phase: 0, source: "Helms et al. 2014 (ISSN)" },
      { label: "1개월 후 예상 체중", phase: 1, source: "칼로리 밸런스 회귀분석" },
      { label: "-5kg 감량 예상 기간", phase: 1, source: "칼로리 밸런스 회귀분석" },
      { label: "2개월 후 예상 체중", phase: 2, source: "칼로리 밸런스 회귀분석" },
      { label: "-10kg 감량 예상 기간", phase: 2, source: "칼로리 밸런스 회귀분석" },
      { label: "4개월 후 예상 체중", phase: 3, source: "칼로리 밸런스 회귀분석" },
      { label: "-20kg 감량 예상 기간", phase: 3, source: "칼로리 밸런스 회귀분석" },
    ],
  },
  muscle_gain: {
    title: "근력 증가",
    beginner: [], // 동적 생성 — getMuscleGainItems()에서 처리
    advanced: [],
  },
  endurance: {
    title: "기초 체력",
    beginner: [
      { label: "현재 기초체력 등급", phase: 0, source: "ACSM Push-up Test · 국민체력100 · 자체 스쿼트 기준" },
      { label: "다음 등급 도달 예상 기간", phase: 1, source: "체력 테스트 데이터 추세 분석" },
      { label: "2단계 상위 등급 도달 예상 기간", phase: 2, source: "체력 테스트 데이터 추세 분석" },
      { label: "최고 등급 도달 예상 기간", phase: 3, source: "체력 테스트 데이터 추세 분석" },
    ],
    advanced: [
      { label: "현재 기초체력 등급", phase: 0, source: "ACSM Push-up Test · 국민체력100 · 자체 스쿼트 기준" },
      { label: "다음 등급 도달 예상 기간", phase: 1, source: "체력 테스트 데이터 추세 분석" },
      { label: "2단계 상위 등급 도달 예상 기간", phase: 2, source: "체력 테스트 데이터 추세 분석" },
      { label: "최고 등급 도달 예상 기간", phase: 3, source: "체력 테스트 데이터 추세 분석" },
    ],
  },
  health: {
    title: "건강 유지",
    beginner: [
      { label: "WHO 권장 운동량 달성률", phase: 0, source: "WHO Physical Activity Guidelines 2020" },
      { label: "운동 빈도 분석", phase: 1, source: "운동 기록 데이터" },
      { label: "운동 일관성 분석", phase: 2, source: "최근 4주 출석률 분석" },
      { label: "근육군 밸런스 분석", phase: 3, source: "운동 부위별 볼륨 비율 분석" },
    ],
    advanced: [
      { label: "WHO 권장 운동량 달성률", phase: 0, source: "WHO Physical Activity Guidelines 2020" },
      { label: "운동 빈도 분석", phase: 1, source: "운동 기록 데이터" },
      { label: "운동 일관성 분석", phase: 2, source: "최근 4주 출석률 분석" },
      { label: "근육군 밸런스 분석", phase: 3, source: "운동 부위별 볼륨 비율 분석" },
    ],
  },
};

/** 근력 등급에 따라 동적 예측 항목 생성 */
export function getMuscleGainItems(p: FitnessProfile, history?: WorkoutHistory[]): PredictionItem[] {
  const byEx = history ? calcE1RMTrendByExercise(history) : [];
  // 종목별 NSCA 기준으로 등급 판단 (가장 낮은 등급 기준)
  const liftStd = { bench: { mid: 1.0, adv: 1.5 }, squat: { mid: 1.25, adv: 1.75 }, deadlift: { mid: 1.5, adv: 2.0 } };
  const lifts = [
    { rm: Math.max(p.bench1RM || 0, byEx.find(e => e.name === "bench")?.lastE1RM || 0), std: liftStd.bench },
    { rm: Math.max(p.squat1RM || 0, byEx.find(e => e.name === "squat")?.lastE1RM || 0), std: liftStd.squat },
    { rm: Math.max(p.deadlift1RM || 0, byEx.find(e => e.name === "deadlift")?.lastE1RM || 0), std: liftStd.deadlift },
  ].filter(l => l.rm > 0);
  // 데이터 있는 종목 중 가장 낮은 등급으로 판단
  const allIntermediate = lifts.length > 0 && lifts.every(l => l.rm >= p.bodyWeight * l.std.mid);
  const allAdvanced = lifts.length > 0 && lifts.every(l => l.rm >= p.bodyWeight * l.std.adv);
  const isAdvanced = allAdvanced;
  const isIntermediate = allIntermediate && !allAdvanced;

  const items: PredictionItem[] = [
    { label: "현재 근력 수준 평가", phase: 0, source: "ExRx/NSCA Strength Standards" },
  ];

  if (isAdvanced) {
    // 상급 달성 → +20, +40, +60
    items.push({ label: "+20kg 증량 예상 기간", phase: 1, source: "e1RM 선형 회귀" });
    items.push({ label: "+40kg 증량 예상 기간", phase: 2, source: "e1RM 선형 회귀" });
    items.push({ label: "+60kg 증량 예상 기간", phase: 3, source: "e1RM 선형 회귀" });
  } else if (isIntermediate) {
    // 중급 달성 → 상급, +20, +40
    items.push({ label: "상급 진입 예상 기간", phase: 1, source: "e1RM 선형 회귀" });
    items.push({ label: "+20kg 증량 예상 기간", phase: 2, source: "e1RM 선형 회귀" });
    items.push({ label: "+40kg 증량 예상 기간", phase: 3, source: "e1RM 선형 회귀" });
  } else {
    // 초급 → 중급, 상급, +20
    items.push({ label: "중급 진입 예상 기간", phase: 1, source: "e1RM 선형 회귀" });
    items.push({ label: "상급 진입 예상 기간", phase: 2, source: "e1RM 선형 회귀" });
    items.push({ label: "+20kg 증량 예상 기간", phase: 3, source: "e1RM 선형 회귀" });
  }

  return items;
}

/* ─── 과학적 계산 함수 ─── */


/** ACSM MET 기반 칼로리 소모 추정 (Ainsworth et al., 2011)
 *  일반 저항운동: 3.5-6.0 MET, 유산소: 4.0-8.0 MET
 *  칼로리 = MET × 체중(kg) × 시간(h)
 */
export function estimateSessionCalories(weight: number, minutes: number, goal: string): { low: number; high: number } {
  // 목표별 MET 범위 (ACSM Compendium of Physical Activities)
  const metRange = goal === "endurance" ? { low: 5.0, high: 8.0 }
    : goal === "muscle_gain" ? { low: 3.5, high: 6.0 }
    : goal === "fat_loss" ? { low: 4.0, high: 7.0 }
    : { low: 3.5, high: 6.0 }; // health

  const hours = minutes / 60;
  return {
    low: Math.round(metRange.low * weight * hours),
    high: Math.round(metRange.high * weight * hours),
  };
}

/** ExRx/NSCA 상대근력 기준 (Strength Standards)
 *  체중 대비 1RM 비율로 수준 평가
 *  남성 기준: 초보 0.5x, 중급 1.0x, 상급 1.5x, 엘리트 2.0x (벤치)
 *  여성 기준: 초보 0.3x, 중급 0.6x, 상급 0.9x, 엘리트 1.2x (벤치)
 */
export function assessStrengthLevel(lift: "bench" | "squat" | "deadlift", oneRM: number, bw: number, gender: "male" | "female"):
  { level: string; ratio: number; percentile: string } {
  const ratio = Math.round((oneRM / bw) * 100) / 100;

  // 남성 기준표 (ExRx Strength Standards)
  const maleStandards = {
    bench:    { novice: 0.5, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
    squat:    { novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.5 },
    deadlift: { novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.75 },
  };
  const femaleStandards = {
    bench:    { novice: 0.3, intermediate: 0.6, advanced: 0.9, elite: 1.2 },
    squat:    { novice: 0.5, intermediate: 0.9, advanced: 1.25, elite: 1.75 },
    deadlift: { novice: 0.6, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
  };

  const std = gender === "male" ? maleStandards[lift] : femaleStandards[lift];
  let level: string;
  let percentile: string;

  if (ratio < std.novice) { level = "입문"; percentile = "하위 20%"; }
  else if (ratio < std.intermediate) { level = "초급"; percentile = "상위 60~80%"; }
  else if (ratio < std.advanced) { level = "중급"; percentile = "상위 30~60%"; }
  else if (ratio < std.elite) { level = "상급"; percentile = "상위 10~30%"; }
  else { level = "엘리트"; percentile = "상위 10%"; }

  return { level, ratio, percentile };
}


/* ─── reading results ─── */
interface StrengthBar {
  name: string;    // 벤치프레스, 스쿼트, 데드리프트
  level: string;   // 입문, 초급, 중급, 상급, 엘리트
  ratio: number;   // 체중 대비 배수
  pct: number;     // 0~100 프로그레스 바 위치
}

interface PredictionResult {
  value: string;
  sub?: string;
  source?: string;
  action?: "edit_1rm" | "fitness_test";
  strengthBars?: StrengthBar[];  // 근력 수준 바 데이터
}

export interface ReadingResult {
  typeName: string;
  typeEmoji: string;
  message: string;
  growthStars: number;
  predictions: PredictionResult[];
  condition: string;
}

export function computeReading(
  p: FitnessProfile,
  wkCount: number,
  history?: WorkoutHistory[],
  weightLog?: { date: string; weight: number }[]
): ReadingResult {
  const weeklyMin = p.weeklyFrequency * p.sessionMinutes;
  const age = new Date().getFullYear() - p.birthYear;

  // ACSM 권고: 주 150분 moderate or 75분 vigorous
  const acsmPct = Math.round((weeklyMin / 150) * 100);

  // 성장 포텐셜 별점
  let stars = 3;
  if (p.weeklyFrequency === 0) stars = 3;
  else if (p.weeklyFrequency >= 4 && p.sessionMinutes >= 60) stars = 5;
  else if (p.weeklyFrequency >= 3 && p.sessionMinutes >= 45) stars = 4;
  else if (p.weeklyFrequency <= 2 && p.sessionMinutes <= 30) stars = 2;
  if (age >= 40) stars = Math.max(1, stars - 1);

  // 타입 결정
  let typeName: string;
  let typeEmoji: string;
  if (p.goal === "fat_loss") {
    typeName = p.weeklyFrequency >= 4 ? "불꽃 연소형" : "꾸준한 연소형";
    typeEmoji = "";
  } else if (p.goal === "muscle_gain") {
    typeName = p.weeklyFrequency >= 4 ? "폭발 성장형" : "안정 성장형";
    typeEmoji = "";
  } else if (p.goal === "endurance") {
    typeName = "끈기 상승형";
    typeEmoji = "";
  } else {
    typeName = "균형 유지형";
    typeEmoji = "";
  }

  // 목표별 동적 코치 멘트 (룰베이스 + 변수 치환)
  const message = (() => {
    if (p.weeklyFrequency === 0) return "growth.coach.beginner";

    const sessionCals = estimateSessionCalories(p.bodyWeight, p.sessionMinutes, p.goal);
    const weeklyCalBurn = Math.round(((sessionCals.low + sessionCals.high) / 2) * p.weeklyFrequency);

    if (p.goal === "fat_loss") {
      const weeklyLossKg = Math.round((weeklyCalBurn / 7700) * 100) / 100;
      const pred4w = Math.round((p.bodyWeight - weeklyLossKg * 4) * 10) / 10;
      const pred8w = Math.round((p.bodyWeight - weeklyLossKg * 8) * 10) / 10;
      // 주간 감량 속도 기반 기간 예측
      const weeksTo1kg = weeklyLossKg > 0 ? Math.ceil(1 / weeklyLossKg) : 0;
      return `growth.coach.fatLoss:${pred4w}:${pred8w}:${weeksTo1kg}`;
    }
    if (p.goal === "muscle_gain") {
      let total1RM = 0;
      if (history && history.length > 0) {
        // 운동별 정확한 e1RM 추출 (calcE1RMTrendByExercise 사용)
        const byEx = calcE1RMTrendByExercise(history);
        for (const ex of byEx) {
          total1RM += Math.round(ex.lastE1RM);
        }
      }
      if (total1RM > 0) {
        const levelLabel = total1RM >= 500 ? "엘리트" : total1RM >= 400 ? "상급" : total1RM >= 300 ? "중급" : "입문";
        const nextTarget = total1RM >= 500 ? 0 : total1RM >= 400 ? 500 : total1RM >= 300 ? 400 : 300;
        const remaining = nextTarget > 0 ? nextTarget - total1RM : 0;
        return `growth.coach.muscleGain:${total1RM}:${levelLabel}:${nextTarget}:${remaining}`;
      }
      return "growth.coach.muscleGainStart";
    }
    if (p.goal === "endurance") {
      // 기초체력: 주당 운동 시간 기반 체력 등급
      const totalWeeklyMin = p.weeklyFrequency * p.sessionMinutes;
      const grade = totalWeeklyMin >= 300 ? "특급" : totalWeeklyMin >= 225 ? "상급" : totalWeeklyMin >= 150 ? "우수" : "성장중";
      const nextMin = totalWeeklyMin >= 300 ? 0 : totalWeeklyMin >= 225 ? 300 : totalWeeklyMin >= 150 ? 225 : 150;
      const minRemaining = nextMin > 0 ? nextMin - totalWeeklyMin : 0;
      return `growth.coach.endurance:${totalWeeklyMin}:${grade}:${minRemaining}:${nextMin}`;
    }
    // health: 꾸준함 + 습관 중심
    const totalWorkouts = history?.length || 0;
    const weeksActive = totalWorkouts > 0 ? Math.max(1, Math.ceil(totalWorkouts / p.weeklyFrequency)) : 0;
    return `growth.coach.health:${p.weeklyFrequency}:${totalWorkouts}:${weeksActive}`;
  })();

  // 항목 선택
  const isBeginner = p.weeklyFrequency <= 2;
  const level: UserLevel = isBeginner ? "beginner" : "advanced";
  const goalItems = p.goal === "muscle_gain" ? getMuscleGainItems(p, history) : (PREDICTIONS_BY_GOAL[p.goal]?.[level] || []);

  const conditionStr = p.weeklyFrequency === 0
    ? "growth.condition.notStarted"
    : `growth.condition.active:${p.sessionMinutes}:${p.weeklyFrequency}`;

  // 공통 계산값 (Phase 0: 순수 산술만)
  const sessionCal = estimateSessionCalories(p.bodyWeight, p.sessionMinutes, p.goal);
  const weeklyCal = { low: sessionCal.low * p.weeklyFrequency, high: sessionCal.high * p.weeklyFrequency };

  const predictions: PredictionResult[] = goalItems.map((item) => {
    const label = item.label;

    // ── Phase 체크: 운동 데이터 필요한 항목 ──
    const needed = PHASE_THRESHOLDS[item.phase] ?? 0;
    if (wkCount < needed) {
      return { value: `${needed}회 운동 후 해금`, sub: `현재 ${wkCount}회 완료` };
    }

    // ── Phase 0: 프로필 데이터 기반 ──

    // 공통: 주간 칼로리 소모
    if (label.includes("주간 예상 운동 칼로리 소모")) {
      if (p.weeklyFrequency === 0) return { value: "운동 시작 후 측정 가능" };
      return {
        value: `${weeklyCal.low.toLocaleString()}~${weeklyCal.high.toLocaleString()} kcal/주`,
        sub: `1회 약 ${sessionCal.low}~${sessionCal.high} kcal 소모`,
      };
    }

    // 공통: ACSM 권장량 달성률
    if (label.includes("ACSM 권장") && label.includes("달성률")) {
      if (p.weeklyFrequency === 0) return { value: "0%", sub: "주 150분 이상이 목표입니다" };
      const status = acsmPct >= 200 ? "우수" : acsmPct >= 100 ? "충족" : "미달";
      return {
        value: `${acsmPct}% (${status})`,
        sub: `주 ${weeklyMin}분 운동 중 / 권장 150분`,
      };
    }

    // WHO 권장량
    if (label.includes("WHO 권장 운동량 달성률")) {
      if (p.weeklyFrequency === 0) return { value: "0%", sub: "주 150분 이상이 목표입니다" };
      const whoMin = 150;
      const whoPct = Math.round((weeklyMin / whoMin) * 100);
      const status = whoPct >= 200 ? "우수" : whoPct >= 100 ? "충족" : "미달";
      return {
        value: `${whoPct}% (${status})`,
        sub: `주 ${weeklyMin}분 운동 중 / 권장 150~300분`,
      };
    }

    // 감량: 안전한 주간 감량 속도
    if (label.includes("안전한 주간 체중 감량 속도")) {
      const safeMin = Math.round(p.bodyWeight * 0.005 * 10) / 10;
      const safeMax = Math.round(p.bodyWeight * 0.01 * 10) / 10;
      const weeklyDeficit = weeklyCal.low;
      const estWeeklyLoss = Math.round((weeklyDeficit / 7700) * 100) / 100;
      return {
        value: `주 ${safeMin}~${safeMax}kg 권장`,
        sub: p.weeklyFrequency > 0
          ? `운동만으로 주 약 ${estWeeklyLoss}kg 소모`
          : "운동 시작 후 측정 가능",
      };
    }

    // 근력: 현재 근력 수준 평가 (3대 운동별)
    if (label.includes("현재 근력 수준 평가")) {
      // 프로필 1RM이 있으면 사용, 없으면 운동 기록에서 추출
      const byEx = calcE1RMTrendByExercise(history || []);
      const benchRM = p.bench1RM || byEx.find(e => e.name === "bench")?.lastE1RM || 0;
      const squatRM = p.squat1RM || byEx.find(e => e.name === "squat")?.lastE1RM || 0;
      const deadRM = p.deadlift1RM || byEx.find(e => e.name === "deadlift")?.lastE1RM || 0;
      if (benchRM <= 0 && squatRM <= 0 && deadRM <= 0) return { value: "1RM 입력 또는 운동 기록 필요", action: "edit_1rm" };
      // NSCA/ExRx Strength Standards (종목별 체중 대비 기준)
      const standards = {
        bench:    { mid: 1.0, adv: 1.5 },
        squat:    { mid: 1.25, adv: 1.75 },
        deadlift: { mid: 1.5, adv: 2.0 },
      };
      const items: string[] = [];
      if (benchRM > 0) { const r = benchRM / p.bodyWeight; items.push(`벤치 ${Math.round(benchRM)}kg (${r >= standards.bench.adv ? "상급" : r >= standards.bench.mid ? "중급" : "초급"})`); }
      if (squatRM > 0) { const r = squatRM / p.bodyWeight; items.push(`스쿼트 ${Math.round(squatRM)}kg (${r >= standards.squat.adv ? "상급" : r >= standards.squat.mid ? "중급" : "초급"})`); }
      if (deadRM > 0) { const r = deadRM / p.bodyWeight; items.push(`데드 ${Math.round(deadRM)}kg (${r >= standards.deadlift.adv ? "상급" : r >= standards.deadlift.mid ? "중급" : "초급"})`); }
      return { value: items.join("\n"), sub: `체중 ${p.bodyWeight}kg 기준` };
    }

    // 근력: 초보자 근성장 속도
    if (label.includes("초보자 예상 근성장 속도")) {
      const monthlyGain = p.gender === "male" ? "0.7~0.9" : "0.3~0.45";
      return {
        value: `월 ${monthlyGain}kg 근육 증가 가능`,
        sub: "단백질 충분히 섭취할 때 기준",
      };
    }

    // 근력 상급자: 현재 근력 수준 평가
    if (label.includes("현재 근력 수준 평가")) {
      if (!p.bench1RM && !p.squat1RM && !p.deadlift1RM) {
        return { value: "최대 중량 입력 후 평가 가능", action: "edit_1rm" };
      }
      const std = p.gender === "male"
        ? { bench: 2.0, squat: 2.5, deadlift: 2.75 }
        : { bench: 1.2, squat: 1.75, deadlift: 2.0 };
      const bars: StrengthBar[] = [];
      if (p.bench1RM) {
        const r = assessStrengthLevel("bench", p.bench1RM, p.bodyWeight, p.gender);
        bars.push({ name: "벤치프레스", level: r.level, ratio: r.ratio, pct: Math.min(100, Math.round((r.ratio / std.bench) * 100)) });
      }
      if (p.squat1RM) {
        const r = assessStrengthLevel("squat", p.squat1RM, p.bodyWeight, p.gender);
        bars.push({ name: "스쿼트", level: r.level, ratio: r.ratio, pct: Math.min(100, Math.round((r.ratio / std.squat) * 100)) });
      }
      if (p.deadlift1RM) {
        const r = assessStrengthLevel("deadlift", p.deadlift1RM, p.bodyWeight, p.gender);
        bars.push({ name: "데드리프트", level: r.level, ratio: r.ratio, pct: Math.min(100, Math.round((r.ratio / std.deadlift) * 100)) });
      }
      return {
        value: bars.map(b => `${b.name} ${b.level}`).join(" · "),
        strengthBars: bars,
      };
    }

    // 근력 상급자: 3대 강점·약점 분석
    if (label.includes("강점·약점 분석")) {
      if (!p.bench1RM || !p.squat1RM || !p.deadlift1RM) {
        return { value: "3대 운동 1RM 모두 입력 시 분석 가능", action: "edit_1rm" };
      }
      const bench = assessStrengthLevel("bench", p.bench1RM, p.bodyWeight, p.gender);
      const squat = assessStrengthLevel("squat", p.squat1RM, p.bodyWeight, p.gender);
      const dead = assessStrengthLevel("deadlift", p.deadlift1RM, p.bodyWeight, p.gender);

      const levels = [
        { name: "벤치프레스", ...bench },
        { name: "스쿼트", ...squat },
        { name: "데드리프트", ...dead },
      ];
      const sorted = [...levels].sort((a, b) => b.ratio - a.ratio);
      const strongest = sorted[0];
      const weakest = sorted[sorted.length - 1];

      return {
        value: `강점: ${strongest.name} (${strongest.percentile})`,
        sub: `약점: ${weakest.name} (${weakest.percentile}) — 집중 강화 추천`,
      };
    }

    // ── Phase 1 (5회): 미래 예측 (운동 데이터 기반) ──
    const h = history || [];

    // 감량: N개월 후 예상 체중 (칼로리 밸런스 회귀분석)
    const monthMatch = label.match(/(\d+)개월 후 예상 체중/);
    if (monthMatch) {
      const months = parseInt(monthMatch[1]);
      const heightCm = p.height || 170;
      const balanceTrend = calcCalorieBalanceTrend(h, p.gender, p.bodyWeight, heightCm, age);
      if (!balanceTrend || balanceTrend.points.length < 2) return { value: `운동 기록 ${Math.max(0, 2 - h.length)}회 더 필요` };
      const reg = linearRegression(balanceTrend.points.map(pt => ({ x: pt.x, y: pt.y })));
      if (!reg) return { value: "데이터 분석 중" };
      const lastX = balanceTrend.points[balanceTrend.points.length - 1].x;
      const predCum = reg.predict(lastX + months * 30);
      const predKgChange = Math.round(predCum / 7700 * 10) / 10;
      const predWeight = Math.round((p.bodyWeight + predKgChange) * 10) / 10;
      return {
        value: `${months}개월 후 예상: ${predWeight}kg`,
        sub: `누적 ${predKgChange > 0 ? "+" : ""}${predKgChange}kg (칼로리 밸런스 기준)`,
      };
    }

    // 감량: -Nkg 감량 예상 기간 (칼로리 밸런스 회귀분석)
    const kgMatch = label.match(/-(\d+)kg 감량 예상 기간/);
    if (kgMatch) {
      const targetKg = parseInt(kgMatch[1]);
      const heightCm = p.height || 170;
      const balanceTrend = calcCalorieBalanceTrend(h, p.gender, p.bodyWeight, heightCm, age);
      if (!balanceTrend || balanceTrend.points.length < 2) return { value: `운동 기록 ${Math.max(0, 2 - h.length)}회 더 필요` };
      const reg = linearRegression(balanceTrend.points.map(pt => ({ x: pt.x, y: pt.y })));
      if (!reg) return { value: "데이터 분석 중" };
      // 목표 적자: -targetKg * 7700kcal
      const targetDeficit = -targetKg * 7700;
      if (reg.slope >= 0) return { value: "현재 칼로리 소모가 부족해요", sub: "운동 빈도를 늘리거나 식단 조절이 필요해요" };
      // 현재 누적에서 목표까지 남은 적자 / 일일 적자율 = 남은 일수
      const remaining = targetDeficit - balanceTrend.cumulative;
      const daysNeeded = Math.ceil(Math.abs(remaining) / Math.abs(reg.slope));
      const weeksNeeded = Math.ceil(daysNeeded / 7);
      const duration = weeksNeeded > 12 ? `${Math.round(weeksNeeded / 4)}개월` : `${weeksNeeded}주`;
      const targetWeight = Math.round((p.bodyWeight - targetKg) * 10) / 10;
      return {
        value: `${targetWeight}kg까지 ${duration}`,
        sub: `현재 ${p.bodyWeight}kg → ${targetWeight}kg`,
      };
    }

    // 근력: 중급/상급 진입 예상 기간 (달성 시 자동 승격)
    if (label.includes("중급 진입 예상 기간") || label.includes("상급 진입 예상 기간")) {
      const byEx = calcE1RMTrendByExercise(h);
      const isAdvanced = label.includes("상급");
      const liftStandards = { bench: { mid: 1.0, adv: 1.5 }, squat: { mid: 1.25, adv: 1.75 }, deadlift: { mid: 1.5, adv: 2.0 } };

      const allLifts = [
        { name: "bench" as const, label: "벤치", profile: p.bench1RM || 0, tracked: byEx.find(e => e.name === "bench") },
        { name: "squat" as const, label: "스쿼트", profile: p.squat1RM || 0, tracked: byEx.find(e => e.name === "squat") },
        { name: "deadlift" as const, label: "데드", profile: p.deadlift1RM || 0, tracked: byEx.find(e => e.name === "deadlift") },
      ];
      const available = allLifts.filter(lift => lift.profile > 0 || lift.tracked);
      if (available.length === 0) return { value: "1RM 입력 또는 운동 기록 필요", action: "edit_1rm" };

      const results = available.map(lift => {
        const current = Math.max(lift.profile, lift.tracked?.lastE1RM || 0);
        const growth = (lift.tracked?.growthPerWeek || 0) > 0 ? lift.tracked!.growthPerWeek : 2.5;
        const std = liftStandards[lift.name];
        const midTarget = p.bodyWeight * std.mid;
        const advTarget = p.bodyWeight * std.adv;

        if (isAdvanced) {
          const remaining = advTarget - current;
          if (remaining <= 0) return `${lift.label} → 달성`;
          const weeksNeeded = Math.ceil(remaining / growth);
          const duration = weeksNeeded > 12 ? `${Math.round(weeksNeeded / 4)}개월` : `${weeksNeeded}주`;
          return `${lift.label} → ${Math.round(advTarget)}kg (${duration})`;
        } else {
          const midRemaining = midTarget - current;
          if (midRemaining > 0) {
            const weeksNeeded = Math.ceil(midRemaining / growth);
            const duration = weeksNeeded > 12 ? `${Math.round(weeksNeeded / 4)}개월` : `${weeksNeeded}주`;
            return `${lift.label} → ${Math.round(midTarget)}kg (${duration})`;
          }
          const advRemaining = advTarget - current;
          if (advRemaining > 0) {
            const weeksNeeded = Math.ceil(advRemaining / growth);
            const duration = weeksNeeded > 12 ? `${Math.round(weeksNeeded / 4)}개월` : `${weeksNeeded}주`;
            return `${lift.label} → ${Math.round(advTarget)}kg (${duration})`;
          }
          const target20 = current + 20;
          const weeksNeeded = Math.ceil(20 / growth);
          const duration = weeksNeeded > 12 ? `${Math.round(weeksNeeded / 4)}개월` : `${weeksNeeded}주`;
          return `${lift.label} → ${Math.round(target20)}kg (${duration})`;
        }
      });
      return {
        value: results.join("\n"),
        sub: `체중 ${p.bodyWeight}kg 기준`,
      };
    }

    // 근력: 3대 운동 각각 +Nkg 증량 예상 기간
    const kgIncMatch = label.match(/\+(\d+)kg 증량 예상 기간/);
    if (kgIncMatch) {
      const incKg = parseInt(kgIncMatch[1]);
      const byEx = calcE1RMTrendByExercise(h);
      const allLifts = [
        { name: "bench", label: "벤치", profile: p.bench1RM || 0, tracked: byEx.find(e => e.name === "bench") },
        { name: "squat", label: "스쿼트", profile: p.squat1RM || 0, tracked: byEx.find(e => e.name === "squat") },
        { name: "deadlift", label: "데드", profile: p.deadlift1RM || 0, tracked: byEx.find(e => e.name === "deadlift") },
      ];
      const results = allLifts
        .filter(lift => lift.profile > 0 || lift.tracked)
        .map(lift => {
          const current = Math.max(lift.profile, lift.tracked?.lastE1RM || 0);
          const target = current + incKg;
          const growth = (lift.tracked?.growthPerWeek || 0) > 0 ? lift.tracked!.growthPerWeek : 2.5;
          const weeksNeeded = Math.ceil(incKg / growth);
          const duration = weeksNeeded > 12 ? `${Math.round(weeksNeeded / 4)}개월` : `${weeksNeeded}주`;
          return `${lift.label} → ${target}kg (${duration})`;
        });
      if (results.length === 0) return { value: "1RM 입력 또는 운동 기록 필요", action: "edit_1rm" };
      return {
        value: results.join("\n"),
        sub: `각 종목별 성장률 기준`,
      };
    }

    // ── 기초 체력: 체력 테스트 기반 등급 ──
    if (label.includes("현재 기초체력 등급")) {
      try {
        const testHistory = JSON.parse(localStorage.getItem("ohunjal_fitness_test_history") || "[]");
        if (testHistory.length > 0) {
          const latest = testHistory[testHistory.length - 1];
          const gradeLabels = ["", "최우수", "우수", "양호", "보통", "미흡"];
          return {
            value: `종합 평가 : ${gradeLabels[latest.overallGrade]} (${latest.overallGrade}등급)`,
            sub: `푸쉬업 ${latest.pushups}회(${gradeLabels[latest.pushupGrade]}) · 크런치 ${latest.crunches}회(${gradeLabels[latest.crunchGrade]}) · 스쿼트 ${latest.squats}회(${gradeLabels[latest.squatGrade]})`,
            action: "fitness_test",
          };
        }
      } catch { /* ignore */ }
      return { value: "체력 테스트를 완료하면 등급이 표시됩니다", sub: "푸쉬업 · 크런치 · 맨몸 스쿼트 (각 2분)", action: "fitness_test" };
    }
    if (label.includes("다음 등급 도달 예상 기간") || label.includes("2단계 상위 등급 도달 예상 기간") || label.includes("최고 등급 도달 예상 기간")) {
      return { value: "체력 테스트 2회 이상 필요", sub: "테스트를 반복하면 성장 추세를 예측합니다" };
    }

    // ── 건강 유지: 분석 모드 ──
    if (label.includes("WHO 권장 운동량 달성률")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      if (cs.weeks === 0) return { value: "운동 기록이 쌓이면 분석 가능" };
      const actualWeeklyMin = Math.round(cs.avgWeeklyFreq * p.sessionMinutes);
      const target = 150;
      const pct = Math.min(200, Math.round((actualWeeklyMin / target) * 100));
      const status = pct >= 100 ? "✅ 잘하고 있어요" : pct >= 70 ? "⚠️ 조금만 더" : "❌ 운동량 부족";
      return { value: `${pct}% 달성 ${status}`, sub: `주 ${actualWeeklyMin}분 / 권장 ${target}분` };
    }
    if (label.includes("운동 빈도 분석")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      if (cs.weeks === 0) return { value: "운동 기록이 쌓이면 분석 가능" };
      const status = cs.avgWeeklyFreq >= 3 ? "✅ 충분한 빈도" : cs.avgWeeklyFreq >= 2 ? "⚠️ 권장 기준 충족" : "❌ 빈도를 늘려보세요";
      return { value: `주 평균 ${cs.avgWeeklyFreq}회 ${status}`, sub: `보건복지부 권장: 주 2회 이상 근력운동` };
    }
    if (label.includes("운동 일관성 분석")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      if (cs.weeks < 4) return { value: "4주 이상 기록이 필요합니다" };
      const status = cs.score >= 80 ? "✅ 꾸준히 잘하고 있어요" : cs.score >= 50 ? "⚠️ 일관성 유지 필요" : "❌ 불규칙한 패턴";
      return { value: `출석률 ${cs.score}% ${status}`, sub: `최근 ${cs.weeks}주 기준` };
    }
    if (label.includes("근육군 밸런스 분석")) {
      const big3 = calcBig3VolumeBalance(h);
      if (!big3) return { value: "운동 기록이 더 쌓이면 분석 가능" };
      const { bench, squat, deadlift } = big3.percentages;
      const min = Math.min(bench, squat, deadlift);
      const status = min >= 20 ? "✅ 균형 잡힌 운동" : "⚠️ 밸런스 주의";
      return { value: `벤치 ${bench}% · 스쿼트 ${squat}% · 데드 ${deadlift}% ${status}`, sub: big3.weakest ? `${big3.weakest === "bench" ? "벤치" : big3.weakest === "squat" ? "스쿼트" : "데드리프트"} 보강 필요` : "이상적 비율: 각 33% 내외" };
    }

    return { value: "운동 기록이 쌓이면 예측 가능" };
  });

  return { typeName, typeEmoji, message, growthStars: stars, predictions, condition: conditionStr };
}

/* ─── 회귀분석 그래프 ─── */
