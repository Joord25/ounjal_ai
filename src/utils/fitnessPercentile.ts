/**
 * ACSM/NSCA 기반 연령·성별별 퍼센타일 기준표
 * BW(체중) 대비 1RM 비율로 퍼센타일 산출
 *
 * 카테고리: 가슴(chest), 등(back), 어깨(shoulder), 하체(legs), 체력(cardio)
 * 종합(overall)은 5개 가중 평균으로 산출
 */

// 연령대 구간
type AgeGroup = "teens" | "20s" | "30s" | "40s" | "50s" | "60plus";

function getAgeGroup(age: number): AgeGroup {
  if (age < 20) return "teens";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60plus";
}

// BW ratio → 퍼센타일 (10구간)
// 각 배열은 [10th, 20th, 30th, 40th, 50th, 60th, 70th, 80th, 90th] BW ratio
// 예: 30대 남자 가슴(벤치) 50th percentile = BW x 0.90
interface PercentileTable {
  [gender: string]: {
    [ageGroup: string]: {
      [category: string]: number[]; // 9개 값 (10th~90th)
    };
  };
}

const PERCENTILE_TABLE: PercentileTable = {
  male: {
    teens: {
      chest: [0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00, 1.10, 1.25],
      back: [0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.15, 1.30],
      shoulder: [0.25, 0.32, 0.38, 0.44, 0.50, 0.56, 0.62, 0.70, 0.80],
      legs: [0.55, 0.70, 0.85, 1.00, 1.10, 1.25, 1.40, 1.55, 1.80],
    },
    "20s": {
      chest: [0.50, 0.60, 0.72, 0.82, 0.92, 1.05, 1.15, 1.30, 1.50],
      back: [0.55, 0.65, 0.78, 0.88, 1.00, 1.12, 1.25, 1.40, 1.60],
      shoulder: [0.30, 0.38, 0.44, 0.50, 0.56, 0.62, 0.70, 0.80, 0.92],
      legs: [0.70, 0.85, 1.00, 1.15, 1.30, 1.45, 1.60, 1.80, 2.10],
    },
    "30s": {
      chest: [0.45, 0.55, 0.68, 0.78, 0.90, 1.00, 1.12, 1.25, 1.45],
      back: [0.50, 0.62, 0.75, 0.85, 0.95, 1.08, 1.20, 1.35, 1.55],
      shoulder: [0.28, 0.35, 0.42, 0.48, 0.54, 0.60, 0.68, 0.78, 0.90],
      legs: [0.65, 0.80, 0.95, 1.10, 1.25, 1.40, 1.55, 1.72, 2.00],
    },
    "40s": {
      chest: [0.40, 0.50, 0.62, 0.72, 0.82, 0.92, 1.02, 1.15, 1.35],
      back: [0.45, 0.58, 0.70, 0.80, 0.90, 1.00, 1.12, 1.25, 1.45],
      shoulder: [0.25, 0.32, 0.38, 0.44, 0.50, 0.56, 0.64, 0.72, 0.85],
      legs: [0.58, 0.72, 0.85, 1.00, 1.12, 1.28, 1.42, 1.58, 1.85],
    },
    "50s": {
      chest: [0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.25],
      back: [0.40, 0.52, 0.62, 0.72, 0.82, 0.92, 1.04, 1.18, 1.38],
      shoulder: [0.22, 0.28, 0.35, 0.40, 0.46, 0.52, 0.58, 0.66, 0.78],
      legs: [0.50, 0.65, 0.78, 0.90, 1.02, 1.15, 1.30, 1.45, 1.70],
    },
    "60plus": {
      chest: [0.28, 0.38, 0.48, 0.56, 0.65, 0.75, 0.85, 0.95, 1.12],
      back: [0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.08, 1.25],
      shoulder: [0.18, 0.24, 0.30, 0.35, 0.40, 0.46, 0.52, 0.60, 0.70],
      legs: [0.42, 0.55, 0.68, 0.80, 0.92, 1.05, 1.18, 1.32, 1.55],
    },
  },
  female: {
    teens: {
      chest: [0.20, 0.28, 0.35, 0.42, 0.48, 0.55, 0.62, 0.70, 0.82],
      back: [0.25, 0.32, 0.40, 0.48, 0.55, 0.62, 0.70, 0.78, 0.90],
      shoulder: [0.15, 0.20, 0.25, 0.30, 0.34, 0.38, 0.42, 0.48, 0.55],
      legs: [0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.08, 1.25],
    },
    "20s": {
      chest: [0.28, 0.35, 0.42, 0.50, 0.58, 0.65, 0.72, 0.82, 0.95],
      back: [0.32, 0.40, 0.48, 0.55, 0.65, 0.72, 0.80, 0.90, 1.05],
      shoulder: [0.18, 0.24, 0.30, 0.35, 0.40, 0.45, 0.50, 0.56, 0.65],
      legs: [0.45, 0.55, 0.68, 0.80, 0.90, 1.00, 1.12, 1.28, 1.50],
    },
    "30s": {
      chest: [0.25, 0.32, 0.40, 0.48, 0.55, 0.62, 0.70, 0.78, 0.92],
      back: [0.30, 0.38, 0.45, 0.52, 0.60, 0.68, 0.76, 0.86, 1.00],
      shoulder: [0.16, 0.22, 0.28, 0.32, 0.38, 0.42, 0.48, 0.54, 0.62],
      legs: [0.40, 0.52, 0.62, 0.74, 0.85, 0.95, 1.08, 1.22, 1.42],
    },
    "40s": {
      chest: [0.22, 0.30, 0.36, 0.44, 0.50, 0.58, 0.65, 0.72, 0.85],
      back: [0.28, 0.35, 0.42, 0.48, 0.56, 0.64, 0.72, 0.80, 0.92],
      shoulder: [0.14, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.58],
      legs: [0.35, 0.48, 0.58, 0.68, 0.78, 0.88, 1.00, 1.12, 1.32],
    },
    "50s": {
      chest: [0.20, 0.26, 0.32, 0.40, 0.46, 0.52, 0.58, 0.66, 0.78],
      back: [0.25, 0.32, 0.38, 0.44, 0.52, 0.58, 0.66, 0.74, 0.85],
      shoulder: [0.12, 0.18, 0.22, 0.26, 0.32, 0.36, 0.40, 0.46, 0.54],
      legs: [0.30, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92, 1.05, 1.22],
    },
    "60plus": {
      chest: [0.16, 0.22, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.70],
      back: [0.20, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.66, 0.78],
      shoulder: [0.10, 0.14, 0.18, 0.22, 0.28, 0.32, 0.36, 0.40, 0.48],
      legs: [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.10],
    },
  },
};

