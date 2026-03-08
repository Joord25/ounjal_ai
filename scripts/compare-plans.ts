/**
 * 룰베이스 vs Gemini 플랜 비교 스크립트
 * 실행: npx tsx scripts/compare-plans.ts
 */

const GEMINI_API_KEY = "AIzaSyCMdlatwsTtriQS8s7zSIJtE1PGt8FBfug";

// ====== 룰베이스 로직 (workout.ts에서 발췌) ======
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface ExerciseStep {
  type: string;
  name: string;
  count: string;
  sets: number;
  reps: number;
  weight?: string;
}

interface WorkoutSessionData {
  title: string;
  description: string;
  exercises: ExerciseStep[];
}

type WorkoutGoal = "fat_loss" | "muscle_gain" | "strength" | "general_fitness";

interface UserCondition {
  bodyPart: "upper_stiff" | "lower_heavy" | "full_fatigue" | "good";
  energyLevel: 1 | 2 | 3 | 4 | 5;
  availableTime: 30 | 50 | 90;
  bodyWeightKg?: number;
  gender?: "male" | "female";
  birthYear?: number;
}

const adjustVolume = (baseSets: number, condition: UserCondition, goal: WorkoutGoal): number => {
  let sets = baseSets;
  if (condition.bodyPart === "full_fatigue" || condition.energyLevel <= 2) sets = Math.max(2, sets - 1);
  if (condition.energyLevel >= 4) sets += 1;
  if (goal === "fat_loss") sets = Math.max(2, sets);
  if (goal === "muscle_gain") sets += 1;
  if (goal === "strength") sets = Math.max(3, sets - 1);
  if (goal === "general_fitness") sets = Math.max(2, Math.min(sets, 3));
  return sets;
};

const getRepsForGoal = (goal: WorkoutGoal): string => {
  switch (goal) {
    case "fat_loss": return "15-20 Reps";
    case "muscle_gain": return "8-12 Reps";
    case "strength": return "3-5 Reps";
    case "general_fitness": return "10-15 Reps";
  }
};

