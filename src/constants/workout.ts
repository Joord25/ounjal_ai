export type WorkoutLevel = "beginner" | "intermediate" | "advanced";
export type ExerciseType = "warmup" | "strength" | "cardio" | "core" | "mobility";
export type WorkoutType = "push" | "pull" | "leg_core" | "mobility" | "run_easy" | "run_speed" | "run_long" | "full_body_circuit" | "hiit_cardio" | "lower_core" | "upper_cardio" | "full_body_mobility";

export type ExercisePhase = "warmup" | "main" | "core" | "cardio";

export interface SetDetail {
  reps: number;
  weight?: string; // "60kg" 또는 undefined (맨몸/시간 기반)
}

/**
 * 회의 64-T (2026-04-19): 러닝 인터벌 구성의 구조화 필드. tag-at-source 원칙 (박서진 64-I) 연장.
 * 플랜 프리뷰·FitScreen이 regex 역추론 대신 이 필드 1순위. `count` 문자열은 back-compat 유지.
 */
export interface IntervalSpec {
  rounds: number;
  sprintSec?: number;
  recoverySec?: number;
  sprintDist?: number;    // meters (400, 800, 1000, 1600...)
  recoveryDist?: number;  // meters
  sprintLabel?: string;   // "전력" | "걷기" | "빠르게"
  recoveryLabel?: string; // "회복" | "달리기" | "보통"
  paceGuide?: string;     // "4:15-4:25/km" 등
}

export interface ExerciseStep {
  type: ExerciseType;
  phase?: ExercisePhase;
  name: string;
  count: string;
  weight?: string;
  sets: number;
  reps: number;
  /** 세트별 reps/weight 상세. 없으면 sets/reps/weight로 동일 적용 */
  setDetails?: SetDetail[];
  logs?: ExerciseLog[];
  tempoGuide?: string;
  /**
   * 회의 64-I (박서진 자문, 2026-04-18): 러닝 세션 tag-at-source.
   * 생성부에서 직접 태깅. 소비부(FitScreen/runningFormat)가 regex 역추론 대신 이 필드 1순위.
   * undefined = 헬스 운동 or 과거 레코드 (regex fallback으로 후퇴).
   */
  runKind?: "interval" | "continuous";
  /** 러닝 타입 세부 분류 (런닝 리포트/공유카드용). runKind와 같이 세팅. */
  runType?: RunningType;
  /** 회의 64-T (2026-04-19): 인터벌 구성 구조화. runKind="interval"일 때 채움. */
  intervalSpec?: IntervalSpec;
}

/** ExerciseStep에서 세트별 상세를 도출 (setDetails 우선, 없으면 sets/reps/weight로 균일 생성) */
export function deriveSetDetails(ex: ExerciseStep): SetDetail[] {
  if (ex.setDetails && ex.setDetails.length > 0) return ex.setDetails;
  return Array.from({ length: Math.max(1, ex.sets) }, () => ({
    reps: ex.reps,
    weight: ex.weight,
  }));
}

export interface ExerciseLog {
  setNumber: number;
  repsCompleted: number;
  weightUsed?: string;
  feedback: "fail" | "target" | "easy" | "too_easy";
  timestamp?: number;
}

export interface ExerciseTiming {
  exerciseIndex: number;
  startedAt: number;
  endedAt: number;
  durationSec: number;
}

