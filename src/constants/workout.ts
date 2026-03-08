export type WorkoutLevel = "beginner" | "intermediate" | "advanced";
export type ExerciseType = "warmup" | "strength" | "cardio" | "core" | "mobility";
export type WorkoutType = "push" | "pull" | "leg_core" | "mobility" | "run_easy" | "run_speed" | "run_long" | "full_body_circuit" | "hiit_cardio" | "lower_core" | "upper_cardio" | "full_body_mobility";

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
    bestE1RM?: number;
    bwRatio?: number;
    successRate?: number;
    loadScore?: number; // normalized session load
  };
  analysis?: WorkoutAnalysis;
}

// User Condition Interface (Updated)
export interface UserCondition {
  bodyPart: "upper_stiff" | "lower_heavy" | "full_fatigue" | "good";
  energyLevel: 1 | 2 | 3 | 4 | 5; // 1(Low) - 5(High)
  availableTime: 30 | 50 | 90; // minutes
  bodyWeightKg?: number; // User's body weight for BW ratio calculations
  gender?: "male" | "female";
  birthYear?: number;
}

// Workout Goal Interface
export type WorkoutGoal = "fat_loss" | "muscle_gain" | "strength" | "general_fitness";

// Helper: Pick random item from array
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
};

// ====== Korean Exercise Name Mappings ======
// Format: "한국어 이름 (English Name)" — MasterPlanPreview parses this with split('(')

// --- Warmup Pools by Condition ---
const WARMUP_POOLS: Record<UserCondition["bodyPart"], string[]> = {
  upper_stiff: [
    "폼롤러 흉추 스트레칭 (Foam Roller Thoracic Extension)",
    "캣-카멜 스트레칭 (Cat-Camel Stretch)",
    "벽 엔젤 (Wall Angel)",
    "견갑골 푸쉬업 플러스 (Scapular Push-up Plus)",
    "밴드 페이스 풀 (Band Face Pull)",
    "다이나믹 흉근 스트레칭 (Dynamic Pec Stretch)",
    "능동적 흉추 회전 (Active Thoracic Rotation)",
  ],
  lower_heavy: [
    "폼롤러 둔근 및 햄스트링 이완 (Foam Roller Glutes & Hamstrings Release)",
    "동적 고관절 굴곡근 스트레칭 (Dynamic Hip Flexor Stretch)",
    "고블렛 스쿼트 프라잉 (Prying Goblet Squat)",
    "고관절 90/90 스트레치 (Hip 90/90 Stretch)",
    "내전근 동적 스트레칭 (Adductor Dynamic Stretch)",
    "스파이더맨 런지 (Spiderman Lunge)",
  ],
  full_fatigue: [
    "폼롤러 흉추/광배근 마사지 (Foam Roller Thoracic & Lat Release)",
    "능동적 다리 스윙 (Dynamic Leg Swings)",
    "고관절 회전 (Hip Circles)",
    "캣 카멜 스트레치 (Cat-Camel Stretch)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
    "밴드 워크 (Band Walk)",
  ],
  good: [
    "고관절 굴곡근 스트레치 (Hip Flexor Stretch)",
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "월 슬라이드 (Wall Slides)",
    "밴드 풀 어파트 (Band Pull-Apart)",
    "팔 흔들기 (Arm Swings)",
    "동적 런지 (Dynamic Lunge)",
  ],
};

// Warmup pools for run sessions — condition-aware
const WARMUP_POOLS_RUN: Record<UserCondition["bodyPart"], string[]> = {
  upper_stiff: [
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "벽 흉추 스트레칭 (Wall Thoracic Stretch)",
    "폼롤러 등 마사지 (Foam Roller Thoracic Extension)",
    "다이내믹 가슴 열기 (Dynamic Chest Openers)",
    "암 서클 전/후방 (Arm Circles)",
    "동적 팔 스윙 (Dynamic Arm Swings)",
  ],
  lower_heavy: [
    "폼롤러 햄스트링/둔근 이완 (Foam Roll Hamstrings & Glutes)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
    "동적 스트레칭: 런지 & 트위스트 (Lunge & Twist)",
    "동적 다리 스윙 (Dynamic Leg Swings)",
    "내전근 동적 스트레칭 (Adductor Dynamic Stretch)",
  ],
  full_fatigue: [
    "폼롤러 둔근 및 햄스트링 이완 (Foam Rolling Glutes & Hamstrings)",
    "동적 스트레칭: 다리 스윙 앞/옆 (Dynamic Leg Swings)",
    "걷기 또는 가벼운 조깅 (Walking or Light Jog)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
    "캣 카멜 스트레치 (Cat-Camel Stretch)",
  ],
  good: [
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "폼롤러 등 마사지 (Foam Roller Thoracic Extension)",
    "동적 팔 스윙 (Dynamic Arm Swings)",
    "워킹 런지 (Walking Lunge)",
    "동적 다리 스윙 (Dynamic Leg Swings)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
  ],
};

