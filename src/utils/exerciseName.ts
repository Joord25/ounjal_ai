/**
 * 운동 이름에서 locale에 맞는 이름 추출
 *
 * 형태: "바벨 백 스쿼트 (Barbell Back Squat)"
 * → ko: "바벨 백 스쿼트 (Barbell Back Squat)" (원본 그대로)
 * → en: "Barbell Back Squat" (괄호 안 영어만)
 *
 * 괄호 없는 경우: 원본 그대로 반환
 */
export function getExerciseName(name: string, locale: string): string {
  if (locale === "ko") return name.split("(")[0].trim();

  // 괄호 안 영어 추출: "한글 (English Name)" → "English Name"
  const match = name.match(/\(([^)]+)\)/);
  if (match) return match[1];

  // 괄호 없으면 원본 반환
  return name;
}