export type FitnessCategory = "chest" | "back" | "shoulder" | "legs" | "cardio";

/** 운동명 → 카테고리 매핑 */
const EXERCISE_CATEGORY_MAP: Record<string, FitnessCategory> = {};

// 가슴 (chest)
["벤치 프레스", "바벨 벤치 프레스", "덤벨 벤치 프레스", "인클라인 벤치 프레스", "인클라인 덤벨 프레스", "디클라인 벤치 프레스",
 "체스트 프레스", "케이블 크로스오버", "펙 덱 플라이", "덤벨 플라이", "푸시업", "딥스",
 "Barbell Bench Press", "Dumbbell Bench Press", "Incline Bench Press", "Incline Dumbbell Press",
 "Decline Bench Press", "Chest Press", "Cable Crossover", "Pec Deck Fly", "Dumbbell Fly",
 "Push Up", "Push-Up", "Dips", "스미스 벤치 프레스", "Smith Bench Press",
].forEach(name => EXERCISE_CATEGORY_MAP[name] = "chest");

// 등 (back)
["바벨 로우", "덤벨 로우", "풀업", "랫 풀다운", "시티드 로우", "케이블 로우", "T바 로우",
 "펜들레이 로우", "원암 덤벨 로우", "턱걸이", "친업", "인버티드 로우",
 "Barbell Row", "Dumbbell Row", "Pull Up", "Pull-Up", "Lat Pulldown", "Seated Row",
 "Cable Row", "T-Bar Row", "Pendlay Row", "One Arm Dumbbell Row", "Chin Up", "Chin-Up",
 "Inverted Row", "스미스 로우", "Smith Row",
].forEach(name => EXERCISE_CATEGORY_MAP[name] = "back");