// Warmup pools for mobility sessions — condition-aware
const WARMUP_POOLS_MOBILITY: Record<UserCondition["bodyPart"], string[]> = {
  upper_stiff: [
    "폼롤러 흉추 스트레칭 (Foam Roller Thoracic Extension)",
    "능동적 흉추 회전 (Active Thoracic Rotation)",
    "팔 흔들기 (Arm Swings)",
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "다이나믹 흉근 스트레칭 (Dynamic Pec Stretch)",
  ],
  lower_heavy: [
    "폼롤러 둔근 및 햄스트링 이완 (Foam Roller Glutes & Hamstrings Release)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
    "내전근 동적 스트레칭 (Adductor Dynamic Stretch)",
    "고관절 90/90 스트레치 (Hip 90/90 Stretch)",
  ],
  full_fatigue: [
    "폼롤러 등 상부 및 둔근 이완 (Foam Roller Upper Back & Glute Release)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
    "캣-카멜 (Cat-Camel)",
    "고관절 회전 (Hip Circles)",
  ],
  good: [
    "폼롤러 흉추 스트레칭 (Foam Roller Thoracic Stretch)",
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "밴드 풀 어파트 (Band Pull-Apart)",
    "고관절 회전 (Hip Circles)",
    "폼롤러 둔근 이완 (Foam Roller Glutes Release)",
  ],
};

// --- Main Exercise Pools (Korean) ---
const PUSH_EXERCISES = {
  mainCompound: [
    "바벨 벤치 프레스 (Barbell Bench Press)",
    "덤벨 벤치 프레스 (Dumbbell Bench Press)",
    "웨이티드 푸쉬업 (Weighted Push-ups)",
    "케틀벨 플로어 프레스 (Kettlebell Floor Press)",
  ],
  verticalPress: [
    "오버헤드 프레스 (Overhead Press)",
    "덤벨 숄더 프레스 (Seated Dumbbell Press)",
    "아놀드 프레스 (Arnold Press)",
    "케틀벨 오버헤드 프레스 (Kettlebell Overhead Press)",
  ],
  accessory: [
    "인클라인 덤벨 프레스 (Incline Dumbbell Press)",
    "랜드마인 프레스 (Landmine Press)",
    "딥스 (Dips - Chest Version)",
    "바텀스업 케틀벨 프레스 (Bottoms-Up Kettlebell Press)",
  ],
  isoShoulder: [
    "레터럴 레이즈 (Lateral Raises)",
    "케이블 레터럴 레이즈 (Cable Lateral Raises)",
    "업라이트 로우 (Upright Row)",
  ],
  isoTricep: [
    "트라이셉 로프 푸쉬다운 (Tricep Rope Pushdown)",
    "스컬크러셔 (Skullcrushers)",
    "오버헤드 트라이셉 익스텐션 (Overhead Tricep Extension)",
    "케이블 푸쉬 다운 (Cable Pushdown)",
  ],
};

const PULL_EXERCISES = {
  verticalPull: [
    "풀업 (Pull-ups)",
    "랫 풀다운 (Lat Pulldown)",
    "친업 (Chin-ups)",
    "풀업 또는 랫 풀다운 (Pull-ups or Lat Pulldown)",
  ],
  horizontalPull: [
    "바벨 로우 (Barbell Row)",
    "펜들레이 로우 (Pendlay Row)",
    "티바 로우 (T-Bar Row)",
    "케틀벨 고릴라 로우 (Kettlebell Gorilla Row)",
  ],
  unilateral: [
    "싱글 암 덤벨 로우 (Single Arm Dumbbell Row)",
    "시티드 케이블 로우 (Seated Cable Row)",
    "체스트 서포티드 로우 (Chest Supported Row)",
    "케이블 로우 (Cable Row)",
  ],
  rearDelt: [
    "페이스 풀 (Face Pulls)",
    "리어 델트 플라이 (Rear Delt Fly)",
    "밴드 풀 어파트 (Band Pull-Aparts)",
  ],
  bicep: [
    "바벨 컬 (Barbell Curl)",
    "해머 컬 (Hammer Curl)",
    "인클라인 덤벨 컬 (Incline Dumbbell Curl)",
  ],
};

