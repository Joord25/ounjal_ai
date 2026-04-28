import type { Locale } from "@/hooks/useTranslation";

export interface EquipmentInfo {
  imagePath: string;
  /** Phase 1.5: find = 위치/외형 식별 (헬스장 안에서 "어디 있고 어떻게 생겼는지"). 안전 셋업 정보 포함 X */
  findGuide: { ko: string[]; en: string[] };
  /** Phase 1.5: use = 안전 셋업 (안전바·핀·플레이트·콜라). 폼 cue 와 별개 — cue 는 formCues.ts */
  useGuide: { ko: string[]; en: string[] };
}

/**
 * Phase 1.5 (회의 ζ): 바벨 벤치 프레스 정확 1종. 운동 풀 키 = workout.ts L270 정확 일치.
 * find ↔ use 분리 — 회의 ζ 결정 (대표 vision: "장비 판매 톤 X, 코치 동행 톤. 찾는 법 vs 사용법 분리").
 * 다른 벤치 변형 (덤벨/스미스/인클라인 등) 은 Phase 2 변형별 분리 후 추가.
 */
export const EXERCISE_EQUIPMENT: Record<string, EquipmentInfo> = {
  "바벨 벤치 프레스 (Barbell Bench Press)": {
    imagePath: "/machine/bench-press.png",
    findGuide: {
      ko: [
        "긴 평평한 벤치 위에 바벨 거치대가 양쪽으로 세워진 모양이에요",
        "보통 자유 웨이트존 중앙이나 한쪽 벽을 따라 줄지어 놓여있어요",
        "바벨이 거치대 위에 가로로 올려진 상태로 보여요",
        "옆에 큰 원판(플레이트)이 무게별로 정리된 거치대가 함께 있어요",
        "스미스 머신과 다르게 — 바벨이 레일에 고정되지 않고 자유롭게 움직여요",
      ],
      en: [
        "A long flat bench with a barbell rack standing at both ends",
        "Usually placed in the center of the free-weight area or along a wall",
        "The barbell sits horizontally on top of the rack",
        "Plates are organized by weight on a nearby rack",
        "Different from a Smith Machine — the bar moves freely, not locked to rails",
      ],
    },
    useGuide: {
      ko: [
        "거치대 핀 위치 — 누웠을 때 손목보다 살짝 아래가 표준이에요",
        "양쪽 플레이트 무게가 같은지 확인 (좌우 균형)",
        "안전바(세이프티) 높이 — 가슴 옆 높이로 맞추면 든든해요",
        "그립 너비 — 손목이 어깨 바로 위에 오도록 잡아요",
        "콜라(칼라)로 플레이트 끝 고정해서 흔들림 없이 준비",
      ],
      en: [
        "Pin height — set it just below your wrist when lying down",
        "Check both sides have equal plate weight (balance)",
        "Safety bars — set them at chest level for confidence",
        "Grip width — wrists directly above shoulders",
        "Lock plates with collars to keep them steady",
      ],
    },
  },
};

export function getEquipmentInfo(exerciseName: string): EquipmentInfo | undefined {
  return EXERCISE_EQUIPMENT[exerciseName];
}

export function getEquipmentFindGuide(
  exerciseName: string,
  locale: Locale,
): string[] {
  const info = EXERCISE_EQUIPMENT[exerciseName];
  if (!info) return [];
  return locale === "en" ? info.findGuide.en : info.findGuide.ko;
}

export function getEquipmentUseGuide(
  exerciseName: string,
  locale: Locale,
): string[] {
  const info = EXERCISE_EQUIPMENT[exerciseName];
  if (!info) return [];
  return locale === "en" ? info.useGuide.en : info.useGuide.ko;
}

/** Phase 1.5: 정확 매칭 — overlay 마운트 + 휴식 분기 공유. Phase 2에서 컴파운드 추가 시 EXERCISE_EQUIPMENT 에 entry 추가하면 자동 확장 */
export function isBeginnerSupportedExercise(exerciseName: string): boolean {
  return exerciseName in EXERCISE_EQUIPMENT;
}
