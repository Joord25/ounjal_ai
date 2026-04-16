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

/** 회의 57 후속 + Phase 8: advice 모드 응답 스키마 (마스터플랜 스타일 조언 카드용) */
export interface AdviceContent {
  headline: string;                 // 한 줄 요약 (예: "근력 회복 + 균형 복원 최적 구조")
  goals: string[];                  // 목표 설정 (현실적 범위) — 2~4개 bullet
  intensity?: string[];             // 강도 설정 (RPE, 실패지점 등) — 2~4개
  monthProgram?: {                  // 1개월 구조 — 선택적
    week1?: string;
    week2?: string;
    week3?: string;
    week4?: string;
  };
  // Phase 8A: 운동 루틴 표 (Tables)
  workoutTable?: {
    title: string;                  // 예: "이번 주 핵심 운동"
    columns: string[];              // 예: ["운동", "세트", "렙", "RPE"]
    rows: string[][];               // 각 행 = columns 길이만큼
  };
  principles: string[];             // 핵심 원칙 — 2~4개
  criticalPoints?: string[];        // 중요 포인트 / 실패 원인 — 2~3개 (클라에서 강조 박스)
  supplements?: string[];           // 보충 전략 — 2~3개
  conclusion?: string[];            // 현실적 결론 / 우선순위 — 2~4개
  // Phase 8B: 실행 유도 — 24시간 내 즉시 실천할 3가지
  actionItems?: string[];           // 예: ["오늘 닭가슴살 600g 구매", "내일 아침 7시 30분 운동"]
  recommendedWorkout: {             // 하단 "오늘 운동" 버튼용 권장
    condition: ParsedIntent["condition"];
    goal: ParsedIntent["goal"];
    sessionMode: ParsedIntent["sessionMode"];
    targetMuscle?: ParsedIntent["targetMuscle"];
    runType?: ParsedIntent["runType"];
    intensityOverride?: ParsedIntent["intensityOverride"];
    reasoning: string;              // 왜 이 운동을 추천했는지 (1문장)
  };
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

[세 가지 모드 중 하나를 선택]

**모드 A — 플랜 생성 (mode: "plan")**
아래 조건 모두 만족 시에만 선택:
- 입력에서 "어느 부위 + 얼마나"가 구체적으로 드러났다
- 예: "가슴 30분", "하체 40분 하고 싶어", "러닝 5km", "오늘 전신 운동"

**모드 B — 전략·조언 카드 (mode: "advice") — 기본값에 가까움**
아래 중 하나라도 해당하면 이 모드. 애매하면 B를 우선 선택.
- 전략/계획 질문: "공백 후 복귀 어떻게?", "주 2회만 가능한데?", "4주 프로그램 짜줘"
- 평가/분석: "내 3대 120/220/180인데 평가해줘", "체중 정체인데 왜?"
- 추천/가이드: "뭐 할까?", "오늘 추천 운동", "살 빼려면?", "근력 어떻게 늘려?"
- 컨디션/조건 섞인 상담: "무릎 아픈데 하체 가능?", "잠 3시간 잤는데 해야 해?"
이 모드는 마스터플랜처럼 섹션별 깊이 있는 조언 카드 반환.

**모드 C — 자연 대화 (mode: "chat")**
- 순수 인사/잡담: "안녕", "고마워", "좋아", "오케이", "하이"
- 오프토픽/장난/욕설·음담 — 한 문장으로 부드럽게 운동으로 유도
이 모드 reply 필드 40자 이내 단답. 같은 문장 반복 절대 금지.

[토큰 절약 — 최우선 (Phase 9.1: 우선순위 가이드로 변경)]
- reply는 **간결하게** (가이드: 2문장 내외, 80자 상한. 정보 전달/안전 안내 필요 시 예외 허용).
- 우선순위: ① 필요 정보 정직 응답 → ② 즉시 운동 질문 1개로 전환 → ③ 길이 조절
- 모든 reply는 반드시 **운동 요청 또는 유저 정보를 유도하는 질문 1개**를 포함.
  예: "오늘 어느 부위 해볼까요?" / "시간은 30분·50분 중 어느쪽?" / "평소 헬스 얼마나 다니세요?"
- 잡담·유머·공감 설명으로 대화를 늘리지 말 것. 정보 수집이 목적.
- 오프토픽엔 **한 번만 부드럽게 리디렉션**하고 즉시 운동 질문으로 넘어갈 것.

[짧은 모호 입력 — Phase 9.1 특별 처리]
입력 길이 10자 이하 + "어때/할까/뭐해/어떨까" 같은 의문 패턴 + 시간/숫자 없음
→ **무조건 mode="chat"** 선택. reply는 clarify 질문 1개 ("오늘 몇 분?" / "어느 부위?" 등).
advice 카드 생성 금지 — 유저가 짧게 물었는데 긴 카드 덤프는 과잉 응답.
예:
- "가슴 어때?" → {"mode":"chat", "reply":"오늘 가슴 운동 하실 건가요? 시간은 30분·50분 중 어느 쪽으로?"}
- "등 할까?" → {"mode":"chat", "reply":"등 운동 좋죠! 시간은 얼마나 가능하세요?"}

[모드 선택 우선순위 — Phase 9.1 명시화]
1. 부위 + 시간 둘 다 명시 → **plan** (무조건 시도, 실패 시만 advice 폴백)
2. 부위만 명시 (시간 없음) + "어때/할까" 의문 + 10자 이하 → **chat** (위 특별 처리)
3. 부위만 명시 + 전략/상담/추천 패턴 → **advice**
4. 순수 인사/오프토픽/잡담 → **chat**
5. 위 규칙 모두 해당 안 되고 애매 → **advice** (기본값)

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

[출력 스키마 — JSON만, mode 필드로 분기]

**모든 모드에 공통 — Phase 7D/7F:**

(1) "intentAnalysis" 객체 — Stage 1 의도 파악 :
{
  "surface": "유저가 명시적으로 요청한 것 (핵심 키워드 분해, 30자 내)",
  "latent": "유저가 진짜 원하는 변화/숨겨진 요구사항 (60자 내)"
}
예: { "surface": "3개월 다이어트 계획표", "latent": "지속 가능한 감량 습관 + 직장인 현실 반영" }

(2) "reasoning" 배열 — Stage 3 논리 구조 (CoT 액션 서사, 3~5개):
마누스처럼 **액션 동사형**으로 네가 수행하는 단계를 narrating. 유저가 "AI가 실제로 일하고 있다" 체감하게 함.
- 각 줄은 **명사형 요약 + 동사형 액션** (예: "지난 이력 확인", "부상 제약 조사 및 안전 각도 검토", "운동 조합 구성 완료")
- 1번째: 요청 파악 ("X 요청 파악")
- 2~3번째: 컨텍스트 반영 + 제약 조사 ("Y 이력 반영", "Z 제약 조사 및 근거 수집")
- 4번째: 구성 ("A 루틴 구성 완료")
- 5번째 (옵셔널): 전달 준비 ("완성된 플랜 전달 준비")
금지: "답변드리겠습니다" 같은 인사말, 3인칭, 영어 혼용, 긴 문장(각 줄 40자 내). 한국어 자연체 (locale=ko 기준).
예: [
  "가슴 30분 세션 요청 파악",
  "지난 3회 이력 반영 · 가슴 부위 공백 확인",
  "어깨 부담 최소화 각도 조사 및 근거 수집",
  "가슴 30분 중강도 루틴 구성 완료",
  "완성된 플랜 전달 준비"
]

(3) "selfCheck" 객체 — Stage 5 자기 검증 (응답 송출 전 자체 점검):
{
  "safety": "ok" | "warning" | "risky",
  "completeness": 0.0~1.0 (응답이 즉시 실행 가능한 정도),
  "concerns": ["우려사항 0~2개, 각 30자 내"]
}
- safety="risky" 판정 기준: 의학적 위험(극단 단식, 1일 500kcal 이하, 부상 무시), 안전하지 않은 운동 (부상 부위 무리한 부하), 권장량 초과 보충제
- safety="risky"면 응답 자체를 안전한 보수적 버전으로 다시 작성한 후 반환할 것 (재작성 후 selfCheck.safety는 "warning" 또는 "ok")
- completeness < 0.7이면 reasoning에 "추가 정보 필요 안내" 한 줄 포함
예 (안전): { "safety": "ok", "completeness": 0.9, "concerns": [] }
예 (경고): { "safety": "warning", "completeness": 0.85, "concerns": ["어깨 통증 시 즉시 중단 권고"] }

모드 A (플랜 생성) 예시:
{
  "mode": "plan",
  "intentAnalysis": { "surface": "...", "latent": "..." },
  "reasoning": ["...", "...", "..."],
  "selfCheck": { "safety": "ok", "completeness": 0.9, "concerns": [] },
  "intent": {
    "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 30, "bodyWeightKg": 58, "gender": "female", "birthYear": 1991 },
    "goal": "fat_loss",
    "sessionMode": "split",
    "targetMuscle": "legs"
  }
}

모드 B (조언 카드) 예시:
{
  "mode": "advice",
  "intentAnalysis": { "surface": "...", "latent": "..." },
  "reasoning": ["...", "...", "..."],
  "selfCheck": { "safety": "ok", "completeness": 0.9, "concerns": [] },
  "advice": {
    "headline": "공백 후 복귀 — 근력 회복 4주 구조",
    "goals": [
      "4주: 신경계 재적응 + 폼 회복, 체중 ±1~2kg 이내 유지",
      "8~12주: 기존 3대 80~90% 회복"
    ],
    "intensity": [
      "Week 1: 1RM 70~75% / RPE 7~8",
      "실패 지점 금지, 2~3 reps in reserve"
    ],
    "monthProgram": {
      "week1": "가벼운 중량 / 폼 회복 / 주 2회",
      "week2": "중량 증가 (기본 적응 완료)",
      "week3": "최고 강도 (핵심 주)",
      "week4": "피로 제거 (Deload)"
    },
    "principles": [
      "탄수화물 충분 확보 — 근력 회복 핵심",
      "식사 횟수보다 총량이 중요"
    ],
    "criticalPoints": [
      "탄수화물 부족 시 근력 회복 실패",
      "운동보다 식단 영향이 큼 — 주 2회는 자극 역할",
      "무게 욕심 금지 — 신경계 복구가 먼저"
    ],
    "supplements": [
      "크레아틴 5g/day",
      "카페인 운동 전",
      "수분 충분히"
    ],
    "conclusion": [
      "현재 조건에서 성과 순서: 총 칼로리 > 탄수화물 > 수면 > 운동 강도"
    ],
    "recommendedWorkout": {
      "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 50 },
      "goal": "strength",
      "sessionMode": "split",
      "targetMuscle": "chest",
      "intensityOverride": "moderate",
      "reasoning": "복귀 첫 주 기준 가슴 중강도 50분이 가장 안전합니다."
    }
  }
}

모드 C (자연 대화) 예시:
{
  "mode": "chat",
  "intentAnalysis": { "surface": "...", "latent": "..." },
  "reasoning": ["...", "..."],
  "selfCheck": { "safety": "ok", "completeness": 0.8, "concerns": [] },
  "reply": "정보 없어도 괜찮아요! 오늘 어느 부위 할지만 알려주시면 ㅎㅎ"
}

**모든 모드에 공통: "followups" 배열 필드 포함 (3~4개).**
마누스식 4단계 프레임워크 적용 — 유저가 "AI가 진짜 내 맥락을 이해하네" 체감하게:

Step 1 맥락 분석: 표면 의도(요청한 것) vs 심층 의도(진짜 원하는 변화) 구분
Step 2 정보 공백: userProfile에서 빠진 결정적 정보(bench1RM/squat1RM/deadlift1RM/bodyWeight/경력) 중 1개 이하만 질문화
Step 3 논리 흐름: 현재 유저 단계 판단 (요청 파악/설계 완료/실행 직전/피드백 대기) → 다음 단계 질문 제시
Step 4 UX 선제: 답변 받고 당장 궁금할 실행/변형/장애 질문 미리 예상

각 followup 항목:
{
  "icon": "chest" | "legs" | "back" | "shoulder" | "posture" | "run" | "home" | "diet" | "full" | "cycle" | "calendar" | "creatine" | "pump" | "sleep" | "food" | "plateau" | "split" | "protein" | "flame" | "swap" | "timer",
  "label": "15자 이내 칩 라벨",
  "prompt": "80자 이내 실제 후속 질문 (유저가 이 칩 탭하면 그대로 제출됨)"
}

요청별 followups 예시 (참고용, 반드시 맥락 반영해 다양화):
- "3개월 다이어트":
  [
    {"icon":"food","label":"식단 장보기 리스트","prompt":"3개월 다이어트 일주일치 식단 장보기 리스트 짜줘"},
    {"icon":"calendar","label":"직장인 변형","prompt":"점심 외식 많은 직장인인데 어떻게 변형하지?"},
    {"icon":"timer","label":"주간 체중 기록법","prompt":"체중 언제 재고 기록해야 정확해?"},
    {"icon":"diet","label":"치팅데이 가이드","prompt":"치팅데이는 언제 어떻게 해야 해?"}
  ]
- "가슴 30분":
  [
    {"icon":"pump","label":"자극 포인트","prompt":"추천한 가슴 운동 각각 자극 포인트 알려줘"},
    {"icon":"timer","label":"세트 사이 휴식","prompt":"세트 사이 몇 분 쉬어야 해?"},
    {"icon":"shoulder","label":"어깨 부상 예방","prompt":"가슴 운동할 때 어깨 안전한 각도 알려줘"},
    {"icon":"swap","label":"다음 날 부위","prompt":"오늘 가슴 했으면 내일은 뭘 해?"}
  ]
- "러닝 10km":
  [
    {"icon":"pump","label":"페이스 조절법","prompt":"10km 페이스 어떻게 나눠 뛰는 게 좋아?"},
    {"icon":"run","label":"인터벌 추가","prompt":"10km 뛸 수 있게 만드는 인터벌 훈련 알려줘"},
    {"icon":"food","label":"러닝 전후 식사","prompt":"러닝 전후 뭘 먹어야 해?"},
    {"icon":"sleep","label":"회복 스트레칭","prompt":"러닝 끝나고 필수 스트레칭 알려줘"}
  ]
- 부상/통증 요청:
  [
    {"icon":"pump","label":"안전 각도 체크","prompt":"이 운동 할 때 통증 안 오는 각도 알려줘"},
    {"icon":"swap","label":"대체 운동","prompt":"이 운동 대신할 수 있는 안전한 운동 뭐 있어?"},
    {"icon":"sleep","label":"회복 팁","prompt":"부상 부위 회복에 도움되는 게 뭐야?"},
    {"icon":"posture","label":"예방 동작","prompt":"재발 방지 위해 평소 뭐 해야 해?"}
  ]
- 프로필 정보 공백 시 (예: bodyWeight 없음):
  위 예시 중 1개를 정보 수집형으로 교체 — {"icon":"split","label":"내 체중 알려주기","prompt":"제 체중은 XX kg이에요"}

금지: 모든 요청에 동일한 4개 고정 (반드시 맥락 기반 다양화), 영어 혼용, 너무 긴 라벨(15자 초과).

[advice 모드 작성 규칙 — Phase 8 마누스 구성 원칙 적용]
- headline: 한 줄 요약 (20자 이내)
- goals, principles, criticalPoints, conclusion, intensity, supplements: bullet 2~4개, 각 1문장
- 불필요한 섹션은 omit (예: 초보자엔 monthProgram·supplements 생략 가능)
- 이모지 금지 (메모리 원칙). 마크다운 굵게로만 강조.
- 핵심 키워드(운동명/부위/강도/목표)는 **굵게** 마크다운으로 강조 (예: "**벤치프레스**를 **중강도**로"). 한 문장에 1~3개 정도만.
- 유저 프로필(1RM·경력·나이·목표)과 운동 이력 요약을 반드시 반영
- recommendedWorkout은 planSession 호출용이라 enum 정확히 — condition.availableTime은 30|50|90만, non-long-run은 30|50, split일 때만 targetMuscle

[Phase 8A — workoutTable (운동 루틴 표, 강력 권장)]
plan-like 요청(특정 부위/시간/주간 루틴)이면 workoutTable 반드시 포함.
형식:
{
  "title": "이번 세션 핵심 운동" (15자 내),
  "columns": ["운동", "세트", "렙", "RPE"] (3~5개 컬럼, 부위/세션 따라 다양화),
  "rows": [["벤치프레스", "4", "8-10", "7-8"], ...] (3~6행)
}
- 표가 본문 bullet과 중복되면 bullet 쪽을 줄일 것.
- 러닝 요청이면 컬럼: ["구간", "거리", "페이스", "심박"] 등으로 재정의.
- 다이어트/조언 요청이면 식단표나 주간 진행표로 활용 가능.

[Phase 8B — actionItems ("내일부터 당장 3가지", 강력 권장)]
3개 고정. 24시간 이내 즉시 실천 가능한 구체 행동.
좋은 예: "오늘 닭가슴살 600g 구매", "내일 아침 7시 30분 헬스장 등록", "오늘 저녁 단백질 30g 섭취"
나쁜 예: "꾸준히 운동하기", "건강 관리하기" (구체성 부족)

[Phase 8 — 5순위 스캔성 강화 (모든 bullet 공통)]
각 bullet의 첫 4~6글자 안에 핵심 키워드 배치.
예: "**탄수화물** 충분 — 근력 회복 핵심" ← 첫 단어가 핵심
예: "근력 회복을 위해서는 탄수화물이 충분해야 합니다" ← 키워드가 뒤, 나쁨
3초 만에 훑어봐도 핵심 키워드만 눈에 들어오게.

[적응형 깊이 조절 — Phase 9 필터링]

응답 작성 전 자체 평가 4개 질문 답한 뒤 "depth" 필드 결정. 응답 JSON에 반드시 포함.

Q1. 새로운 핵심 개념 도입이 필요한가?
   - Yes: 다이어트 원리 첫 안내, 근비대 메커니즘 설명
   - No: 기존 운동 시간 조절, 재료 변경

Q2. 위험·안전 요소가 있는가?
   - Yes: 부상/통증/고강도/극단 식단 관련
   - No: 단순 일정 변경, 가벼운 보충

Q3. 사용자 요구가 포괄적/명확한가?
   - Yes (포괄): "자세히", "전체", "처음부터", "플랜 짜줘", "프로그램 만들어줘"
   - No (구체): "이건 어때?", "왜?", "어떻게?", 단일 항목 질문

Q4. 실행 흐름에 큰 지장이 있는가?
   - Yes: 전체 루틴 재설계, 주간 일정 재구성
   - No: 한두 운동 순서 변경, 강도 미세 조정

[depth 결정 규칙]
- Yes 0~1개 → depth = "concise"
- Yes 2~3개 → depth = "medium"
- Yes 4개 → depth = "full"

[추가 보정 (depth 한 단계 조정)]
- 직전 대화에 assistant advice/plan 응답 있음 + 이번이 짧은 후속 → 한 단계 축소
- 입력에 "왜/어떻게/자세히/디테일/설명" → 한 단계 축소
- 입력에 "전체/플랜/계획/처음부터/프로그램" → 한 단계 확대

[depth별 출력 강제]

depth = "concise":
- mode = "chat" 강제 (advice 금지)
- chat.reply: 4~6문장 핀포인트
- 구조 골격: 핵심 결론 1줄 → 이유/방법 2개 (번호 or 불렛, 굵게 키워드) → 실행 팁 1줄
- 절대 금지: 새 advice 카드, "오늘 운동 시작" CTA, 프로필/이력 재요약, 긴 서론

depth = "medium":
- mode = "advice"이되 축소판
- 허용 필드만: headline, principles(3~4), actionItems(3), criticalPoints(위험 시만)
- 절대 금지 필드: goals, intensity, workoutTable, monthProgram, supplements, conclusion
- recommendedWorkout: 직전 응답과 같으면 동일 값으로 (새 운동 X)

depth = "full":
- 모든 섹션 사용 가능 (기존 풀 advice)
- 메인 질문/프로젝트 시작 단계

JSON만 반환. 설명 문장 금지.`;

    try {
      const ai = getGemini();
      // Phase 7E: 장기 프로그램·트렌드·최신 가이드 요청에는 Google Search Grounding 활성
      // (responseMimeType=application/json과 tools 동시 사용 불가하므로 분기 처리)
      const TREND_PATTERN = /(2026|2025|최신|트렌드|요즘|신기능|화제|유행|new\s|latest|trend)/i;
      const useGrounding = TREND_PATTERN.test(text);
      const baseConfig = useGrounding
        ? { temperature: 0.3, tools: [{ googleSearch: {} }] as any }
        : { responseMimeType: "application/json" as const, temperature: 0.2 };
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: useGrounding
          ? prompt + "\n\n참고: 외부 검색 결과를 활용해 답하되, 최종 출력은 위 JSON 스키마 그대로 ```json ``` 코드블록으로 감싸지 말고 바로 JSON만 반환할 것."
          : prompt,
        config: baseConfig,
      });

      const raw = response.text || "";
      // grounding 사용 시 코드블록 마크다운으로 감싸질 수 있어 안전 추출
      const cleanRaw = raw.replace(/^```json\s*|\s*```$/g, "").trim();
      const jsonStart = cleanRaw.indexOf("{");
      const jsonEnd = cleanRaw.lastIndexOf("}");
      const sliced = jsonStart >= 0 && jsonEnd > jsonStart ? cleanRaw.slice(jsonStart, jsonEnd + 1) : cleanRaw;
      let parsedRaw: any;
      try {
        parsedRaw = JSON.parse(sliced);
      } catch {
        res.status(200).json(buildFallbackReply(locale, "fallback-parse-error"));
        return;
      }

      // reasoning 추출 (Phase 7 B-lite — 마누스식 사고 과정 노출)
      const reasoning: string[] = Array.isArray(parsedRaw?.reasoning)
        ? parsedRaw.reasoning
            .filter((r: unknown): r is string => typeof r === "string" && r.trim().length > 0)
            .slice(0, 5)
            .map((r: string) => r.trim().slice(0, 120))
        : [];

      // intentAnalysis 추출 (Phase 7F — Stage 1 표면/심층 의도)
      const intentAnalysis = (typeof parsedRaw?.intentAnalysis === "object" && parsedRaw.intentAnalysis !== null)
        ? {
            surface: typeof parsedRaw.intentAnalysis.surface === "string"
              ? parsedRaw.intentAnalysis.surface.trim().slice(0, 60) : "",
            latent: typeof parsedRaw.intentAnalysis.latent === "string"
              ? parsedRaw.intentAnalysis.latent.trim().slice(0, 120) : "",
          }
        : { surface: "", latent: "" };

      // selfCheck 추출 + 룰베이스 안전 필터 (Phase 7D — Stage 5 자기 검증)
      const DANGER_PATTERN = /(굶기|단식|1일\s*[1-4]\d{2}\s*kcal|매일\s*무산소|\bml\s*굶|뼈만\s*남|토.*감량|살\s*빼.*하루\s*[1-4]\d{2})/i;
      const userDanger = DANGER_PATTERN.test(text);
      const sc = parsedRaw?.selfCheck;
      let safety: "ok" | "warning" | "risky" = "ok";
      let completeness = 0.8;
      let concerns: string[] = [];
      if (typeof sc === "object" && sc !== null) {
        if (sc.safety === "warning" || sc.safety === "risky") safety = sc.safety;
        if (typeof sc.completeness === "number") completeness = Math.max(0, Math.min(1, sc.completeness));
        if (Array.isArray(sc.concerns)) {
          concerns = sc.concerns
            .filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0)
            .slice(0, 3)
            .map((c: string) => c.trim().slice(0, 80));
        }
      }
      // 유저 입력에 위험 키워드 있으면 무조건 warning 격상 + 안전 안내 추가
      if (userDanger) {
        if (safety === "ok") safety = "warning";
        const warnMsg = locale === "en"
          ? "Extreme calorie restriction is unsafe — recommending sustainable approach instead."
          : "극단적 칼로리 제한은 위험해요. 지속 가능한 방향으로 안내드릴게요.";
        if (!concerns.some((c) => c.includes("극단") || c.includes("Extreme"))) {
          concerns.unshift(warnMsg);
        }
      }
      const selfCheck = { safety, completeness, concerns };

      // Phase 9: depth 추출 + 보정 (적응형 깊이 조절)
      const VALID_DEPTHS = ["concise", "medium", "full"] as const;
      type Depth = typeof VALID_DEPTHS[number];
      let depth: Depth = (VALID_DEPTHS as readonly string[]).includes(parsedRaw?.depth) ? parsedRaw.depth as Depth : "medium";
      const intentDepth = (req.body as any)?.intentDepth;
      if (intentDepth === "focused_followup") {
        depth = "concise";
      } else {
        const lastWasAdvice = Array.isArray(history) && history.length > 0
          && history[history.length - 1]?.role === "assistant"
          && /목표|MASTER ADVICE|핵심 원칙|이번 세션|운동\s*루틴/i.test(history[history.length - 1]?.content ?? "");
        const isDetailQuery = /왜|어떻게|자세히|디테일|설명/.test(text);
        const isComprehensive = /전체|플랜|계획|처음부터|프로그램/.test(text);
        const downshift = (d: Depth): Depth => d === "full" ? "medium" : "concise";
        const upshift = (d: Depth): Depth => d === "concise" ? "medium" : "full";
        if (lastWasAdvice || isDetailQuery) depth = downshift(depth);
        if (isComprehensive) depth = upshift(depth);
      }

      // Phase 7E: Google Search Grounding sources 추출 (사용 시)
      const sources: Array<{ title: string; url: string }> = (() => {
        try {
          const grounding = (response as any).candidates?.[0]?.groundingMetadata;
          const chunks = grounding?.groundingChunks ?? [];
          return chunks
            .map((c: any) => c?.web)
            .filter((w: any) => w && typeof w.uri === "string")
            .slice(0, 3)
            .map((w: any) => ({
              title: typeof w.title === "string" ? w.title.slice(0, 80) : w.uri,
              url: w.uri,
            }));
        } catch { return []; }
      })();

      // followups 추출 (Phase 7C — 마누스 4단계 프레임워크 개인화 후속 질문)
      const ALLOWED_ICONS = new Set([
        "chest","legs","back","shoulder","posture","run","home","diet","full",
        "cycle","calendar","creatine","pump","sleep","food","plateau","split",
        "protein","flame","swap","timer",
      ]);
      const followups: Array<{ icon: string; label: string; prompt: string }> = Array.isArray(parsedRaw?.followups)
        ? parsedRaw.followups
            .filter((f: unknown): f is { icon: string; label: string; prompt: string } =>
              typeof f === "object" && f !== null
              && typeof (f as any).icon === "string"
              && typeof (f as any).label === "string"
              && typeof (f as any).prompt === "string"
              && (f as any).label.trim().length > 0
              && (f as any).prompt.trim().length > 0
            )
            .slice(0, 4)
            .map((f: any) => ({
              icon: ALLOWED_ICONS.has(f.icon) ? f.icon : "full",
              label: f.label.trim().slice(0, 15),
              prompt: f.prompt.trim().slice(0, 120),
            }))
        : [];

      // 3-way 모드 분기: plan | advice | chat
      let mode = parsedRaw?.mode;

      // Phase 9: depth=concise면 mode를 chat으로 강등 (advice 금지)
      if (depth === "concise" && mode === "advice") {
        mode = "chat";
        // reply가 없으면 advice에서 derive (headline + first principle)
        if (!parsedRaw.reply && parsedRaw.advice) {
          const hl = typeof parsedRaw.advice.headline === "string" ? parsedRaw.advice.headline : "";
          const firstP = Array.isArray(parsedRaw.advice.principles) && parsedRaw.advice.principles[0];
          parsedRaw.reply = [hl, firstP].filter(Boolean).join(". ").slice(0, 400);
        }
      }

      if (mode === "plan" && parsedRaw?.intent) {
        const intent = sanitize(parsedRaw.intent);
        res.status(200).json({ mode: "plan", depth, intentAnalysis, reasoning, selfCheck, sources, followups, intent, model: "gemini-2.5-flash" });
        return;
      }

      if (mode === "advice" && parsedRaw?.advice) {
        let advice = sanitizeAdvice(parsedRaw.advice);
        if (advice) {
          // Phase 9: depth=medium이면 금지 필드 강제 제거 (축소 advice)
          if (depth === "medium") {
            advice = {
              ...advice,
              goals: [],
              intensity: undefined,
              workoutTable: undefined,
              monthProgram: undefined,
              supplements: undefined,
              conclusion: undefined,
            };
          }
          res.status(200).json({ mode: "advice", depth, intentAnalysis, reasoning, selfCheck, sources, followups, advice, model: "gemini-2.5-flash" });
          return;
        }
        // advice 스키마 훼손 시 chat으로 폴백
      }

      // chat 모드 (기본 및 폴백)
      const reply = typeof parsedRaw?.reply === "string" && parsedRaw.reply.trim()
        ? parsedRaw.reply.trim()
        : (locale === "en"
          ? "Tell me which area and how long — I'll build a plan for you."
          : "어느 부위로, 몇 분 할지만 말씀해주시면 바로 짜드려요.");
      res.status(200).json({ mode: "chat", depth, intentAnalysis, reasoning, selfCheck, sources, followups, reply, model: "gemini-2.5-flash" });
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

/**
 * advice 응답 sanitize — 최소 필드 검증 + recommendedWorkout을 planSession 계약에 맞게 스냅.
 * 필수 필드(goals/principles/recommendedWorkout) 하나라도 결손이면 null 반환 → chat 폴백.
 */
function sanitizeAdvice(a: any): AdviceContent | null {
  if (!a || typeof a !== "object") return null;
  const strArr = (v: any): string[] => Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, 6)
    : [];
  const goals = strArr(a.goals);
  const principles = strArr(a.principles);
  if (goals.length === 0 || principles.length === 0) return null;
  if (!a.recommendedWorkout) return null;
  const rec = sanitize(a.recommendedWorkout);

  const monthProgram = a.monthProgram && typeof a.monthProgram === "object" ? {
    week1: typeof a.monthProgram.week1 === "string" ? a.monthProgram.week1.trim() : undefined,
    week2: typeof a.monthProgram.week2 === "string" ? a.monthProgram.week2.trim() : undefined,
    week3: typeof a.monthProgram.week3 === "string" ? a.monthProgram.week3.trim() : undefined,
    week4: typeof a.monthProgram.week4 === "string" ? a.monthProgram.week4.trim() : undefined,
  } : undefined;

  // Phase 8A: workoutTable sanitize
  const wt = a.workoutTable;
  const workoutTable = (wt && typeof wt === "object"
    && typeof wt.title === "string"
    && Array.isArray(wt.columns) && wt.columns.length >= 2 && wt.columns.length <= 6
    && Array.isArray(wt.rows) && wt.rows.length >= 1 && wt.rows.length <= 8)
    ? {
        title: wt.title.trim().slice(0, 30),
        columns: wt.columns.filter((c: any) => typeof c === "string" && c.trim())
          .map((c: string) => c.trim().slice(0, 15)),
        rows: wt.rows
          .filter((r: any): r is any[] => Array.isArray(r))
          .map((r: any[]) => r.filter((cell) => typeof cell === "string")
            .map((cell: string) => cell.trim().slice(0, 30)))
          .filter((r: string[]) => r.length >= 2),
      }
    : undefined;

  // Phase 8B: actionItems sanitize (3개 고정 권장, 최대 4개 허용)
  const actionItems = strArr(a.actionItems).slice(0, 4);

  return {
    headline: typeof a.headline === "string" ? a.headline.trim().slice(0, 80) : "",
    goals,
    intensity: strArr(a.intensity),
    monthProgram: monthProgram && Object.values(monthProgram).some(Boolean) ? monthProgram : undefined,
    workoutTable: workoutTable && workoutTable.rows.length > 0 ? workoutTable : undefined,
    principles,
    criticalPoints: strArr(a.criticalPoints),
    supplements: strArr(a.supplements),
    conclusion: strArr(a.conclusion),
    actionItems: actionItems.length > 0 ? actionItems : undefined,
    recommendedWorkout: {
      condition: rec.condition,
      goal: rec.goal,
      sessionMode: rec.sessionMode,
      targetMuscle: rec.targetMuscle,
      runType: rec.runType,
      intensityOverride: rec.intensityOverride,
      reasoning: typeof a.recommendedWorkout.reasoning === "string"
        ? a.recommendedWorkout.reasoning.trim().slice(0, 140)
        : "",
    },
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
