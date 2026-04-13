/**
 * 운동 → 근육 그룹 색상 매핑 (아이콘 에셋 대체 플레이스홀더)
 * 추후 근육 일러스트로 교체 예정
 */
import { getExerciseMuscleGroups } from "@/constants/workout";

interface MuscleColor {
  bg: string;   // 배경 (연함)
  fg: string;   // 전경/텍스트 (진함)
  hex: string;  // 인라인 스타일용
}

const GROUP_COLORS: Record<string, MuscleColor> = {
  "가슴":   { bg: "bg-orange-100", fg: "text-orange-700", hex: "#FED7AA" },
  "등":     { bg: "bg-blue-100",   fg: "text-blue-700",   hex: "#BFDBFE" },
  "어깨":   { bg: "bg-purple-100", fg: "text-purple-700", hex: "#E9D5FF" },
  "이두":   { bg: "bg-pink-100",   fg: "text-pink-700",   hex: "#FBCFE8" },
  "삼두":   { bg: "bg-rose-100",   fg: "text-rose-700",   hex: "#FECDD3" },
  "하체":   { bg: "bg-emerald-100", fg: "text-emerald-700", hex: "#A7F3D0" },
  "종아리": { bg: "bg-teal-100",   fg: "text-teal-700",   hex: "#99F6E4" },
  "코어":   { bg: "bg-amber-100",  fg: "text-amber-700",  hex: "#FDE68A" },
  "전신":   { bg: "bg-indigo-100", fg: "text-indigo-700", hex: "#C7D2FE" },
  "후면 어깨": { bg: "bg-violet-100", fg: "text-violet-700", hex: "#DDD6FE" },
};

const DEFAULT_COLOR: MuscleColor = { bg: "bg-gray-100", fg: "text-gray-600", hex: "#F3F4F6" };

/** 운동 이름 → 대표 근육 그룹 색상 (첫 번째 매칭 그룹) */
export function getMuscleColor(exerciseName: string): MuscleColor {
  const groups = getExerciseMuscleGroups(exerciseName);
  if (groups.length === 0) return DEFAULT_COLOR;
  return GROUP_COLORS[groups[0]] || DEFAULT_COLOR;
}

/** 근육 그룹 → 색상 */
export function getMuscleColorByGroup(group: string): MuscleColor {
  return GROUP_COLORS[group] || DEFAULT_COLOR;
}
