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
  timestamp?: number; // epoch ms when this set was completed
}

/** Per-exercise timing recorded by WorkoutSession */
export interface ExerciseTiming {
  exerciseIndex: number;
  startedAt: number;  // epoch ms
  endedAt: number;    // epoch ms
  durationSec: number;
}

export interface WorkoutSessionData {
  title: string;
  description: string;
  exercises: ExerciseStep[];
}

export interface BriefingStructured {
  headline: string;
  weekProgress: string;
  insight: string;
  action: string;
}

export interface WorkoutAnalysis {
  briefing: string | BriefingStructured;
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
    totalDurationSec?: number;
    bestE1RM?: number;
    bwRatio?: number;
    successRate?: number;
    loadScore?: number; // normalized session load
  };
  exerciseTimings?: ExerciseTiming[];
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
    "날개뼈 푸쉬업 플러스 (Scapular Push-up Plus)",
    "밴드 페이스 풀 (Band Face Pull)",
    "동적 흉근 스트레칭 (Dynamic Pec Stretch)",
    "동적 흉추 회전 (Active Thoracic Rotation)",
    "숄더 CARs (Shoulder CARs)",
    "벽 흉추 회전 (Wall Thoracic Rotations)",
    "어깨 회전 및 견갑골 움직임 (Shoulder Rotations & Scapular Mobility)",
    "어깨 돌리기 (Shoulder Circles)",
  ],
  lower_heavy: [
    "폼롤러 둔근 및 햄스트링 이완 (Foam Roller Glutes & Hamstrings Release)",
    "동적 고관절 굴곡근 스트레칭 (Dynamic Hip Flexor Stretch)",
    "고블렛 스쿼트 프라잉 (Prying Goblet Squat)",
    "고관절 90/90 스트레치 (Hip 90/90 Stretch)",
    "내전근 동적 스트레칭 (Adductor Dynamic Stretch)",
    "스파이더맨 런지 (Spiderman Lunge)",
    "힙 CARs (Hip CARs)",
  ],
  full_fatigue: [
    "폼롤러 흉추/광배근 마사지 (Foam Roller Thoracic & Lat Release)",
    "동적 다리 스윙 (Dynamic Leg Swings)",
    "고관절 회전 (Hip Circles)",
    "캣 카멜 스트레치 (Cat-Camel Stretch)",
    "앞벅지 스트레칭 (Hip Flexor Stretch)",
    "밴드 워크 (Band Walk)",
    "숄더 CARs (Shoulder CARs)",
    "힙 CARs (Hip CARs)",
  ],
  good: [
    "앞벅지 스트레치 (Hip Flexor Stretch)",
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "월 슬라이드 (Wall Slides)",
    "밴드 풀 어파트 (Band Pull-Apart)",
    "팔 흔들기 (Arm Swings)",
    "동적 런지 (Dynamic Lunge)",
    "숄더 CARs (Shoulder CARs)",
    "힙 CARs (Hip CARs)",
  ],
};

