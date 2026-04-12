/**
 * 칼로리 공식 검증 — 회의 55 시뮬레이션 테이블 기준
 *
 * 목표 레퍼런스 (30대 남자 75kg):
 *   라이트: 2000kg / 30분 → ~200 kcal
 *   중간:   4000kg / 40분 → ~332 kcal
 *   하드:   5500kg / 45분 → ~428 kcal
 *   초하드: 8000kg / 50분 → ~525 kcal
 */
import { describe, test, expect } from "vitest";
import { calcSessionCalories } from "../predictionUtils";
import { WorkoutHistory } from "@/constants/workout";

function makeSession(overrides: {
  totalVolume: number;
  totalDurationSec: number;
  totalSets?: number;
  totalReps?: number;
  exercises?: { name: string; type: string }[];
}): WorkoutHistory {
  const exercises = overrides.exercises || [
    { name: "바벨 로우", type: "strength" },
    { name: "랫 풀다운", type: "strength" },
    { name: "시티드 로우", type: "strength" },
    { name: "덤벨 로우", type: "strength" },
    { name: "페이스 풀", type: "strength" },
  ];
  return {
    id: "test",
    date: new Date().toISOString(),
    sessionData: {
      title: "test",
      description: "",
      exercises: exercises.map((e) => ({
        name: e.name,
        type: e.type,
        sets: 3,
        reps: 10,
        equipment: "barbell",
      })),
    },
    logs: {},
    stats: {
      totalVolume: overrides.totalVolume,
      totalSets: overrides.totalSets ?? 15,
      totalReps: overrides.totalReps ?? 150,
      totalDurationSec: overrides.totalDurationSec,
    },
  } as unknown as WorkoutHistory;
}

describe("회의 55: 칼로리 시뮬레이션 테이블", () => {
  const BW = 75;

  test("라이트 세션: 2000kg / 30분 → 180~260 kcal", () => {
    const session = makeSession({ totalVolume: 2000, totalDurationSec: 30 * 60 });
    const cal = calcSessionCalories(session, BW);
    expect(cal).toBeGreaterThanOrEqual(180);
    expect(cal).toBeLessThanOrEqual(260);
  });

  test("중간 세션: 4000kg / 40분 → 290~400 kcal", () => {
    const session = makeSession({ totalVolume: 4000, totalDurationSec: 40 * 60 });
    const cal = calcSessionCalories(session, BW);
    expect(cal).toBeGreaterThanOrEqual(290);
    expect(cal).toBeLessThanOrEqual(400);
  });

  test("하드 세션: 5500kg / 45분 → 400~470 kcal", () => {
    const session = makeSession({ totalVolume: 5500, totalDurationSec: 45 * 60 });
    const cal = calcSessionCalories(session, BW);
    expect(cal).toBeGreaterThanOrEqual(400);
    expect(cal).toBeLessThanOrEqual(470);
  });

  test("초하드 세션: 8000kg / 50분 → 440~560 kcal", () => {
    const session = makeSession({ totalVolume: 8000, totalDurationSec: 50 * 60 });
    const cal = calcSessionCalories(session, BW);
    expect(cal).toBeGreaterThanOrEqual(440);
    expect(cal).toBeLessThanOrEqual(560);
  });

  test("2분 끝난 세션 → 정직하게 낮은 값 (<30 kcal)", () => {
    const session = makeSession({ totalVolume: 200, totalDurationSec: 120, totalSets: 2 });
    const cal = calcSessionCalories(session, BW);
    expect(cal).toBeLessThan(30);
  });

  test("duration 0 + sets 폴백 → sets × 90초 기반", () => {
    const session = makeSession({ totalVolume: 3000, totalDurationSec: 0, totalSets: 12 });
    const cal = calcSessionCalories(session, BW);
    expect(cal).toBeGreaterThan(0);
    // 12세트 × 90초 = 18분
    expect(cal).toBeGreaterThanOrEqual(100);
  });

  test("체중 0 → 0 kcal (division safety)", () => {
    const session = makeSession({ totalVolume: 5000, totalDurationSec: 2700 });
    expect(calcSessionCalories(session, 0)).toBe(0);
  });
});

describe("칼로리: 러닝 세션", () => {
  test("이지런 30분 / 70kg → 합리적 범위", () => {
    const session = {
      ...makeSession({ totalVolume: 0, totalDurationSec: 1800 }),
      runningStats: { duration: 1800, runningType: "easy", distance: 4000 },
    } as unknown as WorkoutHistory;
    const cal = calcSessionCalories(session, 70);
    // MET 6.0 × 70 × 0.5h = 210
    expect(cal).toBeGreaterThanOrEqual(190);
    expect(cal).toBeLessThanOrEqual(230);
  });
});
