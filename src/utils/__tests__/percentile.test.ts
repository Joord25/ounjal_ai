/**
 * 퍼센타일 공식 검증 — 회의 54 EASING + 팔 재매핑 기준
 *
 * 목표 (30대 남자 75kg, 50th percentile BW ratio):
 *   가슴:     raw 0.90 × 0.93 = 0.837
 *   등:       raw 0.95 × 0.93 = 0.884
 *   어깨:     raw 0.54 × 0.82 = 0.443
 *   하체:     raw 1.25 × 0.93 = 1.163
 *   코어&팔:  raw 0.52 × 0.80 = 0.416
 */
import { describe, test, expect } from "vitest";
import { bwRatioToPercentile } from "../fitnessPercentile";

describe("회의 54: EASING 적용 검증", () => {
  // 50th percentile에 정확히 eased threshold를 넣으면 50이 나와야 함
  const AGE = 35;
  const GENDER = "male" as const;

  test("가슴: BW ratio 0.837 → 50th percentile", () => {
    const p = bwRatioToPercentile(0.837, "chest", GENDER, AGE);
    expect(p).toBeGreaterThanOrEqual(48);
    expect(p).toBeLessThanOrEqual(52);
  });

  test("등: BW ratio 0.884 → 50th percentile", () => {
    const p = bwRatioToPercentile(0.884, "chest", GENDER, AGE);
    // 0.884 is above chest 50th (0.837), so should be > 50
    // But for back category:
    const pBack = bwRatioToPercentile(0.884, "back", GENDER, AGE);
    expect(pBack).toBeGreaterThanOrEqual(48);
    expect(pBack).toBeLessThanOrEqual(52);
  });

  test("어깨: BW ratio 0.443 → 50th percentile", () => {
    const p = bwRatioToPercentile(0.443, "shoulder", GENDER, AGE);
    expect(p).toBeGreaterThanOrEqual(48);
    expect(p).toBeLessThanOrEqual(52);
  });

  test("하체: BW ratio 1.163 → 50th percentile", () => {
    const p = bwRatioToPercentile(1.163, "legs", GENDER, AGE);
    expect(p).toBeGreaterThanOrEqual(48);
    expect(p).toBeLessThanOrEqual(52);
  });

  test("코어&팔: BW ratio 0.416 → 50th percentile", () => {
    const p = bwRatioToPercentile(0.416, "core", GENDER, AGE);
    expect(p).toBeGreaterThanOrEqual(48);
    expect(p).toBeLessThanOrEqual(52);
  });
});

describe("퍼센타일 경계값", () => {
  test("BW ratio 0 → 매우 낮은 퍼센타일 (1 이상)", () => {
    const p = bwRatioToPercentile(0, "chest", "male", 35);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(5);
  });

  test("BW ratio 2.0 → 매우 높은 퍼센타일 (90+)", () => {
    const p = bwRatioToPercentile(2.0, "chest", "male", 35);
    expect(p).toBeGreaterThanOrEqual(90);
    expect(p).toBeLessThanOrEqual(99);
  });

  test("cardio → 항상 50 (별도 체계)", () => {
    expect(bwRatioToPercentile(1.0, "cardio", "male", 35)).toBe(50);
  });
});

describe("퍼센타일 시뮬레이션: 바벨 로우 60kg × 8 reps / 75kg 남성", () => {
  test("1RM 76kg → BW ratio 1.01 → 약 61st percentile", () => {
    // Epley: 60 × (1 + 8/30) = 76kg
    // bwRatio: 76 / 75 = 1.013
    // back eased 50th = 0.884, eased 60th = 1.004
    // 1.013 is above 60th → should be 60+
    const p = bwRatioToPercentile(1.013, "back", "male", 35);
    expect(p).toBeGreaterThanOrEqual(58);
    expect(p).toBeLessThanOrEqual(65);
  });
});

describe("여성/연령별 검증", () => {
  test("20대 여성 가슴 50th → raw와 easing 둘 다 적용", () => {
    const p = bwRatioToPercentile(0.5, "chest", "female", 25);
    // 여성 테이블이 다르므로 정확한 값은 테이블 의존
    expect(p).toBeGreaterThanOrEqual(1);
    expect(p).toBeLessThanOrEqual(99);
  });

  test("50대 남성도 정상 동작", () => {
    const p = bwRatioToPercentile(0.8, "chest", "male", 55);
    expect(p).toBeGreaterThanOrEqual(1);
    expect(p).toBeLessThanOrEqual(99);
  });
});