// Warmup pools for run sessions — condition-aware
const WARMUP_POOLS_RUN: Record<UserCondition["bodyPart"], string[]> = {
  upper_stiff: [
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "벽 흉추 스트레칭 (Wall Thoracic Stretch)",
    "폼롤러 등 마사지 (Foam Roller Thoracic Extension)",
    "동적 가슴 스트레칭 (Dynamic Chest Openers)",
    "암 서클 전/후방 (Arm Circles)",
    "동적 팔 스윙 (Dynamic Arm Swings)",
    "숄더 CARs (Shoulder CARs)",
    "벽 흉추 회전 (Wall Thoracic Rotations)",
    "어깨 회전 및 날개뼈 움직임 (Shoulder Rotations & Scapular Mobility)",
  ],
  lower_heavy: [
    "폼롤러 햄스트링/둔근 이완 (Foam Roll Hamstrings & Glutes)",
    "앞벅지 스트레칭 (Hip Flexor Stretch)",
    "동적 스트레칭: 런지 & 트위스트 (Lunge & Twist)",
    "동적 다리 스윙 (Dynamic Leg Swings)",
    "안벅지 동적 스트레칭 (Adductor Dynamic Stretch)",
    "힙 CARs (Hip CARs)",
    "앵클 CARs (Ankle CARs)",
  ],
  full_fatigue: [
    "폼롤러 둔근 및 햄스트링 이완 (Foam Rolling Glutes & Hamstrings)",
    "동적 스트레칭: 다리 스윙 앞/옆 (Dynamic Leg Swings)",
    "걷기 또는 가벼운 조깅 (Walking or Light Jog)",
    "앞벅지 스트레칭 (Hip Flexor Stretch)",
    "캣 카멜 스트레치 (Cat-Camel Stretch)",
    "힙 CARs (Hip CARs)",
  ],
  good: [
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "고양이-낙타 자세 (Cat-Camel Pose)",
    "폼롤러 등 마사지 (Foam Roller Thoracic Extension)",
    "동적 팔 스윙 (Dynamic Arm Swings)",
    "워킹 런지 (Walking Lunge)",
    "동적 다리 스윙 (Dynamic Leg Swings)",
    "고관절 굴곡근 스트레칭 (Hip Flexor Stretch)",
    "숄더 CARs (Shoulder CARs)",
    "힙 CARs (Hip CARs)",
  ],
};

// Warmup pools for mobility sessions — condition-aware
const WARMUP_POOLS_MOBILITY: Record<UserCondition["bodyPart"], string[]> = {
  upper_stiff: [
    "폼롤러 흉추 스트레칭 (Foam Roller Thoracic Extension)",
    "동적 흉추 회전 (Active Thoracic Rotation)",
    "팔 흔들기 (Arm Swings)",
    "고양이-낙타 자세 (Cat-Camel Pose)",
    "동적 흉근 스트레칭 (Dynamic Pec Stretch)",
    "숄더 CARs (Shoulder CARs)",
    "손목 CARs (Wrist CARs)",
    "벽 흉추 회전 (Wall Thoracic Rotations)",
    "어깨 회전 및 날개뼈 움직임 (Shoulder Rotations & Scapular Mobility)",
    "동적 팔 흔들기 (Active Arm Swings)",
  ],
  lower_heavy: [
    "폼롤러 둔근 및 햄스트링 이완 (Foam Roller Glutes & Hamstrings Release)",
    "앞벅지 스트레칭 (Hip Flexor Stretch)",
    "안벅지 동적 스트레칭 (Adductor Dynamic Stretch)",
    "고관절 90/90 스트레치 (Hip 90/90 Stretch)",
    "힙 CARs (Hip CARs)",
    "앵클 CARs (Ankle CARs)",
  ],
  full_fatigue: [
    "폼롤러 등 상부 및 둔근 이완 (Foam Roller Upper Back & Glute Release)",
    "앞벅지 스트레칭 (Hip Flexor Stretch)",
    "캣-카멜 자세(Cat-Camel Pose)",
    "고관절 회전 (Hip Circles)",
    "숄더 CARs (Shoulder CARs)",
    "힙 CARs (Hip CARs)",
  ],
  good: [
    "폼롤러 흉추 스트레칭 (Foam Roller Thoracic Stretch)",
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "밴드 풀 어파트 (Band Pull-Apart)",
    "고관절 회전 (Hip Circles)",
    "폼롤러 둔근 이완 (Foam Roller Glutes Release)",
    "숄더 CARs (Shoulder CARs)",
    "힙 CARs (Hip CARs)",
    "척추 CARs (Spine CARs)",
  ],
};

