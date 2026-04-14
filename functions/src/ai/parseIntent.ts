import { onRequest } from "firebase-functions/v2/https";
import { verifyAuth } from "../helpers";
import { getGemini } from "../gemini";

/**
 * POST /api/parseIntent
 * 회의 57 (2026-04-15): 채팅형 홈 진입 — 유저 자연어 → planSession 파라미터 JSON.
 *
 * Input:
 *   { text: string,
 *     locale: "ko" | "en",
 *     userProfile?: { gender?, birthYear?, bodyWeightKg? }   // 기존 유저 컨텍스트
 *   }
 *
 * Output (성공):
 *   { intent: ParsedIntent, model: "gemini-2.5-flash" }
 *
 * Output (되묻기 필요):
 *   { intent: { clarifyQuestion: "...", confidence: 0.x, ... }, model: "gemini-2.5-flash" }
 */

export interface ParsedIntent {
  condition: {
    bodyPart: "upper_stiff" | "lower_heavy" | "full_fatigue" | "good";
    energyLevel: 1 | 2 | 3 | 4 | 5;
    availableTime: 30 | 50 | 90;
    bodyWeightKg?: number;
    gender?: "male" | "female";
    birthYear?: number;
  };
  goal: "fat_loss" | "muscle_gain" | "strength" | "general_fitness";
  sessionMode: "balanced" | "split" | "running" | "home_training";
  targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
  runType?: "interval" | "easy" | "long";
  intensityOverride?: "high" | "moderate" | "low";
  recentGymFrequency?: "none" | "1_2_times" | "regular";
  pushupLevel?: "zero" | "1_to_5" | "10_plus";
  confidence: number;            // 0~1
  missingCritical: string[];
  clarifyQuestion?: string;
}