const LEG_EXERCISES = {
  squat: [
    "바벨 백 스쿼트 (Barbell Back Squat)",
    "프론트 스쿼트 (Front Squat)",
    "고블렛 스쿼트 (Goblet Squat)",
    "더블 케틀벨 프론트 스쿼트 (Double Kettlebell Front Squat)",
    "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)",
  ],
  hinge: [
    "루마니안 데드리프트 (Romanian Deadlift)",
    "컨벤셔널 데드리프트 (Conventional Deadlift)",
    "케틀벨 스윙 (Kettlebell Swing)",
    "싱글 레그 케틀벨 RDL (Single-Leg Kettlebell RDL)",
    "케틀벨 데드리프트 (Kettlebell Deadlift)",
  ],
  unilateral: [
    "워킹 런지 (Walking Lunges)",
    "불가리안 스플릿 스쿼트 (Bulgarian Split Squat)",
    "리버스 런지 (Reverse Lunges)",
    "케틀벨 워킹 런지 (Kettlebell Walking Lunge)",
  ],
  isolation: [
    "레그 프레스 (Leg Press)",
    "레그 익스텐션 (Leg Extension)",
    "덤벨 힙 쓰러스트 (Dumbbell Hip Thrust)",
    "힙 쓰러스트 (Hip Thrust)",
    "케이블 풀 스루 (Cable Pull-Through)",
  ],
  calf: [
    "스탠딩 카프 레이즈 (Standing Calf Raises)",
    "시티드 카프 레이즈 (Seated Calf Raises)",
    "동키 카프 레이즈 (Donkey Calf Raises)",
  ],
};

const FULL_BODY_EXERCISES = {
  compound: [
    "덤벨 스러스터 (Dumbbell Thruster)",
    "케틀벨 스윙 (Kettlebell Swing)",
    "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)",
    "바벨 백 스쿼트 (Barbell Back Squat)",
  ],
  upper: [
    "덤벨 벤치 프레스 (Dumbbell Bench Press)",
    "푸쉬업 (Push-up)",
    "오버헤드 프레스 (Overhead Press)",
  ],
  pull: [
    "케이블 로우 (Cable Row)",
    "덤벨 로우 (Dumbbell Row)",
    "풀업 또는 랫 풀다운 (Pull-ups or Lat Pulldown)",
  ],
  lower: [
    "고블렛 스쿼트 (Goblet Squat)",
    "리버스 런지 (Reverse Lunges)",
    "원 레그 루마니안 데드리프트 (Single Leg RDL)",
  ],
};

// --- Core Exercise Pools (Korean) ---
const CORE_EXERCISES = {
  plank: [
    "플랭크 (Plank)",
    "사이드 플랭크 (Side Plank)",
  ],
  dynamic: [
    "러시안 트위스트 (Russian Twist)",
    "데드버그 (Deadbug)",
    "버드 독 (Bird Dog)",
    "행잉 레그 레이즈 (Hanging Leg Raise)",
    "앱 휠 롤아웃 (Ab Wheel Rollout)",
  ],
  mobility_core: [
    "고양이-소 자세 (Cat-Cow Pose)",
    "90/90 힙 로테이션 (90/90 Hip Rotation)",
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "딥 스쿼트 홀드 (Deep Squat Hold)",
    "세계에서 가장 위대한 스트레치 (World's Greatest Stretch)",
    "월 앵클 모빌리티 (Wall Ankle Mobility)",
    "나비 자세 (Butterfly Pose)",
    "개구리 자세 (Frog Pose)",
    "피죤 자세 (Pigeon Pose)",
    "만세 스쿼트 홀드 (Overhead Squat Hold)",
    "능동적 다리 들어올리기 (Active Straight Leg Raise)",
    "케틀벨 고블릿 스쿼트 자세 유지 (Kettlebell Prying Goblet Squat Hold)",
  ],
  // Condition-specific mobility main exercises
  mobility_upper: [
    "상체 이완 플로우 (Upper Body Release Flow)",
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "월 앵글 (Wall Angel)",
    "밴드 풀 어파트 (Band Pull-Aparts)",
    "다이나믹 흉근 스트레칭 (Dynamic Pec Stretch)",
    "폼롤러 흉추 가동성 (Foam Roller Thoracic Mobility)",
  ],
  mobility_lower: [
    "90/90 고관절 회전 (90/90 Hip Rotation)",
    "나비 자세 심화 (Butterfly Pose)",
    "개구리 자세 (Frog Pose)",
    "피죤 자세 (Pigeon Pose)",
    "만세 스쿼트 홀드 프라잉 (Overhead Squat Hold - Prying)",
    "월 앵클 모빌리티 (Wall Ankle Mobility)",
  ],
  mobility_full: [
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "90/90 힙 로테이션 (90/90 Hip Rotation)",
    "월 앵클 모빌리티 (Wall Ankle Mobility)",
    "흉추 회전 운동 (Thoracic Rotation)",
    "딥 스쿼트 홀드 (Deep Squat Hold)",
    "세계에서 가장 위대한 스트레치 (World's Greatest Stretch)",
  ],
};