// --- Main Exercise Pools (Korean) ---
const PUSH_EXERCISES = {
  mainCompound: [
    "바벨 벤치 프레스 (Barbell Bench Press)",
    "덤벨 벤치 프레스 (Dumbbell Bench Press)",
    "디클라인 벤치 프레스 (Decline Bench Press)",
    "헤머 벤치 프레스 (Hammer Bench Press)",
    "웨이티드 푸쉬업 (Weighted Push-ups)",
    "케틀벨 플로어 프레스 (Kettlebell Floor Press)",
    "체스트 프레스 머신 (Chest Press Machine)",
  ],
  verticalPress: [
    "오버헤드 프레스 (Overhead Press)",
    "덤벨 숄더 프레스 (Seated Dumbbell Press)",
    "아놀드 프레스 (Arnold Press)",
    "케틀벨 오버헤드 프레스 (Kettlebell Overhead Press)",
    "밀리터리 프레스 (Military Press)",
  ],
  accessory: [
    "인클라인 덤벨 프레스 (Incline Dumbbell Press)",
    "인클라인 덤벨 플라이 (Incline Dumbbell Fly)",
    "케이블 크로스오버 (Cable Crossover)",
    "케이블 체스트 프레스 (Cable Chest Press)",
    "펙덱 플라이 (Pec Deck Fly)",
    "중량 딥스 (Weighted Dips)",
    "랜드마인 프레스 (Landmine Press)",
    "가슴 딥스 (Dips - Chest Version)",
    "바텀스업 케틀벨 프레스 (Bottoms-Up Kettlebell Press)",
    "푸쉬업 (Push-ups)",
    "니 푸쉬업 (Knee Push-ups)",
    "다이아몬드 푸쉬업 (Diamond Push-ups)",
    "와이드 푸쉬업 (Wide Push-ups)",
    "아처 푸쉬업 (Archer Push-ups)",
    "힌두 푸쉬업 (Hindu Push-ups)",
  ],
  isoShoulder: [
    "사이드 레터럴 레이즈 (Side Lateral Raises)",
    "프론트 레터럴 레이즈 (Front Lateral Raises)",
    "벤트 오버 레터럴 레이즈 (Bent Over Lateral Raises)",
    "케이블 레터럴 레이즈 (Cable Lateral Raises)",
    "업라이트 로우 (Upright Row)",
  ],
  isoTricep: [
    "트라이셉 로프 푸쉬다운 (Tricep Rope Pushdown)",
    "스컬 크러셔 (Skullcrushers)",
    "오버헤드 트라이셉 익스텐션 (Overhead Tricep Extension)",
    "케이블 푸쉬 다운 (Cable Pushdown)",
    "케이블 오버헤드 트라이셉 익스텐션 (Cable Overhead Tricep Extension)",
    "트라이셉스 킥백 (Tricep Kickback)",
    "트라이셉스 딥스 (Tricep Dips)",
  ],
};