function generateRuleBased(dayIndex: number, condition: UserCondition, goal: WorkoutGoal): WorkoutSessionData {
  const exercises: ExerciseStep[] = [];
  const sets = adjustVolume(3, condition, goal);
  const repsStr = getRepsForGoal(goal);
  const repsVal = parseInt(repsStr) || 12;

  // Warmup
  let warmupDrill = "Jumping Jacks & Arm Circles";
  if (condition.bodyPart === "upper_stiff") warmupDrill = pick(["Cat-Cow & Thoracic Rotation", "Kettlebell Halo", "Band Pull-Aparts"]);
  if (condition.bodyPart === "lower_heavy") warmupDrill = pick(["90/90 Stretch & Leg Swings", "Kettlebell Prying Goblet Squat", "Deep Lunge Stretch"]);
  exercises.push({ type: "warmup", name: `Dynamic Warm-up: ${warmupDrill}`, count: "5 min", sets: 1, reps: 1 });

  // Main - Push (dayIndex 0)
  if (dayIndex === 0) {
    const pushMain = pick(["Barbell Bench Press", "Dumbbell Bench Press", "Weighted Push-ups", "Kettlebell Floor Press"]);
    const pushVertical = pick(["Overhead Press (OHP)", "Seated Dumbbell Press", "Arnold Press", "Kettlebell Overhead Press"]);
    const pushAcc = pick(["Incline Dumbbell Press", "Landmine Press", "Dips (Chest Version)", "Bottoms-Up Kettlebell Press"]);
    const pushIso1 = pick(["Lateral Raises", "Cable Lateral Raises", "Upright Row"]);
    const pushIso2 = pick(["Tricep Rope Pushdown", "Skullcrushers", "Overhead Tricep Extension"]);
    exercises.push(
      { type: "strength", name: pushMain, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: pushVertical, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: pushAcc, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: pushIso1, count: `${sets} Sets / 15 Reps`, weight: "Light", sets, reps: 15 },
      { type: "strength", name: pushIso2, count: `${sets} Sets / 12-15 Reps`, weight: "Moderate", sets, reps: 15 }
    );
  }
  // Pull (dayIndex 2)
  else if (dayIndex === 2) {
    const pullVert = pick(["Pull-ups", "Lat Pulldown", "Chin-ups"]);
    const pullHoriz = pick(["Barbell Row", "Pendlay Row", "T-Bar Row", "Kettlebell Gorilla Row"]);
    const pullUni = pick(["One-Arm Dumbbell Row", "Seated Cable Row", "Chest Supported Row", "Kettlebell High Pull"]);
    const pullRear = pick(["Face Pulls", "Rear Delt Fly (Machine/DB)", "Band Pull-Aparts"]);
    const pullBi = pick(["Barbell Curl", "Hammer Curl", "Incline Dumbbell Curl"]);
    exercises.push(
      { type: "strength", name: pullVert, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: pullHoriz, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: pullUni, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: pullRear, count: `${sets} Sets / 15 Reps`, weight: "Light", sets, reps: 15 },
      { type: "strength", name: pullBi, count: `${sets} Sets / 12 Reps`, weight: "Adaptive", sets, reps: 12 }
    );
  }
  // Legs (dayIndex 4)
  else if (dayIndex === 4) {
    const legSquat = pick(["Back Squat", "Front Squat", "Goblet Squat", "Double Kettlebell Front Squat"]);
    const legHinge = pick(["Romanian Deadlift (RDL)", "Conventional Deadlift", "Kettlebell Swing", "Single-Leg Kettlebell RDL"]);
    const legUni = pick(["Walking Lunges", "Bulgarian Split Squat", "Reverse Lunges", "Kettlebell Walking Lunge"]);
    const legIso = pick(["Leg Press", "Leg Extension", "Hip Thrust"]);
    const legCalf = pick(["Standing Calf Raises", "Seated Calf Raises", "Donkey Calf Raises"]);
    exercises.push(
      { type: "strength", name: legSquat, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: legHinge, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets, reps: repsVal },
      { type: "strength", name: legUni, count: `${sets} Sets / 12 Reps (Each)`, weight: "Bodyweight/DB", sets, reps: 12 },
      { type: "strength", name: legIso, count: `${sets} Sets / 15 Reps`, weight: "Adaptive", sets, reps: 15 },
      { type: "strength", name: legCalf, count: `${sets} Sets / 20 Reps`, weight: "Bodyweight", sets, reps: 20 }
    );
  }

  // Core
  if (dayIndex === 0 || dayIndex === 2 || dayIndex === 4) {
    const coreEx = pick(["Deadbug", "Plank", "Hanging Leg Raise", "Russian Twist", "Ab Wheel Rollout"]);
    exercises.push({ type: "core", name: `Core Finisher: ${coreEx}`, count: "5 min Continuous", sets: 1, reps: 1 });
  }

  // Additional Cardio
  exercises.push({ type: "cardio", name: "Additional Cardio: Recovery Run", count: "20 min Zone 2", sets: 1, reps: 1 });

  const typeNames: Record<number, string> = { 0: "PUSH", 2: "PULL", 4: "LEG CORE" };
  return {
    title: typeNames[dayIndex] || "WORKOUT",
    description: `${goal.toUpperCase().replace("_", " ")} FOCUS • ${sets} SETS`,
    exercises,
  };
}

