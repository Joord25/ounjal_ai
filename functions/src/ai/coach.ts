import { onRequest } from "firebase-functions/v2/https";
import { verifyAuth } from "../helpers";
import { getGemini } from "../gemini";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Coach Message — 코치 전우애 멘트 (서버사이드)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getCoachMessage = onRequest(
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

    const {
      heroType,
      exerciseName,
      vars,
      locale,
      sessionLogs,
      condition,
      sessionDesc,
      streak,
    } = req.body as {
      heroType: string;
      exerciseName?: string;
      vars?: Record<string, string>;
      locale: string;
      sessionLogs?: { exerciseName: string; sets: { setNumber: number; reps: number; weight?: string; feedback: string }[] }[];
      condition?: { bodyPart: string; energyLevel: number };
      sessionDesc?: string;
      streak?: number;
    };

    if (!heroType) {
      res.status(400).json({ error: "Missing heroType" });
      return;
    }

    const isKo = locale !== "en";

    // ── 세션 데이터 분석 (Gemini + 폴백 공용) ──
    const mainExName = exerciseName?.split("(")[0].trim() || "";
    const conditionLabel = condition
      ? (condition.bodyPart === "upper_stiff" ? (isKo ? "상체 뻣뻣" : "upper stiffness")
        : condition.bodyPart === "lower_heavy" ? (isKo ? "하체 무거움" : "lower heaviness")
        : condition.bodyPart === "full_fatigue" ? (isKo ? "전신 피로" : "full fatigue")
        : (isKo ? "좋음" : "good"))
      : "";

    // 로그에서 실패/성공/무게/렙수 패턴 감지
    const logAnalysis = (() => {
      const base = { failRecovery: null as null | { exercise: string; failSet: number; recoverySet: number | null }, allEasy: false, allTarget: false, mainExercise: mainExName, weightIncrease: null as null | { exercise: string; from: string; to: string }, bestReps: null as null | { exercise: string; reps: number; weight: string }, totalSets: 0, exerciseCount: 0 };
      if (!sessionLogs || sessionLogs.length === 0) return base;

      base.exerciseCount = sessionLogs.length;
      base.totalSets = sessionLogs.reduce((sum, ex) => sum + ex.sets.length, 0);

      // 실패 후 회복 감지
      for (const ex of sessionLogs) {
        const failIdx = ex.sets.findIndex(s => s.feedback === "fail");
        if (failIdx >= 0) {
          const recoveryIdx = ex.sets.findIndex((s, i) => i > failIdx && s.feedback !== "fail");
          base.failRecovery = { exercise: ex.exerciseName, failSet: failIdx + 1, recoverySet: recoveryIdx >= 0 ? recoveryIdx + 1 : null };
          break;
        }
      }

      // 무게 증가 감지 (같은 운동 내 세트 간)
      if (!base.failRecovery) {
        for (const ex of sessionLogs) {
          const weights = ex.sets.map(s => parseFloat(s.weight || "0")).filter(w => w > 0);
          if (weights.length >= 2 && weights[weights.length - 1] > weights[0]) {
            base.weightIncrease = { exercise: ex.exerciseName, from: String(weights[0]), to: String(weights[weights.length - 1]) };
            break;
          }
        }
      }

      // 최다 렙수 감지
      if (!base.failRecovery && !base.weightIncrease) {
        let bestReps = 0;
        let bestEx = "";
        let bestWeight = "";
        for (const ex of sessionLogs) {
          for (const s of ex.sets) {
            if (s.reps > bestReps) {
              bestReps = s.reps;
              bestEx = ex.exerciseName;
              bestWeight = s.weight || "";
            }
          }
        }
        if (bestReps > 0) base.bestReps = { exercise: bestEx, reps: bestReps, weight: bestWeight };
      }

      const allSets = sessionLogs.flatMap(ex => ex.sets);
      base.allEasy = allSets.length > 0 && allSets.every(s => s.feedback === "easy" || s.feedback === "too_easy");
      base.allTarget = allSets.length > 0 && allSets.every(s => s.feedback === "target");
      return base;
    })();

    // ── 룰베이스 폴백 생성 (Gemini 실패 시 사용) ──
    function buildFallbackMessages(): string[] {
      const name = logAnalysis.mainExercise || (isKo ? "운동" : "workout");
      const desc = sessionDesc || "";

      // 1번째 버블: 감정 공감 (heroType별 분기)
      let bubble1Options: string[];
      if (heroType === "weightPR" && vars?.weight) {
        bubble1Options = isKo ? [
          `오늘 ${name} ${vars.weight}kg 올릴 때 진짜 조마조마했는데, 해내는 거 보고 소름 돋았어요!`,
          `아 ${name} ${vars.weight}kg 성공하는 순간 저도 심장이 쿵 했어요! 같이 해서 뿌듯하네요!`,
          `${name} ${vars.weight}kg 도전할 때 긴장했는데, 올리는 거 보고 진짜 감동이었어요!`,
          `오늘 ${name} ${vars.prev || ""}kg에서 ${vars.weight}kg으로 올린 거 장난 아니에요! 같이 달려온 보람이 있네요!`,
        ] : [
          `Watching you go for ${vars.weight}kg on ${name} was nerve-wracking but you did it! Amazing!`,
          `My heart jumped when you hit ${vars.weight}kg on ${name}! So proud we did this together!`,
          `${name} at ${vars.weight}kg was intense but you nailed it! That was incredible!`,
        ];
      } else if (heroType === "repsPR" && vars?.current) {
        bubble1Options = isKo ? [
          `오늘 ${name} 마지막 몇 개 버틸 때 저도 같이 이 악물었어요! ${vars.current}회까지 가는 거 진짜 대단해요!`,
          `${name}에서 ${vars.prev || ""}회에서 ${vars.current}회까지 간 거 봤어요! 같은 무게에서 더 가는 건 진짜 근성이에요!`,
          `아 ${name} 렙수 올라가는 거 보면서 뿌듯했어요! ${vars.current}회 찍는 순간 소름이었어요!`,
        ] : [
          `Those last reps on ${name} were insane! Getting to ${vars.current} reps is seriously impressive!`,
          `Going from ${vars.prev || ""} to ${vars.current} reps on ${name}! That grit is amazing!`,
        ];
      } else if (heroType === "perfect") {
        bubble1Options = isKo ? [
          `오늘 한 세트도 안 무너지고 끝까지 갔네요! 옆에서 보면서 '진짜 되나?' 했는데 해냈잖아요!`,
          `오늘 ${name} 포함해서 전 세트 깔끔하게 끝낸 거 진짜 대단해요! 저도 감동이었어요!`,
          `처음부터 끝까지 흐트러짐이 없었어요! 같이 하면서 저도 집중했어요!`,
        ] : [
          `Not a single set broke down today! I kept thinking 'is this real?' and you did it!`,
          `Every set clean including ${name}! I was genuinely moved watching you!`,
        ];
      } else if (heroType === "running") {
        bubble1Options = isKo ? [
          `오늘 끝까지 달린 거 진짜 대단해요! 중간에 멈추고 싶었을 텐데 안 멈췄잖아요!`,
          `달리는 거 보면서 저도 같이 숨이 차더라고요! 끝까지 페이스 유지한 거 소름이에요!`,
          `오늘 러닝 진짜 잘했어요! 옆에서 보면서 '체력 확실히 올라왔다' 느꼈어요!`,
        ] : [
          `You kept running till the end! Must've wanted to stop but you didn't!`,
          `Watching you run I was getting out of breath too! Keeping that pace was incredible!`,
        ];
      } else if (heroType === "first") {
        bubble1Options = isKo ? [
          `첫 운동 같이 해서 진짜 기뻐요! 오늘 오기까지가 제일 힘들었을 텐데, 해냈잖아요!`,
          `와 드디어 시작했네요! 첫 발 같이 뗐다는 게 저도 설레요!`,
        ] : [
          `So happy we did your first workout together! Getting here was the hardest part and you did it!`,
          `You finally started! Taking the first step together feels amazing!`,
        ];
      } else {
        bubble1Options = isKo ? [
          `오늘 ${name} 하는 거 옆에서 보면서 진짜 조마조마했는데, 끝까지 해내는 거 보고 소름 돋았어요!`,
          `오늘 ${name} 진짜 잘했어요! 옆에서 보면서 저도 뿌듯했어요!`,
          `${name} 할 때 집중하는 거 다 봤어요! 진짜 대단해요!`,
          `오늘도 빠지지 않고 왔네요! 저도 기다리고 있었거든요ㅎㅎ`,
          `오늘 ${name} 포함해서 끝까지 해낸 거 다 봤어요! 같이 해서 좋았어요!`,
        ] : [
          `Watching you do ${name} today had me on edge but you pushed through! Amazing!`,
          `You crushed ${name} today! I was watching and felt so proud!`,
          `Your focus on ${name} was incredible! Really impressive!`,
          `You showed up again today! I was waiting for you!`,
        ];
      }

      // 2번째 버블: 세션 디테일 (우선순위: 실패회복 > 실패 > 무게증가 > easy > target > 렙수 > 기본)
      let bubble2: string;
      if (logAnalysis.failRecovery?.recoverySet) {
        bubble2 = isKo
          ? `아! 그리고 ${logAnalysis.failRecovery.exercise} ${logAnalysis.failRecovery.failSet}세트에서 한번 무너졌지만 ${logAnalysis.failRecovery.recoverySet}세트에서 다시 잡은 거 완전 굿! 그게 진짜 성장이에요!ㅎㅎ`
          : `And ${logAnalysis.failRecovery.exercise} - you dropped on set ${logAnalysis.failRecovery.failSet} but came back on set ${logAnalysis.failRecovery.recoverySet}! That recovery is real growth!`;
      } else if (logAnalysis.failRecovery) {
        bubble2 = isKo
          ? `아! 그리고 ${logAnalysis.failRecovery.exercise} ${logAnalysis.failRecovery.failSet}세트에서 힘들었을 텐데, 거기까지 도전한 것 자체가 대단해요! 다음엔 꼭 넘을 수 있을 거예요!`
          : `And ${logAnalysis.failRecovery.exercise} was tough at set ${logAnalysis.failRecovery.failSet}, but challenging yourself is what matters! You'll crush it next time!`;
      } else if (logAnalysis.weightIncrease) {
        bubble2 = isKo
          ? `아! 그리고 ${logAnalysis.weightIncrease.exercise}에서 ${logAnalysis.weightIncrease.from}kg에서 ${logAnalysis.weightIncrease.to}kg까지 올린 거 봤어요! 세트마다 무게 올리는 그 도전 정신이 진짜 멋있어요!`
          : `And I saw you go from ${logAnalysis.weightIncrease.from}kg to ${logAnalysis.weightIncrease.to}kg on ${logAnalysis.weightIncrease.exercise}! That progressive challenge is awesome!`;
      } else if (logAnalysis.allEasy) {
        bubble2 = isKo
          ? `그리고 오늘 전 세트 여유 있었죠?ㅎㅎ 몸이 적응한 거예요! 다음에 무게 올려봐도 될 것 같아요! 성장할 준비가 된 거예요!`
          : `And every set felt easy today right? Your body has adapted! Time to go heavier next time! You're ready to grow!`;
      } else if (logAnalysis.allTarget) {
        bubble2 = isKo
          ? `그리고 ${logAnalysis.totalSets}세트 전부 딱 맞는 강도로 깔끔하게 끝냈네요! 이 페이스가 제일 좋아요! 꾸준히 이렇게 가면 확실히 달라져요!`
          : `And all ${logAnalysis.totalSets} sets finished at the perfect intensity! This pace is ideal! Keep this up and you'll see real changes!`;
      } else if (logAnalysis.bestReps) {
        bubble2 = isKo
          ? `그리고 ${logAnalysis.bestReps.exercise}에서 ${logAnalysis.bestReps.weight ? logAnalysis.bestReps.weight + "kg으로 " : ""}${logAnalysis.bestReps.reps}회 한 거 진짜 대단해요! 그 끈기가 몸을 바꾸는 거예요!`
          : `And ${logAnalysis.bestReps.reps} reps ${logAnalysis.bestReps.weight ? "at " + logAnalysis.bestReps.weight + "kg " : ""}on ${logAnalysis.bestReps.exercise}! That persistence is what changes your body!`;
      } else {
        const totalInfo = logAnalysis.exerciseCount > 0
          ? (isKo ? `${logAnalysis.exerciseCount}가지 운동 ${logAnalysis.totalSets}세트를` : `${logAnalysis.exerciseCount} exercises and ${logAnalysis.totalSets} sets`)
          : "";
        bubble2 = isKo
          ? `그리고 오늘 ${totalInfo} 전체적으로 집중력 좋게 해냈어요! 세트마다 꾸준하게 하는 거 다 봤어요! 그게 진짜 실력이에요!`
          : `And you stayed focused through ${totalInfo} today! I saw you stay consistent every set! That's real skill!`;
      }

      // 3번째 버블: 컨디션 + 내일 조언
      const bubble3Options = isKo ? [
        `오늘 ${conditionLabel ? conditionLabel + "인 날이었는데 " : ""}${desc ? desc.split("·")[0].trim() + "으로 꽉 채워서 " : ""}내일 좀 뻐근할 수 있으니 가볍게 스트레칭 해주세요!`,
        `${conditionLabel ? conditionLabel + " 컨디션에서 " : ""}끝까지 잘 해냈으니 오늘은 푹 쉬고, 내일 가볍게 걸어주세요!`,
        `오늘 운동 자극 확실히 갔을 거예요! 충분히 쉬고 내일 가볍게 유산소 해주시면 딱이에요!`,
      ] : [
        `${conditionLabel ? "Even with " + conditionLabel + ", " : ""}you got a solid session in! Rest up and do some light stretching tomorrow!`,
        `Great work today! Get some good rest and a light walk tomorrow will help recovery!`,
        `Your muscles got a solid stimulus today! Rest well and some light cardio tomorrow would be perfect!`,
      ];

      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      return [pick(bubble1Options), bubble2, pick(bubble3Options)];
    }

    // ── Gemini 호출 (5초 타임아웃) ──
    try {
      const ai = getGemini();

      // 회의 25: locale별 로그 요약 라벨 분기
      const feedbackLabel = (f: string) =>
        isKo
          ? (f === "fail" ? "실패" : f === "easy" ? "쉬움" : f === "too_easy" ? "너무쉬움" : "적정")
          : (f === "fail" ? "fail" : f === "easy" ? "easy" : f === "too_easy" ? "too easy" : "on target");

      const logSummary = sessionLogs?.map(ex => {
        const sets = ex.sets.map(s =>
          isKo
            ? `${s.setNumber}세트: ${s.reps}회${s.weight ? ` ${s.weight}kg` : ""} → ${feedbackLabel(s.feedback)}`
            : `Set ${s.setNumber}: ${s.reps} reps${s.weight ? ` @ ${s.weight}kg` : ""} → ${feedbackLabel(s.feedback)}`
        ).join(", ");
        return `${ex.exerciseName}: [${sets}]`;
      }).join("\n") || (isKo ? "로그 없음" : "No logs");

      const conditionText = condition
        ? (isKo
            ? `컨디션: ${conditionLabel} / 에너지 ${condition.energyLevel}/5`
            : `Condition: ${conditionLabel} / Energy ${condition.energyLevel}/5`)
        : "";

      // 현재 계절/시간 컨텍스트
      const now = new Date();
      const month = now.getMonth() + 1;
      const hour = now.getHours();
      const seasonKo = month >= 3 && month <= 5 ? "봄" : month >= 6 && month <= 8 ? "여름" : month >= 9 && month <= 11 ? "가을" : "겨울";
      const seasonEn = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "fall" : "winter";
      const timeOfDay = hour < 6 ? "새벽" : hour < 12 ? "아침" : hour < 18 ? "오후" : "저녁";

      // 날씨 정보 (API 키 있으면 실제 데이터, 없으면 계절 기반)
      let weatherContext = "";
      try {
        const weatherKey = process.env.KMA_API_KEY;
        if (weatherKey) {
          // 기상청 초단기실황 API 호출 (서울 기준 nx=60, ny=127)
          const baseDate = `${now.getFullYear()}${String(month).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
          const baseTime = `${String(Math.max(0, hour - 1)).padStart(2, "0")}00`;
          const weatherUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${weatherKey}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=60&ny=127`;
          const wRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(3000) });
          if (wRes.ok) {
            const wData = await wRes.json();
            const items = wData?.response?.body?.items?.item || [];
            const temp = items.find((i: { category: string }) => i.category === "T1H")?.obsrValue;
            const rain = items.find((i: { category: string }) => i.category === "PTY")?.obsrValue;
            const rainType = rain === "1" ? "비" : rain === "2" ? "비/눈" : rain === "3" ? "눈" : null;
            weatherContext = `\n- 현재 날씨: ${temp ? temp + "°C" : "정보없음"}${rainType ? `, ${rainType} 내리는 중` : ", 맑음"}`;
          }
        }
      } catch { /* 날씨 API 실패 시 무시 */ }

      // 날씨 없으면 계절 기반 컨텍스트
      if (!weatherContext) {
        const seasonTips: Record<string, string> = {
          봄: "요즘 날씨 풀려서 야외 운동하기 좋은 계절",
          여름: "요즘 더운데 수분 보충이 중요한 계절",
          가을: "선선해져서 운동하기 딱 좋은 계절",
          겨울: "추운 날씨에 워밍업이 더 중요한 계절",
        };
        weatherContext = `\n- 계절: ${seasonKo} (${seasonTips[seasonKo]})`;
      }

      // 회의 25: EN 전용 프롬프트 — 한글 지배적 프롬프트 + 한 줄 영어 override로는
      // Gemini가 한글 응답을 내보내는 문제 해결을 위해 전체 프롬프트 분기
      const promptEn = `You are the AI coach for "ohunjal AI", a workout app. The user just finished a workout. You're texting them like a close personal trainer would — casual, warm, and genuinely excited about their effort. Talk like a friend who was right there training alongside them.

## Tone
- Casual-polite, lots of exclamation marks!
- Natural conversational fillers: "haha", "wow", "seriously", "so good!"
- Like a trainer DMing a client, not a formal coach
- Feel free to reference seasonal vibes or everyday moments naturally

## Hard rules (do NOT break)
- NO emojis (🔥💪 etc.) — use plain text exclamation instead
- NO medical/sports-science jargon ("lactate threshold", "muscle fibers" etc.)
- NO formal phrases ("You did a great job, sir.")
- NO overly-casual slang or rudeness
- NO repeating the same exercise name across all 3 messages (use different ones)
- NO negative feedback ("that was weak", "disappointing")
- NO pushing/forcing ("go heavier tomorrow!", "don't rest")
- NO comments on weight/appearance
- NO comparisons to other people
- NO fabricated weather/facts without data
- Max 3 sentences per bubble (~60 words)
- NO repetitive closing patterns
- NO direct questions expecting an answer (rhetorical is fine)
- NO number-dump reports ("total volume 12,340kg, 18 sets")

## Message structure (exactly 3 bubbles, natural flowing conversation)
1st: Emotional empathy about today's workout. Mention a specific exercise, feel like a training buddy who was there!
2nd: The most interesting thing from the session data — failure/recovery, weight progression, technique note, growth observation, etc. Different exercise/angle from bubble 1.
3rd: A trainer's closing line. Tomorrow advice, season/weather tie-in, motivation, or building anticipation for the next session. Make them feel "I want to come back tomorrow!"

## Good examples (this tone and variety!)
Example 1:
  "Watching you push through that Barbell Row at 40kg — I was literally holding my breath!"
  "And that recovery on set 4 after failing set 3? That right there is real growth!"
  "Weather's getting nice — maybe a light outdoor jog tomorrow? Your call!"

Example 2:
  "The focus on your Dumbbell Shoulder Press today was unreal! I saw every rep!"
  "How did it feel? Tough but satisfying right? That feeling is the real reward, honestly!"
  "Keep this pace up and you'll smash this month's goal — I'm in your corner all the way!"

Example 3:
  "Hitting 60kg on Squat today was the moment! Building this plan paid off!"
  "Next time try counting 3 seconds on the way down — your muscles will light up differently!"
  "Great work today! Don't forget — eating well and sleeping deep is also part of the training!"

Example 4:
  "I've been tracking your Cable Face Pulls — they're climbing steadily!"
  "Your strength is noticeably better than when we started! Glad we're doing this together — makes me proud!"
  "Next up, maybe the king of lifts — Deadlift? I'll be here waiting tomorrow haha!"

Example 5:
  "You built a stronger body today — real resilience is what matters!"
  "Wow, every set hit the perfect intensity! I'm making a note to replicate this next time!"
  "Days like this deserve something tasty — you've earned it! Rest up well tonight!"

## Session data
- Hero type: ${heroType}${exerciseName ? `\n- Main exercise: ${mainExName}` : ""}${vars ? `\n- PR data: ${JSON.stringify(vars)}` : ""}
- ${conditionText}
- Session summary: ${sessionDesc || "no info"}${streak && streak >= 2 ? `\n- ${streak}-day streak` : ""}
- Time of day: ${hour < 6 ? "early morning" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}${weatherContext.replace(/계절: \S+ \((.+)\)/, (_, tip) => `Season: ${seasonEn} (${tip})`).replace(/현재 날씨:/, "Current weather:").replace(/정보없음/, "unknown").replace(/맑음/, "clear").replace(/비 내리는 중/, "raining").replace(/비\/눈 내리는 중/, "rain/snow").replace(/눈 내리는 중/, "snowing")}
- Session logs:
${logSummary}

Respond ONLY in this JSON format, in ENGLISH:
{"messages":["1st message","2nd message","3rd message"]}`;

      const prompt = isKo ? `당신은 "오운잘"이라는 운동 앱의 AI 코치입니다. 방금 운동을 끝낸 유저에게 친한 트레이너가 카톡하듯 피드백합니다. 매번 옆에서 같이 운동한 동료처럼, 진심을 담아 자연스럽게 대화하세요.

## 톤
- 편한 존댓말 (해요체), 느낌표 자주!
- "ㅎㅎ", "ㅠㅠ", "완전 굿!", "진짜", "캬!" 같은 구어체/한글 이모티콘 자연스럽게 섞기
- 트레이너가 회원한테 카톡 보내는 느낌으로
- 한국에서 최근 유행하는 디저트, 음식, 문화 트렌드를 자연스럽게 언급해도 좋아요 (잘 모르겠으면 무난하게)

## 절대 하지 마 (울타리)
- 이모지 사용 금지 (💪🔥 등. 단 한글 이모티콘 ㅎㅎ ㅠㅠ 는 OK)
- 영어 단어 금지 (운동명 포함 전부 한글)
- "화이팅" 금지 (진부함)
- 의학/운동과학 용어 금지 ("근섬유", "젖산 역치" 등)
- 격식체 금지 ("하셨습니다", "수고하셨습니다")
- 반말 금지 ("잘했어", "대박이야")
- 같은 운동명 2회 이상 반복 금지 (3개 메시지 통틀어)
- 부정적 피드백 금지 ("못했네요", "아쉬웠어요")
- 강요/무리 유도 금지 ("내일 더 무겁게!", "쉬지 말고")
- 체중/외모 직접 언급 금지
- 다른 사람과 비교 금지
- 데이터 없이 거짓 날씨/사실 언급 금지
- 3줄 넘는 긴 버블 금지 (2~3문장, 60자 내외)
- 매번 같은 마무리 패턴 반복 금지
- 답을 기대하는 직접 질문 금지 (수사적 질문은 OK)
- 숫자 나열 금지 ("총 볼륨 12,340kg, 18세트" 같은 리포트형)

## 메시지 구조 (반드시 3개, 자연스럽게 이어지는 대화)
1번째: 오늘 운동에 대한 감정 공감. 운동명 구체적으로 언급하면서 같이 한 동료처럼!
2번째: 세션 데이터를 보고 가장 인상적이었던 포인트를 자유롭게. 실패/성공, 무게변화, 운동 팁, 성장 관찰, 개운함 유도 등 뭐든 좋아요. 1번째와 다른 운동/포인트로!
3번째: 트레이너가 마지막으로 하는 한마디. 내일 조언, 계절/날씨 연결, 동기부여, 일상 연결, 다음 운동 기대감 등 자유롭게. 유저가 '내일도 와야지' 느끼게!

## 좋은 예시 (이런 톤과 다양성으로!)
예시1:
  "바벨 로우 40kg 올릴 때 진짜 득근득근... 심장 떨렷슴다!ㅠㅠ"
  "아! 그리고 (운동명)3세트에서 실패했지만 4세트 다시 잡은 거 완전 굿!ㅎㅎ"
  "요즘 날씨 좋으니 내일은 가볍게 밖에서 뛰어보는 것도 좋아요!"

예시2:
  "덤벨 숄더프레스 집중하는 거 옆에서 다 봤어요! 대단해요!"
  "오늘 운동은 나니까 어땟나요?? 그래도 하고 나니 좋았죠? 그 느낌이 진짜 보상이에요ㅎㅎ"
  "이 페이스면 쭈욱 가면 이번 달 목표 완전 충분! 저 믿고 함께 가시죠!"

예시3:
  "스쿼트 60kg 완료했다는 순간 감격했슴다! 플랜짠 보람이 ㅠㅠ"
  "다음엔 3초 세면서 천천히 앉아보세요! 근육이 팽팽해지는게 쫙 붙습니다잉!"
  "오늘 하루 고생하셨어요! 잘먹고 푹 자는 것까지 운동이란점 잊지마세요!"

예시4:
  "케이블 페이스 풀 변화 추이를 보니! 점점 늘고있네요!"
  "확실히 처음보다 운동 능력치가 올랐어요! 저와 함께해서 더 그런것 같아 뿌듯!"
  "다음엔 3대 운동의 꽃 데드리프트 어떤가요? 내일도 기다리고 있겠슴다!ㅎㅎ"

예시5:
  "오늘도 처지지 않는(성별따라)멋진 or 예쁜 몸 만들었다! 탄력이 생명이죠!"
  "캬! 전 세트 딱 맞는 강도로 끝낸 거 아주 나이스! 다음에도 이렇게 하도록 제가 잘 기억해놓을게요!"
  "오늘 같은 날은 맛있는 거(최근 유행하는 음식 : 두쫀쿠, 버터떡, 봄동비빔밥 등등) 하나 먹어도 돼요! 충분히 자격 있어요ㅎㅎ"

## 세션 데이터
- 히어로 타입: ${heroType}${exerciseName ? `\n- 주요 운동: ${mainExName}` : ""}${vars ? `\n- PR 데이터: ${JSON.stringify(vars)}` : ""}
- ${conditionText}
- 운동 요약: ${sessionDesc || "정보 없음"}${streak && streak >= 2 ? `\n- 연속 ${streak}일째` : ""}
- 운동 시간대: ${timeOfDay}${weatherContext}
- 세션 로그:
${logSummary}

반드시 아래 JSON 형식으로만 응답하세요:
{"messages":["1번째 메시지","2번째 메시지","3번째 메시지"]}` : promptEn;

      // 5초 타임아웃
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.9,
        },
      });

      clearTimeout(timeout);
      const text = response.text || "";
      let messages: string[];

      try {
        const parsed = JSON.parse(text);
        messages = parsed.messages;
        if (!Array.isArray(messages) || messages.length < 1) throw new Error("Invalid format");
      } catch {
        messages = buildFallbackMessages();
      }

      res.status(200).json({
        result: { messages },
        model: "gemini-2.5-flash",
      });
    } catch (error) {
      console.error("getCoachMessage error (fallback used):", error);
      res.status(200).json({
        result: { messages: buildFallbackMessages() },
        model: "fallback",
      });
    }
  }
);
