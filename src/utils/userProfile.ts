import { db, auth } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc, Timestamp } from "firebase/firestore";

export interface FitnessProfileData {
  gender: "male" | "female";
  birthYear: number;
  height: number; // cm
  bodyWeight: number;
  weeklyFrequency: number;
  sessionMinutes: number;
  goal: "fat_loss" | "muscle_gain" | "endurance" | "health";
}

export interface UserProfile {
  gender: "male" | "female" | null;
  birthYear: number | null;
  bodyWeight: number | null;
  weightLog: { date: string; weight: number }[];
  fitnessProfile?: FitnessProfileData | null;
  updatedAt?: Date;
}

function getUserDocRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return doc(db, "users", uid);
}

/** Save full profile to Firestore */
export async function saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
  const ref = getUserDocRef();
  if (!ref) return;

  try {
    await setDoc(ref, {
      ...profile,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (e) {
    console.error("Failed to save user profile to Firestore", e);
  }
}

/** Load profile from Firestore and sync to localStorage */
export async function loadUserProfile(): Promise<UserProfile | null> {
  const ref = getUserDocRef();
  if (!ref) return null;

  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // No Firestore profile — migrate from localStorage
      const local = loadProfileFromLocalStorage();
      if (local.gender || local.birthYear || local.bodyWeight) {
        await saveUserProfile(local);
      }
      return local;
    }

    const data = snap.data();
    const profile: UserProfile = {
      gender: data.gender || null,
      birthYear: data.birthYear || null,
      bodyWeight: data.bodyWeight || null,
      weightLog: data.weightLog || [],
      fitnessProfile: data.fitnessProfile || null,
    };

    // Sync to localStorage
    if (profile.gender) localStorage.setItem("ohunjal_gender", profile.gender);
    if (profile.birthYear) localStorage.setItem("ohunjal_birth_year", String(profile.birthYear));
    if (profile.bodyWeight) localStorage.setItem("ohunjal_body_weight", String(profile.bodyWeight));
    if (profile.weightLog.length > 0) {
      localStorage.setItem("ohunjal_weight_log", JSON.stringify(profile.weightLog));
    }
    if (profile.fitnessProfile) {
      localStorage.setItem("ohunjal_fitness_profile", JSON.stringify(profile.fitnessProfile));
      localStorage.setItem("ohunjal_fitness_reading_done", "true");
    }

    return profile;
  } catch (e) {
    console.error("Failed to load user profile from Firestore", e);
    return loadProfileFromLocalStorage();
  }
}

/** Update weight log entry (today) and sync to Firestore */
export async function updateWeight(weight: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Update localStorage
  localStorage.setItem("ohunjal_body_weight", String(weight));
  try {
    const weightLog: { date: string; weight: number }[] = JSON.parse(
      localStorage.getItem("ohunjal_weight_log") || "[]"
    );
    const existing = weightLog.findIndex((e) => e.date === today);
    if (existing >= 0) {
      weightLog[existing].weight = weight;
    } else {
      weightLog.push({ date: today, weight });
    }
    localStorage.setItem("ohunjal_weight_log", JSON.stringify(weightLog));

    // Sync to Firestore
    await saveUserProfile({ bodyWeight: weight, weightLog });
  } catch (e) {
    console.error("Failed to update weight", e);
  }
}

/** Replace the entire weight log and sync to Firestore */
export async function updateWeightLog(weightLog: { date: string; weight: number }[]): Promise<void> {
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("ohunjal_weight_log", JSON.stringify(sorted));

  // Update current body weight to latest entry
  if (sorted.length > 0) {
    const latest = sorted[sorted.length - 1];
    localStorage.setItem("ohunjal_body_weight", String(latest.weight));
    await saveUserProfile({ bodyWeight: latest.weight, weightLog: sorted });
  } else {
    await saveUserProfile({ weightLog: sorted });
  }
}

/** Update gender and sync to Firestore */
export async function updateGender(gender: "male" | "female"): Promise<void> {
  localStorage.setItem("ohunjal_gender", gender);
  await saveUserProfile({ gender });
}

/** Update birth year and sync to Firestore */
export async function updateBirthYear(birthYear: number): Promise<void> {
  localStorage.setItem("ohunjal_birth_year", String(birthYear));
  await saveUserProfile({ birthYear });
}

/**
 * 신체 정보 초기화 — 프로필/신체 데이터만 삭제, 운동 히스토리/시즌 EXP/인증은 유지
 * - Firestore: gender/birthYear/bodyWeight/weightLog/fitnessProfile null로 클리어
 * - localStorage: 온보딩/프로필 관련 키 제거
 */
export async function resetUserBodyInfo(): Promise<void> {
  // 1. Firestore 프로필 필드 null 처리
  const ref = getUserDocRef();
  if (ref) {
    try {
      await setDoc(ref, {
        gender: null,
        birthYear: null,
        bodyWeight: null,
        weightLog: [],
        fitnessProfile: null,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (e) {
      console.error("Failed to reset user profile in Firestore", e);
    }
  }

  // 2. localStorage 프로필 관련 키 제거 (운동 히스토리/EXP는 유지)
  const keysToRemove = [
    "ohunjal_gender",
    "ohunjal_birth_year",
    "ohunjal_body_weight",
    "ohunjal_weight_log",
    "ohunjal_fitness_profile",
    "ohunjal_onboarding_done",
    "ohunjal_fitness_reading_done",
    "ohunjal_prev_weight",
    "ohunjal_tip_condition",
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/** Get plan count from localStorage (fast, for UI) */
export function getPlanCount(): number {
  return parseInt(localStorage.getItem("ohunjal_plan_count") || "0", 10);
}

/** Increment plan count and sync to Firestore */
export async function incrementPlanCount(): Promise<void> {
  const count = getPlanCount() + 1;
  localStorage.setItem("ohunjal_plan_count", count.toString());

  const ref = getUserDocRef();
  if (!ref) return;
  try {
    await setDoc(ref, { planCount: count, updatedAt: Timestamp.now() }, { merge: true });
  } catch (e) {
    console.error("Failed to sync planCount to Firestore", e);
  }
}

/** Load plan count from Firestore and sync to localStorage */
export async function loadPlanCount(): Promise<number> {
  const ref = getUserDocRef();
  if (!ref) return getPlanCount();

  try {
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().planCount !== undefined) {
      const firestoreCount = snap.data().planCount as number;
      const localCount = getPlanCount();
      // 둘 중 큰 값을 신뢰 (보안: 유저가 localStorage를 낮출 수 없게)
      const count = Math.max(firestoreCount, localCount);
      localStorage.setItem("ohunjal_plan_count", count.toString());
      return count;
    }
    // Firestore에 없으면 localStorage 값 마이그레이션
    const localCount = getPlanCount();
    if (localCount > 0) {
      await setDoc(ref, { planCount: localCount }, { merge: true });
    }
    return localCount;
  } catch (e) {
    console.error("Failed to load planCount from Firestore", e);
    return getPlanCount();
  }
}

function loadProfileFromLocalStorage(): UserProfile {
  const gender = (localStorage.getItem("ohunjal_gender") as "male" | "female") || null;
  const birthYearStr = localStorage.getItem("ohunjal_birth_year");
  const bodyWeightStr = localStorage.getItem("ohunjal_body_weight");
  const weightLogStr = localStorage.getItem("ohunjal_weight_log");

  return {
    gender,
    birthYear: birthYearStr ? parseInt(birthYearStr) : null,
    bodyWeight: bodyWeightStr ? parseFloat(bodyWeightStr) : null,
    weightLog: weightLogStr ? JSON.parse(weightLogStr) : [],
  };
}
