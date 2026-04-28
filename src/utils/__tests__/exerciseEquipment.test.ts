import { describe, test, expect } from "vitest";
import {
  getEquipmentInfo,
  getEquipmentFindGuide,
  getEquipmentUseGuide,
  isBeginnerSupportedExercise,
  EXERCISE_EQUIPMENT,
} from "@/constants/exerciseEquipment";

const BENCH = "바벨 벤치 프레스 (Barbell Bench Press)";

describe("exerciseEquipment Phase 1.5", () => {
  test("정확 매칭 — 운동 풀 키 워딩 일치 (workout.ts L270)", () => {
    expect(BENCH in EXERCISE_EQUIPMENT).toBe(true);
    expect(isBeginnerSupportedExercise(BENCH)).toBe(true);
  });

  test("미지원 운동 — 매칭 X (덤벨/스미스 등 다른 변형 포함)", () => {
    expect(isBeginnerSupportedExercise("덤벨 벤치 프레스 (Dumbbell Bench Press)")).toBe(false);
    expect(isBeginnerSupportedExercise("스미스 머신 벤치 프레스 (Smith Machine Bench Press)")).toBe(false);
    expect(isBeginnerSupportedExercise("스쿼트")).toBe(false);
  });

  test("findGuide = 위치/외형 5줄 (안전 셋업 정보 X)", () => {
    const ko = getEquipmentFindGuide(BENCH, "ko");
    const en = getEquipmentFindGuide(BENCH, "en");
    expect(ko.length).toBe(5);
    expect(en.length).toBe(5);
    // find 에는 안전바·핀·콜라 같은 셋업 단어 없어야 함 (use 와 분리)
    const findText = ko.join(" ");
    expect(findText).not.toMatch(/안전바|콜라|핀\s*위치/);
  });

  test("useGuide = 안전 셋업 5줄 (find 와 분리)", () => {
    const ko = getEquipmentUseGuide(BENCH, "ko");
    const en = getEquipmentUseGuide(BENCH, "en");
    expect(ko.length).toBe(5);
    expect(en.length).toBe(5);
    // use 에는 셋업 단어 포함되어야 함
    const useText = ko.join(" ");
    expect(useText).toMatch(/안전바|콜라|핀|플레이트/);
  });

  test("미매칭 운동 — 빈 배열 반환 (회귀 X)", () => {
    expect(getEquipmentFindGuide("스쿼트", "ko")).toEqual([]);
    expect(getEquipmentUseGuide("스쿼트", "ko")).toEqual([]);
    expect(getEquipmentInfo("스쿼트")).toBeUndefined();
  });

  test("부정 단어 grep — find/use 모두 통증/부상/위험 X (SEED-001 카피 룰)", () => {
    const all = [
      ...getEquipmentFindGuide(BENCH, "ko"),
      ...getEquipmentFindGuide(BENCH, "en"),
      ...getEquipmentUseGuide(BENCH, "ko"),
      ...getEquipmentUseGuide(BENCH, "en"),
    ].join(" ");
    expect(all).not.toMatch(/통증|부상|위험|injury|pain|risk/i);
  });
});