export interface WorkoutSessionData {
  title: string;
  description: string;
  exercises: ExerciseStep[];
  /**
   * 세션 생성 시점에 서버가 결정한 의도 강도.
   * 퀘스트 집계(intensity_high/moderate/low)의 신뢰 소스.
   * 회의 16: 램프업/워밍업 기반 오분류 방지.
   */
  intendedIntensity?: "high" | "moderate" | "low";
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

// ====================================================================
// Running Session Stats (회의 41: GPS 기반 러닝, 지도 없이 숫자만 저장)
// ====================================================================

/**
 * 회의 64-Y (2026-04-19): 6종 → 8종 재분류
 * - fartlek → vo2_interval rename (Canova 근거, Norwegian 4×4는 fartlek 아님)
 * - sprint → 3-way 분할: time_trial (TT/dress rehearsal), sprint_interval (400m/800m/strides), vo2_interval (1000m/mile/Norwegian)
 * - threshold 신규 (Bakken 2x15 Sub-T 블록)
 * - 과거 Firestore 레코드의 "fartlek"/"sprint"은 Batch C 마이그레이션으로 소급 갱신
 * - legacy alias ("fartlek"/"sprint")는 과거 레코드 호환용으로 타입 유지 (마이그 완료 후 차기 PR에서 제거 검토)
 */
export type RunningType =
  | "walkrun"
  | "easy"
  | "long"
  | "tempo"
  | "threshold"
  | "vo2_interval"
  | "sprint_interval"
  | "time_trial"
  // legacy (Firestore 과거 레코드 호환)
  | "fartlek"
  | "sprint";

/**
 * 회의 64-I (박서진 자문, 2026-04-18): 러닝 프로그램 ID — 서버·클라 단일 소스.
 * 서버 functions/src/runningProgram.ts 의 RunningProgramId와 동일 유지 (구조적 제약: 서버-클라 import 불가).
 */
export type RunningProgramId = "vo2_boost" | "10k_sub_50" | "half_sub_2" | "full_sub_3";

export interface IntervalRoundRecord {
  round: number;
  sprintPace: number | null;      // sec/km (실내/권한거부 시 null)
  recoveryPace: number | null;
  sprintDurationSec: number;
  recoveryDurationSec: number;
}

export interface RunningStats {
  runningType: RunningType;
  isIndoor: boolean;
  gpsAvailable: boolean;
  distance: number;                // meters (실내 또는 권한거부 시 0)
  duration: number;                // seconds
  avgPace: number | null;          // sec/km — 전체 평균
  sprintAvgPace: number | null;    // sec/km — 전력 구간만 평균 (Hero 스탯용)
  recoveryAvgPace: number | null;
  bestPace: number | null;         // sec/km — 가장 빠른 구간 페이스
  intervalRounds: IntervalRoundRecord[];
  splits?: { km: number; paceSec: number }[];  // km 스플릿 (1km, 2km, ...)
  completionRate: number;          // 0~1
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
    loadScore?: number;
  };
  exerciseTimings?: ExerciseTiming[];
  analysis?: WorkoutAnalysis;
  coachMessages?: string[];
  runningStats?: RunningStats;     // 회의 41: 러닝 세션만 설정
  /** 회의 64-M3: 중도 종료 여부. 유저가 "운동 종료" 버튼 → 팝업 확인으로 저장된 세션. */
  abandoned?: boolean;
  /** 회의 37: 4탭 리포트 데이터 */
  reportTabs?: {
    /** 운동 당시 유저 목표 (히스토리 고정 표시용) */
    goal?: string;
    status: {
      percentiles: { category: string; rank: number; percentile: number; hasData: boolean }[];
      overallRank: number;
      fitnessAge: number;
      ageGroupLabel: string;
      genderLabel: string;
    };
    today: {
      volumeChangePercent: number | null;
      caloriesBurned: number;
      foodAnalogy: string;
      recoveryHours: string;
      stimulusMessage: string;
    };
    next: {
      message: string;
      recommendedPart: string;
      recommendedIntensity: string;
      weightGoal?: { exerciseName: string; targetWeight: number };
      questProgress?: {
        high: { done: number; target: number };
        moderate: { done: number; target: number };
        low: { done: number; target: number };
        total: { done: number; target: number };
      };
      weekSessions?: { dayLabel: string; desc: string }[];
    };
    nutrition: {
      dailyCalorie: number;
      goalBasis: string;
      macros: { protein: number; carb: number; fat: number };
      meals: { time: string; menu: string }[];
      keyTip: string;
      chatHistory?: { role: "user" | "assistant"; content: string }[];
    } | null;
  };
}

export interface UserCondition {
  bodyPart: "upper_stiff" | "lower_heavy" | "full_fatigue" | "good";
  energyLevel: 1 | 2 | 3 | 4 | 5;
  availableTime: 30 | 50 | 90;
  bodyWeightKg?: number;
  gender?: "male" | "female";
  birthYear?: number;
  // 회의 57 (2026-04-15): 채팅형 온보딩 도입으로 추가된 초보 친화 프록시 필드.
  // 1RM 입력 대신 비전문가도 답할 수 있는 질문으로 초기 강도·장비 적응도 파악.
  recentGymFrequency?: "none" | "1_2_times" | "regular";
  pushupLevel?: "zero" | "1_to_5" | "10_plus";
}

export type WorkoutGoal = "fat_loss" | "muscle_gain" | "strength" | "general_fitness";

export type SessionMode = "balanced" | "split" | "running" | "home_training";
export type TargetMuscle = "chest" | "back" | "shoulders" | "arms" | "legs";
export type RunType = "interval" | "easy" | "long";