// 어깨 (shoulder)
["오버헤드 프레스", "밀리터리 프레스", "덤벨 숄더 프레스", "아놀드 프레스",
 "사이드 레터럴 레이즈", "프론트 레이즈", "리어 델트 플라이", "업라이트 로우",
 "페이스 풀", "숄더 프레스",
 "Overhead Press", "Military Press", "Dumbbell Shoulder Press", "Arnold Press",
 "Side Lateral Raise", "Front Raise", "Rear Delt Fly", "Upright Row",
 "Face Pull", "Shoulder Press", "바벨 숄더 프레스", "Barbell Shoulder Press",
 "스미스 숄더 프레스", "Smith Shoulder Press",
].forEach(name => EXERCISE_CATEGORY_MAP[name] = "shoulder");

// 하체 (legs)
["스쿼트", "바벨 스쿼트", "프론트 스쿼트", "고블릿 스쿼트", "불가리안 스플릿 스쿼트",
 "레그 프레스", "레그 익스텐션", "레그 컬", "루마니안 데드리프트", "데드리프트",
 "컨벤셔널 데드리프트", "스모 데드리프트", "힙 쓰러스트", "런지", "워킹 런지",
 "카프 레이즈", "글루트 브릿지", "스텝 업",
 "Squat", "Barbell Squat", "Front Squat", "Goblet Squat", "Bulgarian Split Squat",
 "Leg Press", "Leg Extension", "Leg Curl", "Romanian Deadlift", "Deadlift",
 "Conventional Deadlift", "Sumo Deadlift", "Hip Thrust", "Lunge", "Walking Lunge",
 "Calf Raise", "Glute Bridge", "Step Up",
 "스미스 스쿼트", "Smith Squat", "해킹 스쿼트", "Hack Squat",
 "케틀벨 스윙", "Kettlebell Swing",
].forEach(name => EXERCISE_CATEGORY_MAP[name] = "legs");

/** 운동명으로 카테고리 찾기 (부분 매칭 지원) */
export function getExerciseCategory(exerciseName: string): FitnessCategory | null {
  // 정확 매칭
  if (EXERCISE_CATEGORY_MAP[exerciseName]) return EXERCISE_CATEGORY_MAP[exerciseName];

  // 부분 매칭
  const lower = exerciseName.toLowerCase();
  if (lower.includes("bench") || lower.includes("벤치") || lower.includes("chest") || lower.includes("가슴") || lower.includes("push up") || lower.includes("푸시업") || lower.includes("플라이") || lower.includes("fly")) return "chest";
  if (lower.includes("row") || lower.includes("로우") || lower.includes("pull up") || lower.includes("풀업") || lower.includes("pulldown") || lower.includes("풀다운") || lower.includes("턱걸이") || lower.includes("chin")) return "back";
  if (lower.includes("shoulder") || lower.includes("어깨") || lower.includes("overhead") || lower.includes("오버헤드") || lower.includes("military") || lower.includes("밀리터리") || lower.includes("lateral") || lower.includes("레터럴") || lower.includes("숄더")) return "shoulder";
  if (lower.includes("squat") || lower.includes("스쿼트") || lower.includes("deadlift") || lower.includes("데드") || lower.includes("leg") || lower.includes("레그") || lower.includes("lunge") || lower.includes("런지") || lower.includes("하체") || lower.includes("hip") || lower.includes("힙") || lower.includes("calf") || lower.includes("카프")) return "legs";

  return null;
}