const PULL_EXERCISES = {
  verticalPull: [
    "풀업 (Pull-ups)",
    "중량 풀업 (Weighted Pull-ups)",
    "랫 풀다운 (Lat Pulldown)",
    "친업 (Chin-ups)",
    "중량 친업 (Weighted Chin-ups)",
    "어시스티드 풀업 (Assisted Pull-ups)",
    "암 풀다운 (Arm Pulldown)",
    "원 암 랫 풀다운 (One Arm Lat Pulldown)",
  ],
  horizontalPull: [
    "바벨 로우 (Barbell Row)",
    "펜들레이 로우 (Pendlay Row)",
    "티바 로우 (T-Bar Row)",
    "케틀벨 고릴라 로우 (Kettlebell Gorilla Row)",
    "인버티드 로우 (Inverted Row)",
    "하이로우 머신 (High Row Machine)",
    "케틀벨 로우 (Kettlebell Row)",
    "TRX 로우 (TRX Row)",
  ],
  unilateral: [
    "싱글 암 덤벨 로우 (Single Arm Dumbbell Row)",
    "시티드 케이블 로우 (Seated Cable Row)",
    "체스트 서포티드 로우 (Chest Supported Row)",
    "케이블 로우 (Cable Row)",
    "원 암 시티드 로우 머신 (One Arm Seated Row Machine)",
    "백익스텐션 머신 (Back Extension Machine)",
    "슈퍼맨 동작 (Superman)",
    "T-W 레이즈 (T-W Raise)",
  ],
  rearDelt: [
    "케이블 페이스 풀 (Cable Face Pulls)",
    "리어 델트 플라이 (Rear Delt Fly)",
    "밴드 풀 어파트 (Band Pull-Aparts)",
  ],
  bicep: [
    "바벨 컬 (Barbell Curl)",
    "해머 컬 (Hammer Curl)",
    "인클라인 덤벨 컬 (Incline Dumbbell Curl)",
    "케이블 바이셉 컬 (Cable Bicep Curl)",
    "친업 (Chin-ups)",
    "덤벨 프리쳐 컬 (Dumbbell Preacher Curl)",
    "덤벨 컬 (Dumbbell Curl)",
    "프리처 컬 머신 (Preacher Curl Machine)",
    "오버헤드 케이블 바이셉 컬 (Overhead Cable Bicep Curl)",
    "TRX 바이셉스 컬 (TRX Biceps Curl)",
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
    "덤벨 쓰러스터 (Dumbbell Thruster)",
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
    "어시스티드 풀업 (Assisted Pull-ups)",
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
    "플랭크 숄더 탭 (Plank Shoulder Tap)",
  ],
  dynamic: [
    "러시안 트위스트 (Russian Twist)",
    "데드버그 (Deadbug)",
    "버드 독 (Bird Dog)",
    "행잉 레그 레이즈 (Hanging Leg Raise)",
    "Ab 휠 롤아웃 (Ab Wheel Rollout)",
    "크런치 (Crunch)",
    "바이시클 크런치 (Bicycle Crunch)",
    "오블리크 크런치 (Oblique Crunch)",
    "싱글 레그 레이즈 (Single Leg Raise)",
    "리버스 크런치 (Reverse Crunch)",
    "마운틴 클라이머 (Mountain Climber)",
    "시저 킥 (Scissor Kick)",
    "토 터치 크런치 (Toe Touch Crunch)",
    "플러터 킥 (Flutter Kick)",
    "레그 레이즈 (Leg Raise)",
    "케이블 크런치 (Cable Crunch)",
    "덤벨 사이드 벤드 (Dumbbell Side Bend)",
    "브이 업 (V-Up)",
    "Ab 슬라이드 (Ab Slide)",
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
    "월 스쿼트 (Wall Squat)",
    "악어 스트레칭 (Alligator Stretch)",
    "케틀벨 암바 (Kettlebell Armbar)",
    "동적 발목 펌핑 (Active Ankle Pumps)",
    "스파이더맨 스트레치 (Spiderman Stretch with Thoracic Rotation)",
    "능형근 스트레칭 (Rhomboid Stretch)",
    "소흉근 스트레칭 (Pectoralis Minor Stretch - Doorway Stretch)",
    "동적 어깨 서클 (Active Shoulder Circles)",
    "트리거 포인트 해제 (Trigger Point Release - Shoulder/Back)",
    "하프 닐링 흉추 로테이션 (Half-Kneeling Thoracic Rotation)",
    "딥 스쿼트 & 흉추 로테이션 (Deep Squat with Thoracic Rotation)",
    "흉추 스트레칭 및 회전 (Thoracic Spine Mobility Flow)",
    "어깨 가동성 드릴 (Shoulder Mobility Drills)",
    "목 주변 근육 이완 (Neck Release)",
    "고관절 이완 (Hip Flexor Stretch & Glute Activation)",
  ],
  // Condition-specific mobility main exercises
  mobility_upper: [
    "상체 이완 플로우 (Upper Body Release Flow)",
    "흉추 회전 스트레칭 (Thoracic Rotation Stretch)",
    "월 앵글 (Wall Angel)",
    "밴드 풀 어파트 (Band Pull-Aparts)",
    "동적 흉근 스트레칭 (Dynamic Pec Stretch)",
    "폼롤러 흉추 가동성 (Foam Roller Thoracic Mobility)",
    "흉추 스트레칭 (Thoracic Spine Extension - Bench/Foam Roller)",
    "능형근 스트레칭 (Rhomboid Stretch)",
    "스파이더맨 스트레치 (Spiderman Stretch with Thoracic Rotation)",
    "능동적 어깨 서클 (Active Shoulder Circles)",
    "소흉근 스트레칭 (Pectoralis Minor Stretch - Doorway Stretch)",
    "폼롤러 등 마사지 및 흉추 신전 (Foam Roller Back Massage & Thoracic Extension)",
    "통증 완화 마사지 (Trigger Point Release - Shoulder/Back)",
    "하프 닐링 흉추 로테이션 (Half-Kneeling Thoracic Rotation)",
    "딥 스쿼트 & 흉추 로테이션 (Deep Squat with Thoracic Rotation)",
    "어깨 돌리기 (Shoulder Circles)",
    "흉추 스트레칭 및 회전 (Thoracic Spine Mobility Flow)",
    "어깨 가동성 드릴 (Shoulder Mobility Drills)",
    "목 주변 근육 이완 (Neck Release)",
  ],
  mobility_lower: [
    "90/90 고관절 회전 (90/90 Hip Rotation)",
    "나비 자세 심화 (Butterfly Pose)",
    "개구리 자세 (Frog Pose)",
    "피죤 자세 (Pigeon Pose)",
    "만세 스쿼트 홀드 프라잉 (Overhead Squat Hold - Prying)",
    "월 앵클 모빌리티 (Wall Ankle Mobility)",
    "고관절 이완 (Hip Flexor Stretch & Glute Activation)",
  ],
  mobility_full: [
    "고양이-낙타 자세 (Cat-Cow Pose)",
    "90/90 힙 로테이션 (90/90 Hip Rotation)",
    "월 앵클 모빌리티 (Wall Ankle Mobility)",
    "흉추 회전 운동 (Thoracic Rotation)",
    "딥 스쿼트 홀드 (Deep Squat Hold)",
    "세계에서 가장 위대한 스트레치 (World's Greatest Stretch)",
    "월 스쿼트 (Wall Squat)",
    "악어 스트레칭 (Alligator Stretch)",
    "동적 발목 펌핑 (Active Ankle Pumps)",
  ],
};

