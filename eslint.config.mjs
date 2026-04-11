import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // 회의 52: workout_history localStorage 직접 접근 금지 (중앙 유틸 경유 강제)
  // 예외: src/utils/workoutHistory.ts 는 중앙 유틸 자체
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/utils/workoutHistory.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='localStorage'][callee.property.name='getItem'][arguments.0.value='ohunjal_workout_history']",
          message: "workout_history 캐시 직접 접근 금지. getCachedWorkoutHistory() in @/utils/workoutHistory 사용 (회의 52).",
        },
        {
          selector: "CallExpression[callee.object.name='localStorage'][callee.property.name='setItem'][arguments.0.value='ohunjal_workout_history']",
          message: "workout_history 캐시 직접 쓰기 금지. replaceCachedWorkoutHistory() 또는 saveWorkoutHistory/updateReportTabs 등 유틸 사용 (회의 52).",
        },
      ],
    },
  },
]);

export default eslintConfig;