/** 머신 운동 보정 계수 (장비 유형별) */
const MACHINE_CORRECTION: Record<string, number> = {
  machine: 0.70,
  smith: 0.75,
  cable: 0.72,
};

/** 장비 유형 판별 */
function getEquipmentCorrection(exerciseName: string): number {
  const lower = exerciseName.toLowerCase();
  if (lower.includes("smith") || lower.includes("스미스")) return MACHINE_CORRECTION.smith;
  if (lower.includes("machine") || lower.includes("머신") || lower.includes("press machine") || lower.includes("레그 프레스") || lower.includes("leg press") || lower.includes("레그 익스텐션") || lower.includes("레그 컬") || lower.includes("leg extension") || lower.includes("leg curl") || lower.includes("펙 덱") || lower.includes("pec deck") || lower.includes("체스트 프레스") || lower.includes("chest press")) return MACHINE_CORRECTION.machine;
  if (lower.includes("cable") || lower.includes("케이블")) return MACHINE_CORRECTION.cable;
  return 1.0; // 프리웨이트
}

export interface CategoryPercentile {
  category: FitnessCategory;
  /** 1~100 (100명 중 몇 등 → 100 - percentile) */
  rank: number;
  /** 0~100 퍼센타일 */
  percentile: number;
  /** BW ratio */
  bwRatio: number;
  /** 데이터 있음? */
  hasData: boolean;
}

/** 맨몸 운동 판별 — weight 0이면 체중을 자동 대입 */
function isBodyweightExercise(name: string): boolean {
  const lower = name.toLowerCase();
  return ["푸시업", "push up", "push-up", "딥스", "dips", "dip",
    "풀업", "pull up", "pull-up", "턱걸이", "친업", "chin up", "chin-up",
    "인버티드 로우", "inverted row", "글루트 브릿지", "glute bridge",
    "스텝 업", "step up", "런지", "lunge", "워킹 런지", "walking lunge",
    "불가리안 스플릿 스쿼트", "bulgarian split squat",
    "어시스티드 풀업", "assisted pull up", "assisted pull-up",
  ].some(kw => lower.includes(kw));
}

/** 카테고리별 최고 E1RM BW ratio 추출 (이력 + 오늘) */
export function getCategoryBestBwRatio(
  exercises: { name: string }[],
  logs: Record<number, { weightUsed?: string; repsCompleted: number }[]>,
  history: { sessionData: { exercises: { name: string }[] }; logs?: Record<number, { weightUsed?: string; repsCompleted: number }[]> }[],
  bodyWeightKg: number,
): Map<FitnessCategory, number> {
  const bestByCategory = new Map<FitnessCategory, number>();

  // 이력에서
  for (const h of history) {
    if (!h.logs) continue;
    for (let i = 0; i < h.sessionData.exercises.length; i++) {
      const ex = h.sessionData.exercises[i];
      const cat = getExerciseCategory(ex.name);
      if (!cat) continue;
      const exLogs = h.logs[i];
      if (!exLogs) continue;
      const correction = getEquipmentCorrection(ex.name);
      for (const l of exLogs) {
        let w = parseFloat(l.weightUsed || "0");
        if (w <= 0 && isBodyweightExercise(ex.name)) w = bodyWeightKg;
        if (w <= 0 || l.repsCompleted <= 0) continue;
        // E1RM 계산 (Epley)
        const e1rm = l.repsCompleted === 1 ? w : w * (1 + l.repsCompleted / 30);
        const corrected = e1rm * correction;
        const bwRatio = corrected / bodyWeightKg;
        const current = bestByCategory.get(cat) || 0;
        if (bwRatio > current) bestByCategory.set(cat, bwRatio);
      }
    }
  }

  // 오늘 세션
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const cat = getExerciseCategory(ex.name);
    if (!cat) continue;
    const exLogs = logs[i];
    if (!exLogs) continue;
    const correction = getEquipmentCorrection(ex.name);
    for (const l of exLogs) {
      const w = parseFloat(l.weightUsed || "0");
      if (w <= 0 || l.repsCompleted <= 0) continue;
      const e1rm = l.repsCompleted === 1 ? w : w * (1 + l.repsCompleted / 30);
      const corrected = e1rm * correction;
      const bwRatio = corrected / bodyWeightKg;
      const current = bestByCategory.get(cat) || 0;
      if (bwRatio > current) bestByCategory.set(cat, bwRatio);
    }
  }

  return bestByCategory;
}

