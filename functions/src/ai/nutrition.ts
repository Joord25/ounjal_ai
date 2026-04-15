import { onRequest } from "firebase-functions/v2/https";
import { verifyAuth } from "../helpers";
import { getGemini, GEMINI_MODEL } from "../gemini";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 영양 가이드 — Gemini 기반 (회의 37)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NutritionRequest {
  locale: string;
  bodyWeightKg: number;
  heightCm?: number;
  age: number;
  gender: "male" | "female";
  goal: string; // muscle_gain, fat_loss, endurance, health
  weeklyFrequency: number;
  todaySession: {
    type: string; // strength, cardio, mixed
    durationMin: number;
    bodyPart?: string;
    estimatedCalories: number;
  };
}

interface NutritionResponse {
  dailyCalorie: number;
  goalBasis: string;
  macros: { protein: number; carb: number; fat: number };
  meals: { time: string; menu: string }[];
  keyTip: string;
}

export const getNutritionGuide = onRequest(
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

    const data = req.body as NutritionRequest;
    const { locale, bodyWeightKg, heightCm, age, gender, goal, weeklyFrequency, todaySession } = data;

    const isKo = locale === "ko";

    // Mifflin-St Jeor BMR
    const height = heightCm ?? (gender === "male" ? 174 : 161); // 한국 평균 키 폴백
    const bmr = gender === "male"
      ? 10 * bodyWeightKg + 6.25 * height - 5 * age + 5
      : 10 * bodyWeightKg + 6.25 * height - 5 * age - 161;

    // 활동계수
    const activityMultiplier = weeklyFrequency <= 1 ? 1.2
      : weeklyFrequency <= 3 ? 1.375
      : weeklyFrequency <= 5 ? 1.55
      : 1.725;

    const tdee = Math.round(bmr * activityMultiplier);

    // 목표별 칼로리 조정
    const goalCalorie = goal === "fat_loss" ? tdee - 400
      : goal === "muscle_gain" ? tdee + 300
      : tdee;

    const goalLabel = isKo
      ? (goal === "fat_loss" ? "감량 목표" : goal === "muscle_gain" ? "증량 목표" : goal === "endurance" ? "체력 목표" : "건강 목표")
      : (goal === "fat_loss" ? "Fat loss goal" : goal === "muscle_gain" ? "Muscle gain goal" : goal === "endurance" ? "Endurance goal" : "Health goal");

    // 탄단지 계산
    const proteinG = Math.round(bodyWeightKg * (goal === "muscle_gain" ? 2.0 : goal === "fat_loss" ? 1.8 : 1.6));
    const fatG = Math.round(bodyWeightKg * 0.9);
    const proteinCal = proteinG * 4;
    const fatCal = fatG * 9;
    const carbG = Math.round((goalCalorie - proteinCal - fatCal) / 4);

    const prompt = isKo
      ? `당신은 운동 영양 전문가입니다. 아래 유저 정보를 바탕으로 오늘의 식단을 JSON으로 추천해주세요.

유저: ${age}세 ${gender === "male" ? "남성" : "여성"}, ${bodyWeightKg}kg, 키 ${height}cm
목표: ${goalLabel}
주 ${weeklyFrequency}회 운동
오늘 운동: ${todaySession.type} ${todaySession.durationMin}분, 약 ${todaySession.estimatedCalories}kcal 소모

하루 목표: ${goalCalorie}kcal (단백질 ${proteinG}g, 탄수화물 ${carbG}g, 지방 ${fatG}g)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "meals": [
    {"time": "아침", "menu": "오트밀 + 계란 3개 + 프로틴"},
    {"time": "점심", "menu": "밥 + 닭가슴살 150g + 견과류"},
    {"time": "간식", "menu": "프로틴 쉐이크 + 바나나"},
    {"time": "저녁", "menu": "밥 + 소고기 200g + 샐러드"}
  ],
  "keyTip": "단백질만 맞추면 나머지는 유동적으로 OK"
}

규칙:
- 3~4끼 구성
- 한국에서 쉽게 구할 수 있는 음식
- 시간 부족한 직장인 기준으로 간편하게
- 운동 시간대에 따라 식사 배치 조정
- keyTip은 한 줄로 핵심만
- 반드시 모든 텍스트를 한국어로 작성 (time: "아침","점심","간식","저녁" / menu도 한국어)`
      : `You are a sports nutrition expert. Recommend today's meal plan based on the user profile below. Respond ONLY in JSON format.

User: ${age}yo ${gender}, ${bodyWeightKg}kg, ${height}cm
Goal: ${goalLabel}
Training ${weeklyFrequency}x/week
Today's session: ${todaySession.type} ${todaySession.durationMin}min, ~${todaySession.estimatedCalories}kcal burned

Daily target: ${goalCalorie}kcal (protein ${proteinG}g, carb ${carbG}g, fat ${fatG}g)

Respond ONLY with this JSON:
{
  "meals": [
    {"time": "Breakfast", "menu": "Oatmeal + 3 eggs + protein shake"},
    {"time": "Lunch", "menu": "Rice + chicken breast 150g + nuts"},
    {"time": "Snack", "menu": "Protein shake + banana"},
    {"time": "Dinner", "menu": "Rice + beef 200g + salad"}
  ],
  "keyTip": "Hit your protein target and the rest is flexible"
}

Rules:
- 3-4 meals
- Simple, accessible foods
- Optimized for busy schedules
- keyTip is one line max`;

    try {
      const genAI = getGemini();
      const result = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      });

      const text = result.text ?? "";

      let parsed: { meals: { time: string; menu: string }[]; keyTip: string };
      try {
        parsed = JSON.parse(text);
      } catch {
        // JSON 파싱 실패 시 폴백
        parsed = {
          meals: isKo
            ? [
                { time: "아침", menu: "오트밀 + 계란 3개 + 프로틴" },
                { time: "점심", menu: "밥 + 닭가슴살 150g + 견과류" },
                { time: "간식", menu: "프로틴 쉐이크 + 바나나" },
                { time: "저녁", menu: "밥 + 소고기/생선 200g" },
              ]
            : [
                { time: "Breakfast", menu: "Oatmeal + 3 eggs + protein" },
                { time: "Lunch", menu: "Rice + chicken 150g + nuts" },
                { time: "Snack", menu: "Protein shake + banana" },
                { time: "Dinner", menu: "Rice + beef/fish 200g" },
              ],
          keyTip: isKo ? "단백질만 맞추면 나머지는 유동적으로 OK" : "Hit your protein and the rest is flexible",
        };
      }

      const response: NutritionResponse = {
        dailyCalorie: goalCalorie,
        goalBasis: goalLabel,
        macros: { protein: proteinG, carb: carbG, fat: fatG },
        meals: parsed.meals,
        keyTip: parsed.keyTip,
      };

      res.json(response);
    } catch (error) {
      console.error("Nutrition guide error:", error);

      // 폴백 응답
      res.json({
        dailyCalorie: goalCalorie,
        goalBasis: goalLabel,
        macros: { protein: proteinG, carb: carbG, fat: fatG },
        meals: isKo
          ? [
              { time: "아침", menu: "오트밀 + 계란 3개 + 프로틴" },
              { time: "점심", menu: "밥 + 닭가슴살 + 견과류" },
              { time: "간식", menu: "프로틴 쉐이크 + 바나나" },
              { time: "저녁", menu: "밥 + 소고기/생선 200g" },
            ]
          : [
              { time: "Breakfast", menu: "Oatmeal + 3 eggs + protein" },
              { time: "Lunch", menu: "Rice + chicken + nuts" },
              { time: "Snack", menu: "Protein shake + banana" },
              { time: "Dinner", menu: "Rice + beef/fish 200g" },
            ],
        keyTip: isKo ? "단백질만 맞추면 나머지는 유동적으로 OK" : "Hit your protein and the rest is flexible",
      } as NutritionResponse);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 영양 채팅 — follow-up 질문 (회의 37)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const nutritionChat = onRequest(
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

    const { question, locale, context } = req.body as {
      question: string;
      locale: string;
      context: {
        bodyWeightKg: number;
        age: number;
        gender: string;
        goal: string;
        todaySession: string;
        currentGuide?: string;
      };
    };

    const isKo = locale === "ko";

    const systemPrompt = isKo
      ? `당신은 운동 영양 전문가입니다. 유저가 운동 후 영양에 대해 질문합니다.

유저 정보: ${context.age}세 ${context.gender === "male" ? "남성" : "여성"}, ${context.bodyWeightKg}kg, 목표: ${context.goal}
오늘 운동: ${context.todaySession}
${context.currentGuide ? `이미 제공한 가이드: ${context.currentGuide}` : ""}

규칙:
- 한국어로 답변
- 간결하게 2-3문장
- 구체적 그램수/메뉴 제공 가능
- 이모지 사용 가능 (채팅이라 자연스럽게 1~2개 정도, 과도한 도배는 금지). 한글 이모티콘(ㅎㅎ ㅠㅠ)도 OK
- 핵심 수치/식품명/타이밍은 **굵게** 마크다운으로 강조 (예: "운동 후 30분 안에 **단백질 30g**"). 한 답변에 1~3개 정도만.
- 반말/격식체 금지, 편한 존댓말
- 의학적 진단/처방은 하지 않음
- "일반적인 영양 정보"임을 인지`
      : `You are a sports nutrition expert. The user is asking about post-workout nutrition.

User: ${context.age}yo ${context.gender}, ${context.bodyWeightKg}kg, Goal: ${context.goal}
Today's session: ${context.todaySession}
${context.currentGuide ? `Current guide: ${context.currentGuide}` : ""}

Rules:
- Reply in English
- Keep it to 2-3 sentences
- Specific grams/foods OK
- Emojis allowed (1~2 per reply, casual chat tone — avoid overuse)
- Use **bold** markdown for key numbers/foods/timing (e.g., "Within 30 min post-workout, aim for **30g protein**"). 1~3 per reply max.
- No medical diagnoses
- Frame as "general nutrition information"`;

    try {
      const genAI = getGemini();
      const result = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${systemPrompt}\n\n유저 질문: ${question}`,
        config: { temperature: 0.7 },
      });

      res.json({ answer: result.text ?? (isKo ? "잠시 후 다시 시도해주세요" : "Please try again shortly") });
    } catch (error) {
      console.error("Nutrition chat error:", error);
      res.json({ answer: isKo ? "잠시 후 다시 시도해주세요" : "Please try again shortly" });
    }
  }
);
