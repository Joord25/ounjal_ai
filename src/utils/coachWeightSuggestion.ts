/**
 * Phase 1.5 (회의 ζ Pajak 의장): 채팅형 무게 픽커 추천 로직.
 * - 이전 기록 있을 때: lastWeight 기반 [그대로 / +2.5 / -2.5] 칩
 * - 첫 사용 시: 장비 default (FitScreen.getDefaultWeight 동일 매트릭스) + [빈바 / +5 / +10] 칩
 *
 * Phase 1.5 범위 = 바벨 벤치 프레스 (Barbell Bench Press) 1종 = barbell.
 * Phase 2 컴파운드 확장 시 EQUIPMENT_DEFAULTS 만 추가.
 *
 * 출처: ACSM Guidelines 11th ch.7 (초보자 시작 무게 = body weight 50% 또는 빈 바부터, 점진적 ±2.5kg).
 */

export interface UserWeightProfile {
  /** "male" | "female" | null. null 이면 male 처리 (보수 X — 기본 male 매트릭스 적용 후 첫 세션 피드백으로 조정) */
  gender: "male" | "female" | null;
  /** 만 나이. null 이면 30 (성인 default) */
  age: number | null;
}

export type WeightChipKey =
  | "beginner_mode.chat_weight.chip_same"
  | "beginner_mode.chat_weight.chip_up"
  | "beginner_mode.chat_weight.chip_down"
  | "beginner_mode.chat_weight.chip_first_base"
  | "beginner_mode.chat_weight.chip_first_plus5"
  | "beginner_mode.chat_weight.chip_first_plus10";

export interface WeightChip {
  key: WeightChipKey;
  weight: number;
}

export interface CoachWeightSuggestion {
  mode: "history" | "first";
  /** 추천 시작 무게 (kg) */
  base: number;
  /** 빠른 선택 칩 (3개) */
  chips: WeightChip[];
}

/** Phase 1.5: 바벨 벤치 1종만. Phase 2 확장 시 entry 추가 (스쿼트/데드/OHP/로우 = 모두 barbell). */
const EQUIPMENT_DEFAULTS: Record<string, { male: number; femaleOrSenior: number }> = {
  barbell: { male: 20, femaleOrSenior: 15 },
};

/** 바벨 벤치 = barbell. Phase 2 확장 시 이름 패턴 매칭 추가 */
function getEquipmentForExercise(exerciseName: string): keyof typeof EQUIPMENT_DEFAULTS {
  if (/벤치\s*프레스|bench\s*press/i.test(exerciseName)) return "barbell";
  return "barbell"; // Phase 1.5 fallback (지원 운동 = 벤치만)
}

function getFirstSessionBaseWeight(exerciseName: string, profile: UserWeightProfile): number {
  const equipment = getEquipmentForExercise(exerciseName);
  const defaults = EQUIPMENT_DEFAULTS[equipment];
  const isFemaleOrSenior = profile.gender === "female" || (profile.age !== null && profile.age >= 60);
  return isFemaleOrSenior ? defaults.femaleOrSenior : defaults.male;
}

export function getCoachWeightSuggestion(
  exerciseName: string,
  lastWeight: number | null,
  profile: UserWeightProfile,
): CoachWeightSuggestion {
  if (lastWeight !== null && lastWeight > 0) {
    // 이전 기록 있음 — ±2.5 점진. 빈 바 (20kg 또는 15kg) 미만 floor 보호
    const equipment = getEquipmentForExercise(exerciseName);
    const defaults = EQUIPMENT_DEFAULTS[equipment];
    const minWeight = profile.gender === "female" || (profile.age !== null && profile.age >= 60)
      ? defaults.femaleOrSenior
      : defaults.male;
    return {
      mode: "history",
      base: lastWeight,
      chips: [
        { key: "beginner_mode.chat_weight.chip_same", weight: lastWeight },
        { key: "beginner_mode.chat_weight.chip_up", weight: lastWeight + 2.5 },
        { key: "beginner_mode.chat_weight.chip_down", weight: Math.max(minWeight, lastWeight - 2.5) },
      ],
    };
  }

  // 첫 사용 — 빈 바부터 시작
  const base = getFirstSessionBaseWeight(exerciseName, profile);
  return {
    mode: "first",
    base,
    chips: [
      { key: "beginner_mode.chat_weight.chip_first_base", weight: base },
      { key: "beginner_mode.chat_weight.chip_first_plus5", weight: base + 5 },
      { key: "beginner_mode.chat_weight.chip_first_plus10", weight: base + 10 },
    ],
  };
}
