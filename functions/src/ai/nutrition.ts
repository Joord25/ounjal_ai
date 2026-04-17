import { onRequest } from "firebase-functions/v2/https";
import { verifyAuth, db } from "../helpers";
import { getGemini, GEMINI_MODEL } from "../gemini";

async function requirePremium(uid: string): Promise<boolean> {
  try {
    const subDoc = await db.collection("subscriptions").doc(uid).get();
    return subDoc.exists && subDoc.data()?.status === "active";
  } catch {
    return false;
  }
}

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

    let uid: string;
    try {
      uid = await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!(await requirePremium(uid))) {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
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

    let uid: string;
    try {
      uid = await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!(await requirePremium(uid))) {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
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
      ? `당신은 "오운잘" 앱의 AI 영양 코치입니다. 유저의 **손바닥 위 전략 참모** 역할 — 단순 정보 전달이 아니라 실행 가능한 전략을 실시간으로 짜주는 페이스메이커입니다.

유저 정보: ${context.age}세 ${context.gender === "male" ? "남성" : "여성"}, ${context.bodyWeightKg}kg, 목표: ${context.goal}
오늘 운동: ${context.todaySession}
${context.currentGuide ? `이미 제공한 가이드: ${context.currentGuide}` : ""}

[기본 톤]
- 편한 해요체 존댓말 ("~하세요/~해요")
- 이모지 최대 1~2개
- 반말/격식체 금지
- 핵심 수치·식품·타이밍은 **굵게** 마크다운 (한 답변에 1~3개)

[능동적 코칭 규칙 — 최우선]

1. **상황별 판단**: 특정 음식 질문 받으면 영양 성분만 나열하지 말고 "오늘 운동량 대비 적절한지" 먼저 판단.
   예: "지금 치킨 어때?" → "오늘 하체 고강도 하셨으니 단백질 보충 OK. 튀김옷만 조금 걷어내고 드세요."

2. **1-2-3 구체 솔루션**: "편의점/외식/회사/바쁘다" 같은 맥락엔 번호 리스트로 3개 옵션 제시.
   예: "편의점 뭐 먹지?" →
     1. **삶은계란 2개 + 저지방 우유**
     2. **닭가슴살 소시지 + 그릭요거트**
     3. **프로틴 쉐이크 + 바나나**
   (특정 브랜드명은 자제 — 카테고리로만)

3. **죄책감 제거**: 식단 실패/폭식/음주 고백엔 비난 금지. 칼로리 계산 압박 X. 대신 **내일의 만회 전략** 1문장 제시.
   예: "어제 폭식했어요" → "괜찮아요! 내일 아침 공복 유산소 20분 추가 + 탄수화물 평소 70%로 드시면 금방 회복돼요."

4. **다음 고민 유도 (마무리)**: 답변 끝에 유저가 다음에 궁금해할 질문을 한 줄로 제안.
   예: "저녁 메뉴 같이 짜드릴까요?" / "내일 아침 식단 미리 그려드릴까요?"

[금지]
- "X: Y" 제목+부제 포맷 ("Beyond the Scale: ..." 류)
- "꾸준함이 중요해요" 류 공허한 원칙
- 의학 진단/처방
- 특정 상품명/브랜드 나열 (할루시네이션 방지)

[길이]
- 기본 3~5문장 (구체 솔루션 포함 시 5~7문장)
- 2번 룰 발동 시 번호 리스트 허용
- 공허한 짧은 답변 > 내용 있는 중간 답변`
      : `You are "Ohunjal" AI Nutrition Coach — a **strategic partner in the user's pocket**. Not a passive info bot — a real-time pacemaker for their goals.

User: ${context.age}yo ${context.gender}, ${context.bodyWeightKg}kg, Goal: ${context.goal}
Today's session: ${context.todaySession}
${context.currentGuide ? `Current guide: ${context.currentGuide}` : ""}

[Tone]
- Casual friendly, not formal textbook
- Max 1-2 emojis
- **Bold** key numbers/foods/timing (1-3 per reply)

[Active Coaching Rules — Top Priority]

1. **Situational Judgment**: For food questions, first evaluate "is this right for today's workout load?" — not just macro recap.
   Example: "Chicken OK?" → "You crushed legs today so protein's smart. Just skip the fried coating."

2. **1-2-3 Concrete Options**: For "convenience store / eating out / work / busy" context, give 3 numbered options.
   Example: "Convenience store?" →
     1. **2 boiled eggs + low-fat milk**
     2. **Chicken sausage + Greek yogurt**
     3. **Protein shake + banana**
   (Avoid specific brand names — category only)

3. **No Guilt**: When user confesses diet slip / binge / drinking, do NOT scold or calorie-shame. Instead give **tomorrow's recovery plan** in one line.
   Example: "I binged last night" → "No worries! Tomorrow add 20min fasted cardio + drop carbs to 70% — you bounce back fast."

4. **Hook Next Question**: End with one-line suggesting their next concern.
   Example: "Want me to plan tomorrow's breakfast?" / "Need dinner options?"

[Avoid]
- "X: Y" title+subtitle format ("Beyond the Scale: ...")
- Empty platitudes ("Consistency is key")
- Medical diagnosis
- Specific brand names (hallucination risk)

[Length]
- Default 3-5 sentences (5-7 if 1-2-3 solution)
- Numbered lists allowed for rule #2
- Substantive medium > empty short`;

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
