import { describe, test, expect } from "vitest";
import { getCoachWeightSuggestion } from "../coachWeightSuggestion";

const BENCH = "바벨 벤치 프레스 (Barbell Bench Press)";

describe("coachWeightSuggestion Phase 1.5", () => {
  test("이전 기록 있음 (남성) — mode='history', chips [그대로 / +2.5 / -2.5]", () => {
    const s = getCoachWeightSuggestion(BENCH, 60, { gender: "male", age: 30 });
    expect(s.mode).toBe("history");
    expect(s.base).toBe(60);
    expect(s.chips.map((c) => c.weight)).toEqual([60, 62.5, 57.5]);
  });

  test("이전 기록 있음 — -2.5 칩이 빈 바(20kg) 아래로 안 내려감 (floor)", () => {
    const s = getCoachWeightSuggestion(BENCH, 20, { gender: "male", age: 30 });
    expect(s.chips[2].weight).toBe(20); // 17.5 X, floor = 20 (남성 빈 바)
  });

  test("이전 기록 있음 (여성) — floor = 15kg", () => {
    const s = getCoachWeightSuggestion(BENCH, 15, { gender: "female", age: 30 });
    expect(s.chips[2].weight).toBe(15); // 12.5 X
  });

  test("첫 사용 (남성, 30대) — base 20kg, chips [20 / 25 / 30]", () => {
    const s = getCoachWeightSuggestion(BENCH, null, { gender: "male", age: 30 });
    expect(s.mode).toBe("first");
    expect(s.base).toBe(20);
    expect(s.chips.map((c) => c.weight)).toEqual([20, 25, 30]);
  });

  test("첫 사용 (여성) — base 15kg", () => {
    const s = getCoachWeightSuggestion(BENCH, null, { gender: "female", age: 30 });
    expect(s.base).toBe(15);
    expect(s.chips.map((c) => c.weight)).toEqual([15, 20, 25]);
  });

  test("첫 사용 (60+) — base 15kg (성별 무관)", () => {
    const s = getCoachWeightSuggestion(BENCH, null, { gender: "male", age: 65 });
    expect(s.base).toBe(15);
  });

  test("첫 사용 (프로필 없음) — male 30대 default = 20kg", () => {
    const s = getCoachWeightSuggestion(BENCH, null, { gender: null, age: null });
    expect(s.base).toBe(20);
  });

  test("이전 기록 0 또는 음수 → 첫 사용 처리 (역호환)", () => {
    const s = getCoachWeightSuggestion(BENCH, 0, { gender: "male", age: 30 });
    expect(s.mode).toBe("first");
  });

  test("칩 i18n 키 형식 — beginner_mode.chat_weight.chip_*", () => {
    const history = getCoachWeightSuggestion(BENCH, 60, { gender: "male", age: 30 });
    history.chips.forEach((c) => {
      expect(c.key).toMatch(/^beginner_mode\.chat_weight\.chip_/);
    });
    const first = getCoachWeightSuggestion(BENCH, null, { gender: "male", age: 30 });
    first.chips.forEach((c) => {
      expect(c.key).toMatch(/^beginner_mode\.chat_weight\.chip_first_/);
    });
  });
});