// --- Additional Cardio Pools (Korean) ---
const ADDITIONAL_CARDIO = {
  light: [
    "추가 유산소: 가벼운 조깅 또는 걷기 (Light Jog or Walk)",
    "추가 유산소: 인클라인 워킹 (Incline Walking)",
    "추가 유산소: 가벼운 걷기 (Light Walking)",
  ],
  moderate: [
    "추가 유산소: 조깅 (Jogging)",
    "추가 유산소: 중강도 러닝 (Moderate Running)",
  ],
  cooldown: [
    "추가 추천: 이완 스트레칭 및 심호흡 (Cool-down Stretch & Deep Breathing)",
    "추가 유산소: 쿨다운 스트레칭 및 이완 (Cool-down Stretching)",
    "추가 추천: 전신 스트레칭 및 폼롤링 (Full Body Stretching & Foam Rolling)",
  ],
};

// --- Weight Guidance (Korean) ---
const getWeightGuide = (role: "compound" | "accessory" | "isolation" | "light" | "bodyweight", goal: WorkoutGoal): string => {
  if (role === "bodyweight") return "맨몸";
  if (role === "light") return "가벼운 무게";

  switch (goal) {
    case "strength":
      if (role === "compound") return "점진적 증량";
      if (role === "accessory") return "도전적인 무게";
      return "적당한 무게";
    case "muscle_gain":
      if (role === "compound") return "가능한 최대 무게";
      if (role === "accessory") return "적당한 무게";
      return "적당한 무게";
    case "fat_loss":
      if (role === "compound") return "중간 무게";
      return "가벼운~중간 무게";
    case "general_fitness":
      return "중간 무게";
  }
};

// --- Korean Count Formatter ---
const formatCountKo = (sets: number, reps: string | number, suffix?: string): string => {
  const repsStr = typeof reps === "number" ? `${reps}회` : reps.replace(/Reps/gi, "회").replace(/Each/gi, "양측").replace(/Sets/gi, "세트");
  return `${sets}세트 / ${repsStr}${suffix ? ` ${suffix}` : ""}`;
};
const formatTimeKo = (minutes: number, label?: string): string => {
  return `${minutes}분${label ? ` ${label}` : ""}`;
};

// --- Korean Reps for Goal ---
const getRepsForGoalKo = (goal: WorkoutGoal): string => {
  switch (goal) {
    case "fat_loss": return "15-20회";
    case "muscle_gain": return "8-12회";
    case "strength": return "3-5회";
    case "general_fitness": return "10-15회";
    default: return "10-12회";
  }
};