/**
 * 세션 의도 묶음. 회의 57: ConditionCheck 폐기 이후 ChatHome/page가 공용 타입으로 사용.
 * Phase 4에서 ConditionCheck.tsx 삭제와 함께 이곳으로 이관됨.
 */
/** 회의 64-M4: 장비 제약 — 챗에서 "맨몸만/덤벨 없이" 요청 시 Gemini가 bodyweight_only 세팅.
 *  현재는 BW 전용 1종만 지원. 향후 "home_basic (덤벨/케틀벨 허용)", "gym (풀장비)" 확장 여지. */
export type EquipmentConstraint = "bodyweight_only";

export interface SessionSelection {
  goal: WorkoutGoal;
  sessionMode: SessionMode;
  targetMuscle?: TargetMuscle;
  runType?: RunType;
  equipment?: EquipmentConstraint;
}

// === UI용 운동 풀 (운동 교체 검색에 사용) ===
//
// 회의 64-ε (2026-04-20, 대표 지시): 배열 순서 = 교체 바텀시트 필터 버튼·검색 결과 그룹 헤더 순서.
// 대표 요청 우선순위: 가슴 → 등 → 하체 → 어깨 → 팔(이두/삼두). 보조 그룹(웜업/가동성)은 맨 뒤.
// getAlternativeExercises 의 first-match 우선순위도 이 순서를 따르므로 공유 운동 (예: 친업=등+이두)은
// 앞 그룹이 매칭되는 게 자연스럽도록 대표 지시 순서를 그대로 사용.

