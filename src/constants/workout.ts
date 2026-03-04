export type WorkoutLevel = "beginner" | "intermediate" | "advanced";
export type ExerciseType = "warmup" | "strength" | "cardio" | "core" | "mobility";
export type WorkoutType = "push" | "pull" | "leg_core" | "mobility" | "run_easy" | "run_speed" | "run_long";

export interface ExerciseStep {
  type: ExerciseType;
  name: string;
  count: string;
  weight?: string;
  sets: number;
  reps: number;
  logs?: ExerciseLog[];
}

export interface ExerciseLog {
  setNumber: number;
  repsCompleted: number;
  weightUsed?: string;
  feedback: "fail" | "target" | "easy" | "too_easy";
}

export interface WorkoutSessionData {
  title: string;
  description: string;
  exercises: ExerciseStep[];
}

export interface WorkoutAnalysis {
  briefing: string;
  nextSessionAdvice: string;
}

export interface WorkoutHistory {
  id: string;
  date: string;
  sessionData: WorkoutSessionData;
  logs: Record<number, ExerciseLog[]>;
  stats: {
    totalVolume: number;
    totalSets: number;
    totalReps: number;
  };
  analysis?: WorkoutAnalysis;
}

// User Condition Interface (Updated)
export interface UserCondition {
  bodyPart: "upper_stiff" | "lower_heavy" | "full_fatigue" | "good";
  energyLevel: 1 | 2 | 3 | 4 | 5; // 1(Low) - 5(High)
  availableTime: 30 | 50 | 90; // minutes
}

// Workout Goal Interface
export type WorkoutGoal = "fat_loss" | "muscle_gain" | "strength";

// Helper: Pick random item from array
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Adaptive Logic: Adjust volume/intensity based on condition & goal
const adjustVolume = (baseSets: number, condition: UserCondition, goal: WorkoutGoal): number => {
  let sets = baseSets;

  // Condition Adjustment
  if (condition.bodyPart === "full_fatigue" || condition.energyLevel <= 2) {
    sets = Math.max(2, sets - 1);
  } else if (condition.energyLevel >= 4) {
    sets += 1;
  }

  // Goal Adjustment (Volume)
  if (goal === "muscle_gain") sets += 1; // High volume for hypertrophy
  if (goal === "strength") sets = Math.max(3, sets - 1); // Lower volume, higher intensity (handled in reps)

  return sets;
};

const getRepsForGoal = (goal: WorkoutGoal): string => {
  switch (goal) {
    case "fat_loss": return "15-20 Reps";
    case "muscle_gain": return "8-12 Reps";
    case "strength": return "3-5 Reps";
    default: return "10-12 Reps";
  }
};

