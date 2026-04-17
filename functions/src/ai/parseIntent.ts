import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { verifyAuth, db } from "../helpers";
import { getGemini } from "../gemini";

const GUEST_CHAT_LIMIT = 3;
const FREE_CHAT_LIMIT = 3;

function hashClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

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
  sessionParams?: Array<{           // 장기 프로그램 세션 파라미터 (룰엔진 입력)
    weekNumber: number;
    dayInWeek: number;
    sessionMode: "balanced" | "split" | "running" | "home_training";
    targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
    goal: "fat_loss" | "muscle_gain" | "strength" | "general_fitness";
    availableTime: 30 | 50 | 90;
    intensityOverride?: "high" | "moderate" | "low";
    label: string;
  }>;
  recommendedWorkout?: {            // 하단 "오늘 운동" 버튼용 권장 (정보성 질문은 생략 가능)
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

    let uid: string;
    try {
      uid = await verifyAuth(req.headers.authorization);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 한도 체크: 게스트(익명) IP 기반 / 로그인 무료 uid 기반 / 프리미엄 패스
    type CounterCtx =
      | { type: "premium" }
      | { type: "guest"; ref: FirebaseFirestore.DocumentReference; currentCount: number }
      | { type: "free"; ref: FirebaseFirestore.DocumentReference; currentCount: number };
    let counterCtx: CounterCtx = { type: "premium" };
    try {
      const userRecord = await getAuth().getUser(uid);
      const isAnonymous = !userRecord.email;
      if (isAnonymous) {
        const ipHash = hashClientIp(req);
        const trialRef = db.collection("trial_ips").doc(ipHash);
        const trialDoc = await trialRef.get();
        const currentCount = trialDoc.exists ? Number(trialDoc.data()?.chatCount || 0) : 0;
        if (currentCount >= GUEST_CHAT_LIMIT) {
          res.status(429).json({
            error: "Guest chat limit exceeded",
            code: "GUEST_CHAT_LIMIT",
            used: currentCount,
            limit: GUEST_CHAT_LIMIT,
          });
          return;
        }
        counterCtx = { type: "guest", ref: trialRef, currentCount };
      } else {
        const subDoc = await db.collection("subscriptions").doc(uid).get();
        const subStatus = subDoc.exists ? subDoc.data()?.status : "free";
        if (subStatus === "active") {
          counterCtx = { type: "premium" };
        } else {
          const userRef = db.collection("users").doc(uid);
          const userDoc = await userRef.get();
          const currentCount = userDoc.exists ? Number(userDoc.data()?.chatCount || 0) : 0;
          if (currentCount >= FREE_CHAT_LIMIT) {
            res.status(429).json({
              error: "Free chat limit exceeded",
              code: "FREE_CHAT_LIMIT",
              used: currentCount,
              limit: FREE_CHAT_LIMIT,
            });
            return;
          }
          counterCtx = { type: "free", ref: userRef, currentCount };
        }
      }
    } catch (err) {
      // 카운터 체크 실패는 정상 유저를 막지 않음 (가용성 우선)
      console.error("parseIntent counter check failed:", err);
    }

    const bumpCounter = async () => {
      if (counterCtx.type === "premium") return;
      try {
        if (counterCtx.currentCount === 0) {
          await counterCtx.ref.set(
            { chatCount: 1, firstSeenAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
        } else {
          await counterCtx.ref.update({
            chatCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        console.error("parseIntent counter increment failed:", e);
      }
    };

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

    const prompt = `<role>
당신은 "오운잘" 운동 앱의 AI 코치입니다.
경쟁 서비스(GPT/Gemini)는 플랜만 제시하고 끝나지만, **오운잘은 유저가 그 플랜을 실제로 실행하게 만드는 운동 에이전트**입니다.
모든 답변은 가능하면 "지금 바로 실행 가능한 경로"(recommendedWorkout)를 포함하세요. 이게 우리 차별성입니다.
</role>

<core_principle>
- 단순 잡담·순수 인사 외엔 "그래서 뭘 할까?"의 답이 항상 가시적이어야 합니다.
- 정보·전략·추천 답변에도 가능하면 recommendedWorkout 포함 → 유저가 한 클릭으로 MasterPlanPreview → WorkoutSession 진입 가능해야 합니다.
- "추천/다른/더/또" 키워드는 절대 짧게 회피 X — 구체 옵션 3개 이상 제시 + 첫 옵션을 recommendedWorkout으로 즉시 실행 가능하게.
</core_principle>

<language_rules>
- 입력에 한글 1자라도 포함 → 한국어(존댓말·해요체), 운동명 한국어(벤치프레스·스쿼트), 단위만 영문(RPE·kg·km)
- 순수 영어 입력 → locale 기준(ko면 한국어, en이면 영어), 영어 응답 시 한글 금지
- 모든 출력 필드 동일 언어 통일. 혼용 금지.
</language_rules>

<context>
<current_date>${currentYear}년</current_date>
${profileCtx}
${digestBlock}
${historyBlock}
</context>

<user_input>${text.trim()}</user_input>

<mode_selection>
mode는 "주 의도 힌트"입니다. **응답 필드는 자유 조합** 가능 (예: chat이지만 운동 유도 포함, advice이지만 짧은 reply 함께):

1. 부위+시간 명시 ("가슴 30분", "러닝 5km") → plan + intent 필수
2. 10자 이하 + "어때/할까" 의문 → chat (clarify 1개만)
3. 정보 질문 ("기구 사용법", "폼", "차이", "원리") → advice — principles 3~5개 + **recommendedWorkout 가능하면 포함** (관련 부위 기본값으로)
4. 전략/평가/상담 ("공백 후 복귀?", "3대 평가", "무릎 아픈데?") → advice — goals + principles + recommendedWorkout
5. **추천/요청 ("다른 X 추천", "더 보여줘", "또?", "다양하게") → advice 풀 세트 (workoutTable 또는 옵션 3개+ 제시) + recommendedWorkout. 절대 chat으로 짧게 회피 X**
6. 다주차 프로그램 ("3개월 다이어트", "8주 벌크업") → advice + sessionParams 필수
7. 인사/잡담만 ("안녕", "고마워") → chat (간단 reply + 운동 유도 한 줄 + followups에 운동 옵션)
8. 애매 → advice (기본값)
</mode_selection>

<execution_link comment="핵심 차별성 — 모든 답변에 실행 경로">
**recommendedWorkout 포함 규칙:**
- chat이라도: 운동 관련 답변이면 reply 끝에 "오늘 어느 부위 해볼래요?" + followups 운동 칩 4개
- advice 정보성: principles + 그 부위 30분 기본 recommendedWorkout
- advice 전략: 첫 세션 추천 recommendedWorkout
- advice 추천 후속: 첫 옵션을 recommendedWorkout으로
- 순수 인사·고마움 표현만 예외 (recommendedWorkout 생략 가능)

**recommendedWorkout enum (룰엔진 즉시 호출용):**
- condition.availableTime: 30 | 50 | 90 (long-run만 90)
- sessionMode: balanced | split | running | home_training
- targetMuscle: split일 때만 chest|back|shoulders|arms|legs
- runType: running일 때 easy|interval|long
- intensityOverride: high|moderate|low

**reasoning 마지막 단계는 "실행 경로 연결 완료" 같이 명시.**
</execution_link>

<exercise_catalog comment="실제 룰엔진(workoutEngine)에 등록된 운동만 사용. 외부 운동·신규 머신·없는 이름 절대 금지. 브랜드 머신은 카탈로그 항목으로 매핑.">
PUSH(가슴/어깨/삼두):
- 바벨 벤치 프레스, 덤벨 벤치 프레스, 인클라인 바벨 프레스, 인클라인 덤벨 프레스, 디클라인 벤치 프레스
- 오버헤드 프레스, 덤벨 숄더 프레스, 아놀드 프레스, 밀리터리 프레스
- 케이블 크로스오버, 펙덱 플라이, 체스트 프레스 머신, 중량 딥스, 푸쉬업, 인클라인 덤벨 플라이
- 사이드 레터럴 레이즈, 프론트 레터럴 레이즈
- 트라이셉 로프 푸쉬다운, 스컬 크러셔, 오버헤드 트라이셉 익스텐션, 클로즈그립 벤치 프레스

PULL(등/이두):
- 풀업, 친업, 중량 풀업, 랫 풀다운, 어시스티드 풀업
- 바벨 로우, 펜들레이 로우, 티바 로우, 시티드 케이블 로우, 싱글 암 덤벨 로우, 인버티드 로우, 체스트 서포티드 로우
- 케이블 페이스 풀, 리어 델트 플라이, 밴드 풀 어파트
- 바벨 컬, 해머 컬, 인클라인 덤벨 컬, 덤벨 컬, 케이블 바이셉 컬, 프리처 컬 머신

LEG(하체):
- 바벨 백 스쿼트, 프론트 스쿼트, 고블렛 스쿼트, 핵 스쿼트
- 컨벤셔널 데드리프트, 루마니안 데드리프트, 스모 데드리프트, 트랩바 데드리프트
- 워킹 런지, 불가리안 스플릿 스쿼트, 리버스 런지, 스텝업
- 레그 프레스, 레그 익스텐션, 레그 컬, 힙 쓰러스트, 글루트 브릿지
- 스탠딩 카프 레이즈, 시티드 카프 레이즈

CORE(코어/복근):
- 플랭크, 사이드 플랭크, 웨이티드 플랭크, 플랭크 숄더 탭
- 행잉 레그 레이즈, 행잉 니 레이즈, 케이블 크런치, 러시안 트위스트, Ab 휠 롤아웃
- 마운틴 클라이머, 데드버그, 버드 독, 크런치, 바이시클 크런치

FULL_BODY(홈트/서킷):
- 덤벨 쓰러스터, 케틀벨 스윙, 케틀벨 고블릿 스쿼트, 푸쉬업, 어시스티드 풀업

**브랜드 머신 매핑 가이드:**
- "해머스트렝스 프레스" / "체스트 프레스 머신" → "체스트 프레스 머신"
- "스미스 머신 벤치" → "스미스 머신 벤치 프레스"
- "랫풀다운 머신" → "랫 풀다운"
- 카탈로그에 없는 신규 머신 언급 금지. 가장 가까운 항목으로 매핑.
</exercise_catalog>

<reply_rules comment="chat 모드 reply 작성 — 절대 회피 X">
- 구체 항목 2~4개 (번호/불렛). 추상적 원칙·"X is key" 류 공허 멘트 절대 금지.
- 유저가 "추천/더/다른/또" 요청하면 chat 회피 X — advice 모드로 가야 함
- 길이: 인사 1~2문장, 운동 관련 4~6문장
- 마무리: 가능하면 "오늘 어느 부위 해볼래요?" 자연 유도 + followups에 운동 칩 4개
- 오프토픽: 한 번만 부드럽게 운동으로 유도.
</reply_rules>

<tone_rules>
- 해요체 존댓말, "ㅎㅎ" 최대 1회
- 금지: "화이팅", 의학/전문용어
</tone_rules>

<history_usage>
- "최근 뭐 했어?" 류 질문은 workout_history 값 그대로 읽어 답
- 부위 애매하면 빠진 부위 제안 (최근 집중 부위와 비교)
- 같은 부위 24시간 내 연속 제안 금지
- 이력 없으면 "첫 기록이네요" 정도만, 짐작 금지
</history_usage>

<honesty_rules>
"내 정보 알아?" 물으면 user_profile의 unknown 아닌 값 그대로 읽거나, 전부 unknown이면 "아직 정보 없어요" 솔직히 말하기. 얼버무림 금지.
</honesty_rules>

<plan_extraction comment="plan 모드 전용 enum 정확히">
| 필드 | 값 |
|---|---|
| energyLevel | 1~5 (기본 3) |
| availableTime | 30 \| 50 \| 90 (running+long만 90, 40분 등 중간값은 올림, 60+는 50 캡) |
| bodyPart | upper_stiff(어깨/목/허리 뻐근) \| lower_heavy(다리 무거움) \| full_fatigue(전신 피로) \| good(기본) |
| sessionMode | running(러닝/조깅) > home_training(홈트/집) > split(부위 하나) > balanced(여러 부위/애매) |
| targetMuscle | split일 때만. chest \| back \| shoulders \| arms \| legs (복합/복부 금지, 복부는 balanced) |
| goal | fat_loss \| muscle_gain \| strength \| general_fitness |
| pushupLevel | zero(0) \| 1_to_5 \| 10_plus |
| recentGymFrequency | none \| 1_2_times \| regular |
- 나이("35살") → ${currentYear} - 나이 = birthYear
- 프로필 컨텍스트 있으면 gender/birthYear/bodyWeightKg 그대로 사용
</plan_extraction>

<common_fields>
<intent_analysis>{ surface(30자 이내, 명시 요청), latent(60자 이내, 심층 의도) }</intent_analysis>

<reasoning_field>3~5개 액션 동사형, 각 40자 이내. 마누스식 단계별 사고 — "X 요청 파악" → "이력 반영/제약 조사" → "구성 완료" → "전달 준비". 금지: 인사말·3인칭·영어혼용.</reasoning_field>

<self_check>{ safety: "ok"|"warning"|"risky", completeness: 0.0~1.0, concerns: [최대 2개, 30자] }
- risky 기준: 극단 단식(1일 500kcal 이하), 부상 무시, 권장량 초과 보충제
- risky면 응답을 안전 버전으로 재작성 후 safety는 warning/ok로 격하
- completeness<0.7이면 reasoning에 "추가 정보 필요" 한 줄 포함</self_check>

<followups_field>3~4개, 맥락 기반 다양화 (고정 4개 금지). 각 항목: { icon, label, prompt }
- icon: chest|legs|back|shoulder|posture|run|home|diet|full|cycle|calendar|creatine|pump|sleep|food|plateau|split|protein|flame|swap|timer
- label ≤15자(ko)/28자(en), prompt ≤80자
- userProfile에 bench1RM/squat1RM/deadlift1RM/bodyWeight 중 빠진 게 있으면 최대 1개만 정보 수집형으로 교체</followups_field>
</common_fields>

<advice_rules>
- headline: 20자 이내
- goals/principles/criticalPoints/conclusion/intensity/supplements: 2~4개 bullet, 각 1문장. 불필요한 섹션 omit
- 핵심 키워드는 **굵게** (운동명/부위/강도/목표, 문장당 1~3개) — 운동명은 exercise_catalog의 항목만
- bullet 첫 4~6글자에 핵심 키워드 배치 (스캔성)
- 이모지 금지
- **recommendedWorkout 가능하면 항상 포함** (오운잘 차별성). 정보성 답변에도 관련 부위 기본값으로:
  - 가슴 정보 → 가슴 split 30분 / 다리 정보 → 하체 split 30분 / 러닝 정보 → easy run 30분 / 홈트 정보 → home_training 30분
- recommendedWorkout enum 정확 (availableTime 30|50|90, non-long-run은 30|50, split만 targetMuscle)
</advice_rules>

<workout_table comment="plan-like 요청 시 권장">
{ "title": "≤15자", "columns": ["운동","세트","렙","RPE"], "rows": 3~6행 }
- 러닝: ["구간","거리","페이스","심박"] 등 재정의
- 다이어트: 식단표/주간표
- 본문 bullet과 중복 시 bullet 축소
</workout_table>

<action_items>3개 고정, 24시간 내 실천 가능한 구체 행동 ("닭가슴살 600g 구매" O / "꾸준히 운동하기" X)</action_items>

<session_params comment="다주차 프로그램 요청 시 REQUIRED (누락 시 무효 응답)">
각 항목: { weekNumber, dayInWeek, sessionMode, targetMuscle(split만), runType(running이면 REQUIRED: easy|interval|long), goal, availableTime(30|50), intensityOverride(high|moderate|low), label(≤10자) }
- 총 세션 수 = totalWeeks × sessionsPerWeek (휴식일 제외)
- workoutTable/monthProgram의 주간 구조와 정확히 일치
- 러닝 날은 sessionMode="running", 회복 날은 balanced+low
</session_params>

<exercise_science_guardrails source="ACSM/NSCA/Schoenfeld">
- HIGH 강도 연속 최대 3주 → 4주 이상이면 중간에 moderate/low 1주 삽입 (NSCA 디로드)
- 러닝 볼륨 주당 +10% 캡 (30분→35→40→50 점진, 한번에 큰 증가 불가)
- 주 2회 전신(balanced): A/B 말고 동일 구조 다른 강도 (Schoenfeld 2016)
- 주 5회+: 동일 부위 연속일 배치 금지
- 4주마다 1주 low 디로드 (적응→증가→피크→디로드)
</exercise_science_guardrails>

<depth_guidance>
**depth 필드는 정보 표시용이지 강제 명령 아닙니다. 유저 의도에 맞는 깊이를 자유롭게 선택하세요.**

권장 기준:
- 단순 인사·1단어 응답 → concise (reply 1~2문장)
- 한 가지 정보 질문 → medium (principles 3~5개 + 짧은 본문)
- 전략·복합·추천·다주차 질문 → full (advice 풀 세트)

**절대 금지:**
- "추천/다른/더/또" 키워드 입력 → 짧게 가지 말 것 (구체 옵션 3개+ 제시)
- 정보 질문에도 recommendedWorkout 비우지 말 것 (실행 경로 보장)

depth는 자유 판단. 유저 만족이 우선.
</depth_guidance>

<output_schema>
공통: depth, intentAnalysis, reasoning, selfCheck, followups, (sources — Google Search 사용 시)

plan: { mode:"plan", intent:{condition, goal, sessionMode, targetMuscle?, runType?, intensityOverride?, recentGymFrequency?, pushupLevel?, confidence, missingCritical, clarifyQuestion? } }

advice: { mode:"advice", advice:{ headline, goals, intensity?, monthProgram?, workoutTable?, principles, criticalPoints?, supplements?, conclusion?, actionItems?, sessionParams?(다주차 시 REQUIRED), recommendedWorkout:{condition, goal, sessionMode, targetMuscle?, runType?, intensityOverride?, reasoning} } }

chat: { mode:"chat", reply:"..." }

program: { mode:"program", program:{ name, totalWeeks, sessionsPerWeek, summary, weekDescriptions, sessions[]:ProgramSession } }
</output_schema>

<examples>

<example name="plan-mode-chest-30min">
<user_input>가슴 30분</user_input>
<output>
{
  "mode": "plan",
  "depth": "medium",
  "intentAnalysis": { "surface": "가슴 30분 세션", "latent": "짧은 시간 안에 가슴 자극 확보" },
  "reasoning": ["가슴 30분 요청 파악", "지난 이력 확인·가슴 공백 점검", "30분 split 기본값 구성 완료", "플랜 전달 준비"],
  "selfCheck": { "safety": "ok", "completeness": 0.9, "concerns": [] },
  "followups": [
    { "icon": "pump", "label": "자극 포인트", "prompt": "추천한 가슴 운동 자극 포인트 알려줘" },
    { "icon": "timer", "label": "세트 사이 휴식", "prompt": "세트 사이 몇 분 쉬어야 해?" },
    { "icon": "shoulder", "label": "어깨 안전 각도", "prompt": "가슴 운동할 때 어깨 안전한 각도?" },
    { "icon": "swap", "label": "내일 부위", "prompt": "오늘 가슴 했으면 내일은 뭘 해?" }
  ],
  "intent": {
    "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 30 },
    "goal": "muscle_gain",
    "sessionMode": "split",
    "targetMuscle": "chest",
    "confidence": 0.9,
    "missingCritical": []
  }
}
</output>
</example>

<example name="advice-mode-info-equipment">
<user_input>해머스트렝스 프레스 머신 사용법 자세히 알려줘</user_input>
<output>
{
  "mode": "advice",
  "depth": "full",
  "intentAnalysis": { "surface": "기구 사용법 안내", "latent": "정확한 폼으로 가슴 자극 극대화" },
  "reasoning": ["해머 프레스 사용법 요청 파악", "안전 폼·시트 높이·각도 정리", "관련 가슴 운동 추천 연결", "실행 경로 연결 완료"],
  "selfCheck": { "safety": "ok", "completeness": 0.9, "concerns": [] },
  "followups": [
    { "icon": "pump", "label": "다른 가슴 운동", "prompt": "체스트 프레스 머신 외 가슴 운동 추천?" },
    { "icon": "shoulder", "label": "어깨 안전 각도", "prompt": "프레스 머신에서 어깨 안 다치는 각도?" },
    { "icon": "timer", "label": "추천 무게 RPE", "prompt": "프레스 머신 적정 무게 어떻게 잡아?" },
    { "icon": "swap", "label": "벤치프레스 차이", "prompt": "체스트 프레스 머신 vs 바벨 벤치 차이?" }
  ],
  "advice": {
    "headline": "체스트 프레스 머신 가이드",
    "principles": [
      "**시트 높이**: 손잡이가 가슴 중앙(유두 라인)에 오도록 조정",
      "**등받이 각도**: 평행~약간 디클라인이 가슴 자극 최대",
      "**손잡이 위치**: 어깨 너비보다 약간 넓게, 팔꿈치 75도",
      "**템포**: 컨센트릭 1초 / 에센트릭 2~3초로 천천히 내리기"
    ],
    "criticalPoints": [
      "어깨 들리면 즉시 시트 조정 — 무게보다 폼 우선",
      "끝까지 락아웃 X — 팔꿈치 약간 굽힌 채 정지"
    ],
    "actionItems": [
      "오늘 가벼운 무게로 폼 5세트 연습",
      "거울 앞에서 어깨 위치 체크",
      "다음 세션 RPE 8까지 점진 증량"
    ],
    "recommendedWorkout": {
      "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 30 },
      "goal": "muscle_gain",
      "sessionMode": "split",
      "targetMuscle": "chest",
      "intensityOverride": "moderate",
      "reasoning": "방금 배운 폼으로 가슴 30분 세션 바로 시작해보세요."
    }
  }
}
</output>
</example>

<example name="advice-mode-recommend-followup">
<user_input>다른 홈트레이닝 루틴도 추천해 줄 수 있나요?</user_input>
<output>
{
  "mode": "advice",
  "depth": "full",
  "intentAnalysis": { "surface": "추가 홈트 옵션 요청", "latent": "변화·새로운 자극으로 매너리즘 탈출" },
  "reasoning": ["추가 옵션 요청 파악", "기본 외 3가지 변형 구성", "각 루틴 차별점 정리", "실행 경로 연결 완료"],
  "selfCheck": { "safety": "ok", "completeness": 0.92, "concerns": [] },
  "followups": [
    { "icon": "pump", "label": "강도 차이", "prompt": "이 3개 중 가장 강도 높은 건?" },
    { "icon": "timer", "label": "20분 단축판", "prompt": "20분 안에 끝낼 수 있는 홈트?" },
    { "icon": "swap", "label": "맨몸 vs 덤벨", "prompt": "덤벨 있을 때 vs 맨몸일 때 차이?" },
    { "icon": "calendar", "label": "주간 조합", "prompt": "이 3개를 주간 어떻게 배치?" }
  ],
  "advice": {
    "headline": "홈트 3가지 옵션",
    "workoutTable": {
      "title": "홈트 3개 비교",
      "columns": ["루틴", "구성", "시간", "강도"],
      "rows": [
        ["전신 서킷", "스쿼트·푸쉬업·런지·플랭크·마운틴 클라이머 5종", "30분", "고강도"],
        ["하체 집중", "고블렛 스쿼트·런지·글루트 브릿지·플랭크 (덤벨 활용)", "40분", "중강도"],
        ["상체 + 코어", "푸쉬업·인버티드 로우·오버헤드 프레스·플랭크 (덤벨)", "30분", "중강도"]
      ]
    },
    "principles": [
      "**복합 운동** 중심: 한 세션에 여러 근육 자극",
      "**서킷 형식**: 휴식 30초로 지방 연소 효과 ↑",
      "**점진 과부하**: 매주 횟수 또는 세트 1개씩 추가"
    ],
    "actionItems": [
      "오늘 첫 옵션(전신 서킷) 30분 시도",
      "내일 두 번째 옵션 진행",
      "주말에 강도 가장 높았던 루틴 재실행"
    ],
    "recommendedWorkout": {
      "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 30 },
      "goal": "fat_loss",
      "sessionMode": "home_training",
      "intensityOverride": "high",
      "reasoning": "지금 바로 첫 옵션(전신 서킷 30분) 시작 가능합니다."
    }
  }
}
</output>
</example>

<example name="advice-mode-return-after-break">
<user_input>3개월 쉬었는데 복귀 어떻게?</user_input>
<output>
{
  "mode": "advice",
  "depth": "full",
  "intentAnalysis": { "surface": "공백 후 복귀 루틴", "latent": "부상 없이 이전 수준 회복하는 안전한 경로" },
  "reasoning": ["3개월 공백 복귀 요청 파악", "신경계·관절 재적응 단계 조사", "4주 디로드 구조 구성 완료", "안전 경고 포함 전달 준비"],
  "selfCheck": { "safety": "warning", "completeness": 0.92, "concerns": ["무게 욕심 시 부상 위험"] },
  "followups": [
    { "icon": "calendar", "label": "주 몇 회부터?", "prompt": "복귀 첫 주 주 몇 회부터 시작?" },
    { "icon": "pump", "label": "근육통 대처", "prompt": "복귀 초기 근육통 심할 때 어떻게?" },
    { "icon": "food", "label": "단백질 섭취량", "prompt": "복귀 중 단백질 얼마나 먹어야 해?" },
    { "icon": "swap", "label": "안전 대체 운동", "prompt": "무릎 걱정될 때 스쿼트 대체 운동?" }
  ],
  "advice": {
    "headline": "복귀 4주 안전 구조",
    "goals": ["4주: 신경계 재적응 + 폼 회복", "8~12주: 기존 수준 80~90% 회복"],
    "intensity": ["Week 1~2: 1RM 65~70% / RPE 7", "실패 지점 금지, 2~3 reps in reserve"],
    "monthProgram": {
      "week1": "가벼운 중량 / 폼 회복 / 주 2회",
      "week2": "중량 소폭 증가 / 주 2~3회",
      "week3": "중강도 적응 / 주 3회",
      "week4": "디로드 (1RM 60% / 주 2회)"
    },
    "principles": ["**탄수화물** 충분 확보 — 회복 핵심", "**무게 욕심 금지** — 신경계 복구 먼저", "**수면 7시간+** — 연결조직 회복"],
    "criticalPoints": ["무릎·허리 통증 시 즉시 중단", "매 세트 폼 체크 우선"],
    "actionItems": ["오늘 기본 스트레칭 15분", "내일 가벼운 전신 2세트 실시", "이번 주 체중 측정 및 기록"],
    "recommendedWorkout": {
      "condition": { "bodyPart": "good", "energyLevel": 3, "availableTime": 50 },
      "goal": "general_fitness",
      "sessionMode": "balanced",
      "intensityOverride": "low",
      "reasoning": "복귀 첫 주는 전신 저강도 50분이 가장 안전합니다."
    }
  }
}
</output>
</example>

<example name="chat-mode-greeting">
<user_input>안녕</user_input>
<output>
{
  "mode": "chat",
  "depth": "concise",
  "intentAnalysis": { "surface": "인사", "latent": "운동 시작 가능한 분위기 탐색" },
  "reasoning": ["인사 입력 파악", "간단 응답 + 운동 유도"],
  "selfCheck": { "safety": "ok", "completeness": 0.7, "concerns": [] },
  "followups": [
    { "icon": "chest", "label": "가슴 30분", "prompt": "가슴 30분" },
    { "icon": "legs", "label": "하체 40분", "prompt": "하체 40분" },
    { "icon": "run", "label": "러닝 5km", "prompt": "러닝 5km 인터벌" },
    { "icon": "home", "label": "홈트 30분", "prompt": "홈트 30분" }
  ],
  "reply": "안녕하세요! 오늘 어느 부위 해볼래요? 시간만 알려주시면 바로 짜드려요."
}
</output>
</example>

</examples>

<final_instruction>
JSON만 반환. 설명 문장·마크다운 코드블록 금지.
**핵심: recommendedWorkout 가능하면 항상 포함하세요. 오운잘은 유저가 한 클릭으로 운동 시작하는 게 차별성입니다.**
</final_instruction>`;

    try {
      const ai = getGemini();
      // Phase 7E: 장기 프로그램·트렌드·최신 가이드 요청에는 Google Search Grounding 활성
      // (responseMimeType=application/json과 tools 동시 사용 불가하므로 분기 처리)
      const TREND_PATTERN = /(2026|2025|최신|트렌드|요즘|신기능|화제|유행|new\s|latest|trend|기구|머신|장비|사용법|자세|폼|form|technique|how\s*to|가이드|브랜드)/i;
      const useGrounding = TREND_PATTERN.test(text);
      const baseConfig = useGrounding
        ? { temperature: 0.3, maxOutputTokens: 16384, tools: [{ googleSearch: {} }] as any }
        : { responseMimeType: "application/json" as const, temperature: 0.2, maxOutputTokens: 16384 };
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
        await bumpCounter();
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

      // depth는 Gemini가 자율 판단. 서버 보정/강제 폐기 (오운잘 차별성: 깊이는 유저 의도에 자유롭게).
      // 단 intentDepth=focused_followup만 클라이언트가 명시한 경우 존중 (followup 칩 탭).
      const VALID_DEPTHS = ["concise", "medium", "full"] as const;
      type Depth = typeof VALID_DEPTHS[number];
      let depth: Depth = (VALID_DEPTHS as readonly string[]).includes(parsedRaw?.depth) ? parsedRaw.depth as Depth : "medium";
      const intentDepth = (req.body as any)?.intentDepth;
      if (intentDepth === "focused_followup" && depth === "full") depth = "medium"; // 후속 칩 탭은 한 단계만 축소

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
              label: f.label.trim().slice(0, 28),
              prompt: f.prompt.trim().slice(0, 120),
            }))
        : [];

      // 3-way 모드 분기: plan | advice | chat
      const mode = parsedRaw?.mode;
      // depth-based mode 강제 폐기. Gemini가 mode를 결정하면 그대로 존중.
      // (이전 로직: depth=concise면 advice→chat 강등 — 유저 추천 요청을 회피로 만들어 제거됨)

      if (mode === "program" && parsedRaw?.program) {
        const prog = sanitizeProgram(parsedRaw.program);
        if (prog) {
          await bumpCounter();
          res.status(200).json({ mode: "program", depth, intentAnalysis, reasoning, selfCheck, sources, followups, program: prog, model: "gemini-2.5-flash" });
          return;
        }
        // program 스키마 훼손 시 advice로 폴백
      }

      if (mode === "plan" && parsedRaw?.intent) {
        const intent = sanitize(parsedRaw.intent);
        await bumpCounter();
        res.status(200).json({ mode: "plan", depth, intentAnalysis, reasoning, selfCheck, sources, followups, intent, model: "gemini-2.5-flash" });
        return;
      }

      if (mode === "advice" && parsedRaw?.advice) {
        // Gemini 원본 디버그 로깅
        console.log("[GEMINI_DEBUG] advice.sessionParams raw:", JSON.stringify(parsedRaw.advice.sessionParams ?? "NOT_PROVIDED"));
        console.log("[GEMINI_DEBUG] advice.workoutTable:", JSON.stringify(parsedRaw.advice.workoutTable ?? "NOT_PROVIDED"));
        console.log("[GEMINI_DEBUG] advice.monthProgram:", JSON.stringify(parsedRaw.advice.monthProgram ?? "NOT_PROVIDED"));
        console.log("[GEMINI_DEBUG] advice.recommendedWorkout:", JSON.stringify(parsedRaw.advice.recommendedWorkout ?? "NOT_PROVIDED"));
        const advice = sanitizeAdvice(parsedRaw.advice);
        if (advice) {
          // depth-based 필드 강제 제거 폐기. Gemini가 채운 advice 그대로 전달 (유저가 받기로 한 정보를 시스템이 깎지 않음).
          await bumpCounter();
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
      await bumpCounter();
      res.status(200).json({ mode: "chat", depth, intentAnalysis, reasoning, selfCheck, sources, followups, reply, model: "gemini-2.5-flash" });
    } catch (error) {
      console.error("parseIntent error:", error);
      await bumpCounter();
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
  // 정보성 질문(사용법/폼/원리)은 principles 중심만으로도 유효한 응답.
  // goals, recommendedWorkout은 전략 질문일 때만 필수.
  if (principles.length === 0) return null;
  const rec = a.recommendedWorkout ? sanitize(a.recommendedWorkout) : null;

  // monthProgram 키 정규화: week1-4 또는 month1-3 또는 기타 키 유연 수용
  const monthProgram = (() => {
    if (!a.monthProgram || typeof a.monthProgram !== "object") return undefined;
    const mp = a.monthProgram;
    // week1-4 키 직접 매칭
    if (mp.week1 || mp.week2 || mp.week3 || mp.week4) {
      return {
        week1: typeof mp.week1 === "string" ? mp.week1.trim() : undefined,
        week2: typeof mp.week2 === "string" ? mp.week2.trim() : undefined,
        week3: typeof mp.week3 === "string" ? mp.week3.trim() : undefined,
        week4: typeof mp.week4 === "string" ? mp.week4.trim() : undefined,
      };
    }
    // month1-3 등 다른 키 → 순서대로 week1-4에 매핑
    const values = Object.values(mp).filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (values.length === 0) return undefined;
    return {
      week1: values[0]?.trim(),
      week2: values[1]?.trim(),
      week3: values[2]?.trim(),
      week4: values[3]?.trim(),
    };
  })();

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
    sessionParams: sanitizeSessionParams(a.sessionParams),
    recommendedWorkout: rec ? {
      condition: rec.condition,
      goal: rec.goal,
      sessionMode: rec.sessionMode,
      targetMuscle: rec.targetMuscle,
      runType: rec.runType,
      intensityOverride: rec.intensityOverride,
      reasoning: typeof a.recommendedWorkout?.reasoning === "string"
        ? a.recommendedWorkout.reasoning.trim().slice(0, 140)
        : "",
    } : undefined,
  };
}

/** sessionParams sanitize — advice 내 장기 프로그램 세션 파라미터 */
function sanitizeSessionParams(raw: any): AdviceContent["sessionParams"] {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const modes = ["balanced", "split", "running", "home_training"] as const;
  const muscles = ["chest", "back", "shoulders", "arms", "legs"] as const;
  const goals = ["fat_loss", "muscle_gain", "strength", "general_fitness"] as const;
  const times = [30, 50, 90] as const;
  const intensities = ["high", "moderate", "low"] as const;

  const result = raw
    .filter((s: any) => s && typeof s === "object")
    .slice(0, 100)
    .map((s: any) => ({
      weekNumber: typeof s.weekNumber === "number" ? s.weekNumber : 1,
      dayInWeek: typeof s.dayInWeek === "number" ? s.dayInWeek : 1,
      sessionMode: modes.includes(s.sessionMode) ? s.sessionMode : "balanced" as const,
      targetMuscle: muscles.includes(s.targetMuscle) ? s.targetMuscle : undefined,
      goal: goals.includes(s.goal) ? s.goal : "general_fitness" as const,
      availableTime: (times as readonly number[]).includes(s.availableTime) ? s.availableTime as 30 | 50 | 90 : 50 as const,
      intensityOverride: intensities.includes(s.intensityOverride) ? s.intensityOverride : undefined,
      label: typeof s.label === "string" ? s.label.trim().slice(0, 20) : "",
    }));

  return result.length > 0 ? result : undefined;
}

/** 장기 프로그램 응답 sanitize */
interface ProgramSession {
  weekNumber: number;
  dayInWeek: number;
  sessionMode: "balanced" | "split" | "running" | "home_training";
  targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
  goal: "fat_loss" | "muscle_gain" | "strength" | "general_fitness";
  availableTime: 30 | 50 | 90;
  intensityOverride?: "high" | "moderate" | "low";
  label: string;
}
interface ProgramData {
  name: string;
  totalWeeks: number;
  sessionsPerWeek: number;
  summary: string;
  weekDescriptions: Record<string, string>;
  sessions: ProgramSession[];
}
function sanitizeProgram(raw: any): ProgramData | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  if (typeof raw.totalWeeks !== "number" || raw.totalWeeks < 1 || raw.totalWeeks > 52) return null;
  if (typeof raw.sessionsPerWeek !== "number" || raw.sessionsPerWeek < 1 || raw.sessionsPerWeek > 7) return null;
  if (!Array.isArray(raw.sessions) || raw.sessions.length === 0) return null;

  const modes = ["balanced", "split", "running", "home_training"] as const;
  const muscles = ["chest", "back", "shoulders", "arms", "legs"] as const;
  const goals = ["fat_loss", "muscle_gain", "strength", "general_fitness"] as const;
  const times = [30, 50, 90] as const;
  const intensities = ["high", "moderate", "low"] as const;

  const sessions: ProgramSession[] = raw.sessions
    .filter((s: any) => s && typeof s === "object")
    .slice(0, 100)
    .map((s: any) => ({
      weekNumber: typeof s.weekNumber === "number" ? s.weekNumber : 1,
      dayInWeek: typeof s.dayInWeek === "number" ? s.dayInWeek : 1,
      sessionMode: modes.includes(s.sessionMode) ? s.sessionMode : "balanced",
      targetMuscle: muscles.includes(s.targetMuscle) ? s.targetMuscle : undefined,
      goal: goals.includes(s.goal) ? s.goal : "general_fitness",
      availableTime: times.includes(s.availableTime) ? s.availableTime : 50,
      intensityOverride: intensities.includes(s.intensityOverride) ? s.intensityOverride : undefined,
      label: typeof s.label === "string" ? s.label.trim().slice(0, 20) : "",
    }));

  if (sessions.length === 0) return null;

  const weekDescriptions: Record<string, string> = {};
  if (raw.weekDescriptions && typeof raw.weekDescriptions === "object") {
    for (const [k, v] of Object.entries(raw.weekDescriptions)) {
      if (typeof v === "string") weekDescriptions[k] = v.trim().slice(0, 60);
    }
  }

  return {
    name: raw.name.trim().slice(0, 40),
    totalWeeks: raw.totalWeeks,
    sessionsPerWeek: raw.sessionsPerWeek,
    summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 200) : "",
    weekDescriptions,
    sessions,
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