// --- Korean Title/Description Templates ---
const SESSION_TITLES: Record<string, Record<WorkoutGoal, string>> = {
  push: {
    muscle_gain: "푸시 데이 - 근비대 훈련",
    strength: "푸시 데이 - 근력 강화",
    fat_loss: "푸시 데이 - 체지방 감량",
    general_fitness: "전신 서킷 트레이닝",
  },
  pull: {
    muscle_gain: "풀 데이 - 근비대 훈련",
    strength: "풀 데이 - 근력 강화",
    fat_loss: "풀 데이 - 체지방 감량",
    general_fitness: "하체/코어 트레이닝",
  },
  leg_core: {
    muscle_gain: "레그 데이 - 근비대 훈련",
    strength: "레그 데이 - 근력 강화",
    fat_loss: "레그 데이 - 체지방 감량",
    general_fitness: "상체/유산소 트레이닝",
  },
  run_speed: {
    muscle_gain: "스피드 러닝",
    strength: "인터벌 러닝",
    fat_loss: "인터벌 러닝 - 지방 연소",
    general_fitness: "HIIT 유산소",
  },
  run_easy: {
    muscle_gain: "회복 러닝",
    strength: "회복 러닝",
    fat_loss: "존2 러닝 - 지방 연소",
    general_fitness: "가벼운 유산소",
  },
  run_long: {
    muscle_gain: "장거리 러닝",
    strength: "장거리 러닝",
    fat_loss: "LSD 러닝 - 지방 연소",
    general_fitness: "장거리 유산소",
  },
  mobility: {
    muscle_gain: "모빌리티 - 회복",
    strength: "모빌리티 - 회복",
    fat_loss: "모빌리티 - 회복",
    general_fitness: "모빌리티 - 회복",
  },
  full_body_circuit: {
    muscle_gain: "전신 서킷 - 근비대",
    strength: "전신 서킷 - 근력",
    fat_loss: "전신 서킷 - 지방 연소",
    general_fitness: "전신 서킷 트레이닝",
  },
  hiit_cardio: {
    muscle_gain: "HIIT 유산소",
    strength: "HIIT 유산소",
    fat_loss: "HIIT - 지방 연소",
    general_fitness: "HIIT 유산소",
  },
  lower_core: {
    muscle_gain: "하체/코어 - 근비대",
    strength: "하체/코어 - 근력",
    fat_loss: "하체/코어 - 지방 연소",
    general_fitness: "하체/코어 트레이닝",
  },
  upper_cardio: {
    muscle_gain: "상체/유산소 - 근비대",
    strength: "상체/유산소 - 근력",
    fat_loss: "상체/유산소 - 지방 연소",
    general_fitness: "상체/유산소 트레이닝",
  },
  full_body_mobility: {
    muscle_gain: "전신 모빌리티",
    strength: "전신 모빌리티",
    fat_loss: "전신 모빌리티 - 회복",
    general_fitness: "전신 모빌리티 트레이닝",
  },
};

const getSessionDescription = (workoutType: string, goal: WorkoutGoal, sets: number, condition: UserCondition): string => {
  const conditionMap: Record<string, string> = {
    upper_stiff: "상체 뻣뻣함 개선",
    lower_heavy: "하체 무거움 완화",
    full_fatigue: "전반적 피로 회복",
    good: "최적 컨디션",
  };
  const goalMap: Record<string, string> = {
    muscle_gain: "근비대",
    strength: "근력 강화",
    fat_loss: "체지방 감량",
    general_fitness: "전반적 체력 향상",
  };
  return `${goalMap[goal]} • ${conditionMap[condition.bodyPart]} • ${sets}세트`;
};

// Adaptive Logic: Adjust volume/intensity based on condition & goal
const adjustVolume = (baseSets: number, condition: UserCondition, goal: WorkoutGoal): number => {
  let sets = baseSets;

  if (condition.bodyPart === "full_fatigue" || condition.energyLevel <= 2) {
    sets = Math.max(2, sets - 1);
  } else if (condition.energyLevel >= 4) {
    sets += 1;
  }

  if (goal === "muscle_gain") sets += 1;
  if (goal === "strength") sets = Math.max(3, sets - 1);
  if (goal === "general_fitness") sets = Math.max(2, Math.min(sets, 3));

  return sets;
};