// --- Exercise Swap: find alternatives from the same muscle-group pool ---
export const ALL_EXERCISE_POOLS: string[][] = [
  // Push
  PUSH_EXERCISES.mainCompound,
  PUSH_EXERCISES.verticalPress,
  PUSH_EXERCISES.accessory,
  PUSH_EXERCISES.isoShoulder,
  PUSH_EXERCISES.isoTricep,
  // Pull
  PULL_EXERCISES.verticalPull,
  PULL_EXERCISES.horizontalPull,
  PULL_EXERCISES.unilateral,
  PULL_EXERCISES.rearDelt,
  PULL_EXERCISES.bicep,
  // Leg
  LEG_EXERCISES.squat,
  LEG_EXERCISES.hinge,
  LEG_EXERCISES.unilateral,
  LEG_EXERCISES.isolation,
  LEG_EXERCISES.calf,
  // Full Body
  FULL_BODY_EXERCISES.compound,
  FULL_BODY_EXERCISES.upper,
  FULL_BODY_EXERCISES.pull,
  FULL_BODY_EXERCISES.lower,
  // Core
  CORE_EXERCISES.plank,
  CORE_EXERCISES.dynamic,
];

// Labeled exercise pools for search with muscle group info
export const LABELED_EXERCISE_POOLS: { label: string; keywords: string[]; exercises: string[] }[] = [
  { label: "가슴", keywords: ["가슴", "chest", "푸쉬", "push"], exercises: [...PUSH_EXERCISES.mainCompound, ...PUSH_EXERCISES.accessory] },
  { label: "어깨", keywords: ["어깨", "shoulder", "숄더", "델트"], exercises: [...PUSH_EXERCISES.verticalPress, ...PUSH_EXERCISES.isoShoulder] },
  { label: "삼두", keywords: ["삼두", "트라이셉", "tricep", "팔뒤"], exercises: [...PUSH_EXERCISES.isoTricep] },
  { label: "등", keywords: ["등", "back", "풀", "pull", "로우", "row"], exercises: [...PULL_EXERCISES.verticalPull, ...PULL_EXERCISES.horizontalPull, ...PULL_EXERCISES.unilateral] },
  { label: "후면 어깨", keywords: ["후면", "rear", "리어"], exercises: [...PULL_EXERCISES.rearDelt] },
  { label: "이두", keywords: ["이두", "바이셉", "bicep", "팔앞"], exercises: [...PULL_EXERCISES.bicep] },
  { label: "하체", keywords: ["하체", "다리", "leg", "스쿼트", "squat"], exercises: [...LEG_EXERCISES.squat, ...LEG_EXERCISES.hinge, ...LEG_EXERCISES.unilateral, ...LEG_EXERCISES.isolation] },
  { label: "종아리", keywords: ["종아리", "calf", "카프"], exercises: [...LEG_EXERCISES.calf] },
  { label: "전신", keywords: ["전신", "full", "풀바디", "컴파운드"], exercises: [...FULL_BODY_EXERCISES.compound, ...FULL_BODY_EXERCISES.upper, ...FULL_BODY_EXERCISES.pull, ...FULL_BODY_EXERCISES.lower] },
  { label: "코어", keywords: ["코어", "core", "복근", "abs", "플랭크"], exercises: [...CORE_EXERCISES.plank, ...CORE_EXERCISES.dynamic] },
];