export const parseIntent = onRequest(
  { cors: true, secrets: ["GEMINI_API_KEY"] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { text, locale = "ko", userProfile, history, workoutDigest } = req.body as {
      text?: string;
      locale?: "ko" | "en";
      userProfile?: {
        gender?: "male" | "female";
        birthYear?: number;
        bodyWeightKg?: number;
        heightCm?: number;
        goal?: "fat_loss" | "muscle_gain" | "endurance" | "health";
        weeklyFrequency?: number;
        bench1RM?: number;
        squat1RM?: number;
        deadlift1RM?: number;
      };
      history?: { role: "user" | "assistant"; content: string }[];
      workoutDigest?: string | null;
    };

    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    const now = new Date();
    const currentYear = now.getUTCFullYear();

    const profileCtx = userProfile
      ? `[기존 프로필 (대화에 없으면 이 값 사용, 유저에게 다시 묻지 말 것. "내 정보 뭔데?" 물으면 아래 unknown 아닌 값만 그대로 읽어서 답할 것)]
- gender: ${userProfile.gender ?? "unknown"}
- birthYear: ${userProfile.birthYear ?? "unknown"}
- bodyWeightKg: ${userProfile.bodyWeightKg ?? "unknown"}
- heightCm: ${userProfile.heightCm ?? "unknown"}
- goal: ${userProfile.goal ?? "unknown"} (fat_loss=체지방 감량, muscle_gain=근비대, endurance=지구력, health=건강 유지)
- weeklyFrequency: ${userProfile.weeklyFrequency ?? "unknown"} (주 몇 회 운동)
- bench1RM: ${userProfile.bench1RM ?? "unknown"}kg
- squat1RM: ${userProfile.squat1RM ?? "unknown"}kg
- deadlift1RM: ${userProfile.deadlift1RM ?? "unknown"}kg`
      : `[기존 프로필 없음 — 신규 유저. 정보 없이도 플랜 가능, 집착해서 묻지 말 것]`;

    const historyBlock = Array.isArray(history) && history.length > 0
      ? `[이전 대화 (같은 질문 반복 금지)]\n${history.slice(-8).map((m) => `${m.role === "user" ? "유저" : "AI"}: ${m.content}`).join("\n")}`
      : `[이전 대화 없음 — 첫 메시지]`;

    const digestBlock = typeof workoutDigest === "string" && workoutDigest.trim()
      ? `[유저의 최근 운동 이력 요약 — 추천·기억에 활용. 이력을 직접 언급하는 질문엔 이 데이터를 근거로 답할 것]\n${workoutDigest.trim()}`
      : `[운동 이력 없음 — 신규 유저 혹은 첫 운동]`;

    const prompt = `당신은 "오운잘"이라는 운동 앱의 AI 코치입니다. 유저와 자연스럽게 대화하면서, 운동 의도가 명확해지면 플랜 파라미터를 뽑아냅니다.

오늘 날짜: ${currentYear}년

${profileCtx}

${digestBlock}

${historyBlock}

[이번 유저 입력]
"${text.trim()}"

[두 가지 모드 중 하나를 선택]

**모드 A — 플랜 생성 (planReady: true)**
아래 조건 모두 만족 시에만 선택:
- 입력 또는 이전 대화에서 "어느 부위/무슨 운동/얼마나"가 충분히 드러났다
- 예: "가슴 30분", "하체 40분 하고 싶어", "러닝 5km", "오늘 전신 운동"

**모드 B — 자연 대화 (planReady: false)**
아래 경우 선택:
- 유저가 그냥 대화/질문/잡담 ("내 정보 없잖아?", "뭐 어떻게 알고?", "어떻게 써?", "안녕")
- 운동 의도가 애매해 한 가지 확인이 필요 ("운동하고 싶어" → 부위/시간 되물음)
- 오프토픽/장난/욕설·음담 → 한 문장으로 부드럽게 운동 얘기로 돌리되 설교 금지
이 모드에선 reply 필드에 친근한 한 문장 답변을 넣어라. 같은 문장 반복 절대 금지(이전 대화 참조).

[토큰 절약 — 최우선]
- reply는 **최대 2문장, 40자 이내**. 길게 쓰지 말 것.
- 모든 reply는 반드시 **운동 요청 또는 유저 정보를 유도하는 질문 1개**를 포함.
  예: "오늘 어느 부위 해볼까요?" / "시간은 30분·50분 중 어느쪽?" / "평소 헬스 얼마나 다니세요?"
- 잡담·유머·공감 설명으로 대화를 늘리지 말 것. 정보 수집이 목적.
- 오프토픽엔 **한 번만 부드럽게 리디렉션**하고 즉시 운동 질문으로 넘어갈 것.

[톤 규칙 — 대화 모드일 때]
- 편한 존댓말 (해요체), "ㅎㅎ" 최대 1회
- "화이팅", "파이팅" 금지
- 의학/전문 용어 금지

[이력 활용 규칙]
- "최근에 뭐 했어?", "저번엔 뭐 했지?", "이번주 몇 번 했어?" 같은 질문은 위 [유저의 최근 운동 이력 요약]의 값을 그대로 읽어 답할 것.
- 운동 부위가 애매하면 최근 집중 부위와 비교해 **빠진 부위를 제안**: "최근 상체만 3번이네요, 오늘 하체 어때요?"
- 휴식 필요하면 언급: 같은 부위 24시간 내 연속 제안 금지.
- 이력이 "없음"이면 짐작 금지, "첫 기록이네요" 정도로 언급하고 바로 오늘 운동 질문.

[정직 규칙 — 반드시 지킬 것]
- 유저가 "내 정보 알아?", "뭘 알고 있어?", "내 신체정보 뭐야" 같이 물으면:
  * 위 [기존 프로필] 블록의 gender/birthYear/bodyWeightKg 중 "unknown"이 아닌 값만 **그대로 읽어서** 답할 것.
    예시: "성별 여성, 2001년생, 체중 58kg 알고 있어요. 오늘 어느 부위?"
  * 전부 unknown이면 **솔직히 "아직 정보 없어요"** 라고 말하고 바로 오늘 운동 질문으로 이어갈 것.
    예시: "아직 프로필 정보 없어요. 오늘 가슴·하체 중 어느쪽 하고 싶으세요?"
  * 절대 "알고 있어요"라고 얼버무리면 안 됨. 구체 값 or "없음" 둘 중 하나만.
- 모른다고 거짓말로 회피하거나, 알고 있다고 거짓으로 얼버무리지 말 것.

[플랜 파라미터 추출 규칙 — 모드 A일 때만 적용]
1. 필드 값은 반드시 아래 enum 중 하나. 확실치 않으면 안전한 중립값.
2. 누락 필드는 중립 기본값 — energyLevel=3, bodyPart="good", sessionMode="balanced", goal="general_fitness".
3. 기존 프로필 컨텍스트가 있으면 gender/birthYear/bodyWeightKg 그대로 사용.
4. 나이("35살") → ${currentYear} - 나이 = birthYear.
5. availableTime 스냅: running+long이면 30|50|90, 그 외 30|50 (60+ 요청도 50 캡).
6. bodyPart: 어깨/목/허리 뻐근 → upper_stiff, 다리 무거움 → lower_heavy, 전신 피로 → full_fatigue, 그 외 → good.
7. sessionMode:
   - "러닝/달리기/조깅" → running (최우선)
   - "홈트/집/집에서" 키워드 포함 → home_training (다음 우선)
   - 특정 부위 하나만 지정 (가슴/등/하체/어깨/팔 중 하나) → split
   - 여러 부위 나열 (예: "가슴이랑 삼두", "상체 전체") → balanced
   - 그 외/애매 → balanced
8. targetMuscle: sessionMode==="split"일 때만. enum은 반드시 chest|back|shoulders|arms|legs 중 하나. 복합어(chest_triceps 같은)나 "복부/복근" 같은 외부 값 절대 금지. 복부는 balanced로 분류.
8-1. availableTime 스냅 방향: 중간값(40분 등)은 **올림** (30/50 중 50 선택). 60+는 50 캡.
9. pushupLevel: 0개 → zero, 1~5 → 1_to_5, 10+ → 10_plus.
10. recentGymFrequency: 안 함 → none, 가끔 → 1_2_times, 꾸준히/경력 → regular.

[출력 스키마 — JSON만]

모드 A (플랜 생성) 예시:
{
  "planReady": true,
  "intent": {
    "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 30, "bodyWeightKg": 58, "gender": "female", "birthYear": 1991 },
    "goal": "fat_loss",
    "sessionMode": "split",
    "targetMuscle": "legs",
    "recentGymFrequency": "regular",
    "pushupLevel": "1_to_5"
  }
}

모드 B (자연 대화) 예시:
{
  "planReady": false,
  "reply": "정보 없어도 괜찮아요! 오늘 어느 부위 할지만 알려주시면 맞춰 짜드릴게요 ㅎㅎ"
}

JSON만 반환. 설명 문장 금지.`;

    try {
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2, // 추출 작업이라 결정성 우선
        },
      });

      const raw = response.text || "";
      let parsedRaw: any;
      try {
        parsedRaw = JSON.parse(raw);
      } catch {
        res.status(200).json(buildFallbackReply(locale, "fallback-parse-error"));
        return;
      }

      // Gemini가 planReady 플래그로 모드 선택
      if (parsedRaw?.planReady === true && parsedRaw?.intent) {
        const intent = sanitize(parsedRaw.intent);
        res.status(200).json({ mode: "plan", intent, model: "gemini-2.5-flash" });
        return;
      }

      // 자연 대화 모드 (기본)
      const reply = typeof parsedRaw?.reply === "string" && parsedRaw.reply.trim()
        ? parsedRaw.reply.trim()
        : (locale === "en"
          ? "Tell me which area and how long — I'll build a plan for you."
          : "어느 부위로, 몇 분 할지만 말씀해주시면 바로 짜드려요.");
      res.status(200).json({ mode: "chat", reply, model: "gemini-2.5-flash" });
    } catch (error) {
      console.error("parseIntent error:", error);
      res.status(200).json(buildFallbackReply(locale, "fallback-exception"));
    }
  },
);