// ====== Gemini API 호출 ======
async function generateGemini(condition: UserCondition, goal: WorkoutGoal, dayName: string, sessionType?: string): Promise<WorkoutSessionData | null> {
  const conditionMap: Record<string, string> = {
    upper_stiff: "상체가 굳어있음",
    lower_heavy: "하체가 무거움",
    full_fatigue: "전반적 피로감",
    good: "컨디션 좋음",
  };

  const prompt = `
    You are an elite Strength & Conditioning Coach.
    Create a 50-minute workout master plan for today (${dayName}).

    User Profile:
    - Goal: ${(goal as string).replace("_", " ").toUpperCase()}
    - Condition: ${conditionMap[condition.bodyPart]}
    - Energy Level: ${condition.energyLevel}/5
    ${condition.gender ? `- Gender: ${condition.gender === "male" ? "남성" : "여성"}` : ""}
    ${condition.bodyWeightKg ? `- Body Weight: ${condition.bodyWeightKg}kg` : ""}

    SESSION TYPE: ${sessionType || "Recommended based on schedule"}
    ${!sessionType ? `Schedule: Mon: Push | Tue: Speed Run | Wed: Pull | Thu: Easy Run | Fri: Legs | Sat: LSD Run | Sun: Mobility` : ""}

    Structure:
    1. Warm-up (5 min)
    2. Main Workout (40 min): 5-6 exercises
    3. Core (5 min)
    4. Additional Cardio

    RESPONSE IN KOREAN. Format as JSON:
    {
      "title": "마스터 플랜",
      "description": "...",
      "exercises": [
        { "type": "warmup|strength|core|cardio", "name": "...", "count": "...", "sets": N, "reps": N, "weight": "..." }
      ]
    }
  `;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  const data = await res.json();
  if (data.error) {
    console.log(`    API Error: ${data.error.message}`);
    return null;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.log(`    No text in response. Full response:`, JSON.stringify(data).substring(0, 200));
    return null;
  }
  return JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
}

// ====== 비교 실행 ======
const TEST_CONDITIONS: Array<{
  label: string;
  condition: UserCondition;
  goal: WorkoutGoal;
  dayIndex: number;
  dayName: string;
}> = [
  {
    label: "Push / Muscle Gain / Good / Energy 3",
    condition: { bodyPart: "good", energyLevel: 3, availableTime: 50, bodyWeightKg: 75, gender: "male" },
    goal: "muscle_gain",
    dayIndex: 0,
    dayName: "Monday",
  },
  {
    label: "Pull / Fat Loss / Upper Stiff / Energy 2",
    condition: { bodyPart: "upper_stiff", energyLevel: 2, availableTime: 50, bodyWeightKg: 65, gender: "female" },
    goal: "fat_loss",
    dayIndex: 2,
    dayName: "Wednesday",
  },
  {
    label: "Legs / Strength / Good / Energy 5",
    condition: { bodyPart: "good", energyLevel: 5, availableTime: 50, bodyWeightKg: 80, gender: "male" },
    goal: "strength",
    dayIndex: 4,
    dayName: "Friday",
  },
];

function formatPlan(plan: WorkoutSessionData): string {
  let out = `  Title: ${plan.title}\n  Desc: ${plan.description}\n`;
  plan.exercises.forEach((ex, i) => {
    out += `  ${i + 1}. [${ex.type}] ${ex.name} — ${ex.count}${ex.weight ? ` (${ex.weight})` : ""}\n`;
  });
  return out;
}

async function main() {
  console.log("=" .repeat(80));
  console.log("  룰베이스 vs Gemini 플랜 비교");
  console.log("=".repeat(80));

  for (const test of TEST_CONDITIONS) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`  조건: ${test.label}`);
    console.log(`${"─".repeat(80)}`);

    // 룰베이스 3개
    console.log("\n  [룰베이스] x3:\n");
    for (let i = 0; i < 3; i++) {
      const rb = generateRuleBased(test.dayIndex, test.condition, test.goal);
      console.log(`  --- 변형 ${i + 1} ---`);
      console.log(formatPlan(rb));
    }

    // Gemini 3개
    console.log("  [Gemini] x3:\n");
    for (let i = 0; i < 3; i++) {
      try {
        const gm = await generateGemini(test.condition, test.goal, test.dayName);
        if (gm) {
          console.log(`  --- 변형 ${i + 1} ---`);
          console.log(formatPlan(gm));
        } else {
          console.log(`  --- 변형 ${i + 1}: FAILED (null response) ---\n`);
        }
      } catch (e) {
        console.log(`  --- 변형 ${i + 1}: ERROR: ${e} ---\n`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("  비교 완료");
  console.log("=".repeat(80));
}

main();
