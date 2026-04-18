import { getExerciseMuscleGroups } from "@/constants/workout";

/**
 * 회의 62 후속 (2026-04-18, 대표 지시): 엉덩이(glutes)·내전근(adductor) 전용 아이콘 도입.
 * SVG 파일(glutes.svg / adductor.svg)이 `public/icons/body/`에 준비되면 각 플래그를 true로 전환.
 * false 동안엔 기존 deadlift.svg로 fallback — 런타임 404 방지.
 * Figma: node 24:19184 (glutes), node 26:15589 (Adductor) — kenko-ui-kit-update-1
 */
// 2026-04-19: glutes(3-tone 신버전), adductor(2-tone) SVG 도착 → 플래그 활성화 (회의 64-L).
// wide-squat, calf SVG는 미도착 → fallback 유지.
const GLUTES_SVG_READY = true;       // public/icons/body/glutes.svg
const ADDUCTOR_SVG_READY = true;     // public/icons/body/adductor.svg
const WIDE_SQUAT_SVG_READY = false;  // fallback: leg-press.svg
const CALF_SVG_READY = false;        // fallback: leg-press.svg

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
]);

const ADDUCTOR: Set<string> = new Set([
  // 힙 어덕션 머신 — 대퇴 내전근 주도
  "힙 어덕션 머신 (Hip Adduction Machine)",
]);

/**
 * 회의 62 후속 (2026-04-18, 대표 지시): 딥 스쿼트 홀드 + 와이드 스쿼트 3종 공통 아이콘.
 * 해부학적으로 내전근·엉덩이·대퇴 복합 자극 — Adductor 단독과 구분되는 풀 다리 포즈 아이콘.
 * Figma node 28:15782 (kenko-ui-kit-update-1) → wide-squat.svg 로 export 예정.
 */
const WIDE_SQUAT: Set<string> = new Set([
  "딥 스쿼트 홀드 (Deep Squat Hold)",
  "케틀벨 와이드 스쿼트 (Kettlebell Wide Squat)",
  "덤벨 와이드 스쿼트 (Dumbbell Wide Squat)",
  "와이드 스쿼트 (Wide Squat)",
]);

/**
 * 회의 62 후속 (2026-04-18, 대표 지시): 종아리(calf) 전용 아이콘.
 * Figma node 28:15962 → calf.svg 로 export 예정. fallback: leg-press.svg (다리 계열 일관).
 */
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
  // 회의 62 후속 (2026-04-18, 대표 지시): 원 레그 RDL → 데드리프트 아이콘
  "원 레그 루마니안 데드리프트 (Single Leg RDL)",
  // 아래 7개는 GLUTE Set으로 이동 (2026-04-18 회의 62 후속, 대표 지시)
  // - 글루트 브릿지, 불가리안 스플릿 스쿼트, 리버스 런지, 워킹 런지, 스텝업, 케틀벨 워킹 런지, 케이블 풀 스루
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
 * 현재 풀: "사이드 플랭크 (Side Plank)" 1종. 향후 변형 (사이드 플랭크 힙 립·Side Plank Dips 등) 자동 커버.
 */
function isSidePlank(name: string): boolean {
  return /사이드 플랭크|Side\s*Plank/i.test(name);
}

export function getBodyIcon(name: string): string | null {
  // SVG 미도착 동안은 기존 아이콘으로 fallback. 도착하면 *_SVG_READY 플래그를 true로 전환.
  if (WIDE_SQUAT.has(name)) return WIDE_SQUAT_SVG_READY ? "/icons/body/wide-squat.svg" : "/icons/body/leg-press.svg";
  if (CALF.has(name)) return CALF_SVG_READY ? "/icons/body/calf.svg" : "/icons/body/leg-press.svg";
  if (GLUTE.has(name)) return GLUTES_SVG_READY ? "/icons/body/glutes.svg" : "/icons/body/deadlift.svg";
  if (isSidePlank(name) || ADDUCTOR.has(name)) return ADDUCTOR_SVG_READY ? "/icons/body/adductor.svg" : "/icons/body/deadlift.svg";
  if (ANTERIOR_LEG.has(name)) return "/icons/body/leg-press.svg";
  if (POSTERIOR_LEG.has(name)) return "/icons/body/deadlift.svg";
  const groups = getExerciseMuscleGroups(name);
  for (const g of groups) {
    if (GROUP_TO_ICON[g]) return GROUP_TO_ICON[g];
  }
  return null;
}