export const generateAdaptiveWorkout = (
  dayIndex: number, // 0(Mon) - 6(Sun)
  condition: UserCondition,
  goal: WorkoutGoal
): WorkoutSessionData => {
  // Schedule:
  // Mon: Push (Strength)
  // Tue: Run (Speed)
  // Wed: Pull (Strength)
  // Thu: Run (Easy)
  // Fri: Leg/Core (Strength)
  // Sat: Run (Long)
  // Sun: Mobility (Recovery)

  const schedule: WorkoutType[] = [
    "push",       // Mon
    "run_speed",  // Tue
    "pull",       // Wed
    "run_easy",   // Thu
    "leg_core",   // Fri
    "run_long",   // Sat
    "mobility",   // Sun
  ];

  const workoutType = schedule[dayIndex];
  const exercises: ExerciseStep[] = [];
  
  // Base sets & Reps based on Goal
  const sets = adjustVolume(3, condition, goal); 
  const repsStr = getRepsForGoal(goal);
  const repsVal = parseInt(repsStr) || 12;

  // 1. Dynamic Warm-up (5 min)
  let warmupFocus = "General Flow";
  let warmupDrill = "Jumping Jacks & Arm Circles";

  if (condition.bodyPart === "upper_stiff") {
    warmupFocus = "Thoracic & Shoulder Mobility";
    warmupDrill = pick(["Cat-Cow & Thoracic Rotation", "Kettlebell Halo", "Band Pull-Aparts"]);
  }
  if (condition.bodyPart === "lower_heavy") {
    warmupFocus = "Hip & Ankle Mobility";
    warmupDrill = pick(["90/90 Stretch & Leg Swings", "Kettlebell Prying Goblet Squat", "Deep Lunge Stretch"]);
  }
  
  exercises.push({
    type: "warmup",
    name: `Dynamic Warm-up: ${warmupDrill}`,
    count: "5 min",
    sets: 1,
    reps: 1,
  });

  // 2. Main Workout (40 min) - Expanded Exercise Pools with Kettlebells
  switch (workoutType) {
    case "push":
      // Slot 1: Main Compound Press (Chest Focus)
      const pushMain = pick(["Barbell Bench Press", "Dumbbell Bench Press", "Weighted Push-ups", "Kettlebell Floor Press"]);
      // Slot 2: Vertical Press (Shoulder Focus)
      const pushVertical = pick(["Overhead Press (OHP)", "Seated Dumbbell Press", "Arnold Press", "Kettlebell Overhead Press"]);
      // Slot 3: Accessory Press (Upper Chest/Stability)
      const pushAcc = pick(["Incline Dumbbell Press", "Landmine Press", "Dips (Chest Version)", "Bottoms-Up Kettlebell Press"]);
      // Slot 4: Isolation (Side Delt)
      const pushIso1 = pick(["Lateral Raises", "Cable Lateral Raises", "Upright Row"]);
      // Slot 5: Isolation (Triceps)
      const pushIso2 = pick(["Tricep Rope Pushdown", "Skullcrushers", "Overhead Tricep Extension"]);

      exercises.push(
        { type: "strength", name: pushMain, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: pushVertical, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: pushAcc, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: pushIso1, count: `${sets} Sets / 15 Reps`, weight: "Light", sets: sets, reps: 15 },
        { type: "strength", name: pushIso2, count: `${sets} Sets / 12-15 Reps`, weight: "Moderate", sets: sets, reps: 15 }
      );
      break;

    case "pull":
      // Slot 1: Vertical Pull (Lats)
      const pullVert = pick(["Pull-ups", "Lat Pulldown", "Chin-ups"]);
      // Slot 2: Horizontal Pull (Thickness)
      const pullHoriz = pick(["Barbell Row", "Pendlay Row", "T-Bar Row", "Kettlebell Gorilla Row"]);
      // Slot 3: Unilateral/Machine (Symmetry)
      const pullUni = pick(["One-Arm Dumbbell Row", "Seated Cable Row", "Chest Supported Row", "Kettlebell High Pull"]);
      // Slot 4: Rear Delt / Upper Back
      const pullRear = pick(["Face Pulls", "Rear Delt Fly (Machine/DB)", "Band Pull-Aparts"]);
      // Slot 5: Biceps
      const pullBi = pick(["Barbell Curl", "Hammer Curl", "Incline Dumbbell Curl"]);

      exercises.push(
        { type: "strength", name: pullVert, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: pullHoriz, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: pullUni, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: pullRear, count: `${sets} Sets / 15 Reps`, weight: "Light", sets: sets, reps: 15 },
        { type: "strength", name: pullBi, count: `${sets} Sets / 12 Reps`, weight: "Adaptive", sets: sets, reps: 12 }
      );
      break;

    case "leg_core":
      // Slot 1: Squat Pattern (Quads/Glutes)
      const legSquat = pick(["Back Squat", "Front Squat", "Goblet Squat", "Double Kettlebell Front Squat"]);
      // Slot 2: Hinge Pattern (Hamstrings/Glutes)
      const legHinge = pick(["Romanian Deadlift (RDL)", "Conventional Deadlift", "Kettlebell Swing", "Single-Leg Kettlebell RDL"]);
      // Slot 3: Unilateral (Stability)
      const legUni = pick(["Walking Lunges", "Bulgarian Split Squat", "Reverse Lunges", "Kettlebell Walking Lunge"]);
      // Slot 4: Machine/Isolation
      const legIso = pick(["Leg Press", "Leg Extension", "Hip Thrust"]);
      // Slot 5: Calves
      const legCalf = pick(["Standing Calf Raises", "Seated Calf Raises", "Donkey Calf Raises"]);

      exercises.push(
        { type: "strength", name: legSquat, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: legHinge, count: `${sets} Sets / ${repsStr}`, weight: "Adaptive", sets: sets, reps: repsVal },
        { type: "strength", name: legUni, count: `${sets} Sets / 12 Reps (Each)`, weight: "Bodyweight/DB", sets: sets, reps: 12 },
        { type: "strength", name: legIso, count: `${sets} Sets / 15 Reps`, weight: "Adaptive", sets: sets, reps: 15 },
        { type: "strength", name: legCalf, count: `${sets} Sets / 20 Reps`, weight: "Bodyweight", sets: sets, reps: 20 }
      );
      break;

    case "mobility":
      exercises.push(
        { type: "mobility", name: "Full Body Flow (Yoga)", count: "20 min Flow", sets: 1, reps: 1 },
        { type: "mobility", name: "Deep Squat Hold", count: "3 x 1 min", sets: 3, reps: 1 },
        { type: "mobility", name: "Kettlebell Windmill (Light)", count: "3 x 5 Each Side", sets: 3, reps: 5 },
        { type: "mobility", name: "Foam Rolling (Quads/Back)", count: "10 min Deep Tissue", sets: 1, reps: 1 }
      );
      break;

    case "run_speed":
      exercises.push({ type: "cardio", name: "Interval Run (Speed Work)", count: "10 x (1min Fast / 2min Slow)", sets: 1, reps: 1 });
      break;
    case "run_easy":
      exercises.push({ type: "cardio", name: "Recovery Run / Walk", count: "40 min Zone 2", sets: 1, reps: 1 });
      break;
    case "run_long":
      exercises.push({ type: "cardio", name: "LSD Run (Long Slow Distance)", count: "60+ min Pace Maintenance", sets: 1, reps: 1 });
      break;
  }

  // 3. Core (5 min) - Added to all strength days
  if (workoutType === "push" || workoutType === "pull" || workoutType === "leg_core") {
    const coreEx = pick(["Deadbug", "Plank", "Hanging Leg Raise", "Russian Twist", "Ab Wheel Rollout", "Kettlebell Around the World", "Kettlebell March"]);
    exercises.push(
      { type: "core", name: `Core Finisher: ${coreEx}`, count: "5 min Continuous", sets: 1, reps: 1 }
    );
  }

  // 4. Additional Cardio (Adaptive)
  if (!workoutType.startsWith("run") && workoutType !== "mobility") {
     let runName = "Recovery Run";
     let runCount = "20 min Zone 2";

     if (dayIndex === 2) { // Wednesday (Pull) -> Speed
        runName = "Interval Sprints";
        runCount = "15 min (30s On/30s Off)";
     } else if (dayIndex === 4) { // Friday (Legs) -> Very Light
        runName = "Cooldown Walk";
        runCount = "15 min Incline Walk";
     }
     
     exercises.push({ 
       type: "cardio", 
       name: `Additional Cardio: ${runName}`, 
       count: runCount,
       sets: 1,
       reps: 1,
     });
  } else if (workoutType.startsWith("run")) {
     exercises.push(
      { type: "mobility", name: "Post-Run Stretch (Calves/Hams)", count: "5 min", sets: 1, reps: 1 }
    );
  } else {
     // Mobility day
     exercises.push(
      { type: "mobility", name: "Light Walk", count: "20 min Nature Walk", sets: 1, reps: 1 }
    );
  }

  return {
    title: workoutType.toUpperCase().replace("_", " "),
    description: `${goal.toUpperCase().replace("_", " ")} FOCUS • ${sets} SETS`,
    exercises,
  };
};