function buildFallbackReply(locale: "ko" | "en", model: string) {
  return {
    mode: "chat" as const,
    reply: locale === "en"
      ? "Hmm, connection hiccup. Try again in a sec — or just say 'chest 30 min' style."
      : "잠깐 연결이 흔들렸어요. 다시 말씀해주시거나 '가슴 30분' 같이 편하게 보내주세요.",
    model,
  };
}

/** Gemini가 enum 밖 값을 내더라도 안전값으로 스냅. */
function sanitize(p: any): ParsedIntent {
  const cond = p?.condition || {};
  const bodyParts = ["upper_stiff", "lower_heavy", "full_fatigue", "good"] as const;
  const energies = [1, 2, 3, 4, 5] as const;
  const times = [30, 50, 90] as const;
  const goals = ["fat_loss", "muscle_gain", "strength", "general_fitness"] as const;
  const modes = ["balanced", "split", "running", "home_training"] as const;
  const muscles = ["chest", "back", "shoulders", "arms", "legs"] as const;
  const runTypes = ["interval", "easy", "long"] as const;
  const intensities = ["high", "moderate", "low"] as const;
  const freq = ["none", "1_2_times", "regular"] as const;
  const push = ["zero", "1_to_5", "10_plus"] as const;

  // availableTime 캡 — long run 외에는 50으로 제한
  let at: 30 | 50 | 90 = times.includes(cond.availableTime) ? cond.availableTime : 30;
  const isLongRun = p?.sessionMode === "running" && p?.runType === "long";
  if (!isLongRun && at === 90) at = 50;

  return {
    condition: {
      bodyPart: bodyParts.includes(cond.bodyPart) ? cond.bodyPart : "good",
      energyLevel: energies.includes(cond.energyLevel) ? cond.energyLevel : 3,
      availableTime: at,
      bodyWeightKg: typeof cond.bodyWeightKg === "number" && cond.bodyWeightKg > 20 && cond.bodyWeightKg < 300
        ? cond.bodyWeightKg : undefined,
      gender: cond.gender === "male" || cond.gender === "female" ? cond.gender : undefined,
      birthYear: typeof cond.birthYear === "number" && cond.birthYear > 1920 && cond.birthYear < 2020
        ? cond.birthYear : undefined,
    },
    goal: goals.includes(p?.goal) ? p.goal : "general_fitness",
    sessionMode: modes.includes(p?.sessionMode) ? p.sessionMode : "balanced",
    targetMuscle: muscles.includes(p?.targetMuscle) ? p.targetMuscle : undefined,
    runType: runTypes.includes(p?.runType) ? p.runType : undefined,
    intensityOverride: intensities.includes(p?.intensityOverride) ? p.intensityOverride : undefined,
    recentGymFrequency: freq.includes(p?.recentGymFrequency) ? p.recentGymFrequency : undefined,
    pushupLevel: push.includes(p?.pushupLevel) ? p.pushupLevel : undefined,
    confidence: typeof p?.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0.5,
    missingCritical: Array.isArray(p?.missingCritical) ? p.missingCritical : [],
    clarifyQuestion: typeof p?.clarifyQuestion === "string" && p.clarifyQuestion.trim()
      ? p.clarifyQuestion.trim() : undefined,
  };
}
