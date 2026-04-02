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
    if (profile.gender) localStorage.setItem("alpha_gender", profile.gender);
    if (profile.birthYear) localStorage.setItem("alpha_birth_year", String(profile.birthYear));
    if (profile.bodyWeight) localStorage.setItem("alpha_body_weight", String(profile.bodyWeight));
    if (profile.weightLog.length > 0) {
      localStorage.setItem("alpha_weight_log", JSON.stringify(profile.weightLog));
    }
    if (profile.fitnessProfile) {
      localStorage.setItem("alpha_fitness_profile", JSON.stringify(profile.fitnessProfile));
      localStorage.setItem("alpha_fitness_reading_done", "true");
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
  localStorage.setItem("alpha_body_weight", String(weight));
  try {
    const weightLog: { date: string; weight: number }[] = JSON.parse(
      localStorage.getItem("alpha_weight_log") || "[]"
    );
    const existing = weightLog.findIndex((e) => e.date === today);
    if (existing >= 0) {
      weightLog[existing].weight = weight;
    } else {
      weightLog.push({ date: today, weight });
    }
    localStorage.setItem("alpha_weight_log", JSON.stringify(weightLog));

    // Sync to Firestore
    await saveUserProfile({ bodyWeight: weight, weightLog });
  } catch (e) {
    console.error("Failed to update weight", e);
  }
}

/** Replace the entire weight log and sync to Firestore */
export async function updateWeightLog(weightLog: { date: string; weight: number }[]): Promise<void> {
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("alpha_weight_log", JSON.stringify(sorted));

  // Update current body weight to latest entry
  if (sorted.length > 0) {
    const latest = sorted[sorted.length - 1];
    localStorage.setItem("alpha_body_weight", String(latest.weight));
    await saveUserProfile({ bodyWeight: latest.weight, weightLog: sorted });
  } else {
    await saveUserProfile({ weightLog: sorted });
  }
}

/** Update gender and sync to Firestore */
export async function updateGender(gender: "male" | "female"): Promise<void> {
  localStorage.setItem("alpha_gender", gender);
  await saveUserProfile({ gender });
}

/** Update birth year and sync to Firestore */
export async function updateBirthYear(birthYear: number): Promise<void> {
  localStorage.setItem("alpha_birth_year", String(birthYear));
  await saveUserProfile({ birthYear });
}

/** Get plan count from localStorage (fast, for UI) */
export function getPlanCount(): number {
  return parseInt(localStorage.getItem("alpha_plan_count") || "0", 10);
}

/** Increment plan count and sync to Firestore */
export async function incrementPlanCount(): Promise<void> {
  const count = getPlanCount() + 1;
  localStorage.setItem("alpha_plan_count", count.toString());

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
      localStorage.setItem("alpha_plan_count", count.toString());
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
  const gender = (localStorage.getItem("alpha_gender") as "male" | "female") || null;
  const birthYearStr = localStorage.getItem("alpha_birth_year");
  const bodyWeightStr = localStorage.getItem("alpha_body_weight");
  const weightLogStr = localStorage.getItem("alpha_weight_log");

  return {
    gender,
    birthYear: birthYearStr ? parseInt(birthYearStr) : null,
    bodyWeight: bodyWeightStr ? parseFloat(bodyWeightStr) : null,
    weightLog: weightLogStr ? JSON.parse(weightLogStr) : [],
  };
}