export function getAlternativeExercises(exerciseName: string): string[] {
  const lower = exerciseName.toLowerCase();
  for (const pool of ALL_EXERCISE_POOLS) {
    if (pool.some(e => e.toLowerCase() === lower || lower.includes(e.toLowerCase().split(" (")[0]))) {
      return pool.filter(e => e !== exerciseName && !lower.includes(e.toLowerCase().split(" (")[0]));
    }
  }
  return [];
}

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
    "추가 추천: 동적 스트레칭 및 이완 (Dynamic Stretching & Relaxation)",
    "추가 유산소: 가벼운 걷기 (Cooldown Walk)",
    "추가 활동: 가벼운 걷기 또는 스트레칭 (Light Walk or Stretching)",
  ],
};

// --- Weight Guidance (Korean) ---
const getWeightGuide = (role: "compound" | "accessory" | "isolation" | "light" | "bodyweight", goal: WorkoutGoal, intensityOverride?: "high" | "moderate" | "low"): string => {
  if (role === "bodyweight") return "맨몸";
  if (role === "light") {
    if (intensityOverride === "high") return "적당한 무게";
    return "가벼운 무게";
  }

  // Intensity override takes precedence over goal
  if (intensityOverride) {
    switch (intensityOverride) {
      case "high":
        if (role === "compound") return "점진적 증량";
        if (role === "accessory") return "도전적인 무게";
        return "적당한 무게";
      case "moderate":
        if (role === "compound") return "가능한 최대 무게";
        return "적당한 무게";
      case "low":
        if (role === "compound") return "중간 무게";
        return "가벼운~중간 무게";
    }
  }

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

// --- Korean Reps for Goal (with optional intensity override) ---
const getRepsForGoalKo = (goal: WorkoutGoal, intensityOverride?: "high" | "moderate" | "low"): string => {
  // If intensity override differs from goal's default, adjust reps
  if (intensityOverride) {
    switch (intensityOverride) {
      case "high": return "3-6회";
      case "moderate": return "8-12회";
      case "low": return "15-20회";
    }
  }
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

/** Map MasterPlanPreview session type → algorithm WorkoutType */
const SESSION_TYPE_TO_WORKOUT: Record<string, WorkoutType[]> = {
  Strength: ["push", "pull", "leg_core"],
  Running: ["run_speed", "run_easy", "run_long", "hiit_cardio"],
  Mobility: ["mobility", "full_body_mobility"],
};

export const generateAdaptiveWorkout = (
  dayIndex: number, // 0(Mon) - 6(Sun)
  condition: UserCondition,
  goal: WorkoutGoal,
  selectedSessionType?: string,
  intensityOverride?: "high" | "moderate" | "low" | null
): WorkoutSessionData => {
  const generalFitnessSchedule: WorkoutType[] = [
    "full_body_circuit", "hiit_cardio", "lower_core",
    "upper_cardio", "full_body_mobility", "mobility", "mobility",
  ];
  const fatLossSchedule: WorkoutType[] = [
    "push", "pull", "leg_core", "full_body_circuit", "push", "leg_core", "mobility",
  ];
  const defaultSchedule: WorkoutType[] = [
    "push", "run_speed", "pull", "run_easy", "leg_core", "run_long", "mobility",
  ];

  let workoutType: WorkoutType;
  if (selectedSessionType && selectedSessionType !== "Recommended" && SESSION_TYPE_TO_WORKOUT[selectedSessionType]) {
    // Goal-first: pick from the session type pool (rotate by dayIndex for variety)
    const pool = SESSION_TYPE_TO_WORKOUT[selectedSessionType];
    workoutType = pool[dayIndex % pool.length];
  } else {
    // Day-based schedule (AI 추천 / Recommended)
    const schedule = goal === "fat_loss" ? fatLossSchedule : goal === "general_fitness" ? generalFitnessSchedule : defaultSchedule;
    workoutType = schedule[dayIndex];
  }
  const exercises: ExerciseStep[] = [];
  const baseSets = adjustVolume(3, condition, goal);
  // Intensity override adjusts sets: high → +1, low → -1
  const sets = intensityOverride === "high" ? Math.min(baseSets + 1, 5) : intensityOverride === "low" ? Math.max(baseSets - 1, 2) : baseSets;
  const repsKo = getRepsForGoalKo(goal, intensityOverride || undefined);
  const repsVal = parseInt(repsKo) || 12;
  // Isolation/accessory reps also scale with intensity
  const isoRepsKo = intensityOverride === "high" ? "8-10회" : intensityOverride === "low" ? "20회" : "12-15회";
  const isoRepsVal = parseInt(isoRepsKo) || 15;
  const wg = (role: "compound" | "accessory" | "isolation" | "light" | "bodyweight") => getWeightGuide(role, goal, intensityOverride || undefined);

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
        { type: "strength", name: pick(pushCompoundPool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.verticalPress), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.accessory), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("accessory"), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.isoShoulder), count: formatCountKo(sets, isoRepsKo), weight: wg("light"), sets, reps: isoRepsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.isoTricep), count: formatCountKo(sets, isoRepsKo), weight: wg("isolation"), sets, reps: isoRepsVal },
      );
      break;
    }
    case "pull": {
      const pullCompoundPool = isFatigued
        ? ["랫 풀다운 (Lat Pulldown)", "케이블 로우 (Cable Row)", "싱글 암 덤벨 로우 (Single Arm Dumbbell Row)"]
        : PULL_EXERCISES.verticalPull;
      exercises.push(
        { type: "strength", name: pick(pullCompoundPool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.horizontalPull), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.unilateral), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("accessory"), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.rearDelt), count: formatCountKo(sets, isoRepsKo), weight: wg("light"), sets, reps: isoRepsVal },
        { type: "strength", name: pick(PULL_EXERCISES.bicep), count: formatCountKo(sets, isoRepsKo), weight: wg("isolation"), sets, reps: isoRepsVal },
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
        { type: "strength", name: pick(legCompoundPool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(legHingePool), count: formatCountKo(sets, repsKo), weight: fatigueWeightOverride || wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(LEG_EXERCISES.unilateral), count: formatCountKo(sets, `${repsVal}회 양측`), weight: fatigueWeightOverride || wg("accessory"), sets, reps: repsVal },
        { type: "strength", name: pick(LEG_EXERCISES.isolation), count: formatCountKo(sets, isoRepsKo), weight: fatigueWeightOverride || wg("isolation"), sets, reps: isoRepsVal },
        { type: "strength", name: pick(LEG_EXERCISES.calf), count: formatCountKo(sets, isoRepsKo), weight: "맨몸", sets, reps: isoRepsVal },
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
      exercises.push(
        { type: "strength", name: pick(FULL_BODY_EXERCISES.compound), count: formatCountKo(sets, repsKo), weight: wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(FULL_BODY_EXERCISES.upper), count: formatCountKo(sets, repsKo), weight: wg("accessory"), sets, reps: repsVal },
        { type: "strength", name: pick(FULL_BODY_EXERCISES.pull), count: formatCountKo(sets, repsKo), weight: wg("accessory"), sets, reps: repsVal },
        { type: "strength", name: pick(FULL_BODY_EXERCISES.lower), count: formatCountKo(sets, repsKo), weight: wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(LEG_EXERCISES.unilateral), count: formatCountKo(sets, `${repsVal}회 양측`), weight: "맨몸", sets, reps: repsVal },
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
      exercises.push(
        { type: "strength", name: pick(LEG_EXERCISES.squat), count: formatCountKo(sets, repsKo), weight: wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(LEG_EXERCISES.hinge), count: formatCountKo(sets, repsKo), weight: wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(LEG_EXERCISES.unilateral), count: formatCountKo(sets, `${repsVal}회 양측`), weight: "맨몸", sets, reps: repsVal },
        ...(() => {
          const pool = [...CORE_EXERCISES.dynamic];
          const first = pick(pool);
          const remaining = pool.filter(e => e !== first);
          const second = pick(remaining);
          return [
            { type: "core" as const, name: first, count: formatCountKo(sets, isoRepsKo), sets, reps: isoRepsVal },
            { type: "core" as const, name: second, count: formatCountKo(sets, isoRepsKo), sets, reps: isoRepsVal },
          ];
        })(),
      );
      break;
    }
    case "upper_cardio": {
      exercises.push(
        { type: "strength", name: pick(PUSH_EXERCISES.mainCompound), count: formatCountKo(sets, repsKo), weight: wg("compound"), sets, reps: repsVal },
        { type: "strength", name: pick(PULL_EXERCISES.unilateral), count: formatCountKo(sets, repsKo), weight: wg("accessory"), sets, reps: repsVal },
        { type: "strength", name: pick(PUSH_EXERCISES.isoShoulder), count: formatCountKo(sets, isoRepsKo), weight: wg("light"), sets, reps: isoRepsVal },
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
    // 50% chance: 2 dynamic abs exercises, 50% chance: 1 plank + 1 dynamic
    const doubleDynamic = Math.random() < 0.5;
    if (doubleDynamic) {
      const pool = [...CORE_EXERCISES.dynamic];
      const first = pick(pool);
      const remaining = pool.filter(e => e !== first);
      const second = pick(remaining);
      exercises.push(
        { type: "core", name: first, count: formatCountKo(3, isoRepsKo), sets: 3, reps: isoRepsVal },
        { type: "core", name: second, count: formatCountKo(3, isoRepsKo), sets: 3, reps: isoRepsVal },
      );
    } else {
      const corePlank = pick(CORE_EXERCISES.plank);
      const coreDynamic = pick(CORE_EXERCISES.dynamic);
      exercises.push(
        { type: "core", name: corePlank, count: formatCountKo(3, "30-45초 유지"), sets: 3, reps: 1 },
        { type: "core", name: coreDynamic, count: formatCountKo(3, isoRepsKo), sets: 3, reps: isoRepsVal },
      );
    }
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
  const isGoalFirst = selectedSessionType && selectedSessionType !== "Recommended";

  return {
    title: isGoalFirst ? titleBase : `${dayName}: ${titleBase}`,
    description: getSessionDescription(workoutType, goal, sets, condition),
    exercises,
  };
};