export const LABELED_EXERCISE_POOLS: { label: string; keywords: string[]; exercises: string[] }[] = [
  { label: "가슴", keywords: ["가슴", "chest", "푸쉬", "push"], exercises: ["바벨 벤치 프레스 (Barbell Bench Press)", "덤벨 벤치 프레스 (Dumbbell Bench Press)", "디클라인 벤치 프레스 (Decline Bench Press)", "헤머 벤치 프레스 (Hammer Bench Press)", "웨이티드 푸쉬업 (Weighted Push-ups)", "케틀벨 플로어 프레스 (Kettlebell Floor Press)", "체스트 프레스 머신 (Chest Press Machine)", "인클라인 바벨 프레스 (Incline Barbell Press)", "스미스 머신 벤치 프레스 (Smith Machine Bench Press)", "인클라인 덤벨 프레스 (Incline Dumbbell Press)", "인클라인 덤벨 플라이 (Incline Dumbbell Fly)", "케이블 크로스오버 (Cable Crossover)", "케이블 체스트 프레스 (Cable Chest Press)", "펙덱 플라이 (Pec Deck Fly)", "중량 딥스 (Weighted Dips)", "랜드마인 프레스 (Landmine Press)", "가슴 딥스 (Dips - Chest Version)", "바텀스업 케틀벨 프레스 (Bottoms-Up Kettlebell Press)", "덤벨 플로어 프레스 (Dumbbell Floor Press)", "푸쉬업 (Push-ups)", "니 푸쉬업 (Knee Push-ups)", "다이아몬드 푸쉬업 (Diamond Push-ups)", "와이드 푸쉬업 (Wide Push-ups)", "아처 푸쉬업 (Archer Push-ups)", "힌두 푸쉬업 (Hindu Push-ups)"] },
  { label: "등", keywords: ["등", "back", "풀", "pull", "로우", "row"], exercises: ["폼롤러 흉추 가동성 (Foam Roller Thoracic Mobility)", "풀업 (Pull-ups)", "중량 풀업 (Weighted Pull-ups)", "랫 풀다운 (Lat Pulldown)", "친업 (Chin-ups)", "중량 친업 (Weighted Chin-ups)", "어시스티드 풀업 (Assisted Pull-ups)", "암 풀다운 (Arm Pulldown)", "원 암 랫 풀다운 (One Arm Lat Pulldown)", "스트레이트 암 풀다운 (Straight Arm Pulldown)", "바벨 로우 (Barbell Row)", "펜들레이 로우 (Pendlay Row)", "티바 로우 (T-Bar Row)", "케틀벨 고릴라 로우 (Kettlebell Gorilla Row)", "인버티드 로우 (Inverted Row)", "하이로우 머신 (High Row Machine)", "케틀벨 로우 (Kettlebell Row)", "TRX 로우 (TRX Row)", "싱글 암 덤벨 로우 (Single Arm Dumbbell Row)", "시티드 케이블 로우 (Seated Cable Row)", "시티드 로우 (Seated Cable Row)", "체스트 서포티드 로우 (Chest Supported Row)", "케이블 로우 (Cable Row)", "원 암 시티드 로우 머신 (One Arm Seated Row Machine)", "백익스텐션 머신 (Back Extension Machine)", "슈퍼맨 동작 (Superman)", "랙 풀 (Rack Pull)", "바벨 슈러그 (Barbell Shrug)"] },
  { label: "하체", keywords: ["하체", "다리", "leg", "스쿼트", "squat"], exercises: ["바벨 백 스쿼트 (Barbell Back Squat)", "프론트 스쿼트 (Front Squat)", "고블렛 스쿼트 (Goblet Squat)", "더블 케틀벨 프론트 스쿼트 (Double Kettlebell Front Squat)", "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)", "핵 스쿼트 (Hack Squat)", "에어 스쿼트 (Air Squat)", "월 스쿼트 (Wall Squat)", "루마니안 데드리프트 (Romanian Deadlift)", "컨벤셔널 데드리프트 (Conventional Deadlift)", "스모 데드리프트 (Sumo Deadlift)", "트랩바 데드리프트 (Trap Bar Deadlift)", "케틀벨 스윙 (Kettlebell Swing)", "싱글 레그 케틀벨 RDL (Single-Leg Kettlebell RDL)", "케틀벨 데드리프트 (Kettlebell Deadlift)", "덤벨 루마니안 데드리프트 (Dumbbell Romanian Deadlift)", "워킹 런지 (Walking Lunges)", "워킹 런지 (Walking Lunge)", "불가리안 스플릿 스쿼트 (Bulgarian Split Squat)", "리버스 런지 (Reverse Lunges)", "리버스 런지 (Alternating Reverse Lunges)", "케틀벨 워킹 런지 (Kettlebell Walking Lunge)", "스텝업 (Step-Up)", "레그 프레스 (Leg Press)", "레그 익스텐션 (Leg Extension)", "덤벨 힙 쓰러스트 (Dumbbell Hip Thrust)", "힙 쓰러스트 (Hip Thrust)", "바벨 힙 쓰러스트 (Barbell Hip Thrust)", "글루트 브릿지 (Glute Bridge)", "힙 브릿지 (Hip Bridge)", "클램쉘 (Clamshell)", "케이블 풀 스루 (Cable Pull-Through)", "레그 컬 (Leg Curl)", "힙 어브덕션 머신 (Hip Abduction Machine)", "힙 어덕션 머신 (Hip Adduction Machine)", "케틀벨 와이드 스쿼트 (Kettlebell Wide Squat)", "덤벨 와이드 스쿼트 (Dumbbell Wide Squat)", "와이드 스쿼트 (Wide Squat)"] },
  { label: "어깨", keywords: ["어깨", "shoulder", "숄더", "델트"], exercises: ["오버헤드 프레스 (Overhead Press)", "덤벨 숄더 프레스 (Seated Dumbbell Press)", "아놀드 프레스 (Arnold Press)", "케틀벨 오버헤드 프레스 (Kettlebell Overhead Press)", "밀리터리 프레스 (Military Press)", "사이드 레터럴 레이즈 (Side Lateral Raises)", "프론트 레터럴 레이즈 (Front Lateral Raises)", "벤트 오버 레터럴 레이즈 (Bent Over Lateral Raises)", "케이블 레터럴 레이즈 (Cable Lateral Raises)", "업라이트 로우 (Upright Row)"] },
  { label: "이두", keywords: ["이두", "바이셉", "bicep", "팔앞"], exercises: ["바벨 컬 (Barbell Curl)", "해머 컬 (Hammer Curl)", "인클라인 덤벨 컬 (Incline Dumbbell Curl)", "케이블 바이셉 컬 (Cable Bicep Curl)", "친업 (Chin-ups)", "덤벨 프리쳐 컬 (Dumbbell Preacher Curl)", "덤벨 컬 (Dumbbell Curl)", "프리처 컬 머신 (Preacher Curl Machine)", "오버헤드 케이블 바이셉 컬 (Overhead Cable Bicep Curl)", "TRX 바이셉스 컬 (TRX Biceps Curl)"] },
  { label: "삼두", keywords: ["삼두", "트라이셉", "tricep", "팔뒤"], exercises: ["트라이셉 로프 푸쉬다운 (Tricep Rope Pushdown)", "스컬 크러셔 (Skullcrushers)", "오버헤드 트라이셉 익스텐션 (Overhead Tricep Extension)", "케이블 푸쉬 다운 (Cable Pushdown)", "케이블 OH 트라이셉 익스텐션 (Cable Overhead Tricep Extension)", "트라이셉스 킥백 (Tricep Kickback)", "트라이셉스 딥스 (Tricep Dips)", "클로즈그립 벤치 프레스 (Close-Grip Bench Press)"] },
  { label: "후면 어깨", keywords: ["후면", "rear", "리어"], exercises: ["케이블 페이스 풀 (Cable Face Pulls)", "리어 델트 플라이 (Rear Delt Fly)", "밴드 풀 어파트 (Band Pull-Aparts)"] },
  { label: "종아리", keywords: ["종아리", "calf", "카프"], exercises: ["스탠딩 카프 레이즈 (Standing Calf Raises)", "시티드 카프 레이즈 (Seated Calf Raises)", "동키 카프 레이즈 (Donkey Calf Raises)"] },
  { label: "코어", keywords: ["코어", "core", "복근", "abs", "플랭크"], exercises: ["폼롤러 흉추 가동성 (Foam Roller Thoracic Mobility)", "플랭크 (Plank)", "사이드 플랭크 (Side Plank)", "플랭크 숄더 탭 (Plank Shoulder Tap)", "웨이티드 플랭크 (Weighted Plank)", "러시안 트위스트 (Russian Twist)", "데드버그 (Deadbug)", "데드버그 (Dead Bug)", "버드 독 (Bird Dog)", "행잉 레그 레이즈 (Hanging Leg Raise)", "행잉 니 레이즈 (Hanging Knee Raise)", "Ab 휠 롤아웃 (Ab Wheel Rollout)", "바벨 롤아웃 (Barbell Rollout)", "케이블 우드찹 (Cable Woodchop)", "크런치 (Crunch)", "바이시클 크런치 (Bicycle Crunch)", "오블리크 크런치 (Oblique Crunch)", "싱글 레그 레이즈 (Single Leg Raise)", "리버스 크런치 (Reverse Crunch)", "마운틴 클라이머 (Mountain Climber)", "시저 킥 (Scissor Kick)", "토 터치 크런치 (Toe Touch Crunch)", "플러터 킥 (Flutter Kick)", "레그 레이즈 (Leg Raise)", "케이블 크런치 (Cable Crunch)", "덤벨 사이드 벤드 (Dumbbell Side Bend)", "브이 업 (V-Up)", "Ab 슬라이드 (Ab Slide)", "터키시 겟업 (Turkish Get-up)", "케틀벨 암바 (Kettlebell Armbar)", "케틀벨 윈드밀 (Kettlebell Windmill)", "베어 크롤 (Bear Crawl)"] },
  { label: "전신", keywords: ["전신", "full", "풀바디", "컴파운드"], exercises: ["덤벨 쓰러스터 (Dumbbell Thruster)", "케틀벨 스윙 (Kettlebell Swing)", "케틀벨 고블릿 스쿼트 (Kettlebell Goblet Squat)", "바벨 백 스쿼트 (Barbell Back Squat)", "덤벨 벤치 프레스 (Dumbbell Bench Press)", "푸쉬업 (Push-up)", "오버헤드 프레스 (Overhead Press)", "케이블 로우 (Cable Row)", "덤벨 로우 (Dumbbell Row)", "어시스티드 풀업 (Assisted Pull-ups)", "고블렛 스쿼트 (Goblet Squat)", "리버스 런지 (Reverse Lunges)", "원 레그 루마니안 데드리프트 (Single Leg RDL)"] },
  { label: "플라이오", keywords: ["플라이오", "plyo", "점프", "jump", "버피", "burpee", "hiit", "카디오", "cardio", "맨몸"], exercises: ["버피 (Burpees)", "스텝아웃 버피 (Step-out Burpees)", "스쿼트 점프 (Squat Jumps)", "스쿼트 점프 (Squat Jump)", "점프 런지 (Jump Lunges)", "점핑 잭 (Jumping Jacks)", "스텝 잭 (Step Jacks)", "하이니즈 (High Knees)", "스피드 스케이터 (Speed Skaters)", "마운틴 클라이머 (Mountain Climbers)", "플랭크 잭 (Plank Jacks)", "섀도 복싱 (Shadow Boxing)", "제자리 걸음 (Marching in Place)", "베어 크롤 (Bear Crawl)"] },
  { label: "웜업", keywords: ["웜업", "warmup", "스트레칭", "stretch", "동적", "폼롤러"], exercises: ["폼롤러 흉추 스트레칭 (Foam Roller Thoracic Extension)", "캣-카멜 스트레칭 (Cat-Camel Stretch)", "벽 엔젤 (Wall Angel)", "날개뼈 푸쉬업 플러스 (Scapular Push-up Plus)", "밴드 페이스 풀 (Band Face Pull)", "동적 흉근 스트레칭 (Dynamic Pec Stretch)", "동적 흉추 회전 (Active Thoracic Rotation)", "숄더 CARs (Shoulder CARs)", "벽 흉추 회전 (Wall Thoracic Rotations)", "어깨 회전 및 견갑골 움직임 (Shoulder Rotations & Scapular Mobility)", "어깨 돌리기 (Shoulder Circles)", "폼롤러 둔근 및 햄스트링 이완 (Foam Roller Glutes & Hamstrings Release)", "동적 고관절 굴곡근 스트레칭 (Dynamic Hip Flexor Stretch)", "고블렛 스쿼트 프라잉 (Prying Goblet Squat)", "고관절 90/90 스트레치 (Hip 90/90 Stretch)", "내전근 동적 스트레칭 (Adductor Dynamic Stretch)", "스파이더맨 런지 (Spiderman Lunge)", "힙 CARs (Hip CARs)", "폼롤러 흉추/광배근 마사지 (Foam Roller Thoracic & Lat Release)", "동적 다리 스윙 (Dynamic Leg Swings)", "고관절 회전 (Hip Circles)", "캣 카멜 스트레치 (Cat-Camel Stretch)", "앞벅지 스트레칭 (Hip Flexor Stretch)", "밴드 워크 (Band Walk)", "앞벅지 스트레치 (Hip Flexor Stretch)", "고양이-낙타 자세 (Cat-Cow Pose)", "월 슬라이드 (Wall Slides)", "밴드 풀 어파트 (Band Pull-Apart)", "팔 흔들기 (Arm Swings)", "동적 런지 (Dynamic Lunge)"] },
  { label: "가동성", keywords: ["가동성", "mobility", "스트레칭", "CARs", "회전"], exercises: ["고양이-소 자세 (Cat-Cow Pose)", "90/90 힙 로테이션 (90/90 Hip Rotation)", "흉추 회전 스트레칭 (Thoracic Rotation Stretch)", "딥 스쿼트 홀드 (Deep Squat Hold)", "세계에서 가장 위대한 스트레치 (World's Greatest Stretch)", "월 앵클 모빌리티 (Wall Ankle Mobility)", "나비 자세 (Butterfly Pose)", "개구리 자세 (Frog Pose)", "피죤 자세 (Pigeon Pose)", "만세 스쿼트 홀드 (Overhead Squat Hold)", "상체 이완 플로우 (Upper Body Release Flow)", "월 앵글 (Wall Angel)", "밴드 풀 어파트 (Band Pull-Aparts)", "동적 흉근 스트레칭 (Dynamic Pec Stretch)", "폼롤러 흉추 가동성 (Foam Roller Thoracic Mobility)", "90/90 고관절 회전 (90/90 Hip Rotation)", "나비 자세 심화 (Butterfly Pose)", "월 앵클 모빌리티 (Wall Ankle Mobility)", "흉추 회전 운동 (Thoracic Rotation)"] },
];

export function getAlternativeExercises(exerciseName: string): string[] {
  for (const group of LABELED_EXERCISE_POOLS) {
    if (group.exercises.some(e => e === exerciseName || e.toLowerCase().includes(exerciseName.toLowerCase().split(" (")[0]))) {
      return group.exercises.filter(e => e !== exerciseName);
    }
  }
  return [];
}

/** 운동 이름으로 소속된 근육 그룹 라벨들 반환 (Kenko 스타일 태그용) */
export function getExerciseMuscleGroups(exerciseName: string): string[] {
  const normalized = exerciseName.toLowerCase().split(" (")[0].trim();
  const groups: string[] = [];
  for (const group of LABELED_EXERCISE_POOLS) {
    if (group.label === "웜업" || group.label === "가동성") continue; // 보조 그룹 제외
    if (group.exercises.some(e => e === exerciseName || e.toLowerCase().includes(normalized))) {
      groups.push(group.label);
    }
  }
  return groups.slice(0, 2); // 최대 2개까지만
}
