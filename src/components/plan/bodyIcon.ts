import { getExerciseMuscleGroups } from "@/constants/workout";

/**
 * 하체 아이콘은 Figma Kenko UI Kit 기반 4종으로 운용 (회의 64-R, 대표 지시 2026-04-19):
 * - glutes.svg: 엉덩이 (힙 쓰러스트·런지·와이드 스쿼트 등)
 * - adductor.svg: 내전근·사이드 플랭크
 * - calf.svg: 종아리
 * - deadlift.svg: 후면 체인 (데드리프트·레그컬 등)
 * 전면 다리는 leg-press.svg, 상체·코어는 GROUP_TO_ICON 유지.
 */

const GLUTE: Set<string> = new Set([
  "글루트 브릿지 (Glute Bridge)",
  "불가리안 스플릿 스쿼트 (Bulgarian Split Squat)",
  "리버스 런지 (Reverse Lunges)",
  "워킹 런지 (Walking Lunges)",
  "스텝업 (Step-Up)",
  "케틀벨 워킹 런지 (Kettlebell Walking Lunge)",
  "케이블 풀 스루 (Cable Pull-Through)",
  // 힙 어브덕션 머신 — 중둔근(엉덩이 외측) 주도
  "힙 어브덕션 머신 (Hip Abduction Machine)",
  // 힙 쓰러스트 3종 — 엉덩이 주도 (대표 지시 2026-04-18)
  "덤벨 힙 쓰러스트 (Dumbbell Hip Thrust)",
  "힙 쓰러스트 (Hip Thrust)",
  "바벨 힙 쓰러스트 (Barbell Hip Thrust)",
  // 와이드/딥 스쿼트 4종 — 엉덩이·내전근 복합 자극, glutes 아이콘으로 통일 (회의 64-Q, 대표 지시 2026-04-19)
  "딥 스쿼트 홀드 (Deep Squat Hold)",
  "케틀벨 와이드 스쿼트 (Kettlebell Wide Squat)",
  "덤벨 와이드 스쿼트 (Dumbbell Wide Squat)",
  "와이드 스쿼트 (Wide Squat)",
]);

const ADDUCTOR: Set<string> = new Set([
  // 힙 어덕션 머신 — 대퇴 내전근 주도
  "힙 어덕션 머신 (Hip Adduction Machine)",
]);

const CALF: Set<string> = new Set([
  "스탠딩 카프 레이즈 (Standing Calf Raises)",
  "시티드 카프 레이즈 (Seated Calf Raises)",
  "동키 카프 레이즈 (Donkey Calf Raises)",
]);

const ANTERIOR_LEG: Set<string> = new Set([
  "바벨 백 스쿼트 (Barbell Back Squat)",
  "프론트 스쿼트 (Front Squat)",
  "고블렛 스쿼트 (Goblet Squat)",
  "더블 케틀벨 프론트 스쿼트 (Double Kettlebell Front Squat)",
  "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)",
  "핵 스쿼트 (Hack Squat)",
  "레그 프레스 (Leg Press)",
  "레그 익스텐션 (Leg Extension)",
  // 회의 62 후속 (2026-04-18, 대표 지시): 스쿼트 점프 맨몸 → 레그프레스 부위 아이콘
  "스쿼트 점프 (Squat Jump)",
  "스쿼트 점프 (Squat Jumps)",
  // 에어 스쿼트 맨몸 — 대퇴사두 주도, 레그프레스 아이콘 (대표 지시 2026-04-19)
  "에어 스쿼트 (Air Squat)",
]);

const POSTERIOR_LEG: Set<string> = new Set([
  "루마니안 데드리프트 (Romanian Deadlift)",
  "컨벤셔널 데드리프트 (Conventional Deadlift)",
  "스모 데드리프트 (Sumo Deadlift)",
  "트랩바 데드리프트 (Trap Bar Deadlift)",
  "케틀벨 스윙 (Kettlebell Swing)",
  "싱글 레그 케틀벨 RDL (Single-Leg Kettlebell RDL)",
  "케틀벨 데드리프트 (Kettlebell Deadlift)",
  "덤벨 루마니안 데드리프트 (Dumbbell Romanian Deadlift)",
  "레그 컬 (Leg Curl)",
  "원 레그 루마니안 데드리프트 (Single Leg RDL)",
]);

const GROUP_TO_ICON: Record<string, string> = {
  "가슴": "/icons/body/bench-press.svg",
  "등": "/icons/body/barbell-row.svg",
  "이두": "/icons/body/barbell-curl.svg",
  "삼두": "/icons/body/triceps.svg",
  "어깨": "/icons/body/shoulder.svg",
  "후면 어깨": "/icons/body/rear-delt.svg",
  "코어": "/icons/body/core.svg",
};

/**
 * 사이드 플랭크 류 판정 — 내전근 자극 (대표 지시 2026-04-18).
 * 현재 풀: "사이드 플랭크 (Side Plank)" 1종. 향후 변형(사이드 플랭크 힙 립·Side Plank Dips 등) 자동 커버.
 */
function isSidePlank(name: string): boolean {
  return /사이드 플랭크|Side\s*Plank/i.test(name);
}

export function getBodyIcon(name: string): string | null {
  if (CALF.has(name)) return "/icons/body/calf.svg";
  if (GLUTE.has(name)) return "/icons/body/glutes.svg";
  if (isSidePlank(name) || ADDUCTOR.has(name)) return "/icons/body/adductor.svg";
  if (ANTERIOR_LEG.has(name)) return "/icons/body/leg-press.svg";
  if (POSTERIOR_LEG.has(name)) return "/icons/body/deadlift.svg";
  const groups = getExerciseMuscleGroups(name);
  for (const g of groups) {
    if (GROUP_TO_ICON[g]) return GROUP_TO_ICON[g];
  }
  return null;
}
