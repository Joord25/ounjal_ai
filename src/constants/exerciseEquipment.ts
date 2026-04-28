import type { Locale } from "@/hooks/useTranslation";

export interface EquipmentInfo {
  imagePath: string;
  findGuide: { ko: string[]; en: string[] };
}

export const EXERCISE_EQUIPMENT: Record<string, EquipmentInfo> = {
  "벤치프레스": {
    imagePath: "/machine/bench-press.png",
    findGuide: {
      ko: [
        "긴 벤치와 바벨 거치대가 한 세트로 놓여 있어요",
        "보통 자유 웨이트존 중앙에 자리 잡고 있어요",
        "양쪽 거치대에 플레이트가 끼워져 있는지 확인하세요",
        "바벨 위 안전바(세이프티) 높이를 가슴 옆에 맞춰주세요",
        "거치대 핀 위치는 손목보다 살짝 아래가 표준이에요",
      ],
      en: [
        "Look for a flat bench paired with a barbell rack",
        "Usually located in the center of the free-weight area",
        "Check that plates are loaded on both sides",
        "Set the safety bars to chest level for security",
        "Pin height should sit just below your wrist line",
      ],
    },
  },
};

/**
 * Phase 1: 벤치 프레스 변형 7종 모두 매칭 (바벨/덤벨/디클라인/헤머/스미스/인클라인 바벨/클로즈그립).
 * 실제 운동 풀 이름은 "바벨 벤치 프레스 (Barbell Bench Press)" 같은 띄어쓰기+영문 병기 형식이라 부분 매칭 필요.
 * Phase 2 에서 변형별 폼 cue 분리 시 정확 매칭으로 전환.
 */
function normalizeExerciseKey(exerciseName: string): string | null {
  if (/벤치\s*프레스|bench\s*press/i.test(exerciseName)) return "벤치프레스";
  return null;
}

export function getEquipmentInfo(exerciseName: string): EquipmentInfo | undefined {
  const key = normalizeExerciseKey(exerciseName);
  return key ? EXERCISE_EQUIPMENT[key] : undefined;
}

export function getEquipmentFindGuide(
  exerciseName: string,
  locale: Locale,
): string[] {
  const info = getEquipmentInfo(exerciseName);
  if (!info) return [];
  return locale === "en" ? info.findGuide.en : info.findGuide.ko;
}

/** Phase 1: 벤치 프레스 변형 매칭 (overlay 마운트 + 휴식 분기 공유) */
export function isBeginnerSupportedExercise(exerciseName: string): boolean {
  return normalizeExerciseKey(exerciseName) !== null;
}