/** BW ratio → 퍼센타일 (보간) */
export function bwRatioToPercentile(
  bwRatio: number,
  category: FitnessCategory,
  gender: "male" | "female",
  age: number,
): number {
  if (category === "cardio") return 50; // 체력은 별도 로직 필요 (러닝 데이터 기반)

  const ageGroup = getAgeGroup(age);
  const table = PERCENTILE_TABLE[gender]?.[ageGroup]?.[category];
  if (!table) return 50;

  // 보간: table[0]=10th ... table[8]=90th
  const percentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  if (bwRatio <= table[0]) return Math.max(1, Math.round((bwRatio / table[0]) * 10));
  if (bwRatio >= table[8]) return Math.min(99, 90 + Math.round(((bwRatio - table[8]) / (table[8] * 0.2)) * 10));

  for (let i = 0; i < table.length - 1; i++) {
    if (bwRatio >= table[i] && bwRatio < table[i + 1]) {
      const ratio = (bwRatio - table[i]) / (table[i + 1] - table[i]);
      return Math.round(percentiles[i] + ratio * 10);
    }
  }
  return 50;
}

/** 종합 퍼센타일 (가중 평균) */
export function computeOverallPercentile(categories: CategoryPercentile[]): number {
  const weights: Record<FitnessCategory, number> = {
    chest: 20, back: 20, shoulder: 15, legs: 30, cardio: 15,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const cat of categories) {
    if (!cat.hasData) continue;
    const w = weights[cat.category] || 15;
    weightedSum += cat.percentile * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 50;
  return Math.round(weightedSum / totalWeight);
}

/** 피트니스 나이 계산 (종합 퍼센타일 → 연령 역산) */
export function computeFitnessAge(
  overallPercentile: number,
  actualAge: number,
  gender: "male" | "female",
): number {
  // 간이 모델: 퍼센타일 50th = 실제 나이
  // 퍼센타일 70th = 실제 나이 - 5살
  // 퍼센타일 90th = 실제 나이 - 12살
  // 퍼센타일 30th = 실제 나이 + 3살
  // 퍼센타일 10th = 실제 나이 + 8살
  const diff = (overallPercentile - 50) * 0.25;
  const fitnessAge = Math.round(actualAge - diff);
  return Math.max(15, Math.min(80, fitnessAge));
}

/** 퍼센타일 → "100명 중 X등" (높을수록 좋음 → 100 - percentile + 1) */
export function percentileToRank(percentile: number): number {
  return Math.max(1, Math.min(100, 101 - percentile));
}

/** 연령대 라벨 */
export function getAgeGroupLabel(age: number, locale: string): string {
  const group = getAgeGroup(age);
  const labels: Record<string, Record<AgeGroup, string>> = {
    ko: { teens: "10대", "20s": "20대", "30s": "30대", "40s": "40대", "50s": "50대", "60plus": "60대+" },
    en: { teens: "Teens", "20s": "20s", "30s": "30s", "40s": "40s", "50s": "50s", "60plus": "60s+" },
  };
  return (labels[locale] ?? labels["en"])[group];
}
