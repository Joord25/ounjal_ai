import { getExerciseMuscleGroups } from "@/constants/workout";

const ANTERIOR_LEG: Set<string> = new Set([
  "바벨 백 스쿼트 (Barbell Back Squat)",
  "프론트 스쿼트 (Front Squat)",
  "고블렛 스쿼트 (Goblet Squat)",
  "더블 케틀벨 프론트 스쿼트 (Double Kettlebell Front Squat)",
  "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)",
  "핵 스쿼트 (Hack Squat)",
  "레그 프레스 (Leg Press)",
  "레그 익스텐션 (Leg Extension)",
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
  "덤벨 힙 쓰러스트 (Dumbbell Hip Thrust)",
  "힙 쓰러스트 (Hip Thrust)",
  "바벨 힙 쓰러스트 (Barbell Hip Thrust)",
  "글루트 브릿지 (Glute Bridge)",
  "케이블 풀 스루 (Cable Pull-Through)",
  "레그 컬 (Leg Curl)",
  "불가리안 스플릿 스쿼트 (Bulgarian Split Squat)",
  "리버스 런지 (Reverse Lunges)",
  "워킹 런지 (Walking Lunges)",
  "스텝업 (Step-Up)",
  "케틀벨 워킹 런지 (Kettlebell Walking Lunge)",
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

export function getBodyIcon(name: string): string | null {
  if (ANTERIOR_LEG.has(name)) return "/icons/body/leg-press.svg";
  if (POSTERIOR_LEG.has(name)) return "/icons/body/deadlift.svg";
  const groups = getExerciseMuscleGroups(name);
  for (const g of groups) {
    if (GROUP_TO_ICON[g]) return GROUP_TO_ICON[g];
  }
  return null;
}
