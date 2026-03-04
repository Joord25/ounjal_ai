import { GoogleGenAI } from "@google/genai";
import { UserCondition, WorkoutGoal, WorkoutSessionData, ExerciseLog, WorkoutAnalysis } from "@/constants/workout";

// 주의: 보안을 위해 이 함수는 반드시 서버 환경(Server Actions 또는 API Routes)에서 실행되어야 합니다.
// 서버 환경이라면 NEXT_PUBLIC_ 을 빼고 순수 process.env.GEMINI_API_KEY 를 사용하는 것이 맞습니다.
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const analyzeWorkoutSession = async (
  sessionData: WorkoutSessionData,
  logs: Record<number, ExerciseLog[]>
): Promise<WorkoutAnalysis | null> => {
  if (!API_KEY) {
    console.error("Gemini API Key is missing!");
    return null;
  }

  try {
    // Construct a readable log summary
    const logSummary = sessionData.exercises.map((ex, idx) => {
      const exLogs = logs[idx];
      if (!exLogs || exLogs.length === 0) return null;
      
      const logDetails = exLogs.map(l => 
        `Set ${l.setNumber}: ${l.repsCompleted} reps (${l.weightUsed || "Bodyweight"}) - Feedback: ${l.feedback}`
      ).join(", ");
      
      return `Exercise: ${ex.name}\nLogs: ${logDetails}`;
    }).filter(Boolean).join("\n\n");

    const prompt = `
      You are an expert Strength & Conditioning Coach.
      Analyze the user's completed workout session logs.
      
      Workout Logs:
      ${logSummary}

      Your task is to provide a brief, actionable coaching briefing in KOREAN (한국어).
      
      ANALYSIS LOGIC (Strictly follow):
      1. Session Briefing:
         - If >90% of sets have "target" (적당함) feedback: "설정하신 목표에 부합하는 완벽한 템포였습니다."
         - If many "easy": "강도가 다소 낮았습니다. 점진적 과부하가 필요합니다."
         - If many "fail": "목표 중량이 다소 높았습니다. 자세와 회복에 집중하세요."
      
      2. Next Session Tip (Provide specific numbers per exercise):
         - If reps increased across sets (e.g., 12, 14, 16): "XX 운동 초기 볼륨 +5% 상향 추천 (세트별 데이터값에 따라)"
         - If reps fluctuated/failed (e.g., 12, 8, 6): "XX 운동 초기 볼륨 -10% 하향 추천 (세트별 데이터값 편차에 따라)"
         - If consistent: "XX 운동 현행 유지 또는 미세 증량 추천"

      OUTPUT FORMAT (JSON):
      {
        "briefing": "설정하신 목표(근비대 타겟)에 부합하는 완벽한 템포였습니다.",
        "nextSessionAdvice": "바벨로우 초기 볼륨 +5% 상향 추천\\n시티드로우 초기 볼륨 -10% 하향 추천"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        responseMimeType: "application/json", 
      }
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText) as WorkoutAnalysis;

  } catch (error) {
    console.error("Failed to analyze workout with Gemini:", error);
    return null;
  }
};

export const generateAIWorkoutPlan = async (
  condition: UserCondition,
  goal: WorkoutGoal,
  dayName: string,
  selectedSessionType?: string
): Promise<WorkoutSessionData | null> => {
  if (!API_KEY) {
    console.error("Gemini API Key is missing!");
    return null;
  }

  const conditionMap: Record<string, string> = {
    upper_stiff: "상체가 굳어있음 (Upper Body Stiffness - Neck/Shoulder/Back tightness)",
    lower_heavy: "하체가 무거움 (Lower Body Heaviness - Hip/Hamstring tightness)",
    full_fatigue: "전반적 피로감 (General Fatigue - Needs Recovery Focus)",
    good: "컨디션 좋음 (Good Condition - Ready for High Intensity)",
  };

  const userConditionDesc = conditionMap[condition.bodyPart] || condition.bodyPart;

  try {
    const prompt = `
      You are an elite Strength & Conditioning Coach certified by ACSM, NASM, and NSCA.
      Create a highly professional 50-minute workout master plan for today (${dayName}).

      User Profile:
      - Goal: ${goal.replace("_", " ").toUpperCase()}
      - Condition: ${userConditionDesc}
      - Available Time: 50 minutes (Fixed)
      
      TODAY SESSION TYPE (FINAL DECISION): ${selectedSessionType || "Recommended based on schedule"}
      ${selectedSessionType ? `
      CRITICAL INSTRUCTION: 
      The user explicitly selected "${selectedSessionType}". 
      YOU MUST GENERATE A "${selectedSessionType}" WORKOUT regardless of the day of the week (${dayName}).
      DO NOT CHANGE THE WORKOUT TYPE based on the weekly schedule.
      ` : `
      Determine the workout type based on the weekly schedule:
      - Mon: Push | Tue: Speed Run | Wed: Pull | Thu: Easy Run | Fri: Legs | Sat: LSD Run | Sun: Mobility
      `}

      Workout Structure (50 min total):
      1. Warm-up (5 min): 
         - CRITICAL: Apply NASM/ACSM Corrective Exercise guidelines.
         - IF Condition is "Good": Focus on dynamic activation for high performance.
         - IF Condition is "Stiff/Heavy/Fatigue": Select specific drills to alleviate the specific issue mentioned in Condition.
         - Example: If "Upper Body Stiffness", include Thoracic Spine Openers.
         - Equipment: Bodyweight, Bands, or Light Kettlebell (e.g., Halo, Prying Goblet Squat).
      2. Main Workout (40 min):
         - Apply NSCA guidelines for sets/reps based on the Goal (${goal}).
         - If Session Type is "Strength" (Push/Pull/Legs/Full Body): 5-6 compound & isolation movements.
         - If Session Type is "Running" (Easy/Speed/LSD): Structured run (e.g., Fartlek, Tempo) + pre-run activation.
         - If Session Type is "Mobility": Full body flow, yoga, or deep tissue work.
         - IMPORTANT: For Running Days, the Main Workout MUST be the Run itself (type: "cardio").
         - EQUIPMENT USAGE: Actively incorporate a variety of equipment including Barbell, Dumbbell, Kettlebell, and Cables/Machines.
         - Kettlebell Examples: KB Swings, Goblet Squats, KB Clean & Press, Turkish Get-up.
      3. Core (5 min): Functional core stability.
      4. Additional Cardio (Phase 04): 
         - If Main Workout was Strength: Recommend 15-20 min Running.
         - If Main Workout was Running: Recommend Mobility or Cooldown.
      
      CRITICAL LANGUAGE & FORMAT RULES:
      1. RESPONSE MUST BE IN KOREAN (한국어).
      2. Exercise names should be in Korean (e.g., "벤치 프레스", "스쿼트").
      3. "title" MUST be exactly "마스터 플랜".
      4. "description" MUST follow this format: 
         "${dayName}: [Workout Theme] - [Focus Area]"
         (Example: "Wednesday: Hypertrophy Pull Day - Fatigue Management Focus") 
         * Keep the Day Name in English, but translate the rest if natural, or keep it professional English/Korean mix.
         * Actually, User requested exactly: "Wednesday: Hypertrophy Pull Day - Fatigue Management Focus" style. 
         * Let's use English for the description to match the user's requested style exactly, OR Korean if they prefer. 
         * User said "한글로 나와야하는데... 부가 설명에 Wednesday... 이런식으로". 
         * Let's Output Description in ENGLISH format as requested example, but other contents in KOREAN.
         * WAIT, User said "한글로 나와야하는데" first. So description should be: "Wednesday: 등 근비대 - 피로 관리 집중" (Korean mixed).

      Format the response STRICTLY as a JSON object:
      {
        "title": "마스터 플랜", 
        "description": "Wednesday: Hypertrophy Pull - Fatigue Focus",
        "exercises": [
          {
            "type": "warmup",
            "name": "흉추 가동성 드릴 (Thoracic Openers)", 
            "count": "5분",
            "sets": 1,
            "reps": 1
          },
          {
            "type": "strength",
            "name": "바벨 로우 (Barbell Row)",
            "count": "3세트 / 12회", 
            "sets": 3,
            "reps": 12,
            "weight": "적당한 무게" 
          },
          {
            "type": "core",
            "name": "데드버그 (Deadbug)",
            "count": "5분",
            "sets": 1,
            "reps": 1
          },
          {
            "type": "cardio",
            "name": "추가 유산소: 인터벌 러닝",
            "count": "20분",
            "sets": 1,
            "reps": 1
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        responseMimeType: "application/json", 
        thinkingConfig: {
          thinkingBudget: 0,
        },
      }
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const workoutPlan: WorkoutSessionData = JSON.parse(cleanText);

    return workoutPlan;

  } catch (error) {
    console.error("Failed to generate workout with Gemini:", error);
    return null;
  }
};
