import { db, auth } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { WorkoutHistory } from "@/constants/workout";

const COLLECTION = "workout_history";

function getUserCollection() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return collection(db, "users", uid, COLLECTION);
}

/** Save a new workout history entry to Firestore + localStorage cache */
export async function saveWorkoutHistory(entry: WorkoutHistory): Promise<void> {
  // Always save to localStorage as cache
  try {
    const existing = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
    localStorage.setItem("alpha_workout_history", JSON.stringify([...existing, entry]));
  } catch (e) {
    console.error("Failed to save workout history to localStorage", e);
  }

  // Save to Firestore
  const col = getUserCollection();
  if (!col) return;

  try {
    const docRef = doc(col, entry.id);
    await setDoc(docRef, {
      ...entry,
      createdAt: Timestamp.fromDate(new Date(entry.date)),
    });
  } catch (e) {
    console.error("Failed to save workout history to Firestore", e);
  }
}

/** Update the latest history entry with analysis data */
export async function updateWorkoutAnalysis(
  historyId: string,
  analysis: WorkoutHistory["analysis"]
): Promise<void> {
  // Update localStorage
  try {
    const history = JSON.parse(localStorage.getItem("alpha_workout_history") || "[]");
    const entry = history.find((h: WorkoutHistory) => h.id === historyId);
    if (entry) {
      entry.analysis = analysis;
      localStorage.setItem("alpha_workout_history", JSON.stringify(history));
    }
  } catch (e) {
    console.error("Failed to update analysis in localStorage", e);
  }

  // Update Firestore
  const col = getUserCollection();
  if (!col) return;

  try {
    const docRef = doc(col, historyId);
    await updateDoc(docRef, { analysis });
  } catch (e) {
    console.error("Failed to update analysis in Firestore", e);
  }
}

/** Load all workout history from Firestore, falling back to localStorage */
export async function loadWorkoutHistory(): Promise<WorkoutHistory[]> {
  const col = getUserCollection();
  if (!col) {
    // Not logged in — use localStorage only
    return loadFromLocalStorage();
  }

  try {
    const q = query(col, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Firestore empty — check localStorage for migration
      const local = loadFromLocalStorage();
      if (local.length > 0) {
        // Migrate localStorage data to Firestore
        await migrateToFirestore(local);
      }
      return local;
    }

    const history: WorkoutHistory[] = snapshot.docs.map((d) => {
      const data = d.data();
      // Remove Firestore-specific fields
      const { createdAt, ...rest } = data;
      return rest as WorkoutHistory;
    });

    // Sync to localStorage as cache
    localStorage.setItem("alpha_workout_history", JSON.stringify(history));
    return history;
  } catch (e) {
    console.error("Failed to load from Firestore, using localStorage", e);
    return loadFromLocalStorage();
  }
}

/** Load recent history (last 28 days) — used by WorkoutReport */
export async function loadRecentHistory(): Promise<WorkoutHistory[]> {
  const col = getUserCollection();

  if (!col) {
    return loadRecentFromLocalStorage();
  }

  try {
    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const q = query(
      col,
      where("createdAt", ">=", Timestamp.fromDate(cutoff)),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return loadRecentFromLocalStorage();
    }

    return snapshot.docs.map((d) => {
      const { createdAt, ...rest } = d.data();
      return rest as WorkoutHistory;
    });
  } catch (e) {
    console.error("Failed to load recent history from Firestore", e);
    return loadRecentFromLocalStorage();
  }
}

/** Migrate existing localStorage data to Firestore (one-time) */
async function migrateToFirestore(history: WorkoutHistory[]): Promise<void> {
  const col = getUserCollection();
  if (!col) return;

  try {
    const batch = history.map((entry) => {
      const docRef = doc(col, entry.id);
      return setDoc(docRef, {
        ...entry,
        createdAt: Timestamp.fromDate(new Date(entry.date)),
      });
    });
    await Promise.all(batch);
    console.log(`Migrated ${history.length} workout history entries to Firestore`);
  } catch (e) {
    console.error("Failed to migrate history to Firestore", e);
  }
}

function loadFromLocalStorage(): WorkoutHistory[] {
  try {
    const raw = localStorage.getItem("alpha_workout_history");
    if (!raw) return [];
    return JSON.parse(raw) as WorkoutHistory[];
  } catch {
    return [];
  }
}

function loadRecentFromLocalStorage(): WorkoutHistory[] {
  const all = loadFromLocalStorage();
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  return all.filter((h) => new Date(h.date).getTime() > cutoff);
}
