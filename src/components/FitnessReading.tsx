"use client";

import React, { useState, useEffect } from "react";
import { saveUserProfile, updateGender, updateBirthYear, updateWeight } from "@/utils/userProfile";
import { WorkoutHistory } from "@/constants/workout";
import {
  calcConsistencyScore,
  calcVolumeGrowthRate,
  calcCaloriesTrend,
  calcE1RMTrend,
  calcWeightTrend,
  detectPlateau,
  linearRegression,
  dateToDayIndex,
} from "@/utils/predictionUtils";

/* ─── types ─── */
export interface FitnessProfile {
  gender: "male" | "female";
  birthYear: number;
  bodyWeight: number;
  weeklyFrequency: number;       // 주 몇 회
  sessionMinutes: number;        // 1회 운동 시간(분)
  goal: "fat_loss" | "muscle_gain" | "endurance" | "health";
  bench1RM?: number;             // 상급자 선택 입력
  squat1RM?: number;
  deadlift1RM?: number;
}

interface Props {
  userName: string;
  onComplete: (profile: FitnessProfile) => void;
  onPremium?: () => void;
  isPremium?: boolean;
  resultOnly?: boolean;
  onBack?: () => void;
  workoutCount?: number;
  workoutHistory?: WorkoutHistory[];
  weightLog?: { date: string; weight: number }[];
  onEdit1RM?: () => void;
}

