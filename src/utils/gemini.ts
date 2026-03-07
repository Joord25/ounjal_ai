import { UserCondition, WorkoutGoal, WorkoutSessionData, ExerciseLog, WorkoutAnalysis } from "@/constants/workout";
import { buildWorkoutMetrics } from "@/utils/workoutMetrics";
import { auth } from "@/lib/firebase";

// Helper: get current user's ID token for authenticated requests
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

// Helper: determine API base URL (hosting rewrites in prod, emulator in dev)
function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR === "true") {
    return "http://127.0.0.1:5001/ounjal/asia-northeast3";
  }
  return "/api"; // Firebase Hosting rewrites handle this
}

export const analyzeWorkoutSession = async (
  sessionData: WorkoutSessionData,
  logs: Record<number, ExerciseLog[]>,
  bodyWeightKg?: number,
  gender?: "male" | "female",
  birthYear?: number,
  historyStats?: { avgVolume28d: number; sessionCount: number } | null
): Promise<WorkoutAnalysis | null> => {
  try {
    const token = await getIdToken();
    const metrics = buildWorkoutMetrics(sessionData.exercises, logs, bodyWeightKg);

    const response = await fetch(`${getApiBase()}/analyzeWorkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionData,
        logs,
        bodyWeightKg,
        gender,
        birthYear,
        historyStats,
        metrics,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return await response.json() as WorkoutAnalysis;
  } catch (error) {
    console.error("Failed to analyze workout:", error);
    return null;
  }
};

export const generateAIWorkoutPlan = async (
  condition: UserCondition,
  goal: WorkoutGoal,
  dayName: string,
  selectedSessionType?: string,
): Promise<WorkoutSessionData | null> => {
  try {
    const token = await getIdToken();

    const response = await fetch(`${getApiBase()}/generateWorkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        condition,
        goal,
        dayName,
        selectedSessionType,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return await response.json() as WorkoutSessionData;
  } catch (error) {
    console.error("Failed to generate workout with Functions:", error);
    return null;
  }
};