export const generateAdaptiveWorkout = (
  dayIndex: number, // 0(Mon) - 6(Sun)
  condition: UserCondition,
  goal: WorkoutGoal
): WorkoutSessionData => {
  const generalFitnessSchedule: WorkoutType[] = [
    "full_body_circuit", "hiit_cardio", "lower_core",
    "upper_cardio", "full_body_mobility", "mobility", "mobility",
  ];
  const defaultSchedule: WorkoutType[] = [
    "push", "run_speed", "pull", "run_easy", "leg_core", "run_long", "mobility",
  ];

  const schedule = goal === "general_fitness" ? generalFitnessSchedule : defaultSchedule;
  const workoutType = schedule[dayIndex];
  const exercises: ExerciseStep[] = [];
  const sets = adjustVolume(3, condition, goal);
  const repsKo = getRepsForGoalKo(goal);
  const repsVal = parseInt(repsKo) || 12;

  // ====== 1. WARM-UP (3-5 exercises, 5 min total) ======
  const isRunType = workoutType.startsWith("run");
  const isMobility = workoutType === "mobility" || workoutType === "full_body_mobility";

  let warmupPool: string[];
  if (isRunType) {
    warmupPool = WARMUP_POOLS_RUN[condition.bodyPart];
  } else if (isMobility) {
    warmupPool = WARMUP_POOLS_MOBILITY[condition.bodyPart];
  } else {
    warmupPool = WARMUP_POOLS[condition.bodyPart];
  }

  const warmupCount = condition.availableTime === 30 ? 3 : condition.availableTime === 90 ? 5 : 4;
  const selectedWarmups = pickN(warmupPool, warmupCount);
  const warmupTimeEach = Math.floor(5 / selectedWarmups.length);

  for (const wu of selectedWarmups) {
    exercises.push({
      type: "warmup",
      name: wu,
      count: formatTimeKo(warmupTimeEach),
      sets: 1,
      reps: 1,
    });
  }

  // ====== 2. MAIN WORKOUT (40 min) ======
  // Fatigue-adaptive: prefer lighter equipment when fatigued
  const isFatigued = condition.bodyPart === "full_fatigue" || condition.energyLevel <= 2;
  const fatigueWeightOverride = isFatigued ? "적당한 무게" : undefined;

  switch (workoutType) {
    case "push": {
      // When fatigued, prefer dumbbell/kettlebell over barbell
      const pushCompoundPool = isFatigued
        ? ["덤벨 벤치 프레스 (Dumbbell Bench Press)", "케틀벨 플로어 프레스 (Kettlebell Floor Press)", "푸쉬업 (Push-up)"]
        : PUSH_EXERCISES.mainCompound;
      exercises.push(
        { type: "strength", name: pick(pushCompoundPool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("compound", goal), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.verticalPress), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("compound", goal), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.accessory), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("accessory", goal), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.isoShoulder), count: formatCountKo(sets, "15회"), weight: getWeightGuide("light", goal), sets, reps: 15 },
        { type: "strength", name: pick(PUSH_EXERCISES.isoTricep), count: formatCountKo(sets, "12-15회"), weight: getWeightGuide("isolation", goal), sets, reps: 15 },
      );
      break;
    }
    case "pull": {
      const pullCompoundPool = isFatigued
        ? ["랫 풀다운 (Lat Pulldown)", "케이블 로우 (Cable Row)", "싱글 암 덤벨 로우 (Single Arm Dumbbell Row)"]
        : PULL_EXERCISES.verticalPull;
      exercises.push(
        { type: "strength", name: pick(pullCompoundPool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("compound", goal), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.horizontalPull), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("compound", goal), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.unilateral), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("accessory", goal), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.rearDelt), count: formatCountKo(sets, "15회"), weight: getWeightGuide("light", goal), sets, reps: 15 },
        { type: "strength", name: pick(PULL_EXERCISES.bicep), count: formatCountKo(sets, "12회"), weight: getWeightGuide("isolation", goal), sets, reps: 12 },
      );
      break;
    }
    case "leg_core": {
      const legCompoundPool = isFatigued
        ? ["고블렛 스쿼트 (Goblet Squat)", "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)"]
        : LEG_EXERCISES.squat;
      const legHingePool = isFatigued
        ? ["케틀벨 스윙 (Kettlebell Swing)", "케틀벨 데드리프트 (Kettlebell Deadlift)"]
        : LEG_EXERCISES.hinge;
      exercises.push(
        { type: "strength", name: pick(legCompoundPool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("compound", goal), sets, reps: repsVal },
        { type: "strength", name: pick(legHingePool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || getWeightGuide("compound", goal), sets, reps: repsVal },
        { type: "strength", name: pick(LEG_EXERCISES.unilateral), count: formatCountKo(sets, "12회 양측"), weight: fatigueWeightOverride || getWeightGuide("accessory", goal), sets, reps: 12 },
        { type: "strength", name: pick(LEG_EXERCISES.isolation), count: formatCountKo(sets, "15회"), weight: fatigueWeightOverride || getWeightGuide("isolation", goal), sets, reps: 15 },
        { type: "strength", name: pick(LEG_EXERCISES.calf), count: formatCountKo(sets, "20회"), weight: "맨몸", sets, reps: 20 },
      );
      break;
    }
    case "run_speed": {
      const speedVariant = pick([
        { name: "인터벌 러닝 (Interval Running)", count: "30분" },
        { name: "변속주 (Fartlek Run)", count: "40분" },
        { name: "인터벌 스프린트 (Interval Sprints)", count: "20분 (30초 전력/90초 회복 × 10)" },
      ]);
      exercises.push({ type: "cardio", name: speedVariant.name, count: speedVariant.count, sets: 1, reps: 1 });
      break;
    }
    case "run_easy": {
      const easyVariant = pick([
        { name: "회복 러닝: 존 2 유지 (Recovery Run: Zone 2)", count: "40분" },
        { name: "준비 런: 가벼운 조깅 (Easy Jog)", count: "30분" },
        { name: "이지 런: 대화 가능 속도 (Conversational Pace Run)", count: "35분" },
      ]);
      exercises.push({ type: "cardio", name: easyVariant.name, count: easyVariant.count, sets: 1, reps: 1 });
      break;
    }
    case "run_long": {
      const longVariant = pick([
        { name: "장거리 러닝 (Long Slow Distance Run)", count: "60분 이상" },
        { name: "LSD 러닝: 페이스 유지 (LSD Run: Pace Maintenance)", count: "60-90분" },
      ]);
      exercises.push({ type: "cardio", name: longVariant.name, count: longVariant.count, sets: 1, reps: 1 });
      break;
    }
    case "mobility": {
      // Condition-specific mobility pool
      let mobilityPool: string[];
      if (condition.bodyPart === "upper_stiff") {
        mobilityPool = CORE_EXERCISES.mobility_upper;
      } else if (condition.bodyPart === "lower_heavy") {
        mobilityPool = CORE_EXERCISES.mobility_lower;
      } else if (condition.bodyPart === "full_fatigue") {
        mobilityPool = CORE_EXERCISES.mobility_full;
      } else {
        mobilityPool = CORE_EXERCISES.mobility_core;
      }

      const mobilityExercises = pickN(mobilityPool, 5);
      for (const ex of mobilityExercises) {
        exercises.push({
          type: "core",
          name: ex,
          count: formatCountKo(3, "각 방향 8회"),
          sets: 3,
          reps: 8,
        });
      }
      exercises.push(
        { type: "core", name: pick(CORE_EXERCISES.plank), count: "각 측 30초 유지", sets: 2, reps: 1 },
        { type: "core", name: "버드 독 (Bird Dog)", count: "각 측 10회", sets: 2, reps: 10 },
      );
      break;
    }
    // === General Fitness Circuit Types ===
    case "full_body_circuit": {
      const circuitReps = 12;
      exercises.push(
        { type: "strength", name: pick(FULL_BODY_EXERCISES.compound), count: formatCountKo(sets, `${circuitReps}회`), weight: "중간 무게", sets, reps: circuitReps },
        { type: "strength", name: pick(FULL_BODY_EXERCISES.upper), count: formatCountKo(sets, `${circuitReps}회`), weight: "중간 무게", sets, reps: circuitReps },
        { type: "strength", name: pick(FULL_BODY_EXERCISES.pull), count: formatCountKo(sets, `${circuitReps}회`), weight: "중간 무게", sets, reps: circuitReps },
        { type: "strength", name: pick(FULL_BODY_EXERCISES.lower), count: formatCountKo(sets, `${circuitReps}회`), weight: "중간 무게", sets, reps: circuitReps },
        { type: "strength", name: pick(LEG_EXERCISES.unilateral), count: formatCountKo(sets, `${circuitReps}회 양측`), weight: "맨몸", sets, reps: circuitReps },
      );
      break;
    }
    case "hiit_cardio": {
      const hiitExercises = [
        pick(["버피 (Burpees)", "스쿼트 점프 (Squat Jumps)", "스텝아웃 버피 (Step-out Burpees)"]),
        pick(["마운틴 클라이머 (Mountain Climbers)", "하이니즈 (High Knees)", "제자리 걸음 (Marching in Place)"]),
        pick(["점프 런지 (Jump Lunges)", "스피드 스케이터 (Speed Skaters)", "리버스 런지 (Alternating Reverse Lunges)"]),
        pick(["플랭크 잭 (Plank Jacks)", "점핑 잭 (Jumping Jacks)", "스텝 잭 (Step Jacks)"]),
      ];
      for (const ex of hiitExercises) {
        exercises.push({ type: "cardio", name: ex, count: "30초 운동 / 15초 휴식 × 4라운드", sets: 4, reps: 1 });
      }
      break;
    }
    case "lower_core": {
      const lcReps = 12;
      exercises.push(
        { type: "strength", name: pick(LEG_EXERCISES.squat), count: formatCountKo(sets, `${lcReps}회`), weight: "중간 무게", sets, reps: lcReps },
        { type: "strength", name: pick(LEG_EXERCISES.hinge), count: formatCountKo(sets, `${lcReps}회`), weight: "중간 무게", sets, reps: lcReps },
        { type: "strength", name: pick(LEG_EXERCISES.unilateral), count: formatCountKo(sets, `${lcReps}회 양측`), weight: "맨몸", sets, reps: lcReps },
        { type: "core", name: pick(CORE_EXERCISES.plank), count: formatCountKo(sets, "30초"), sets, reps: 1 },
        { type: "core", name: pick(CORE_EXERCISES.dynamic), count: formatCountKo(sets, "30초"), sets, reps: 1 },
      );
      break;
    }
    case "upper_cardio": {
      const ucReps = 12;
      exercises.push(
        { type: "strength", name: pick(PUSH_EXERCISES.mainCompound), count: formatCountKo(sets, `${ucReps}회`), weight: "중간 무게", sets, reps: ucReps },
        { type: "strength", name: pick(PULL_EXERCISES.unilateral), count: formatCountKo(sets, `${ucReps}회`), weight: "중간 무게", sets, reps: ucReps },
        { type: "strength", name: pick(PUSH_EXERCISES.isoShoulder), count: formatCountKo(sets, `${ucReps}회`), weight: "가벼운 무게", sets, reps: ucReps },
        { type: "cardio", name: pick(["점핑 잭 (Jumping Jacks)", "섀도 복싱 (Shadow Boxing)", "스텝 잭 (Step Jacks)"]), count: "3 × 2분 운동 / 30초 휴식", sets: 3, reps: 1 },
      );
      break;
    }
    case "full_body_mobility": {
      exercises.push(
        { type: "strength", name: pick(["터키시 겟업 (Turkish Get-up)", "케틀벨 윈드밀 (Kettlebell Windmill)", "베어 크롤 (Bear Crawl)"]), count: formatCountKo(sets, "5회 양측"), weight: "가벼운 무게", sets, reps: 5 },
        { type: "core", name: pick(CORE_EXERCISES.dynamic), count: formatCountKo(sets, "30초"), sets, reps: 1 },
        { type: "mobility", name: pick(CORE_EXERCISES.mobility_core), count: "3 × 1분 유지", sets: 3, reps: 1 },
        { type: "mobility", name: pick(["폼롤링 전신 (Foam Rolling Full Body)", "가벼운 요가 플로우 (Light Yoga Flow)"]), count: "10분", sets: 1, reps: 1 },
      );
      break;
    }
  }

  // ====== 3. CORE (5 min, 2-3 exercises) ======
  if (workoutType === "push" || workoutType === "pull" || workoutType === "leg_core") {
    const corePlank = pick(CORE_EXERCISES.plank);
    const coreDynamic = pick(CORE_EXERCISES.dynamic);
    exercises.push(
      { type: "core", name: corePlank, count: formatCountKo(3, "30-45초 유지"), sets: 3, reps: 1 },
      { type: "core", name: coreDynamic, count: formatCountKo(3, "10회"), sets: 3, reps: 10 },
    );
  }

  // ====== 4. ADDITIONAL CARDIO ======
  const isCircuitType = ["full_body_circuit", "hiit_cardio", "lower_core", "upper_cardio", "full_body_mobility"].includes(workoutType);
  if (isCircuitType) {
    exercises.push({ type: "cardio", name: pick(ADDITIONAL_CARDIO.cooldown), count: "10분", sets: 1, reps: 1 });
  } else if (!isRunType && !isMobility) {
    // Strength days — additional cardio
    if (condition.bodyPart === "full_fatigue" || condition.energyLevel <= 2) {
      exercises.push({ type: "cardio", name: pick(ADDITIONAL_CARDIO.light), count: "15-20분", sets: 1, reps: 1 });
    } else {
      exercises.push({ type: "cardio", name: pick(ADDITIONAL_CARDIO.moderate), count: "15-20분", sets: 1, reps: 1 });
    }
  } else if (isRunType) {
    exercises.push({ type: "cardio", name: pick(ADDITIONAL_CARDIO.cooldown), count: "10분", sets: 1, reps: 1 });
  } else {
    // Mobility day
    exercises.push({ type: "cardio", name: "추가 추천: 편안한 속도 걷기 또는 가벼운 스트레칭 (Light Walking or Stretching)", count: "15-20분", sets: 1, reps: 1 });
  }

  // ====== Build title & description ======
  const days = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
  const dayName = days[dayIndex];
  const titleBase = SESSION_TITLES[workoutType]?.[goal] || SESSION_TITLES["mobility"][goal];

  return {
    title: `${dayName}: ${titleBase}`,
    description: getSessionDescription(workoutType, goal, sets, condition),
    exercises,
  };
};