/* ─── constants ─── */
const FREQ_OPTIONS = [
  { value: 0, label: "안 해봤어요", sub: "처음이에요" },
  { value: 2, label: "주 1~2회", sub: "가볍게" },
  { value: 3, label: "주 3~4회", sub: "꾸준히" },
  { value: 5, label: "주 5회+", sub: "열심히" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30분-" },
  { value: 50, label: "50분" },
  { value: 60, label: "60분" },
  { value: 90, label: "90분+" },
];

const GOAL_OPTIONS: { value: FitnessProfile["goal"]; label: string }[] = [
  { value: "fat_loss", label: "체지방 감량" },
  { value: "muscle_gain", label: "근력 증가" },
  { value: "endurance", label: "기초 체력" },
  { value: "health", label: "건강 유지" },
];

/* ─── Phase 기반 예측 항목 ─── */
// Phase 0: 프로필 데이터만으로 (가이드라인 비교, 공식 기반 추정)
// Phase 1: 3회 운동 후 (초기 트렌드)
// Phase 2: 10회 운동 후 (ML 예측)

type UserLevel = "beginner" | "advanced";

interface PredictionItem {
  label: string;
  phase: 0 | 1 | 2 | 3;    // 0=즉시, 1=5회, 2=10회, 3=20회
  source: string;            // 근거 출처
}

const PHASE_THRESHOLDS = [0, 5, 10, 20]; // 각 Phase별 필요 운동 횟수

interface GoalPrediction {
  title: string;
  beginner: PredictionItem[];
  advanced: PredictionItem[];
}

const PREDICTIONS_BY_GOAL: Record<string, GoalPrediction> = {
  fat_loss: {
    title: "체지방 감량",
    beginner: [
      { label: "주간 예상 운동 칼로리 소모", phase: 0, source: "ACSM MET Tables (Ainsworth 2011)" },
      { label: "4주 후 예상 체중", phase: 1, source: "운동 볼륨 × MET 기반 칼로리 적자 추정" },
      { label: "목표 체중 도달 예측", phase: 2, source: "체중 로그 선형 회귀" },
      { label: "감량 정체기 예측", phase: 3, source: "체중 로그 + 볼륨 데이터 회귀분석" },
    ],
    advanced: [
      { label: "안전한 주간 체중 감량 속도", phase: 0, source: "Helms et al. 2014 (ISSN)" },
      { label: "목표 체중까지 예상 소요 기간", phase: 1, source: "운동 볼륨 × 칼로리 적자 추정" },
      { label: "체중 변화 정밀 예측", phase: 2, source: "체중 로그 회귀분석" },
      { label: "근손실 없는 최적 감량 구간", phase: 3, source: "볼륨 · 체중 · 강도 상관분석" },
    ],
  },
  muscle_gain: {
    title: "근력 증가",
    beginner: [
      { label: "근력 향상 체감 예상 시점", phase: 0, source: "NSCA Essentials 4th ed., ACSM 2009" },
      { label: "중급자 진입까지 예상 기간", phase: 1, source: "e1RM 성장률 기반 추정" },
      { label: "주요 종목 e1RM 도달 예측", phase: 2, source: "세션별 e1RM 선형 회귀" },
      { label: "근력 정체기 예상 시점", phase: 3, source: "e1RM + 볼륨 변화율 회귀분석" },
    ],
    advanced: [
      { label: "현재 근력 수준 평가", phase: 0, source: "ExRx/NSCA Strength Standards" },
      { label: "1RM 목표 도달까지 예상 기간", phase: 1, source: "e1RM 성장률 기반 추정" },
      { label: "e1RM 성장 곡선 및 목표 예측", phase: 2, source: "세션별 e1RM 회귀분석" },
      { label: "다음 레벨 진입 예측", phase: 3, source: "e1RM 성장률 + 체중 데이터 회귀분석" },
    ],
  },
  endurance: {
    title: "기초 체력",
    beginner: [
      { label: "ACSM 권장 유산소 운동량 달성률", phase: 0, source: "ACSM Position Stand 2011" },
      { label: "ACSM 권장량 완전 충족까지 예상 기간", phase: 1, source: "운동 빈도 추세 기반 추정" },
      { label: "동년배 상위 체력 도달 예측", phase: 2, source: "HUNT Study + 운동 데이터 기반" },
      { label: "VO2max 향상 예측", phase: 3, source: "운동량 · 강도 · 빈도 회귀분석" },
    ],
    advanced: [
      { label: "ACSM 권장 유산소 운동량 달성률", phase: 0, source: "ACSM Position Stand 2011" },
      { label: "현재 페이스 기준 VO2max 도달 예측", phase: 1, source: "HERITAGE Study + 운동 데이터" },
      { label: "동년배 상위 체력 순위 예측", phase: 2, source: "HUNT Study + 강도·볼륨 상관분석" },
      { label: "심폐능력 성장 곡선 예측", phase: 3, source: "ACSM/HERITAGE 모델 + 운동 데이터" },
    ],
  },
  health: {
    title: "건강 유지",
    beginner: [
      { label: "WHO 권장 운동량 달성률", phase: 0, source: "WHO Physical Activity Guidelines 2020" },
      { label: "이 패턴 유지 시 동년배 체력 순위", phase: 1, source: "HUNT Study + 운동 빈도 데이터" },
      { label: "추정 피트니스 나이", phase: 2, source: "HUNT Study + 운동 데이터 기반" },
      { label: "피트니스 나이 변화 예측", phase: 3, source: "운동량 · 체중 · 빈도 회귀분석" },
    ],
    advanced: [
      { label: "WHO 권장 운동량 달성률", phase: 0, source: "WHO Physical Activity Guidelines 2020" },
      { label: "이 패턴 유지 시 건강 위험 감소 예측", phase: 1, source: "WHO 2020 + 운동 데이터" },
      { label: "추정 피트니스 나이 + 심혈관 위험 감소율", phase: 2, source: "HUNT Study + WHO 2020" },
      { label: "장기 건강 개선 예측", phase: 3, source: "종합 데이터 회귀분석" },
    ],
  },
};

/* ─── 과학적 계산 함수 ─── */

/** VO2max 추정 — ACSM 연령/성별 기준표 기반
 *  HUNT 공식은 RHR·허리둘레 등 미보유 데이터가 필요하여 과대추정 위험이 큼.
 *  대신 ACSM 연령별 평균 VO2max 표를 기준으로,
 *  운동 빈도에 따라 ±보정하는 방식을 사용.
 *
 *  ACSM 남성 평균 VO2max (mL/kg/min):
 *    20대: 43, 30대: 40, 40대: 37, 50대: 34, 60대+: 30
 *  여성: 약 -8 (ACSM)
 *
 *  운동 빈도 보정: 비활동 -5, 주1~2회 ±0, 주3~4회 +3, 주5+ +5
 *  BMI 보정: BMI 25 초과 시 초과분 × -0.5
 */
function estimateVO2max(age: number, weight: number, heightEstimate: number, weeklyFreq: number, gender: "male" | "female"): number {
  // ACSM 연령별 평균 (남성)
  const maleBaseline = age < 30 ? 43 : age < 40 ? 40 : age < 50 ? 37 : age < 60 ? 34 : 30;
  const baseline = gender === "male" ? maleBaseline : maleBaseline - 8;

  // 운동 빈도 보정
  const freqAdj = weeklyFreq === 0 ? -5 : weeklyFreq <= 2 ? 0 : weeklyFreq <= 4 ? 3 : 5;

  // BMI 보정 (과체중 패널티)
  const bmi = weight / ((heightEstimate / 100) ** 2);
  const bmiAdj = bmi > 25 ? -(bmi - 25) * 0.5 : 0;

  const vo2 = baseline + freqAdj + bmiAdj;
  return Math.round(Math.max(15, Math.min(65, vo2)) * 10) / 10;
}

/** VO2max 기반 피트니스 나이 (HUNT Study, Nes 2013)
 *  해당 VO2max가 평균인 연령을 역산
 */
function fitnessAge(vo2max: number, gender: "male" | "female"): number {
  // 평균 VO2max: 남성 ~45 (20세) → ~30 (60세), 여성 ~38 (20세) → ~25 (60세)
  let age: number;
  if (gender === "male") {
    age = Math.round((45 - vo2max) / 0.375 + 20);
  } else {
    age = Math.round((38 - vo2max) / 0.325 + 20);
  }
  return Math.max(18, Math.min(80, age));
}

/** ACSM MET 기반 칼로리 소모 추정 (Ainsworth et al., 2011)
 *  일반 저항운동: 3.5-6.0 MET, 유산소: 4.0-8.0 MET
 *  칼로리 = MET × 체중(kg) × 시간(h)
 */
function estimateSessionCalories(weight: number, minutes: number, goal: string): { low: number; high: number } {
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
function assessStrengthLevel(lift: "bench" | "squat" | "deadlift", oneRM: number, bw: number, gender: "male" | "female"):
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

/** 키 추정 (국민건강영양조사 2022 평균)
 *  실제 키 데이터가 없으므로 성별/연령 평균 사용
 */
function estimateHeight(gender: "male" | "female", age: number): number {
  if (gender === "male") {
    if (age < 30) return 174;
    if (age < 40) return 173;
    if (age < 50) return 172;
    return 170;
  }
  if (age < 30) return 161;
  if (age < 40) return 160;
  if (age < 50) return 159;
  return 157;
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
  action?: "edit_1rm";
  strengthBars?: StrengthBar[];  // 근력 수준 바 데이터
}

interface ReadingResult {
  typeName: string;
  typeEmoji: string;
  message: string;
  growthStars: number;
  predictions: PredictionResult[];
  condition: string;
}

function computeReading(
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

  const message =
    p.weeklyFrequency === 0
      ? "처음이라면 지금이 가장 좋은 시작입니다\n초보자일수록 성장 속도가 빠릅니다"
      : acsmPct >= 150
        ? "당신의 조건은\n빠른 변화를 만들기에 충분합니다"
        : acsmPct >= 100
          ? "당신의 조건은\n변화를 만들기에 충분합니다"
          : "작은 시작이\n가장 큰 변화를 만듭니다";

  // 항목 선택
  const isBeginner = p.weeklyFrequency <= 2;
  const level: UserLevel = isBeginner ? "beginner" : "advanced";
  const goalItems = PREDICTIONS_BY_GOAL[p.goal]?.[level] || [];

  const conditionStr = p.weeklyFrequency === 0
    ? "운동 시작 후 측정"
    : `하루 ${p.sessionMinutes}분, 주 ${p.weeklyFrequency}회 기준`;

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

    // 근력: 근력 향상 체감 시점
    if (label.includes("근력 향상 체감 예상 시점")) {
      return {
        value: "힘 느는 시점: 2~4주 / 근육 크는 시점: 8~12주",
        sub: p.weeklyFrequency >= 3 ? "현재 빈도로 충분합니다" : "주 2회 이상 추천",
      };
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

    // Phase 2+: 추정 VO2max (운동 데이터 기반으로만)
    if (label.includes("추정 VO2max")) {
      const hEst = estimateHeight(p.gender, age);
      const v = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const vo2Level = v >= 45 ? "우수" : v >= 35 ? "보통" : "개선 필요";
      return {
        value: `심폐 체력 ${v}점 (${vo2Level})`,
        sub: `${p.gender === "male" ? "남" : "여"}성 ${age}세 기준`,
      };
    }

    // Phase 2+: 추정 피트니스 나이 + 심혈관 위험 감소율 (복합)
    if (label.includes("피트니스 나이") && label.includes("심혈관")) {
      const hEst = estimateHeight(p.gender, age);
      const v = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const fAge = fitnessAge(v, p.gender);
      const riskReduction = weeklyMin >= 300 ? "35~40%" : weeklyMin >= 150 ? "25~30%" : "10~20%";
      return {
        value: `체력 나이 ${fAge}세 (실제 ${age}세)`,
        sub: `심혈관 질환 위험 ${riskReduction} 감소 예상`,
      };
    }

    // Phase 2+: 추정 피트니스 나이
    if (label.includes("피트니스 나이")) {
      const hEst = estimateHeight(p.gender, age);
      const v = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const fAge = fitnessAge(v, p.gender);
      return {
        value: `체력 나이 ${fAge}세 (실제 ${age}세)`,
        sub: v >= 40 ? "심폐 체력 양호" : "운동으로 개선 가능",
      };
    }

    // ── Phase 1 (5회): 미래 예측 (운동 데이터 기반) ──
    const h = history || [];
    const wl = weightLog || [];

    // 감량 초보: 4주 후 예상 체중
    if (label.includes("4주 후 예상 체중")) {
      const trend = calcCaloriesTrend(h, p.bodyWeight);
      if (trend.length < 2) return { value: `${2 - trend.length}회 더 운동하면 예측 가능` };
      const avgCal = Math.round(trend.reduce((s, t) => s + t.calories, 0) / trend.length);
      const weeklyBurn = avgCal * p.weeklyFrequency;
      const weeklyLossKg = Math.round((weeklyBurn / 7700) * 100) / 100; // 7700kcal ≈ 1kg
      const pred4w = Math.round((p.bodyWeight - weeklyLossKg * 4) * 10) / 10;
      return {
        value: `4주 후 예상: ${pred4w}kg`,
        sub: `매주 약 ${weeklyLossKg.toFixed(1)}kg씩 빠지는 페이스`,
      };
    }

    // 감량 상급: 목표 체중까지 예상 소요 기간
    if (label.includes("목표 체중까지 예상 소요 기간")) {
      const trend = calcCaloriesTrend(h, p.bodyWeight);
      if (trend.length < 2) return { value: `${2 - trend.length}회 더 운동하면 예측 가능` };
      const avgCal = Math.round(trend.reduce((s, t) => s + t.calories, 0) / trend.length);
      const weeklyBurn = avgCal * p.weeklyFrequency;
      const weeklyLossKg = weeklyBurn / 7700;
      // 안전 감량 목표: 현재 체중의 5~10% 감량
      const targetWeight = Math.round(p.bodyWeight * 0.9 * 10) / 10;
      const kgToLose = p.bodyWeight - targetWeight;
      const weeksNeeded = weeklyLossKg > 0 ? Math.ceil(kgToLose / weeklyLossKg) : 0;
      return {
        value: weeksNeeded > 0 ? `${targetWeight}kg까지 약 ${weeksNeeded}주` : "운동량 증가 필요",
        sub: `현재 ${p.bodyWeight}kg에서 ${kgToLose.toFixed(1)}kg 감량 목표`,
      };
    }

    // 근력 초보: 중급자 진입까지 예상 기간
    if (label.includes("중급자 진입까지 예상 기간")) {
      const e1t = calcE1RMTrend(h);
      // 프로필 1RM fallback: 운동 기록 부족 시 프로필 1RM + 표준 초보자 성장률 사용
      const currentE1RM = e1t?.lastE1RM ?? Math.max(p.bench1RM || 0, p.squat1RM || 0, p.deadlift1RM || 0);
      const growth = (e1t && e1t.growthPerWeek > 0) ? e1t.growthPerWeek : 2.5; // NSCA 초보자 주간 성장률
      if (currentE1RM <= 0) return { value: "1RM 입력 또는 운동 기록 필요", action: "edit_1rm" };
      // 중급 기준: 벤치 체중×1.0 (ExRx)
      const intermediateTarget = p.bodyWeight * 1.0;
      const remaining = intermediateTarget - currentE1RM;
      if (remaining <= 0) return { value: "이미 중급 수준 도달" };
      const weeksToTarget = Math.ceil(remaining / growth);
      return {
        value: `중급 진입까지 약 ${weeksToTarget}주`,
        sub: `지금 ${currentE1RM}kg → 목표 ${Math.round(intermediateTarget)}kg`,
      };
    }

    // 근력 상급: 1RM 목표 도달까지 예상 기간
    if (label.includes("1RM 목표 도달까지 예상 기간")) {
      const e1t = calcE1RMTrend(h);
      // 프로필 1RM fallback: 운동 기록 부족 시 프로필 1RM + 상급자 성장률 사용
      const currentE1RM = e1t?.lastE1RM ?? Math.max(p.bench1RM || 0, p.squat1RM || 0, p.deadlift1RM || 0);
      const growth = (e1t && e1t.growthPerWeek > 0) ? e1t.growthPerWeek : 1.0; // 상급자 주간 성장률 (보수적)
      if (currentE1RM <= 0) return { value: "1RM을 입력하면 예측 가능", action: "edit_1rm" };
      const targets = [
        { name: "벤치 중급", target: p.bodyWeight * 1.0 },
        { name: "스쿼트 중급", target: p.bodyWeight * 1.25 },
        { name: "데드 중급", target: p.bodyWeight * 1.5 },
      ];
      const closest = targets
        .map(t => ({ ...t, weeksLeft: Math.max(0, Math.ceil((t.target - currentE1RM) / growth)) }))
        .filter(t => t.weeksLeft > 0)
        .sort((a, b) => a.weeksLeft - b.weeksLeft);
      if (closest.length === 0) return { value: "모든 중급 기준 달성" };
      const next = closest[0];
      return {
        value: `${next.name} (${Math.round(next.target)}kg)까지 약 ${next.weeksLeft}주`,
        sub: `지금 최고 ${currentE1RM}kg, 매주 +${growth}kg씩 성장 중`,
      };
    }

    // 체력 초보: ACSM 권장량 완전 충족까지
    if (label.includes("ACSM 권장량 완전 충족까지 예상 기간")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      if (cs.weeks === 0) return { value: "운동 기록이 쌓이면 예측 가능" };
      const currentWeeklyMin = cs.avgWeeklyFreq * p.sessionMinutes;
      const target = 150; // ACSM 권장
      if (currentWeeklyMin >= target) {
        return { value: "이미 권장 운동량 충족", sub: `주 ${Math.round(currentWeeklyMin)}분 운동 중` };
      }
      const gap = target - currentWeeklyMin;
      const addSessionsNeeded = Math.ceil(gap / p.sessionMinutes);
      return {
        value: `주 ${addSessionsNeeded}회만 더 하면 충족`,
        sub: `현재 주 ${Math.round(currentWeeklyMin)}분 → 목표 150분`,
      };
    }

    // 체력 상급: 현재 페이스 기준 VO2max 도달 예측
    if (label.includes("현재 페이스 기준 VO2max 도달 예측")) {
      const hEst = estimateHeight(p.gender, age);
      const currentVO2 = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const weeksTraining = Math.round(wkCount / Math.max(1, p.weeklyFrequency));
      const expectedGainPct = Math.min(20, weeksTraining * 0.75);
      const predicted12w = Math.round(currentVO2 * (1 + Math.min(0.2, (weeksTraining + 12) * 0.0075)) * 10) / 10;
      const targetVO2 = 45; // 우수 기준
      const weeksToTarget = currentVO2 < targetVO2 && expectedGainPct > 0
        ? Math.ceil(((targetVO2 - currentVO2) / currentVO2) / 0.0075)
        : 0;
      return {
        value: weeksToTarget > 0 ? `체력 우수 등급까지 약 ${weeksToTarget}주` : `이미 우수 수준`,
        sub: `심폐 체력 ${currentVO2}점 → 12주 후 ${predicted12w}점 예상`,
      };
    }

    // 건강 초보: 이 패턴 유지 시 동년배 체력 순위
    if (label.includes("이 패턴 유지 시 동년배 체력 순위")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      if (cs.weeks === 0) return { value: "운동 기록이 쌓이면 예측 가능" };
      const percentile = cs.avgWeeklyFreq >= 4 ? "상위 20%" : cs.avgWeeklyFreq >= 3 ? "상위 30%" : cs.avgWeeklyFreq >= 2 ? "상위 50%" : "상위 70%";
      return {
        value: `같은 나이 중 ${percentile} 체력`,
        sub: `주 평균 ${cs.avgWeeklyFreq}회 운동 기준`,
      };
    }

    // 건강 상급: 이 패턴 유지 시 건강 위험 감소 예측
    if (label.includes("이 패턴 유지 시 건강 위험 감소 예측")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      if (cs.weeks === 0) return { value: "운동 기록이 쌓이면 예측 가능" };
      const actualWeeklyMin = cs.avgWeeklyFreq * p.sessionMinutes;
      const riskReduction = actualWeeklyMin >= 300 ? "35~40%" : actualWeeklyMin >= 150 ? "25~30%" : "10~20%";
      return {
        value: `심혈관 질환 위험 ${riskReduction} 감소`,
        sub: `주 ${Math.round(actualWeeklyMin)}분 운동 중`,
      };
    }

    // ── Phase 2 (10회): 정밀 예측 (선형 회귀 기반) ──

    // 감량: 목표 체중 도달 예측
    if (label.includes("목표 체중 도달 예측")) {
      const wt = calcWeightTrend(wl);
      if (!wt) return { value: `체중 기록 ${3 - wl.length}개 더 필요` };
      if (wt.weeklyChange >= 0) return { value: "현재 체중 유지 또는 증가 추세", sub: "운동량 증가 또는 식단 조절 권장" };
      const targetWeight = Math.round(p.bodyWeight * 0.9 * 10) / 10;
      const kgToLose = p.bodyWeight - targetWeight;
      const weeksNeeded = Math.ceil(kgToLose / Math.abs(wt.weeklyChange));
      return {
        value: `${targetWeight}kg 도달까지 약 ${weeksNeeded}주`,
        sub: `매주 약 ${Math.abs(wt.weeklyChange)}kg씩 빠지는 중`,
      };
    }

    // 감량 상급: 체중 변화 정밀 예측
    if (label.includes("체중 변화 정밀 예측")) {
      const wt = calcWeightTrend(wl);
      if (!wt) return { value: `체중 기록 ${3 - wl.length}개 더 필요` };
      const pred4w = wt.predictInWeeks(4);
      const pred8w = wt.predictInWeeks(8);
      const safe = Math.abs(wt.weeklyChange) <= p.bodyWeight * 0.01;
      return {
        value: `4주 후 ${pred4w}kg / 8주 후 ${pred8w}kg`,
        sub: `매주 ${wt.weeklyChange > 0 ? "+" : ""}${wt.weeklyChange}kg${safe ? " · 안전 범위" : " · 급변 주의"}`,
      };
    }

    // 근력 초보: 주요 종목 e1RM 도달 예측
    if (label.includes("주요 종목 e1RM 도달 예측")) {
      const e1t = calcE1RMTrend(h);
      const currentE1RM = e1t?.lastE1RM ?? Math.max(p.bench1RM || 0, p.squat1RM || 0, p.deadlift1RM || 0);
      const growth = (e1t && e1t.growthPerWeek > 0) ? e1t.growthPerWeek : 2.5;
      if (currentE1RM <= 0) return { value: "1RM을 입력하면 예측 가능", action: "edit_1rm" };
      const targets = [
        { name: "벤치 체중×1배", target: p.bodyWeight * 1.0 },
        { name: "스쿼트 체중×1.25배", target: p.bodyWeight * 1.25 },
      ];
      const predictions = targets
        .map(t => {
          const remaining = t.target - currentE1RM;
          if (remaining <= 0) return `${t.name} 달성`;
          const weeks = Math.ceil(remaining / growth);
          return `${t.name} ${Math.round(t.target)}kg → ${weeks}주`;
        });
      return {
        value: predictions.join(" / "),
        sub: `지금 최고 ${currentE1RM}kg, 매주 +${growth}kg씩 성장`,
      };
    }

    // 근력 상급: e1RM 성장 곡선 및 목표 예측
    if (label.includes("e1RM 성장 곡선 및 목표 예측")) {
      const e1t = calcE1RMTrend(h);
      if (!e1t) {
        const profile1RM = Math.max(p.bench1RM || 0, p.squat1RM || 0, p.deadlift1RM || 0);
        if (profile1RM <= 0) return { value: "1RM을 입력하면 예측 가능", action: "edit_1rm" };
        const estGrowth = 1.0;
        const pred4w = Math.round((profile1RM + estGrowth * 4) * 10) / 10;
        return {
          value: `4주 후 최대 중량 ${pred4w}kg 예상`,
          sub: `지금 ${profile1RM}kg, 매주 +${estGrowth}kg 성장 기준`,
        };
      }
      const pred4w = Math.round(e1t.regression.predict(e1t.regression.intercept + 28) * 10) / 10;
      return {
        value: `4주 후 최대 중량 ${pred4w}kg 예상`,
        sub: `${e1t.firstE1RM}kg → ${e1t.lastE1RM}kg, 매주 +${e1t.growthPerWeek}kg 성장`,
      };
    }

    // 체력: 동년배 상위 체력 도달 예측
    if (label.includes("동년배 상위 체력 도달 예측")) {
      const hEst = estimateHeight(p.gender, age);
      const currentVO2 = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const fAge = fitnessAge(currentVO2, p.gender);
      const diff = age - fAge;
      return {
        value: diff > 0 ? `동년배보다 ${diff}살 젊은 체력` : `실제 나이와 동일한 체력`,
        sub: `체력 나이 ${fAge}세 (실제 ${age}세)`,
      };
    }

    // 체력 상급: 동년배 상위 체력 순위 예측
    if (label.includes("동년배 상위 체력 순위 예측")) {
      const hEst = estimateHeight(p.gender, age);
      const currentVO2 = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const weeksTraining = Math.round(wkCount / Math.max(1, p.weeklyFrequency));
      const futureVO2 = Math.round(currentVO2 * (1 + Math.min(0.2, (weeksTraining + 12) * 0.0075)) * 10) / 10;
      const percentile = futureVO2 >= 50 ? "상위 10%" : futureVO2 >= 45 ? "상위 20%" : futureVO2 >= 40 ? "상위 30%" : "상위 50%";
      return {
        value: `12주 후 같은 나이 중 ${percentile} 예상`,
        sub: `심폐 체력 ${currentVO2}점 → ${futureVO2}점`,
      };
    }

    // ── Phase 3 (20회): 정체기 감지 + 장기 예측 ──

    if (label.includes("감량 정체기 예측")) {
      const wt = calcWeightTrend(wl);
      if (!wt || wl.length < 5) return { value: `체중 기록 ${5 - wl.length}개 더 필요` };
      const plateau = detectPlateau(wl.map(w => ({ date: w.date, value: w.weight })), 5);
      if (plateau?.isPlateau) {
        return {
          value: `${plateau.durationDays}일째 정체 중`,
          sub: "운동량을 늘리거나 식단을 점검해보세요",
        };
      }
      return {
        value: `순조롭게 진행 중`,
        sub: `4주 후 ${wt.predictInWeeks(4)}kg 예상`,
      };
    }

    // 감량 상급: 근손실 없는 최적 감량 구간
    if (label.includes("근손실 없는 최적 감량 구간")) {
      const avgSets = h.length > 0 ? Math.round(h.reduce((s, x) => s + x.stats.totalSets, 0) / h.length) : 0;
      const weeklySets = avgSets * p.weeklyFrequency;
      const mev = 10;
      const safe = weeklySets >= mev;
      const wt = calcWeightTrend(wl);
      const weeklyLoss = wt ? Math.abs(wt.weeklyChange) : 0;
      const safeLoss = weeklyLoss <= p.bodyWeight * 0.01;
      return {
        value: safe && safeLoss ? `근육 지키면서 안전하게 빠지는 중` : `페이스 조정 필요`,
        sub: safe ? `주 ${weeklySets}세트로 근육 유지 충분` : `주 ${weeklySets}세트 — 세트 수를 늘려보세요`,
      };
    }

    if (label.includes("근력 정체기 예상")) {
      const e1t = calcE1RMTrend(h);
      if (!e1t) return { value: "운동 기록이 더 쌓이면 분석 가능" };
      const plateau = detectPlateau(
        h.filter(s => s.stats.bestE1RM).map(s => ({ date: s.date, value: s.stats.bestE1RM! })),
        5
      );
      if (plateau?.isPlateau) {
        return {
          value: `${plateau.durationDays}일째 성장 정체 중`,
          sub: "쉬는 주간이나 프로그램 변경을 추천합니다",
        };
      }
      return {
        value: `꾸준히 성장 중 — 매주 +${e1t.growthPerWeek}kg`,
        sub: e1t.growthPerWeek < 0.5 ? "성장이 느려지는 구간 — 프로그램 점검 추천" : "현재 프로그램 유지 추천",
      };
    }

    if (label.includes("1RM 목표 도달 예측")) {
      const e1t = calcE1RMTrend(h);
      const currentE1RM = e1t?.lastE1RM ?? Math.max(p.bench1RM || 0, p.squat1RM || 0, p.deadlift1RM || 0);
      const growth = (e1t && e1t.growthPerWeek > 0) ? e1t.growthPerWeek : 1.0;
      if (currentE1RM <= 0) return { value: "1RM을 입력하면 예측 가능", action: "edit_1rm" };
      const targets = [
        { name: "벤치 중급", target: p.bodyWeight * 1.0 },
        { name: "스쿼트 중급", target: p.bodyWeight * 1.25 },
        { name: "데드 중급", target: p.bodyWeight * 1.5 },
      ];
      const closest = targets
        .map(t => ({ ...t, weeksLeft: Math.max(0, Math.ceil((t.target - currentE1RM) / growth)) }))
        .filter(t => t.weeksLeft > 0)
        .sort((a, b) => a.weeksLeft - b.weeksLeft);
      if (closest.length === 0) return { value: "모든 중급 기준 달성" };
      const next = closest[0];
      return {
        value: `${next.name} ${Math.round(next.target)}kg까지 약 ${next.weeksLeft}주`,
        sub: `지금 최고 ${currentE1RM}kg, 매주 +${growth}kg씩 성장 중`,
      };
    }

    if (label.includes("VO2max 향상 예측")) {
      const hEst = estimateHeight(p.gender, age);
      const currentVO2 = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const weeksTraining = Math.round(wkCount / Math.max(1, p.weeklyFrequency));
      const expectedGainPct = Math.min(20, weeksTraining * 0.75);
      const predictedVO2 = Math.round(currentVO2 * (1 + expectedGainPct / 100) * 10) / 10;
      return {
        value: `심폐 체력 약 +${Math.round(expectedGainPct)}% 향상 예상`,
        sub: `현재 ${currentVO2}점 → 12주 후 ${predictedVO2}점`,
      };
    }

    if (label.includes("심폐능력 성장 곡선")) {
      const hEst = estimateHeight(p.gender, age);
      const currentVO2 = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const weeksTraining = Math.round(wkCount / Math.max(1, p.weeklyFrequency));
      const gain4w = Math.min(20, (weeksTraining + 4) * 0.75);
      const gain12w = Math.min(20, (weeksTraining + 12) * 0.75);
      return {
        value: `4주 후 +${Math.round(gain4w)}% / 12주 후 +${Math.round(gain12w)}%`,
        sub: `심폐 체력 ${currentVO2}점 기준`,
      };
    }

    if (label.includes("피트니스 나이 변화 추세")) {
      const hEst = estimateHeight(p.gender, age);
      const currentVO2 = estimateVO2max(age, p.bodyWeight, hEst, p.weeklyFrequency, p.gender);
      const fAge = fitnessAge(currentVO2, p.gender);
      const weeksTraining = Math.round(wkCount / Math.max(1, p.weeklyFrequency));
      const futureVO2 = currentVO2 * (1 + Math.min(0.2, weeksTraining * 0.0075 + 0.09));
      const futureFAge = fitnessAge(futureVO2, p.gender);
      return {
        value: `체력 나이 ${fAge}세 → 12주 후 ${futureFAge}세`,
        sub: `실제 나이 ${age}세 기준`,
      };
    }

    if (label.includes("장기 건강 개선 예측")) {
      const cs = calcConsistencyScore(h, p.weeklyFrequency);
      const vg = calcVolumeGrowthRate(h);
      const healthScore = Math.min(100, cs.score + (vg && vg.trend === "up" ? 10 : 0));
      const riskReduction = weeklyMin >= 300 ? "35~40%" : weeklyMin >= 150 ? "25~30%" : "10~20%";
      return {
        value: `건강 점수 ${healthScore}점 / 100점`,
        sub: `심혈관 질환 위험 ${riskReduction} 감소 예상`,
      };
    }

    return { value: "운동 기록이 쌓이면 예측 가능" };
  });

  return { typeName, typeEmoji, message, growthStars: stars, predictions, condition: conditionStr };
}

/* ─── 회귀분석 그래프 ─── */
function RegressionChart({ goal, history, weightLog, profile }: {
  goal: string;
  history: WorkoutHistory[];
  weightLog: { date: string; weight: number }[];
  profile: FitnessProfile;
}) {
  // 목표별 데이터 포인트 + 회귀선 + 예측 구간 생성
  const chartData = React.useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sorted.length < 2) return null;

    let points: { x: number; y: number; label: string }[] = [];
    let yLabel = "";
    let targetLine: number | null = null;
    let targetLabel = "";

    const baseDate = sorted[0].date;

    if (goal === "fat_loss") {
      // 체중 변화 또는 칼로리 추이
      if (weightLog.length >= 2) {
        const sortedW = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
        const wBase = sortedW[0].date;
        points = sortedW.map(w => ({ x: dateToDayIndex(w.date, wBase), y: Math.round(w.weight * 10) / 10, label: `${Math.round(w.weight * 10) / 10}kg` }));
        yLabel = "체중 (kg)";
        targetLine = Math.round(profile.bodyWeight * 0.9 * 10) / 10;
        targetLabel = `목표 ${targetLine}kg`;
      } else {
        const trend = calcCaloriesTrend(sorted, profile.bodyWeight);
        if (trend.length < 2) return null;
        points = trend.map((t, i) => ({ x: i, y: Math.round(t.calories), label: `${Math.round(t.calories)}kcal` }));
        yLabel = "세션 칼로리 (kcal)";
      }
    } else if (goal === "muscle_gain") {
      // e1RM 추이 (이상치 필터링 + 반올림)
      const withE1RM = sorted.filter(s => s.stats.bestE1RM && s.stats.bestE1RM > 0);
      if (withE1RM.length < 2) return null;
      // IQR 기반 이상치 제거
      const e1vals = withE1RM.map(s => s.stats.bestE1RM!).sort((a, b) => a - b);
      const q1 = e1vals[Math.floor(e1vals.length * 0.25)];
      const q3 = e1vals[Math.floor(e1vals.length * 0.75)];
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      const filtered = withE1RM.filter(s => s.stats.bestE1RM! >= lower && s.stats.bestE1RM! <= upper);
      if (filtered.length < 2) return null;
      const e1Base = filtered[0].date;
      points = filtered.map(s => {
        const val = Math.round(s.stats.bestE1RM! * 10) / 10;
        return { x: dateToDayIndex(s.date, e1Base), y: val, label: `${val}kg` };
      });
      yLabel = "Best e1RM (kg)";
      targetLine = profile.bodyWeight * 1.0;
      targetLabel = `중급 ${Math.round(targetLine)}kg`;
    } else {
      // 체력/건강: 주간 운동 빈도 (주차별 집계)
      const weekMap = new Map<number, number>();
      sorted.forEach(s => {
        const week = Math.floor(dateToDayIndex(s.date, baseDate) / 7);
        weekMap.set(week, (weekMap.get(week) || 0) + 1);
      });
      const weeks = Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]);
      if (weeks.length < 2) return null;
      points = weeks.map(([w, freq]) => ({ x: w, y: freq, label: `${freq}회` }));
      yLabel = "주간 운동 횟수";
      targetLine = Math.ceil(150 / profile.sessionMinutes);
      targetLabel = `WHO 권장 ${targetLine}회/주`;
    }

    if (points.length < 2) return null;

    const reg = linearRegression(points.map(p => ({ x: p.x, y: p.y })));
    if (!reg) return null;

    // 예측 구간: 마지막 포인트부터 4주(28일) 또는 4주차 앞
    const lastX = points[points.length - 1].x;
    const predStep = goal === "endurance" || goal === "health" ? 4 : 28;
    const predX = lastX + predStep;
    const rawPredY = reg.predict(predX);
    // 예측값 클램핑: 음수 방지, 소수점 반올림
    const predY = Math.round(Math.max(0, rawPredY) * 10) / 10;

    return { points, reg, yLabel, targetLine, targetLabel, lastX, predX, predY };
  }, [goal, history, weightLog, profile]);

  if (!chartData) {
    return (
      <div className="bg-[#FAFBF9] rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400">{history.length === 0 ? "운동 기록 2회 이상 필요합니다" : `${2 - history.length}회만 더 운동하면 그래프가 표시됩니다`}</p>
      </div>
    );
  }

  const { points, reg, yLabel, targetLine, targetLabel, lastX, predX, predY } = chartData;

  // SVG 좌표 계산
  const W = 300, H = 160, PAD = { top: 20, right: 15, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allY = [...points.map(p => p.y), predY, ...(targetLine ? [targetLine] : [])];
  const minY = Math.max(0, Math.min(...allY) * 0.9);
  const maxY = Math.max(...allY) * 1.1;
  const rangeY = maxY - minY || 1;

  const minX = points[0].x;
  const rangeX = predX - minX || 1;

  const toSvgX = (x: number) => PAD.left + ((x - minX) / rangeX) * chartW;
  const toSvgY = (y: number) => PAD.top + (1 - (y - minY) / rangeY) * chartH;

  // 실제 데이터 점
  const dotPositions = points.map(p => ({ cx: toSvgX(p.x), cy: toSvgY(p.y), label: p.label }));

  // 회귀선 (시작 ~ 마지막 데이터)
  const regLineStart = { x: toSvgX(minX), y: toSvgY(reg.predict(minX)) };
  const regLineEnd = { x: toSvgX(lastX), y: toSvgY(reg.predict(lastX)) };

  // 예측 점선 (마지막 데이터 ~ 미래)
  const predLineEnd = { x: toSvgX(predX), y: toSvgY(predY) };

  const [showHelp, setShowHelp] = React.useState(false);

  const goalHelpMap: Record<string, string> = {
    fat_loss: "운동 기록에서 소모 칼로리를 추정하고, 체중 변화 추세를 선형 회귀로 분석합니다. 점선은 현재 추세가 유지될 경우 4주 후 예상 체중입니다.",
    muscle_gain: "매 세션의 Best e1RM(추정 1회 최대 중량)을 추적합니다. 회귀선은 근력 성장 추세이고, 점선은 이 속도로 4주 뒤 도달할 e1RM 예측입니다.",
    endurance: "주차별 운동 횟수를 집계하여 운동 습관 추세를 보여줍니다. 점선은 WHO 권장 기준 대비 현재 추세의 4주 후 예측입니다.",
    health: "주차별 운동 횟수를 집계하여 운동 습관 추세를 보여줍니다. 점선은 WHO 권장 기준 대비 현재 추세의 4주 후 예측입니다.",
  };

  const r2Explain = reg.r2 >= 0.7 ? "높은 신뢰도" : reg.r2 >= 0.4 ? "보통 신뢰도" : "낮은 신뢰도 (데이터 변동 큼)";

  return (
    <div className="bg-[#FAFBF9] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-[#1B4332]">회귀분석 예측</p>
          <button onClick={() => setShowHelp(!showHelp)} className="w-4 h-4 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
            <span className="text-[9px] font-black text-[#2D6A4F]">?</span>
          </button>
        </div>
        <p className="text-[9px] text-gray-400">R² = {Math.round(reg.r2 * 100)}% ({r2Explain})</p>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in" onClick={() => setShowHelp(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="bg-white rounded-2xl p-5 shadow-2xl mx-8 relative z-10 max-w-[320px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#1B4332]">그래프 읽는 법</p>
              <button onClick={() => setShowHelp(false)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400">✕</span>
              </button>
            </div>
            <p className="text-[12px] text-gray-600 leading-relaxed mb-4">{goalHelpMap[goal] || goalHelpMap.health}</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#2D6A4F] inline-block shrink-0" />
                <span className="text-[11px] text-[#1B4332] font-medium">실제 데이터 (운동 기록)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-5 h-0 border-t-2 border-[#2D6A4F]/60 inline-block shrink-0" />
                <span className="text-[11px] text-[#1B4332] font-medium">추세선</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-5 h-0 border-t-2 border-dashed border-[#2D6A4F]/40 inline-block shrink-0" />
                <span className="text-[11px] text-[#1B4332] font-medium">4주 후 예측</span>
              </div>
              {targetLine && (
                <div className="flex items-center gap-3">
                  <span className="w-5 h-0 border-t border-dashed border-emerald-600/50 inline-block shrink-0" />
                  <span className="text-[11px] text-[#1B4332] font-medium">목표 라인</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                <span className="font-bold text-[#2D6A4F]">R²(신뢰도)</span> — 100%에 가까울수록 예측이 정확합니다
              </p>
            </div>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
        {/* Y축 레이블 */}
        <text x={PAD.left - 5} y={PAD.top - 6} textAnchor="end" className="fill-gray-400" fontSize="8">{yLabel}</text>

        {/* Y축 눈금 */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = PAD.top + (1 - pct) * chartH;
          const val = minY + pct * rangeY;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="8">{Math.round(val)}</text>
            </g>
          );
        })}

        {/* 목표 라인 */}
        {targetLine && (
          <g>
            <line x1={PAD.left} y1={toSvgY(targetLine)} x2={W - PAD.right} y2={toSvgY(targetLine)} stroke="#059669" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
            <text x={W - PAD.right} y={toSvgY(targetLine) - 4} textAnchor="end" className="fill-emerald-600" fontSize="7" fontWeight="bold">{targetLabel}</text>
          </g>
        )}

        {/* 회귀선 (실제 구간) */}
        <line x1={regLineStart.x} y1={regLineStart.y} x2={regLineEnd.x} y2={regLineEnd.y} stroke="#2D6A4F" strokeWidth="1.5" opacity="0.6" />

        {/* 예측 점선 (미래 구간) */}
        <line x1={regLineEnd.x} y1={regLineEnd.y} x2={predLineEnd.x} y2={predLineEnd.y} stroke="#2D6A4F" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />

        {/* 예측 포인트 */}
        <circle cx={predLineEnd.x} cy={predLineEnd.y} r="4" fill="none" stroke="#2D6A4F" strokeWidth="1.5" strokeDasharray="2 2" />
        <text x={predLineEnd.x} y={predLineEnd.y - 8} textAnchor="middle" className="fill-emerald-700" fontSize="8" fontWeight="bold">{Math.round(predY * 10) / 10}</text>
        <text x={predLineEnd.x} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="7">4주 후</text>

        {/* 데이터 점 */}
        {dotPositions.map((d, i) => (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r="3" fill="#2D6A4F" />
            {/* 첫 번째와 마지막 점에만 라벨 */}
            {(i === 0 || i === dotPositions.length - 1) && (
              <text x={d.cx} y={d.cy - 7} textAnchor="middle" className="fill-gray-600" fontSize="7">{d.label}</text>
            )}
          </g>
        ))}

        {/* X축: 시작/끝 날짜 */}
        <text x={PAD.left} y={H - 5} textAnchor="start" className="fill-gray-400" fontSize="7">시작</text>
        <text x={toSvgX(lastX)} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="7">현재</text>
      </svg>
      <p className="text-[9px] text-gray-400 mt-1 text-right">
        {reg.slope > 0 ? "▲" : reg.slope < 0 ? "▼" : "—"} 주간 {goal === "muscle_gain" ? "+" : ""}{Math.round(reg.slope * 7 * 10) / 10}{goal === "fat_loss" ? "kg" : goal === "muscle_gain" ? "kg" : "회"}/주
      </p>
    </div>
  );
}

/* ─── step type ─── */
type Step = "welcome" | "profile" | "frequency" | "time" | "goal" | "onerm" | "analyzing" | "result";

/* ─── Component ─── */
const UNLOCK_THRESHOLDS = [0, 5, 10, 20];

export const FitnessReading: React.FC<Props> = ({ userName, onComplete, onPremium, isPremium, resultOnly, onBack, workoutCount = 0, workoutHistory, weightLog, onEdit1RM }) => {
  // Load saved profile for resultOnly mode
  const savedProfile = React.useMemo<FitnessProfile | null>(() => {
    if (!resultOnly) return null;
    try {
      const raw = localStorage.getItem("alpha_fitness_profile");
      if (raw) return JSON.parse(raw) as FitnessProfile;
    } catch {}
    return null;
  }, [resultOnly]);

  const [step, setStep] = useState<Step>(resultOnly && savedProfile ? "result" : "welcome");
  const [profile, setProfile] = useState<Partial<FitnessProfile>>(savedProfile || {});
  const [gender, setGender] = useState<"male" | "female" | null>(savedProfile?.gender || null);
  const [birthYear, setBirthYear] = useState(savedProfile?.birthYear?.toString() || "");
  const [bodyWeight, setBodyWeight] = useState(savedProfile?.bodyWeight?.toString() || "");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showResult, setShowResult] = useState(!!resultOnly);
  const [resultReady, setResultReady] = useState(!!resultOnly);

  // 1RM inputs (상급자용)
  const [bench1RM, setBench1RM] = useState(savedProfile?.bench1RM?.toString() || "");
  const [squat1RM, setSquat1RM] = useState(savedProfile?.squat1RM?.toString() || "");
  const [deadlift1RM, setDeadlift1RM] = useState(savedProfile?.deadlift1RM?.toString() || "");

  const displayName = userName || "회원";

  /* ─── back navigation ─── */
  const getStepOrder = (): Step[] => {
    const base: Step[] = ["welcome", "profile", "frequency", "time", "goal"];
    // 상급자(주 5+)이고 근력 목표일 때 1RM 입력 스텝 추가
    if ((profile.weeklyFrequency ?? 0) >= 3 && profile.goal === "muscle_gain") {
      base.push("onerm");
    }
    return base;
  };

  const handleBack = () => {
    const order = getStepOrder();
    const currentIdx = order.indexOf(step);
    if (currentIdx <= 0) return;
    setStep(order[currentIdx - 1]);
  };

  /* ─── step transitions ─── */
  const handleProfileNext = () => {
    if (!gender) return;
    const byNum = parseInt(birthYear.trim());
    const wNum = parseFloat(bodyWeight.trim());
    if (isNaN(byNum) || byNum < 1900) return;
    if (isNaN(wNum) || wNum <= 0) return;

    setProfile((p) => ({ ...p, gender, birthYear: byNum, bodyWeight: wNum }));
    updateGender(gender);
    updateBirthYear(byNum);
    updateWeight(wNum);
    setStep("frequency");
  };

  const handleFrequency = (v: number) => {
    setProfile((p) => ({ ...p, weeklyFrequency: v }));
    setStep("time");
  };

  const handleTime = (v: number) => {
    setProfile((p) => ({ ...p, sessionMinutes: v }));
    setStep("goal");
  };

  const handleGoal = (v: FitnessProfile["goal"]) => {
    const updated = { ...profile, goal: v };
    setProfile(updated);
    // 상급자 + 근력증가 → 1RM 입력 스텝
    if ((updated.weeklyFrequency ?? 0) >= 3 && v === "muscle_gain") {
      setStep("onerm");
    } else {
      finishOnboarding(updated as FitnessProfile);
    }
  };

  const handle1RMNext = () => {
    const bench = parseFloat(bench1RM.trim()) || undefined;
    const squat = parseFloat(squat1RM.trim()) || undefined;
    const dead = parseFloat(deadlift1RM.trim()) || undefined;
    const complete = { ...profile, bench1RM: bench, squat1RM: squat, deadlift1RM: dead } as FitnessProfile;
    setProfile(complete);
    finishOnboarding(complete);
  };

  const finishOnboarding = (complete: FitnessProfile) => {
    localStorage.setItem("alpha_fitness_profile", JSON.stringify(complete));
    localStorage.setItem("alpha_fitness_reading_done", "true");
    saveUserProfile({ fitnessProfile: complete }).catch(() => {});
    setStep("analyzing");
  };

  /* ─── fake analysis animation ─── */
  const analysisMessages = [
    `${displayName}님의 훈련 환경을 분석하고 있습니다`,
    "운동 과학 데이터를 매칭하고 있습니다",
    "성장 가능성을 계산하고 있습니다",
    "패턴 리딩을 준비하고 있습니다",
  ];

  useEffect(() => {
    if (step !== "analyzing") return;

    setAnalysisProgress(0);
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      const progress = Math.min(frame * 2.5, 100);
      setAnalysisProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setStep("result");
          setTimeout(() => setShowResult(true), 100);
        }, 400);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── result animation ─── */
  useEffect(() => {
    if (step === "result" && showResult) {
      const timer = setTimeout(() => setResultReady(true), 600);
      return () => clearTimeout(timer);
    }
  }, [step, showResult]);

  /* ─── reading ─── */
  const reading = step === "result" ? computeReading(profile as FitnessProfile, workoutCount, workoutHistory, weightLog) : null;

  /* ─── render helpers ─── */
  const renderStepIndicator = () => {
    const steps: Step[] = ["profile", "frequency", "time", "goal"];
    // 상급자 + 근력이면 onerm도 포함
    if ((profile.weeklyFrequency ?? 0) >= 3 && profile.goal === "muscle_gain") {
      steps.push("onerm");
    }
    const currentIdx = steps.indexOf(step);
    if (currentIdx < 0) return null;
    return (
      <div className="flex items-center gap-1.5 justify-center mb-6">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1 rounded-full transition-all duration-300 ${
              i <= currentIdx ? "bg-emerald-600 w-6" : "bg-gray-200 w-4"
            }`}
          />
        ))}
      </div>
    );
  };

  const questionTitle = (text: string) => (
    <h2 className="text-lg font-bold text-gray-900 text-left w-full mb-6 leading-relaxed whitespace-pre-line">
      {text}
    </h2>
  );

  const backButton = () => (
    <button
      onClick={handleBack}
      className="self-start mb-4 text-[#6B7280] text-sm flex items-center gap-1"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      이전
    </button>
  );

  const optionButton = (
    selected: boolean,
    onClick: () => void,
    children: React.ReactNode,
    key?: string,
  ) => (
    <button
      key={key}
      onClick={onClick}
      className={`w-full py-3.5 px-4 rounded-2xl border-2 text-left transition-all duration-200 ${
        selected
          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
          : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
      }`}
    >
      {children}
    </button>
  );

  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [showMLTooltip, setShowMLTooltip] = useState(false);
  const [showOtherGoals, setShowOtherGoals] = useState(false);
  const [selectedGoalKey, setSelectedGoalKey] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    if (step === "welcome") {
      const t = setTimeout(() => setWelcomeVisible(true), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  /* ─── RENDER ─── */
  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Welcome Screen */}
      {step === "welcome" && (
        <div className="flex-1 flex flex-col bg-[#FAFBF9] overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            {/* Logo */}
            <div
              className={`mb-6 transition-all duration-700 ${
                welcomeVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
            >
              <img
                src="/login-logo-kor2.png"
                alt="오운잘"
                className="h-24 object-contain"
              />
            </div>

            {/* Greeting */}
            <h1
              className={`text-[#1B4332] text-2xl font-bold text-center mb-3 transition-all duration-700 delay-200 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              {displayName}님, 환영합니다
            </h1>

            {/* Message */}
            <div
              className={`text-center mb-10 transition-all duration-700 delay-400 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <p className="text-[#6B7280] text-sm leading-loose">
                오운잘 AI는 미래 예측 모델인
              </p>
              <p className="text-[#6B7280] text-sm leading-loose">
                <button onClick={() => setShowMLTooltip(true)} className="text-[#1B4332] font-semibold underline decoration-dotted underline-offset-2"> 회귀분석 기반 머신러닝</button> 기술로
              </p>
              <p className="text-[#6B7280] text-sm leading-loose mt-2">
                당신의 <span className="text-[#1B4332] font-semibold">운동 패턴을 분석</span>하고
              </p>
              <p className="text-[#6B7280] text-sm leading-loose">
                <span className="text-[#1B4332] font-semibold">더 나은 미래의 모습</span>을 안내드립니다
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setStep("profile")}
              className={`w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all duration-700 delay-800 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              준비되었습니다
            </button>

          </div>
        </div>
      )}

      {/* Profile Step */}
      {step === "profile" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("기본 정보를 알려주세요")}
          <div className="w-full space-y-4">
            {/* Gender */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">성별</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setGender("male")}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                    gender === "male" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  남성
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                    gender === "female" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  여성
                </button>
              </div>
            </div>

            {/* Birth Year */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">출생연도</p>
              <input
                type="number"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="1995"
                className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Body Weight */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">체중</p>
              <div className="flex items-end justify-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  placeholder="70"
                  className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm font-bold text-gray-400 pb-2">kg</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 text-center font-medium mt-4">
            성별·연령·체중 기반 예측 모델에 활용됩니다
          </p>

          {/* Fixed CTA */}
          <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={handleProfileNext}
              disabled={!gender || !birthYear.trim() || !bodyWeight.trim()}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#2D6A4F] text-white hover:bg-[#1B4332] disabled:opacity-30 disabled:active:scale-100"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Question Steps */}
      {step === "frequency" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle(`${displayName}님,\n일주일에 몇 번 운동해 오셨나요?`)}
          <div className="w-full space-y-3">
            {FREQ_OPTIONS.map((o) =>
              optionButton(profile.weeklyFrequency === o.value, () => handleFrequency(o.value), (
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-xs text-gray-400">{o.sub}</span>
                </div>
              ), String(o.value))
            )}
          </div>
        </div>
      )}

      {step === "time" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("1회 운동 시간은\n어느 정도인가요?")}
          <div className="w-full grid grid-cols-2 gap-3">
            {TIME_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleTime(o.value)}
                className={`py-4 rounded-2xl border-2 font-semibold transition-all duration-200 ${
                  profile.sessionMinutes === o.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "goal" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("가장 원하는 변화는\n무엇인가요?")}
          <div className="w-full space-y-3">
            {GOAL_OPTIONS.map((o) =>
              optionButton(profile.goal === o.value, () => handleGoal(o.value), (
                <span className="font-semibold text-center w-full block">{o.label}</span>
              ), o.value)
            )}
          </div>
        </div>
      )}

      {/* 1RM Input Step (상급자 + 근력증가 목표) */}
      {step === "onerm" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("3대 운동 1RM을\n알고 계시면 입력해주세요")}
          <p className="text-[#6B7280] text-xs mb-5 -mt-3">
            모르면 비워두셔도 됩니다. 운동 데이터가 쌓이면 자동 추정됩니다.
          </p>
          <div className="w-full space-y-4">
            {[
              { label: "벤치프레스", value: bench1RM, setter: setBench1RM },
              { label: "스쿼트", value: squat1RM, setter: setSquat1RM },
              { label: "데드리프트", value: deadlift1RM, setter: setDeadlift1RM },
            ].map((lift) => (
              <div key={lift.label} className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{lift.label} 1RM</p>
                <div className="flex items-end justify-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={lift.value}
                    onChange={(e) => lift.setter(e.target.value)}
                    placeholder="—"
                    className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm font-bold text-gray-400 pb-2">kg</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-500 text-center font-medium mt-4">
            ExRx/NSCA 강도 기준표 기반 수준 평가에 활용됩니다
          </p>

          <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={handle1RMNext}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#2D6A4F] text-white hover:bg-[#1B4332]"
            >
              {bench1RM || squat1RM || deadlift1RM ? "분석 시작" : "건너뛰기"}
            </button>
          </div>
        </div>
      )}

      {/* Analyzing Animation */}
      {step === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white">
          {/* Pulse animation */}
          <div className="relative w-16 h-16 mb-8">
            <div className="absolute inset-0 rounded-full bg-[#2D6A4F]/10 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute inset-2 rounded-full bg-[#2D6A4F]/20 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-[#2D6A4F] flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <p className="text-lg font-bold text-[#1B4332] text-center">
            {displayName}님의 데이터를 분석하고 있어요
          </p>

          {/* Step checklist */}
          <div className="mt-8 space-y-3 w-full max-w-[260px]">
            {analysisMessages.map((msg, i) => {
              const currentStep = analysisProgress < 25 ? 0 : analysisProgress < 50 ? 1 : analysisProgress < 75 ? 2 : 3;
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    done ? "bg-[#2D6A4F]" : active ? "bg-[#2D6A4F]/20 animate-pulse" : "bg-gray-100"
                  }`}>
                    {done && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm transition-all duration-300 ${
                    done ? "text-[#1B4332] font-medium" : active ? "text-[#1B4332] font-medium animate-pulse" : "text-gray-300"
                  }`}>
                    {msg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result Screen */}
      {step === "result" && reading && (() => {
        const fp = profile as FitnessProfile;
        const freqLabel = fp.weeklyFrequency === 0 ? "입문" : `주 ${fp.weeklyFrequency}회`;
        const age = new Date().getFullYear() - fp.birthYear;
        const genderLabel = fp.gender === "male" ? "남" : "여";

        return (
          <div className="flex-1 flex flex-col bg-[#FAFBF9] min-h-0">
            {/* Fixed Header */}
            {resultOnly && onBack && (
              <div className="shrink-0 pt-5 pb-3 px-6 flex items-center justify-between bg-[#FAFBF9]">
                <button onClick={onBack} className="p-2 -ml-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-[#2D6A4F]">성장 예측</span>
                <div className="w-9" />
              </div>
            )}
            <div className={`shrink-0 px-6 ${resultOnly ? "pt-2" : "pt-6"} pb-3 bg-[#FAFBF9]`}>
              <h1
                className={`text-[#1B4332] text-xl font-bold mb-2 transition-all duration-700 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {displayName}님의 성장 예측
              </h1>
              <p
                className={`text-[#6B7280] text-sm transition-all duration-700 delay-100 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {genderLabel} · {age}세 · {fp.bodyWeight}kg · {freqLabel} · {fp.sessionMinutes}분
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">

              {/* Message + Stars */}
              <div
                className={`w-full bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm transition-all duration-700 delay-200 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <p className="text-[#1B4332] text-sm font-medium leading-relaxed whitespace-pre-line mb-4">
                  {reading.message}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280] text-sm">성장 가능성</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`text-base text-[#2D6A4F] transition-all duration-300 ${
                          resultReady ? "scale-100" : "scale-0"
                        }`}
                        style={{ transitionDelay: `${400 + i * 100}ms` }}
                      >
                        {i <= reading.growthStars ? "★" : "☆"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* My goal card (always visible) + other goal buttons */}
              {(() => {
                const myLevel: UserLevel = fp.weeklyFrequency <= 2 ? "beginner" : "advanced";
                const myGoalData = PREDICTIONS_BY_GOAL[fp.goal];
                const myItems = myGoalData?.[myLevel] || [];
                const levelLabel = myLevel === "beginner" ? "입문자" : "상급자";

                return (
                  <>
                    {/* My goal card */}
                    <div
                      className={`w-full bg-white rounded-2xl p-5 mb-4 border-2 border-[#2D6A4F]/20 shadow-sm transition-all duration-700 delay-400 ${
                        showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
                          <span className="text-[#1B4332] text-sm font-bold">내 목표: {myGoalData?.title}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2D6A4F]/10 text-[#2D6A4F]">{levelLabel}</span>
                        </div>
                        <span className="text-[#6B7280] text-[11px]">{reading.condition}</span>
                      </div>
                      <div className="space-y-2.5">
                        {myItems.map((item: PredictionItem, i: number) => {
                          const pred = reading.predictions[i];
                          const threshold = UNLOCK_THRESHOLDS[i] ?? 999;
                          const isUnlocked = workoutCount >= threshold;
                          const isOpen = isUnlocked && (i === 0 || isPremium);
                          const easyLabel = item.label.replace(/e1RM/g, "최대 중량").replace(/1RM/g, "최대 중량");
                          const easyValue = pred?.value?.toString().replace(/e1RM/g, "최대 중량").replace(/Best e1RM/g, "최고 기록");
                          const easySub = pred?.sub?.replace(/e1RM/g, "최대 중량").replace(/Best e1RM/g, "최고 기록").replace(/R²=\d+%/g, "").replace(/\s+,\s*/g, ", ").trim();
                          return (
                            <div key={i}>
                              {isOpen ? (
                                <div className="bg-[#FAFBF9] rounded-xl p-3 -mx-1">
                                  <p className="text-[#6B7280] text-xs mb-2">{easyLabel}</p>
                                  {/* 근력 수준 프로그레스 바 */}
                                  {pred?.strengthBars ? (
                                    <div className="space-y-2.5">
                                      {pred.strengthBars.map((bar, bi) => (
                                        <div key={bi}>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] text-[#1B4332] font-medium">{bar.name}</span>
                                            <span className="text-[11px] font-bold text-[#2D6A4F]">{bar.level}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-700"
                                              style={{
                                                width: `${bar.pct}%`,
                                                backgroundColor: bar.pct >= 80 ? "#059669" : bar.pct >= 50 ? "#2D6A4F" : "#6B7280",
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : pred?.action === "edit_1rm" && onEdit1RM ? (
                                    <button onClick={onEdit1RM} className="text-[#1B4332] text-sm font-black text-right w-full underline decoration-emerald-400 decoration-2 underline-offset-2 active:opacity-60">
                                      {easyValue} →
                                    </button>
                                  ) : (
                                    <p className="text-[#1B4332] text-sm font-black text-right">{easyValue}</p>
                                  )}
                                  {!pred?.strengthBars && easySub && <p className="text-[#2D6A4F] text-[11px] mt-1 text-right">{easySub}</p>}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between py-1">
                                  <span className="text-[#1B4332] text-sm">{item.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    {!isUnlocked ? (
                                      <span className="text-[10px] text-gray-400 font-medium">{threshold}회 운동 후 해금</span>
                                    ) : (
                                      <span className="text-[10px] text-gray-400 font-medium">프리미엄</span>
                                    )}
                                    <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 회귀분석 그래프 토글 */}
                      <button
                        onClick={() => setShowChart(!showChart)}
                        className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-xl bg-[#2D6A4F]/5 active:bg-[#2D6A4F]/10 transition-all"
                      >
                        <span className="text-[11px] font-bold text-[#2D6A4F]">{showChart ? "그래프 접기" : "회귀분석 그래프 보기"}</span>
                        <span className={`text-[10px] text-[#2D6A4F] transition-transform ${showChart ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {showChart && (
                        <div className="mt-3 animate-fade-in">
                          <RegressionChart
                            goal={fp.goal}
                            history={workoutHistory || []}
                            weightLog={weightLog || []}
                            profile={fp}
                          />
                        </div>
                      )}
                    </div>

                    {/* Other goal buttons */}
                    <div
                      className={`flex gap-2 mb-4 transition-all duration-700 delay-500 ${
                        showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                      }`}
                    >
                      {Object.entries(PREDICTIONS_BY_GOAL).filter(([k]) => k !== fp.goal).map(([key, gd]) => {
                        const isSelected = selectedGoalKey === key;
                        const canAccess = isPremium;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              if (!canAccess) {
                                setShowOtherGoals(true);
                              } else {
                                setSelectedGoalKey(isSelected ? null : key);
                              }
                            }}
                            className={`flex-1 px-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-[#1B4332] text-white"
                                : canAccess
                                  ? "bg-white border border-gray-200 text-gray-600 active:scale-95"
                                  : "bg-gray-50 border border-gray-100 text-gray-300"
                            }`}
                          >
                            {gd.title}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected other goal card */}
                    {selectedGoalKey && isPremium && (() => {
                      const otherGoalData = PREDICTIONS_BY_GOAL[selectedGoalKey];
                      const otherItems = otherGoalData?.[myLevel] || [];
                      const otherReading = computeReading({ ...fp, goal: selectedGoalKey as FitnessProfile["goal"] }, workoutCount, workoutHistory, weightLog);
                      return (
                        <div className="w-full bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm animate-fade-in">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#059669]" />
                              <span className="text-[#1B4332] text-sm font-bold">{otherGoalData?.title}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{levelLabel}</span>
                            </div>
                            <span className="text-[#6B7280] text-[11px]">{otherReading.condition}</span>
                          </div>
                          <div className="space-y-2.5">
                            {otherItems.map((item: PredictionItem, i: number) => {
                              const pred = otherReading.predictions[i];
                              const threshold = UNLOCK_THRESHOLDS[i] ?? 999;
                              const isUnlocked = workoutCount >= threshold;
                              return (
                                <div key={i}>
                                  {isUnlocked ? (
                                    <div className="bg-[#FAFBF9] rounded-xl p-3 -mx-1">
                                      <p className="text-[#6B7280] text-xs mb-2">{item.label.replace(/e1RM/g, "최대 중량").replace(/1RM/g, "최대 중량")}</p>
                                      <p className="text-[#1B4332] text-sm font-black text-right">{pred?.value?.toString().replace(/e1RM/g, "최대 중량").replace(/Best e1RM/g, "최고 기록")}</p>
                                      {pred?.sub && <p className="text-[#2D6A4F] text-[11px] mt-1 text-right">{pred.sub.replace(/e1RM/g, "최대 중량").replace(/Best e1RM/g, "최고 기록").replace(/R²=\d+%/g, "").replace(/\s+,\s*/g, ", ").trim()}</p>}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between py-1">
                                      <span className="text-[#1B4332] text-sm">{item.label}</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-gray-400 font-medium">{threshold}회 운동 후 해금</span>
                                        <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

            </div>

            {/* Fixed CTA - only for initial onboarding */}
            {!resultOnly && (
              <div className="shrink-0 bg-[#FAFBF9] px-6 pb-6 pt-3 border-t border-gray-100">
                <p className="text-[#6B7280] text-xs text-center mb-3">
                  운동 데이터가 쌓일수록 예측이 정교해집니다
                </p>
                <button
                  onClick={() => onComplete(profile as FitnessProfile)}
                  className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all"
                >
                  첫 운동 시작하기
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Premium Popup (tooltip style) */}
      {showOtherGoals && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center animate-fade-in" onClick={() => setShowOtherGoals(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-6 relative z-10" onClick={(e) => e.stopPropagation()}>
            <p className="text-emerald-600 text-[11px] font-bold tracking-wider uppercase mb-2">PREMIUM</p>
            <p className="text-[15px] font-black text-[#1B4332] leading-snug mb-1">전체 예측 리포트를 열어보세요</p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1.5">
              AI 예측 모델이 분석한 모든 목표의{"\n"}성장 예측과 레벨별 상세 리포트를 확인하세요
            </p>

            <div className="mt-4 space-y-2">
              {Object.entries(PREDICTIONS_BY_GOAL).filter(([k]) => k !== (profile as FitnessProfile).goal).map(([key, goalData]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[#1B4332] text-[13px] font-medium">{goalData.title} 예측</span>
                  <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-[#1B4332] text-[13px] font-medium">
                  {(profile as FitnessProfile).weeklyFrequency <= 2 ? "상급자" : "입문자"} 레벨 분석
                </span>
                <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <button
              onClick={() => {
                setShowOtherGoals(false);
                onPremium?.();
              }}
              className="w-full mt-5 py-3.5 rounded-2xl font-black text-sm text-amber-300 bg-[#1B4332] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)]"
            >
              프리미엄 구독하기
            </button>
            <p className="text-[10px] text-gray-400 mt-3 font-medium text-center">탭하여 닫기</p>
          </div>
        </div>
      )}

      {/* ML Tooltip (CoachTooltip style) */}
      {showMLTooltip && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center animate-fade-in" onClick={() => setShowMLTooltip(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-6 relative z-10">
            <p className="text-emerald-600 text-[11px] font-bold tracking-wider uppercase mb-2">예측 모델 안내</p>
            <p className="text-[15px] font-black text-[#1B4332] leading-snug">회귀분석 기반 머신러닝이란?</p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1.5">
              오운잘 AI는 당신의 운동 데이터에서{"\n"}총볼륨(중량x횟수), 세트수, 운동시간,{"\n"}빈도, 체중 등 다양한 입력값을 수집합니다.
            </p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-2">
              이 데이터를 XGBoost(트리 기반 앙상블) 모델과{"\n"}논문 검증된 회귀분석에 적용하여{"\n"}칼로리 소모, 근력 성장, 볼륨 추세를 예측합니다.
            </p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-2">
              데이터가 쌓일수록 당신만의 패턴을 학습해{"\n"}예측 정밀도가 높아집니다.
            </p>

            <p className="text-[10px] text-gray-400 mt-3 font-medium">탭하여 닫기</p>
          </div>
        </div>
      )}
    </div>
  );
};
