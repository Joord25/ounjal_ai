# 회의록

---

### 회의 64-M3: 운동 중도 종료 기능 Phase 1 (2026-04-22)

**참석:** 대표(임주용), Claude, 김경록(일헥타르), Seth Godin, Kevin Kelly, Nir Eyal, BJ Fogg

**배경:**
- 유저 중도 이탈자 대응 부재. 현재 onBack 시 workout_history 저장 안 됨 → 기록 소실
- 대표 요구: 중도 종료도 리포트·캘린더에 남기되 "중도" 구분 + 완주 설득 팝업

**설계 결정 (자문단 논의):**

*설득 카피 원칙 6개:*
- Loss aversion (Kahneman & Tversky 1979)
- Progress principle (Amabile HBR 2011)
- Specificity (BJ Fogg B=MAT)
- Autonomy (Deci & Ryan SDT)
- 나의 네러티브 (일헥타르)
- Identity framing (Godin)

*인용 선정 (거절 불가 문구 자문):*
- KO: **이순신** 장계 (1597) "아직 N개가 남아 있사옵니다" — Seth Godin "기존 문화 선점"
- EN 3인 랜덤 회전 (날짜 시드 고정):
  - Muhammad Ali "Suffer now and live the rest of your life as a champion"
  - David Goggins "40% Rule"
  - Eliud Kipchoge "No human is limited"
- Backup: 유저 본인 goal (Cialdini Commitment, *Influence* Ch.3) — goal 데이터 부재 시 폴백

*정책 결정:*
- PR 계산: 중도 기록도 포함 (기록 존중)
- 완주율 지표 하락 수용 (진실 우선)
- 1세트 미만 = 기존 onBack (기록 미저장)
- 프로그램 세션 완주 마킹에서 중도 세션 제외

**구현 범위:**

Phase 1 (이번 커밋):
- FitScreen: skip 버튼 → "운동 종료" 버튼 (모든 모드)
- WorkoutSession: `onAbandon` prop + 인용 팝업
- page.tsx: `onAbandon` 핸들러 + `currentWorkoutAbandoned` state
- WorkoutReport: abandoned 앰버 배지
- MyPlansScreen: 완료/중도 아이콘 분기
- ProofTab: 히스토리 뷰 배지 전파
- WorkoutHistory.abandoned / CompletionEntry.abandoned 필드 추가

Phase 2 (별도 커밋 예정):
- 전체시간(elapsed timer) 탭 → 전체 세션 pause/resume
- 앱·탭 이탈 자동 중도 저장 (기존 localStorage 백업 활용, 회의 64-γ 로직 확장)

**파일 수정:**
- [src/constants/workout.ts](src/constants/workout.ts) (WorkoutHistory.abandoned)
- [src/locales/ko.json](src/locales/ko.json) + [src/locales/en.json](src/locales/en.json)
- [src/components/workout/FitScreen.tsx](src/components/workout/FitScreen.tsx)
- [src/components/workout/WorkoutSession.tsx](src/components/workout/WorkoutSession.tsx)
- [src/app/app/page.tsx](src/app/app/page.tsx)
- [src/components/report/WorkoutReport.tsx](src/components/report/WorkoutReport.tsx)
- [src/components/dashboard/MyPlansScreen.tsx](src/components/dashboard/MyPlansScreen.tsx)
- [src/components/dashboard/ProofTab.tsx](src/components/dashboard/ProofTab.tsx)
- [src/utils/programCompletion.ts](src/utils/programCompletion.ts)

**빌드 검증:** `npm run build` 통과.

---

### 회의 64-M2: 관리자 대시보드 정비 (2026-04-22)

**Step A (완료): 데이터 부족·broken 섹션 5종 제거**
- ARPU/Churn (결제 1건 규모 노이즈)
- 월별 추이 6개월 (데이터 부족)
- GA4 funnel 3종 (맞춤 측정기준 미등록)
- 무료 풀 소진 (새 퍼널에 흡수)
- User Segment Stats 표 (새 퍼널로 대체)

**Step B (완료): 유저 행동 퍼널 백엔드 집계 + UI**

구조:
- 단계: 앱 진입 → 챗 시작 → 플랜 생성 → 운동 기록 → 운동 완주
- 세그먼트: 비로그인(anon) / 로그인(가입자) 분리
- 버킷: 오늘 · 어제 · 이번 주 · 이번 달 · 전체
- 단계별 이탈률 ▼N% 표시

데이터 소스:
- 앱 진입: Firebase Auth creationTime (isAnonymous 분리)
- 비로그인 챗/플랜: trial_ips.firstSeenAt · chatCount / count
- 로그인 챗/플랜: users.chatCount / planCount (Auth cohort)
- 운동 기록/완주: workout_history collectionGroup, uid별 최초 date
- 완주 판정: abandoned !== true (회의 64-M3 Phase 1 연동)

제약:
- 비로그인 세그먼트: anon uid ↔ IP 해시 매칭 불가 → 단계별 타임축 상이 (근사)
- 로그인 세그먼트: uid 일관 cohort → 정확

배포:
- `firebase deploy --only functions` 완료 (adminDashboard)
- 기타 함수 HTTP 409 race condition (이번 변경 없음, 기존 버전 작동)

**파일 수정:**
- [functions/src/admin/admin.ts](functions/src/admin/admin.ts) — 퍼널 집계 로직
- [src/app/admin/page.tsx](src/app/admin/page.tsx) — 퍼널 UI + DashboardData.funnel 타입

**이월 과제:**
- 로그인 유저 firstChatAt / firstPlanAt 타임스탬프 스키마 추가 (이벤트 시점 기준 버킷링 정밀화)
- 비로그인 세그먼트 chat/plan 링키지 정리 (현재 trial_ips 기준으로 세그먼트 간 경계 모호)

---

### 회의 64-M1: EN 랜딩 Hero 제목 — 네이티브 카피로 교체 (2026-04-22)

**참석:** 대표(임주용), Claude(기획자), 김경록(일헥타르), Seth Godin, Kevin Kelly

**배경:**
- 현재 EN hero: "Beyond ChatGPT? / Not just talk. / Plan to done."
- 대표가 현지인 카피라이터 3개 후보 제시
- 1차 회의에서 Claude가 한국어 자문 프레임(Godin/Kelly/일헥타르)을 영어 광고 카피 판정에 과잉 적용 → 한국 hero 직역본(후보 A)을 1순위 추천 → 대표 반박: "자기 나라 언어와 카피라이팅도 못하는데 자문단 있으면 뭐해요"
- 재판정: 영어 fitness·tech 광고 문법(Peloton/Nike/Apple 계열) 1차, 전략 프레임 2차

**최종 선택: 후보 2 — "ChatGPT talks / You've got a / body to train / Let's go"**

**판정 근거 (네이티브 광고 카피 문법):**
- 3-beat 리듬: 문제 → 자기 몸 환기 → 활성화
- **"You've got a body to train"** 이 카피의 심장 — 화면 너머 독자 몸을 지목 (Peloton "There is no finish line" 계열 신체 환기)
- "Let's go" 는 클리셰 아닌 fitness 카테고리 canonical CTA (Nike 계보), emerald 강조와 아래 CTA 버튼 색 연결로 시각 연속성
- 후보 1(깔끔하지만 정보 전달 수준)·후보 3(shame-bait 리스크) 대비 활성도 + 훅 강도 우위

**최종 카피 조정 (대표 판단):**
- "only" 제거 + 마침표 전부 삭제 — 더 미니멀·젊은 톤, 원래 mobile 대형 폰트(10vw) 유지 가능
- "You've got a body to train" 모바일 줄바꿈: "You've got a" / "body to train" 2분할 (전치사 위치 아닌 자연 리듬 기준 — 현지 판단)

**파일 수정:**
- [src/app/landing/landingTexts.ts:191-194](src/app/landing/landingTexts.ts#L191-L194)
  - line1: "ChatGPT talks"
  - line2: "You've got a"
  - line2b: "body to train"
  - line3: "Let's go" (emerald 강조)

**부산물 (재발 방지):**
- [memory/feedback_native_copy_frame.md](../../../.claude/projects/-Users-joord-Desktop-Joord-ohunjal-ai/memory/feedback_native_copy_frame.md) 신설 — 네이티브 카피는 현지 광고 문법 1차, 한국어 전략 프레임 2차

**빌드 검증:** `npm run build` 통과.

**이월 과제:**
- EN sub/stats/trust 섹션도 KO 대비 네러티브 밀도 낮음 — 별도 회의로 톤 점검 필요
- JA/ZH 확장 시 동일 원칙(현지 광고 문법 1차) 적용

---

### 회의 64-ζ-γ: 장기 프로그램 완료 판정을 workout_history 기준으로 전환 (2026-04-21)

**참석:** 대표(임주용), 평가자 Agent, 구현자 Agent

**대표의 직관적 분석 (해결의 핵심):**
> "히스토리는 자료가 남았으니 firestore에 기록됐다는 뜻이고, 그게 내 플랜 장기 프로그램에 연결이 안 되어있거나 잘못 연결된 거네. 웨이트 장기플랜은 **연결 안 됨** 문제, 러닝은 **중복 세션 순서 판정** 문제로 봐줘."

**코드 경로로 확인된 두 케이스:**

| 증상 | 메커니즘 |
|---|---|
| 다이어트 플랜 "연결 안 됨" | `workout_history` 저장 경로와 `saved_plans.completedAt` 마킹 경로가 분리됨 + resume 경로 마킹 누락(64-ζ-β) + `syncSavedPlansFromServer` 파괴적 덮어쓰기(`saveProgram`이 `completedAt: null` 고정) |
| 10K S16 "순서 오류" | 4/19 `markSessionCompleted` 미존재 → 4/20 backfill v1이 sessionNumber 정렬 없이 Firestore 문서 순서로 매칭 → S1과 S16(둘 다 tt_2k) 동일 exerciseSet이라 S16에 잘못 저장됨 |

**근본 원인 공통분모:** `saved_plans.completedAt` 필드 자체가 신뢰 불가능한 데이터 소스. 여러 경로에서 오염·유실 가능.

**해결 방향 (대표 직관 반영):**
`saved_plans.completedAt` 의존 버리고 `workout_history`를 source-of-truth로 전환. 렌더 타임에 두 컬렉션 매칭.

**구현:**
- **`src/utils/programCompletion.ts` (신규)** — `exerciseNameSet` 키 기반 1:1 매칭 알고리즘 (backfill v2 로직을 렌더 타임으로 이동):
  - 프로그램 세션을 `exerciseKey` 별 큐로 재구성, 각 큐는 `sessionNumber ASC`
  - `workout_history` 를 date ASC 정렬, 각 엔트리 1회 소비 → 첫 미매칭 세션에 할당
  - `plan.createdAt` 이전 history는 제외 (다른 프로그램 오염 방지)
  - `deriveProgramCompletions` / `getProgramProgressFromHistory` / `getNextProgramSessionFromHistory`
- **`MyPlansScreen.tsx`** — `getActivePrograms` (completedAt 의존) 폐기, `useMemo`로 프로그램별 `completionMap` 계산. 세션 리스트/진행률/다음세션 CTA 모두 `completionMap` 기반

**효과 (대표 폰 실측 확인):**
- 10K S16 체크마크가 자동으로 **S1로 교정됨** (Firestore 데이터 건드리지 않고 UI만 올바르게)
- 앞으로 resume 경로/sync 덮어쓰기 무관하게 완료 표시 신뢰 가능
- 과거 backfill v1 오염 영향 자동 해소

**파일 수정:**
- `src/utils/programCompletion.ts` (신규)
- `src/components/dashboard/MyPlansScreen.tsx`

**빌드 검증:** `npm run build` 통과, tsc 깨끗.

**이월 과제:**
- `syncSavedPlansFromServer` 파괴적 덮어쓰기 자체는 그대로. 다른 필드(useCount/lastUsedAt)에는 영향 있을 수 있음. 별건 체크 필요.
- Firestore 의 오염된 `completedAt` 데이터 클린업은 선택 사항 (UI가 올바르니 긴급성 낮음). 향후 admin 툴 재구현 시 reset만 수행.

---

### 회의 64-ζ-β: resume 경로 완료 마킹 누락 + strength 프로그램 programCategory 갭 (2026-04-21)

**참석:** 대표(임주용), 평가자 Agent, 구현자 Agent

**버그 1 (대표 실측):**
> "2개월 여름맞이 다이어트 플랜도 오늘 1회차 완료했는데 완료 표시가 안 되네."

**원인 진단 (평가자 코드 추적):**
- [page.tsx:1096](src/app/app/page.tsx#L1096) `if (currentPlanSource === "program" && activeSavedPlanId)` 조건
- [page.tsx:1270](src/app/app/page.tsx#L1270) "이전 플랜 이어서" 버튼이 `setCurrentPlanSource("resume")` 덮어씀
- 결과: 뒤로가기 → 홈 → 이어서 경로로 완료하면 마킹 조건 실패 → 체크마크 미반영

**수정:**
```ts
if (activeSavedPlanId && (currentPlanSource === "program" || currentPlanSource === "resume" || currentPlanSource === "saved")) {
  markSessionCompleted(activeSavedPlanId);
}
```
`activeSavedPlanId` 존재만으로 마킹. 단일 플랜(`saved`)이어도 completedAt 찍히지만 display 로직이 프로그램 세션에서만 소비 → 무해.

**버그 2 (평가자 병렬 에이전트 발견):**
`ChatHome.generateAndSaveProgram` ([:448-464](src/components/dashboard/ChatHome.tsx#L448-L464))이 strength 장기 프로그램 생성 시 `programCategory` 필드 누락. 향후 running/strength 구분 필터가 깨질 수 있는 잠재 버그.

**수정:** `programCategory: "strength" as const` 명시.

**에이전트 병렬 조사 결과 (주요 발견):**
- **평가자 Agent** (일반 목적): 러닝 4프로그램(vo2_boost/10k/half/full) + 장기 플랜 예시 칩(summer_diet/vacation/long_full 등) 완료 flow 전수 PASS. 위 2건 제외 이상 없음
- **데이터 조사 Agent** (일반 목적): `git show 91ba262:functions/src/admin/backfillSessionCompletion.ts` 로 deleted 파일 복원 분석. v1/v2 backfill 로직 차이 + `syncSavedPlansFromServer` 파괴적 덮어쓰기 흐름 확정. S16 오염이 Firestore 측에 있고 매 sync마다 로컬로 내려오는 구조임을 증명

**파일 수정:**
- `src/app/app/page.tsx` (조건 확장)
- `src/components/dashboard/ChatHome.tsx` (programCategory)

**빌드 검증:** `npm run build` 통과.

---

### 회의 64-ζ: 장기 프로그램 동일 내용 세션 혼동 해소 — 맥락 라벨 + 세션번호 상시 노출 (2026-04-21)

**참석:** 대표(임주용), 기획자 Agent, 평가자 Agent, 박서진 프엔 헤더

**버그 리포트 (대표 실측):**
> "10K 50분 돌파에서 1번(2km 전력)을 했는데 동일 내용인 16번을 한 걸로 오인하게 됐어."

**평가자 코드 근거:**
- `functions/src/runningProgram.ts:568` + `:592-596` — Week 1 Day 1 override + Chapter 1(Week 4) boundaryTT 둘 다 `slotType="tt_2k"` 편성. 10K 4일/주 기준 Session 1과 Session 16이 동일 slotType
- `:820-827` — 두 세션 모두 `title: "2K Time Trial — 기준점 측정"`, `description: "2km 전력 러닝 + 워밍업/쿨다운 유산소"` 완전 동일
- `src/components/dashboard/MyPlansScreen.tsx:197` — 리스트는 `sessionData.description`만 노출, 구분자 없음. isDone 시 sessionNumber도 체크마크로 가림

**근본 원인 2계층:**
1. **설계 계층(주범):** SPEC이 동일 slotType 세션을 "기준점(W1)"과 "재측정(W4/W8/Peak)" 서로 다른 훈련 맥락에 배치했는데 UI에 맥락 차이가 한 글자도 드러나지 않음
2. **추적 계층(부차):** 완료 마킹은 `plan.id` 기반이라 코드상 정상. 서버 `listSavedPlans` 싱크가 `completedAt`을 리셋하는 잠재 리스크는 별건으로 분리

**자문단 근거 (source-grounded):**
- Canova [Running Writings](https://runningwritings.com/2023/07/renato-canova-marathon-training-lecture.html) — "control test / verifica"는 같은 거리라도 훈련 주기 내 위치가 의미를 바꿈

**대표 확정 (A+B 동시):**
- A(기획): 각 TT/Dress에 역할 라벨 부여 — Base 진입/Base 완료/Threshold 해방/VO2 완료/Peak 점검
- B(프론트): 세션번호(`#N`) 항상 노출, 체크마크가 가리지 않도록 description 앞에 prefix

**구현 구조 (클라이언트 렌더 타임 매핑 — 서버/저장 데이터 불변):**
- **`src/utils/programSessionLabels.ts` (신규)** — `getProgramSessionLabel({slotType, weekIndex, programGoal})` 맥락 라벨 매핑. tt_2k W1→"Base 진입 · 현재 2K 기준점", tt_2k else→"Base 완료 · 4주 성장 재측정", tt_5k vo2_boost→"VO2 완료 · 5K 최종 측정", tt_5k else→"Threshold 해방 · 5K 재측정", dress_rehearsal→"Peak 점검 · 레이스 시뮬레이션"
- **`MyPlansScreen.tsx`** — 세션 리스트/다음 세션 CTA 양쪽에서 `getProgramSessionLabel` 적용. 리스트 각 행에 `#{sessionNumber}` prefix(회색 tabular-nums) — 체크마크 상태에서도 몇 회차인지 노출
- **`page.tsx` onSelectPlan** — 프로그램 세션 선택 시 `applyProgramSessionLabel(plan.sessionData, plan)` → MasterPlanPreview/WorkoutSession/WorkoutReport 전 경로에서 맥락 라벨 일관 표시. 완료 후 workoutHistory에도 맥락 라벨로 기록됨

**설계 원칙 (재활용 가능):**
- 서버 생성기(runningProgram.ts) 스펙은 유지 — 저장된 기존 프로그램 마이그레이션 불필요
- 렌더 타임 derive 로 기존 유저 프로그램까지 자동 반영
- `slotType/weekIndex/programGoal` 3필드가 SavedPlan에 이미 저장돼 있었기에 가능 (회의 64-C 산물)

**파일 수정:**
- `src/utils/programSessionLabels.ts` (신규)
- `src/components/dashboard/MyPlansScreen.tsx`
- `src/app/app/page.tsx`

**빌드 검증:** `npm run build` 통과. tsc diagnostics 깨끗.

**미해결·이월 (회의 64-ζ-β):**
- 데이터 무결성 — `syncSavedPlansFromServer`가 로컬 `completedAt`을 서버 null로 덮어쓰는 잠재 리스크. 서버에도 `completedAt` 저장 경로 필요. 대표 폰 localStorage 덤프로 현상 재현 조사 후 별건 처리

---

### 회의 64-ε: 교체 바텀시트 필터·결과 그룹 순서 재정렬 (2026-04-20)

**참석:** 대표(임주용), 구현자 Agent

**대표 지시:**
> "대체운동 선택시 가슴, 등, 하체, 어깨, 팔 이런순으로..."

**결정:**
- [LABELED_EXERCISE_POOLS](../src/constants/workout.ts#L246) 배열 순서 = [PlanBottomSheets.tsx:260-270, 315-325](../src/components/plan/PlanBottomSheets.tsx#L260-L325) 의 필터 pill · 검색 결과 그룹 헤더 순서. 배열 자체를 재정렬.
- 새 순서: **가슴 → 등 → 하체 → 어깨 → 이두 → 삼두 → 후면 어깨 → 종아리 → 코어 → 전신 → 플라이오 → 웜업 → 가동성**
- "팔" = 이두+삼두 (대표 지시 자연어). 후면 어깨는 보조 근육이라 바로 뒤.

**first-match 무결성 검증:**
- 공유 운동의 `getAlternativeExercises()` first-match 그룹이 기존과 동일하게 유지되는지 확인:
  - 친업 → 등 ✓ (이두보다 앞)
  - 폼롤러 흉추 가동성 → 등 ✓ (코어/가동성보다 앞)
  - 케틀벨 스윙 → 하체 ✓ (전신보다 앞)
  - 마운틴 클라이머 (Climber 단수) → 코어 ✓ (플라이오의 복수형과 분리)
  - 데드버그·베어 크롤 → 코어 ✓
  - 버피 계열 → 플라이오 ✓

**파일 수정:**
- `src/constants/workout.ts` — `LABELED_EXERCISE_POOLS` 배열 순서 재정렬 + 주석 갱신

**빌드 검증:** `npm run build` 통과.

---

### 회의 64-δ: 버피·에어 스쿼트 등 교체 버튼 미노출 버그 (2026-04-20)

**참석:** 대표(임주용), 기획자 Agent, 구현자 Agent

**버그 리포트 (대표):**
> "에어스쿼트, 버피 이친구들은 왜 운동교체가 안뜰까여?"

**원인 진단:**
- [MasterPlanPreview.tsx:605](../src/components/plan/MasterPlanPreview.tsx#L605) 의 `canSwap = getAlternativeExercises(name).length > 0` 로직이 `LABELED_EXERCISE_POOLS` 이름 매칭에 의존. 매칭 실패 시 빈 배열 → `canSwap=false` → 교체 버튼 숨김.
- 서버 [functions/src/workoutEngine.ts:1251, 1276, 1529](../functions/src/workoutEngine.ts) 에는 "에어 스쿼트 (Air Squat)", "버피 (Burpees)", "스텝아웃 버피 (Step-out Burpees)" 등록.
- 클라이언트 [src/constants/workout.ts:246-259](../src/constants/workout.ts#L246-L259) 의 `LABELED_EXERCISE_POOLS` 에는 이 운동들 누락. 근력/머신 중심이라 **플라이오/맨몸 카디오 계열 카테고리 자체가 없었음**.
- 서버·클라이언트 풀 diff 결과 핵심 누락 76건 확인 (`/tmp/missing.txt`).

**수정 방향 (대표 승인, A+B+C 조합):**
1. **C. 플라이오 카테고리 신설** — 버피·점프 스쿼트·점핑잭·마운틴클라이머·하이니즈·스피드스케이터 등 HIIT/맨몸 카디오 13종을 "전신"(바벨/케틀벨 컴파운드 위주)에서 분리.
2. **A. 하체 보강** — 에어 스쿼트, 월 스쿼트, 힙 브릿지, 클램쉘, 리버스 런지 복수형 변형 추가.
3. **B. 기타 누락 동기화** — 코어(터키시 겟업, 케틀벨 암바/윈드밀, 데드버그 별칭, 베어 크롤), 등(스트레이트 암 풀다운, 시티드 로우 별칭).

**전신 아이콘 (대표 지시):**
- Figma Kenko UI Kit `node-id=74:2359` SVG 다운로드 → `public/icons/body/fullbody.svg`.
- [bodyIcon.ts:73-82](../src/components/plan/bodyIcon.ts#L73-L82) `GROUP_TO_ICON` 에 `"전신"`, `"플라이오"` 매핑 추가.

**파일 수정:**
- `src/constants/workout.ts` — `LABELED_EXERCISE_POOLS` (하체/등/코어 보강 + "플라이오" 신설)
- `src/components/plan/bodyIcon.ts` — GROUP_TO_ICON 전신·플라이오 매핑
- `public/icons/body/fullbody.svg` (신규, Figma에서 추출)

**남은 과제 (회의 64-δ-β):**
- 서버·클라이언트 풀 SSOT 분리 구조는 그대로 유지 (보안 설계, [cloud-functions.md](../.claude/rules/cloud-functions.md)). 재발 방지를 위해 CI 테스트로 "서버 풀 운동명은 클라이언트 풀에도 존재" 계약 강제하는 안 제안.

**빌드 검증:** `npm run build` 통과.

---

### 회의 64-γ: 모바일 백그라운드 복귀 시 운동 세션 유실 방지 (2026-04-20)

**참석:** 대표(임주용), 기획자 Agent, 구현자 Agent

**버그 리포트 (대표):**
> "모바일 환경에서 운동하다가 카톡같은게 와서 창을 숨겼다가 다시 띄우니깐 하던 운동이 새로고침되는 경우가 생겨서 기존 운동 내용이 날아가버리는데 이거 문제가 좀 있는데 방법이 있을까요?"

**원인 진단:**
- `WorkoutSession` 진행 상태(exercises/currentExerciseIndex/currentSet/logs/timings/sessionStart epoch/runningStats)가 전부 React state·ref만 보유. localStorage 백업 없음.
- `page.tsx`의 `beforeunload` 핸들러는 PC 새로고침 경고용일 뿐 모바일 백그라운드 discard에는 무력.
- iOS Safari / Android Chrome / 카톡·인스타 인앱 웹뷰가 메모리 압박 시 페이지를 discard → 복귀 시 새로고침 → `view="home_chat"` 초기화로 세션 소실.

**UX 방향 결정 (대표 지시):**
> "굳이 배너 노출 필요없이 계속 페이지 내 타이머나 시간 내용들은 진행되고 있다가 다시 돌아오면 될거같은데"

즉, "이어서 하기" 배너 없이 복귀 시 자동으로 운동 화면/타이머로 투명하게 복원.

**3가지 결정 (대표 승인):**
1. **러닝은 재개 버튼 필요** — GPS가 백그라운드에서 물리적으로 추적 불가. FitScreen `isPlaying` 기본값이 `false`이므로 페이지 재마운트 시 자동 일시정지 상태로 복귀 (별도 로직 불필요).
2. **플랜 미리보기도 복원 대상** — 편집 중이던 운동 배열을 snapshot에 같이 저장.
3. **12시간 TTL** — 어제 하다 만 세션이 오늘 유령처럼 뜨지 않도록 자동 폐기.

**구현:**
- **`src/utils/activeSessionPersistence.ts` (신규)** — snapshot schema + save/update/load/clear. 키: `ohunjal_active_session`, TTL 43,200,000ms, schema v1.
- **`WorkoutSession.tsx`** — `restoredProgress?` prop 추가 → 상태 hydrate. `sessionStartRef`를 복원된 epoch로 초기화해 경과 시간 재계산. state 변화 + `pagehide` + `visibilitychange(hidden)` 3중 플러시.
- **`MasterPlanPreview.tsx`** — `restoredExercises?` prop + `localExercises` 변화 시 `updateActiveSession` 패치.
- **`app/page.tsx`** — isInitialized 완료 후 1회 `loadActiveSession()` → view·sessionData·planSource·condition·goal·session·recommendedIntensity·progress·previewExercises 일괄 복원. view가 `master_plan_preview`/`workout_session` 일 때만 base snapshot 유지, 그 외 view 진입 시 `clearActiveSession()`.

**알려진 한계:**
- 러닝 중 GPS 누적 거리는 discard 시 소실(백그라운드 GPS 웹 불가). 완주된 러닝 세트의 `runningStats`만 보존. 카톡 짧게 답장하는 일반 케이스는 BFCache가 대부분 커버 → 이 경로는 BFCache 실패 시 안전망.

**파일 수정:**
- `src/utils/activeSessionPersistence.ts` (신규)
- `src/components/workout/WorkoutSession.tsx`
- `src/components/plan/MasterPlanPreview.tsx`
- `src/app/app/page.tsx`

**빌드 검증:** `npm run build` 통과. lint는 pre-existing `Date.now()` in `useRef` 패턴과 동일 계열만 감지됨 (신규 에러 없음).

---

### 회의 64-α: 러닝 리포트 Kenko 재디자인 스프린트 (2026-04-19 저녁)

**참석:** 대표(임주용), 기획자 Agent, 평가자 Agent

**레퍼런스:** Vitaly Rubtsov — Kenko Workout tracker (Dribbble/Behance)

**배경 (대표 요청):**
회의 64-XYZ 버그 수정 완료 후 러닝 리포트 UI가 여전히 "정보 나열"에 그쳐 감성적 임팩트가 약함. Kenko 디자인 언어로 3탭(오늘 폼/요약/다음) 전체 재디자인 요청.

**핵심 결정 (대표 지시):**
1. Variant A Activity Ring — 이번 주 카드의 주간 목표(20km) 대비 진행률
2. 오늘 폼 탭 하이브리드 — 육각형 레이더 유지 + Top 3 강점 Activity Ring 3개 추가 (설계만, 구현 보류)
3. colored container 최소화 — 타이포·구분선·여백으로 위계 전달 (배경 박스·뱃지 pill 제거)
4. Phase 2 (오늘 폼 탭) 스킵 — 대표 만족, 현 상태 유지

**기획자 SPEC:**
`.planning/DESIGN-RUNNING-REPORT-KENKO.md` (1107줄)
- 디자인 토큰 (typography scale, spacing, color, shape)
- ActivityRing 컴포넌트 + weeklyRunning 유틸 신설
- 3탭 11 카드 before/after ASCII mockup
- 각 카드 acceptance criteria + grep 검증 명령어

**구현 커밋 이력:**
- `a1c261c` Phase 0: ActivityRing + weeklyRunning + SPEC
- `d261a21` Phase 1.1: Hero 카드
- `1c71726` Phase 1.2: Interval Breakdown 미니 바
- `befb608`/`4a43e4d`/`6939181`/`b1b1b87`/`4d3a06e`/`0c3e38a`/`9e2e285`/`46ede35`/`13b2683`/`43856c4`/`906eee8`/`98d9ca5`/`f580aaf`/`449ae4d` Phase 1.3: TT 카드 (많은 iteration — 3-분할 vs 중앙정렬 vs 좌측정렬 ping-pong, 최종 grid-cols-3 + border-r)
- `ecf08be` Phase 1.4: KM 스플릿 (amber 제거)
- `4722d1d` Phase 1.5: 이번주 Activity Ring (Variant A)
- `fc37954` Phase 3: 다음 탭 (퀘스트 카드 emerald 톤 통일)

**대표 승인 결정:**
- ✅ 요약 탭 5카드 Phase 1 승인 ("이제 됐어! 딱 맘에드네")
- ⏭ Phase 2 (오늘 폼 탭) 스킵 결정
- ✅ 다음 탭 Phase 3 승인 ("오케이 좋아")

**확정된 Kenko 디자인 원칙 (향후 다른 탭 리디자인 시 재사용):**
1. 카드: `rounded-3xl border border-gray-100 shadow-sm px-6 py-7`
2. 라벨: `text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]`
3. 숫자: `text-3xl font-black text-[#1B4332] leading-none tabular-nums`
4. 3분할: `grid grid-cols-3` + `border-r border-gray-100` (last 제외) — 완벽 중앙 정렬 + 오버플로우 방지
5. 구분선: `border-t border-gray-100` (h-px bg- 관행 폐기)
6. 컬러 규칙: emerald 단일 톤 + opacity 변화 (100/60/35), amber는 경고 전용, red/blue 사용 금지
7. colored container 금지 — 타이포 위계 + 구분선만으로 표현

**미해결·이월 과제:**
- 오늘 폼 탭 (피트니스 나이 + 육각형 + Top 3 강점 Ring 하이브리드) — Phase 2 보류
- Weekly Quest Ring (다음 탭 상단에 ActivityRing 추가) — SPEC만, 미구현
- TT 카드 v2 추이 차트 (회의 64-Y Q4 이후 이월)

**Lessons learned:**
- Kenko = 대형 hero 숫자가 전부 아님. 아이콘 anchor + 밀도 있는 그리드 + 타이포 위계.
- `flex + gap + flex-1`은 좁은 폰 프레임에서 `tabular-nums` 와이드 숫자 + 큰 폰트 조합 시 오버플로우. `grid grid-cols-3 + border-r`이 안전.
- colored container는 Kenko 철학 반대. 배경 박스·pill 뱃지 사용 시 항상 재점검.
- 디자인 반복은 대표 피드백 1~2번으로 정리. 3번 이상 ping-pong 시 디자인 원칙을 먼저 재합의해야 함.

---

### 회의 64-XYZ: 러닝 리포트 3대 버그 수정 스프린트 (2026-04-19)

**참석:** 대표(임주용), 기획자 Agent, 평가자 Agent, 러닝 자문단(Seiler/San Millán/Ferber/Esteve-Lanao/Canova/Sang/사내코치), 사내 러닝코치(서브3)

**배경 (대표 실측 보고):**
대표가 "10k 50분 돌파" 프로그램 1회차 세션(2km 전력 러닝 + 워밍업/쿨다운) 실행 후 리포트에서 3가지 문제 발견:
1. 내 플랜에서 1회차 세션이 완료 마크 안 뜸, 2회차로 자동 진행 안 됨
2. 러닝 완료했는데도 "30대 남성 100명 중" 체력 축이 "-", 피트니스 나이 미표시
3. "SPRINT INTERVAL" 카드 제목이 인터벌 아닌 연속 TT에 표시됨. "9m 27s elapsed" 표현 어색. 연속 주행에서 거리 목표 도달 신호 없음 (수동 완료만 가능)

**조사 결과 (평가자 직접 코드 읽기):**
- Issue 1: `SavedPlan.completedAt` 필드·`markSessionCompleted` 함수·MyPlans 체크마크 UI 전부 존재. 문제는 `page.tsx:999` onComplete에서 `markSessionCompleted` 호출 누락
- Issue 2: `StatusTab.tsx:66-68`에서 cardio 축이 하드코딩 `hasData:false` 반환. 주석에 "runningStats 전달 안 되어 일단 false" — 미완성 코드
- Issue 3: "2km 전력(2K All-out)"이 `runningProgram.ts:376`에서 `runType: "sprint"`로 태깅됨. 연속 주행 useEffect(`FitScreen.tsx:570-592`)에 거리 도달 감지 로직 없음 (인터벌 모드에만 있음)

**자문단 소환 내역 + 출처 (source-grounded opinions 원칙):**
- **회의 64-X (체력 축 반영)**: Esteve-Lanao [PubMed 23752040](https://pubmed.ncbi.nlm.nih.gov/23752040/) (recreational 10주 RCT 5% 개선) / San Millán [Peter Attia #201](https://peterattiamd.com/inigosanmillan2/) (1회 페이스 퍼센타일 반대) / Ferber [McCaig UCalgary](https://mccaig.ucalgary.ca/ferber) (웨어러블 다회 평균) / 사내 코치
- **회의 64-Y (runType 재분류)**: Seiler [PubMed 20861519](https://pubmed.ncbi.nlm.nih.gov/20861519/) (2km all-out = Z3 race-simulation test, interval 아님) / Canova [Running Writings](https://runningwritings.com/2023/07/renato-canova-marathon-training-lecture.html) (control test / verifica 개념) / Sang [World Athletics](https://worldathletics.org/news/feature/patrick-sang-distance-running-coach-kenya-kipchoge-kamworor-kipyegon) (직접 TT 출처 미확보 — 추정 꼬리표)
- **만장일치 경계**: San Millán "1회 페이스 퍼센타일 반대" 이견 기록. 잠정/확정 2단계 표시로 부분 수용.

**대표 확정 9개 결정:**

| 회의 | Q | 결정 | 근거 |
|---|---|---|---|
| 64-X | Q1 | A — 1회부터 잠정 퍼센타일 표시 (회색 틴트 + "3회 후 확정" 마이크로카피) | UX: 1회 뛰었는데 반영 없으면 이탈 |
| 64-X | Q2 | D — 3회 OR 2주 경과 (먼저 도달한 쪽) | Esteve-Lanao 10주 유의변화 + UX 속도 트레이드오프 |
| 64-X | Q3 | A — 1km 이상 러닝 반영 (2km→1km 완화) | 초보 러너 실내 러닝머신 우호 |
| 64-X | Q4 | A — 인터벌(walkrun/vo2_interval/sprint_interval) cardio 배제 유지 | 왜곡 방지, v2로 전력 구간만 반영 이월 |
| 64-X | Q5 | A — 러닝 단독 시 피트니스 나이 "체력축만 계산됨" amber 경고 | 투명성 + 다른 운동 동기부여 |
| 64-Y | Q1 | A — 과거 Firestore 데이터 소급 재태깅 | 일관성 우선 |
| 64-Y | Q2 | 동의 — fartlek → vo2_interval (Norwegian 4×4는 fartlek 아님, Canova 근거) | 과학 용어 정확성 |
| 64-Y | Q3 | B — Bakken 2x15 threshold 카드는 전체 평균만 (2블록 시각화 skip) | MVP 단순 유지 |
| 64-Y | Q4 | A — TT 카드 v1 = PR 뱃지 + 목표 대비 차이 한 줄만 | 첫 TT는 기준선, 추이 차트는 v2 |
| 64-Z | — | B 변형 — 신호(종소리+진동+뱃지) + 완료버튼 펄스, 자동 종료 X | 트레이너 관점: 쿨다운 조깅 유연성 |

**runType 8종 재분류 (6종 → 8종):**
walkrun / easy / long / tempo / threshold(신규) / vo2_interval(fartlek 개명) / sprint_interval(sprint 세분화) / time_trial(sprint 세분화)

**구현 실행 구조 (기획자 + 평가자 교차 검증):**
- 기획자 Agent: `.planning/SPEC-64-XYZ.md` 작성 (5개 Batch, 파일별 구체 변경 + AC + grep 검증 명령)
- 구현자: Batch A→B→C→D→E 순서 atomic commit
- 평가자 Agent: 각 Batch 완료 시 코드 직접 읽고 AC 검증 + 스펙 외 변경 감지

**커밋 이력:**
- `221a7e5` fix: 장기 프로그램 세션 완료 표시 + 러닝 리포트 시간 라벨 한글화 (이슈 1 + 3-2 즉시분)
- `963477b` feat: 연속 주행 거리 목표 달성 자동 신호 (Batch A, 회의 64-Z)
- `19a0267` feat: runType 6종 → 8종 재분류 + 서버 태깅 (Batch B, 회의 64-Y)
- `e2fa940` feat: Firestore 과거 runType 소급 재태깅 admin 함수 (Batch C, 회의 64-Y)
- `2643a0e` feat: 러닝 리포트 카드 레이아웃 8종 분기 + Time Trial v1 카드 (Batch D, 회의 64-Y)
- `86b0de3` feat: 러닝 → 체력 축 연결 + 잠정/확정 상태 UX (Batch E, 회의 64-X)

**모든 Batch 평가자 PASS:**
- Batch A: 9/9 AC 통과
- Batch B: 14/14 AC 통과
- Batch C: 7/7 AC 통과
- Batch D: 10/10 AC 통과
- Batch E: 11/11 AC 통과

**배포 순서 (대표 수행):**
1. `git push` (클라 Batch A, D, E 자동 배포)
2. `cd functions && firebase deploy --only functions` (Batch B 서버 태깅 + Batch C 마이그 함수)
3. 마이그레이션 실행 순서:
   - `curl -X POST .../api/adminMigrateRunTypeV2 -H "Authorization: Bearer <token>" -d '{"dryRun":true}'` → 보고서 확인
   - 확인 후 `dryRun:false`로 실행
4. Firestore 랜덤 샘플 3건 확인 → 과거 "sprint" 레코드가 time_trial/vo2_interval/sprint_interval로 올바르게 분기되었는지

**미해결·이월 과제:**
- Sang TT 직접 인용 확보 (worldathletics 피처에 Kipchoge 매주 TT 언급만, 명명법 불명)
- 400m(~75초) sprint vs vo2 경계선 (미검증, 현재 vo2_interval로 분류)
- Norwegian 4×4 paceGuide가 threshold면 실질 threshold_interval (단일 태그 부족 가능)
- PACE_TABLE 30대 남성 50th=6:45/km가 한국 아마추어 분포 대비 적절한지 실증 없음 (90일 후 자사 데이터 재보정 마일스톤)
- TT 카드 v2: 이전 3회 추이 차트
- Threshold 2x15 세션 2블록 시각화 (v2 이월)
- Ferber 웨어러블 단일 세션 신뢰도 공개 출처 미확보

**Q 이벤트는 별도 파일로 문서화됨:** `.planning/SPEC-64-XYZ.md` (기획자 초안, 평가자 검증 기반)

---

### 회의 63-A: GA funnel source 분리 + 평가자 편향 감사 (2026-04-18 저녁)

**참석:** 대표, 기획자, 평가자, David Skok, Sarah Friar, Patrick Campbell, Tomasz Tunguz, 황보현우

**배경 (회의 63 배포 직후 실측):**
- 30일 GA 실측: chat_plan_generated=17, workout_start=204, workout_complete=82
- 비율 1200% (start/plan_generated), 482% (complete/plan_generated) — funnel 붕괴
- 원인: `workout_start` 가 저장 플랜 재실행 · 프로그램 세션 · 이전 플랜 이어서 등 **모든 세션 진입**에서 발화 ([WorkoutSession.tsx:57](src/components/workout/WorkoutSession.tsx#L57))

**평가자 감사 — 제시안 편향 6건 발견 ([feedback_source_grounded_opinions.md](~/memory/feedback_source_grounded_opinions.md) 메모리 채택 촉발):**
1. 자문단 만장일치로 Option B 찬성 → Tunguz "표본 < 100 → 측정 정교화 ROI 낮음" 반대 의견 탈락
2. "업계 평균 완주율 15~25%" 등 근거 없는 수치 3건
3. BigQuery Export 대안 미검토 (코드 편향)
4. "구현 30분" 과소 추정 → 실측 2시간
5. source 5종 스펙을 황보현우 귀속시킴 (실제 본인 설계)
6. Skok "12x reuse rate" 순환논리 (측정 불가한 수치를 분석 결과로 표현)

**대표 결정 (정직성 > 설득력):**
- `feedback_source_grounded_opinions.md` 메모리 영구 기록 — 향후 의견/자문단 발언은 출처·프레임워크 근거 명시 의무
- Option B 진행 결정 (편향 인정 후)

**Option B 구현 — 코드 기반 source 4종 (진입점 전수 조사):**

| source | 트리거 진입점 | 의미 |
|---|---|---|
| `chat` | [page.tsx:584](src/app/app/page.tsx#L584), [:695](src/app/app/page.tsx#L695), [:1280](src/app/app/page.tsx#L1280) | ChatHome / AdviceCard / 로딩 오버레이 완료 — 신규 AI 플랜 |
| `saved` | [page.tsx:1078](src/app/app/page.tsx#L1078) `plan.programId` 없음 | 저장된 단일 플랜 재실행 |
| `program` | [page.tsx:1078](src/app/app/page.tsx#L1078) `plan.programId` 있음 | 장기 프로그램 세션 (프리미엄) |
| `resume` | [page.tsx:1159](src/app/app/page.tsx#L1159) onResumeLastPlan | 홈 "이전 플랜 이어서" 버튼 |

**태깅된 이벤트 (6종):**
- `plan_preview_view`, `plan_preview_start`, `plan_preview_reject`
- `workout_start`, `workout_complete`, `workout_abandon`

**Backend 쿼리 재구조 ([analyticsFunnel.ts](functions/src/admin/analyticsFunnel.ts)):**
- `runEventCountBySource` 신규 — eventName × customEvent:source 이중 그룹핑
- `acquisition` (source=chat): 신규 플랜 → 운동 완료 전환 (Campbell "AI 가치 측정")
- `retention` (source=saved+program): 저장 플랜 재실행 볼륨 + 완주율 (Skok "리텐션 KPI")
- `aggregate` (전체): backward compat + 비교용
- 표본 < 100 → `lowSample: true` 플래그 (Tunguz 권고)
- source 맞춤 측정기준 미등록 시 → `sourceSplitError` 응답 → UI 안내

**Admin UI 4섹션 ([src/app/admin/page.tsx](src/app/admin/page.tsx)):**
- ① 획득 funnel (source=chat) + lowSample 경고
- ② 리텐션 (source=saved+program) + 전체 대비 비중
- ③ 후킹 효과 (회의 62) + lowSample 경고
- ④ 페이월 트리거 분포

**배포 전 대표 세팅:**
1. GA4 관리 > 맞춤 정의 > 맞춤 측정기준 만들기:
   - 이름: `source`, 범위: `이벤트`, 매개변수: `source` (24~48h 데이터 수집 필요)
2. `cd functions && firebase deploy --only functions`

**빌드 검증:** `functions npm run build` ✓ · 루트 `tsc --noEmit` ✓

**자문단 합의 지표 컷오프 (참고용 — 표본 충분 후):**
- 획득 funnel plan → complete: 업계 참고 없음 (추정), 자체 베이스라인 설정 예정
- 리텐션 완주율: 저장 플랜이라 base가 높을 것 — 자체 트렌드 추적
- 표본 100건 채우기 전엔 A/B 결론 보류 (Tunguz 원본 권고)

**후속 과제:**
- 맞춤 측정기준 등록 후 24~48h 대기 → 획득/리텐션 분리 데이터 확보
- 100건 표본 누적 시 재해석 회의 (회의 63-B 예상)

---

### 회의 63: Admin 대시보드 메트릭 정합성 감사 (2026-04-18 PM)

**참석:** 대표(임주용), 기획자, 평가자, 백엔드, Sarah Friar, David Skok, Patrick Campbell, Tomasz Tunguz, 황보현우

**배경:**
- 회의 62 (당일 오전) 후킹 재설계 후 "효과 정량 검증 수단" 필요
- admin 대시보드는 매출·구독 Firestore 기반으로만 동작 — GA funnel 지표 全無
- 메트릭 명칭·분모 정의의 개념적 오류 4건 지적 (자문단)

**평가자 발견 (코드 검증):**
1. `trial` 세그먼트 테이블 분모 = `isAnonymous` Auth 유저 ≈ 모든 `/app` 방문자 (signInAnonymously 자동 발화 [page.tsx:450](src/app/app/page.tsx#L450)). 봇/재방문 로그아웃 유저 포함 → 과대 집계
2. CVR 분모가 위와 동일 → 업계 벤치마크 비교 불가 (Tunguz)
3. "LTV" 표시값은 사실상 "ARPU 누적" (코호트 아님) — Campbell 레이블 교정 지시
4. "Churn" 누적 기준 (해지+만료)/(전체 구독 이력) — 월간 Churn 아님 (Skok)
5. 신규 이벤트 `chat_home_initial_*` 3종은 GA4로만 전송, admin 0 연동

**결정 (대표 승인, 전체 진행):**

| 우선순위 | 조치 | 진행 상태 |
|---|---|---|
| P0 | 라벨 정정: "LTV" → "ARPU 누적 (보수)", Churn "월간 아님" 명시, 세그먼트 주석 | ✓ |
| Q3-B | `trial` 세그먼트를 **`trial_ips`(실제 플랜 시도 IP) SSOT**로 재정의 + CVR 분모 교체 | ✓ |
| P1 | GA4 Data API 연동 Cloud Function `adminAnalyticsFunnel` + admin 카드 3종 (차별성/후킹/페이월 트리거) | ✓ |
| P2 | 월별 추이 6개월 (신규가입/신규결제/매출/해지) + 바차트 | ✓ |

**구현:**

| 항목 | 파일 |
|---|---|
| trial 재정의 + CVR 분모 교체 | [functions/src/admin/admin.ts:381](functions/src/admin/admin.ts#L381) (trialIpRecords), [:528](functions/src/admin/admin.ts#L528) (trialCount) |
| 월별 타임라인 집계 | [functions/src/admin/admin.ts:521-585](functions/src/admin/admin.ts#L521-L585) |
| GA4 Funnel Cloud Function 신설 | [functions/src/admin/analyticsFunnel.ts](functions/src/admin/analyticsFunnel.ts) (신규) |
| Firebase rewrite 추가 | [firebase.json](firebase.json) `/api/adminAnalyticsFunnel` |
| 라벨 정정 + 월간 추이 카드 + GA funnel 카드 | [src/app/admin/page.tsx](src/app/admin/page.tsx) |
| package.json 의존성 | `@google-analytics/data@^5.1.0` 추가 |

**배포 전 대표가 직접 세팅해야 하는 것 (P1):**
1. GA4 속성 ID 확인 (관리 > 속성 설정)
2. `.env` 또는 Cloud Functions 환경변수: `GA_PROPERTY_ID=<속성ID>`
3. GA4 관리 > 속성 액세스 관리 > Cloud Functions 기본 서비스 계정 (`<project>@appspot.gserviceaccount.com`) "뷰어" 권한 부여
4. `cd functions && npm install && firebase deploy --only functions`
5. 설정 미완 시 admin 카드는 "⚙ 설정이 필요합니다" 안내 자동 표시

**빌드 검증:**
- 루트 `npx tsc --noEmit` ✓
- `functions && npm run build` ✓
- `npm run lint` — 수정 파일 0 에러 (pre-existing 경고만 잔존)

**후속 과제 (회의 63 잔여):**
- 월간 gross/net MRR Churn (현재는 updatedAt 근사 — 정확한 event timestamp 스키마 설계 필요)
- 코호트 리텐션 히트맵 (월별 가입 코호트 → N일 후 결제율)
- 표본 크기 충족 시점 체크 (황보현우) — 현재는 데이터량 부족으로 노이즈

**자문단 합의사항 (다음 review 기준):**
- Skok: CAC 측정 인프라(광고 채널별 가입 귀속) 필요 — 현재 인스타 광고 ROI 블랙박스
- Friar: 차별성 KPI (plan→complete) 업계 30%+ 수준이면 가격 인상 재검토 가능
- Campbell: 6,900원 가격 재검증은 결제 샘플 100건 이후 (현재 1건)
- Tunguz: trial→paid 0.2% → 2%까지가 1차 목표 (업계 B2C 앱 평균 2~5%)

---

### 회의 62: 비로그인 첫 진입 후킹 재설계 — 욕구 자극 시즌 카피 + 원클릭 CTA (2026-04-18)
**참석:** 대표(임주용), 기획자, 평가자, Nir Eyal, David Hershey, 박충환, Dan Ariely, Robert Cialdini, BJ Fogg, Amanda Askell, 카피라이터·MD·그로스

**배경 (GA 1차 진단에서 촉발):**
- 2026-04-18 `/admin` 데이터: 누적 체험 413, 가입 45, 결제 1건(₩6,900). 가입→결제 2.2%, 체험→결제 0.2% (업계 1/10~1/25)
- 로그인 유저 32명 중 **63% 0회 미시작·31% 1회만 사용·6%만 페이월 도달** — 결제 funnel 병목이 아니라 **재방문/첫 경험 병목**
- 인스타 광고 재개했으나 유입 전환 약함 — Leaky Bucket 문제 확인 (Skok)
- 대표 지시: "비로그인 후킹 문구로 채팅·플랜·운동까지 몰입시켜야"
- Hershey 원칙 채택: "선택을 유저에게 넘기는 AI는 검색창. AI가 골라주고 [시작] 1개."
- 대표 직관: "운동하고 싶지 않던 사람도 '해야겠다' 들도록. 여름→반팔→몸 드러남→체력 키우자" 사고 체인

**자문단 진단 (대표 사고 체인 해부):**
```
시즌 사실 → 시각화 → 자기 직시 → 긴박감 → 행동 결론(유저 스스로 도달)
```
- Cialdini Consistency: 유저 스스로 끄덕이면 이탈 30%↓
- Ariely 손실회피: "여름까지 N주" 희소성 + "몇 번의 기회"로 투영
- 박충환 Entice: 자존감 상처 없이 가능성으로 치환
- Fogg MAP: 30~50분 = Ability 높음 / 시즌 = Motivation 높음
- Askell 톤: 협박 X, 파트너 톤

**결정사항:**
1. **대상 재정의:** 로그인+이력 있는 유저는 이미 Phase 10 reasoning 작동 중 (문제 없음). 이번 개편은 **goal 없음 + 이력 없음** 유저(비로그인 체험 + 로그인 온보딩 미완) 한정
2. **카피 방향:** 하이브리드 (C-2+C-1) — 시즌 동적 countdown + AI 선제안 + 이유 1줄
3. **시간대 × 운동 매핑 (대표 트레이너 확정):**
   - 새벽(4~6시) → 맨몸 30분
   - 아침~낮(6~16시) → 하체 40분 (내부 50분, 기존 EXAMPLE_CHIPS 관행 동일)
   - 저녁(16~21시) → 홈트 30분
   - 밤(21시~4시) → 홈트 30분
   - **러닝은 기본값에서 제외**, 후속질문 칩의 "러닝도 가능" 경로로만 진입
4. **시즌 동적 계산:** `여름(7/1)까지 N주`, `반팔(5/15)까지 M주`, `남은 기회 = N×3회`. 매일 자동 갱신 → Scarcity 효과.
5. **7월 이후 시즌 전환:** 봄(3~6월) 외에는 중립 폴백 카피 — 시즌 2(여름 유지) 전환 로직은 **추후 별도 회의**로 이관 (TODO)
6. **UI 구조 (Hershey 원칙):** 초기 인사 아래 **CTA 카드 1개** + **후속질문 스타일 칩 4개** (`QuickFollowupList` 재사용, Gemini 호출 X, 룰베이스)
7. **기존 EXAMPLE_CHIPS** 비로그인 초기 화면에서 숨김 (CTA 카드와 역할 중복)
8. **Analytics 3개 이벤트 신설:** `chat_home_initial_greeting_shown` / `chat_home_initial_cta_click` / `chat_home_initial_followup_tap`

**확정 카피 (2026-04-18 기준, 시간대 = 아침~낮):**
```
여름까지 10주. 올여름 더 뜨거워진다는 예보예요.
반팔 매일 입는 날까지 4주 남았어요.

일주일 3번이면 30번의 기회 —
오늘이 그 중 첫 번째입니다.

AI 추천: 하체 40분
대근육부터 건드려야 체지방 태우는 속도가 제일 빨라요.

[오늘 추천 · 하체 40분]
[  바로 시작  ]

🔘 하체 말고 가슴   🔘 30분 말고 짧게
🔘 러닝도 가능해요  🔘 초보라 더 쉽게
```

**구현:**
| 파일 | 변경 |
|---|---|
| `src/utils/historyDigest.ts` | `buildInitialSuggestion()` + `pickByHour()` + `getSeasonCountdown()` + `InitialSuggestion` 타입 신설 |
| `src/components/dashboard/ChatHome.tsx` | `initialSuggestion` useMemo + CTA 카드 + `QuickFollowupList` 재사용 + `handleInitialStart` / `handleInitialFollowupTap` + 최초 노출 analytics + 기존 EXAMPLE_CHIPS 조건부 숨김 |
| `src/utils/analytics.ts` | FunnelEvent 타입에 3개 추가 |
| `src/locales/{ko,en}.json` | 신규 키 10개 (CTA 2개 + 후속질문 라벨 4개 + 후속질문 prompt 4개) |

**검증:**
- `npm run build` 통과 (TypeScript 0 에러)
- `availableTime: 40` 타입 위반 발견 → 시스템 표준 `30 | 50 | 90`에 맞춰 **UI 라벨 "하체 40분" + 내부 50분** 하드코딩 (기존 EXAMPLE_CHIPS 관행과 동일)
- 비로그인 `canSubmit` 가드 경로 유지 — 체험 소진 시 업그레이드 카드 자동 전환
- `UserCondition.bodyWeightKg` optional 확인 — 비로그인도 플랜 생성 가능

**후속 과제:**
- 1주 측정: `chat_home_initial_cta_click / chat_home_initial_greeting_shown` 비율 = CTA CTR
- 2주 측정: 이 개편 유저의 `workout_complete` 비율 vs 이전 코호트
- 광고 영상 ↔ 홈챗 첫 문장 문법 일관성 (광고 훅 ↔ "여름까지 10주" 정합 필요) — 후속 회의
- 시즌 2(7~8월) / 가을(9~11월) / 겨울(12~2월) 카피 추가 (별도 회의)

---

### 회의 62-A: 로그인·이력 유저로 CTA 구조 확장 (2026-04-18 당일 추가)
**참석:** 대표(임주용), 기획자, 평가자

**배경:**
- 회의 62 1차 구현은 비로그인·goal無 유저에만 CTA 카드 적용
- 대표 확인 후 추가 지시: "로그인 시에도 첫 화면에 비로그인 때처럼 적용. 단 히스토리 내역과 유저의 목표를 고려해서 추천. 후속질문도 똑같이."

**결정사항:**
1. **`buildInitialSuggestion` 범용 함수로 승격** — 매개변수 `(history, profile, locale)` 로 확장. 모든 유저 단일 경로.
2. **이력 기반 부위 교대** (아침~낮 6~16시만 적용):
   - 지난 운동 하체 → 오늘 **가슴 30분** 추천 ("지난번 하체 했으니, 오늘은 가슴으로 교대하면 회복이 좋아요.")
   - 지난 운동 가슴 → 오늘 **하체 40분** 추천
   - 기타(러닝·전신) → 시간대 기본 유지
3. **daysSince === 0 특수 케이스** — 오늘 이미 운동했으면 **가벼운 홈트 30분**으로 오버라이드 ("오늘 한 번 하셨으니, 가볍게 마무리 한 세트 어때요?")
4. **목표 기반 이유** (이력 無 + goal 有 케이스) — fat_loss/muscle_gain/endurance/health별 이유 카피 교체
5. **후속질문 첫 칩 동적화** — 현재 추천 부위에 따라:
   - 하체 추천 → "하체 말고 가슴"
   - 가슴 추천 → "가슴 말고 하체"
   - home_training(맨몸·홈트·가벼운 홈트) → "부위 운동 해볼게요"
6. **기존 `buildInitialGreeting` 경로는 dead code화** — 호출 안 됨. 후속 정리 TODO.
7. **closingLine 차별화** — 이력 있으면 "오늘이 그 중 한 번이에요", 없으면 "오늘이 그 중 첫 번째입니다"

**구현:**
| 파일 | 변경 |
|---|---|
| `src/utils/historyDigest.ts` | `buildInitialSuggestion` 시그니처 확장 (history, profile 추가), 이력/목표/daysSince===0 로직 분기, `InitialSuggestion.targetMuscle`에 "chest" 추가 |
| `src/components/dashboard/ChatHome.tsx` | useMemo 의존성 확장, 후속질문 1번 칩 동적 매핑 (switchItem) |
| `src/locales/{ko,en}.json` | switch_legs, switch_split 키 + 프롬프트 4개 추가 |

**검증:**
- `npm run build` 통과 (TypeScript 0 에러)
- 6개 시나리오 런쓰루 OK: 비로그인 / 로그인+goal+이력無 / 로그인+이력有(하체→가슴) / 로그인+이력有(가슴→하체) / daysSince===0 오늘 마무리 / 새벽·밤 홈트 고정

**후속 과제:**
- `buildInitialGreeting` dead code 제거 (별도 cleanup PR)
- 이력 3회차+ 유저에 "초보라 더 쉽게" 칩이 어색 → v3에서 "강도 더 세게"로 교체 고려

---

### 회의 61: 장기 플랜(3개월+) 연계 설계 (2026-04-17)
**참석:** 대표(임주용), Claude

**결정사항:**
1. **생성 방식 — 하이브리드:** Gemini가 주차별 프레임워크(목표, 부위 배분, 강도 프로그레션)만 생성 → 프레임워크를 `workoutEngine`에 넘겨 전체 세션(예: 12주×주3회=36세션) 상세 플랜 일괄 생성. Gemini 1회 + 룰엔진 12회(무료).
2. **UI — 홈챗 내 플랜 아이콘:** 채팅 입력창 영역에 내 플랜 아이콘 배치. 탭하면 저장된 장기 프로그램의 다음 회차(1/12, 2/12...)로 바로 연동.
3. **적응형 업데이트 없음:** 초기 설정대로 고수. 유저가 개별 플랜에서 직접 수정. 우리는 재조정 안 함.

**핵심 흐름:**
- 홈챗 "여름 다이어트 3개월" 입력 → Gemini 프레임워크 생성 → 유저 확인 → workoutEngine 12회분 생성 → 내 플랜에 프로그램 단위 저장 → 홈챗에서 다음 회차 바로 실행

**비용 구조:** 기존(매일 Gemini) 대비 12배 절감. 프레임워크 1회만 Gemini 사용.

**세션 수는 Gemini가 결정:**
- 프로그램 총 세션 수(N)는 고정값이 아님. Gemini가 유저 프로필(주당 운동 횟수, 목표, 기간)을 보고 결정 (예: 12주×3회=36, 8주×4회=32 등)
- 우리 시스템은 N이 뭐든 동적으로 처리 (`totalWeeks × sessionsPerWeek = N세션`)

**핵심 제약 — Gemini↔룰엔진 일치:**
- Gemini는 자유 텍스트 운동 설명이 아닌 **룰엔진 파라미터 형식**으로 12회분 출력 (sessionMode, targetMuscle, goal, availableTime, intensityOverride 등)
- 채팅에서 유저에게 보여주는 주차별 설명은 이 파라미터에서 파생
- 실제 플랜 생성은 `workoutEngine.generateAdaptiveWorkout()`에 파라미터 주입 → Gemini 설명과 룰엔진 결과 100% 일치 보장
- Gemini가 운동 종목을 직접 지정하지 않음 (룰엔진이 풀에서 선택)

**구현 상태:** Phase 1-4 완료, 실서버 테스트 2회 완료. 남은 작업:
- 비로그인 목업 데이터 3개 (Gemini 비용 0 체험)
- 무료 로그인 parseIntent 일 3회 제한
- 디버그 로깅 제거 (안정화 후)

**2차 테스트 결과 (2026-04-17):**
- sessionParams REQUIRED 격상 → 누락 해결 (5/5 → 5/5 제공)
- maxOutputTokens 8192→16384 → 40세션 잘림 방지
- runType 서버 자동 추론 → 러닝 세션 정상 라우팅
- push/pull 교대 수정 → 밀기/당기기 번갈아 생성
- 운동과학 가드레일 추가 (HIGH 3주 제한, 10% 볼륨 규칙)
- monthProgram 키 정규화 (month1/2/3, week1-4/5-8 유연 수용)

---

### 회의 60: 홈챗 UI 개선 + 인라인 업그레이드 카드 (마누스 벤치마크)
**참석:** 대표(임주용), 프로덕트, Nir Eyal (Hook Model 저자)
**일자:** 2026-04-16

**배경:**
- 마누스 AI UI 비교 결과 우리 홈챗 헤더·타이포가 ~130px 더 차지
- 하단 네비 탭 공간 이슈 → 대표 제안(상단 우측 이동) 검토 후 기존 스크롤 자동 숨김 유지 확정
- 채팅 내에서 구매 전환 유도도 필요 (페이월 모달 + 인라인 카드 병행)

**결정:**
1. **Phase 1 — 헤더/타이포 콤팩트화**
   - 운 로고 28px → 24px, "AI 코치 / 온라인" 2줄 → "오운잘 AI" 1줄
   - 상태 pill 4종: `무료 N/N` / `체험 N/N` / `프리미엄` / `무료 완료`
   - 남은 횟수 ≤ 1일 때 amber 경고색
   - 메시지 gap `mt-3` → `mt-2`, `leading-relaxed` → `leading-[1.55]`
2. **하단 네비** — 대표 제안(상단 우측 이동) 기각, 기존 스크롤 자동 숨김 유지
   - 이유: 상단 우측 5개 아이콘은 엄지 리치 나쁨, 햄버거는 오버엔지니어링
3. **Phase 2 — 로딩 인라인 카드**
   - `의도 파악 중…` / `맞춤 플랜 짜는 중…` 마누스식 작업 카드
4. **Phase 3 — 후속 질문 칩**
   - 플랜 확인 카드 아래 4종: 강도 세게 / 다른 부위로 / 시간 줄여서 / 유산소 추가
   - 탭 시 입력창 자동 채우기 (재조정 유도)
5. **Phase 4 — 인라인 업그레이드 카드 (기존 모달 + 병행)**
   - 3 트리거: guest_exhausted / free_limit / high_value
   - 채팅 히스토리에 영구 남음 → 재방문 시 자연 리마인드
   - GA surface 파라미터로 모달 vs 인라인 전환율 A/B 측정

**커밋:**
- `d37f4c9` Phase 1 헤더/타이포 콤팩트화
- `e679e6e` Phase 2~4 로딩카드 + 후속질문칩 + 인라인 업그레이드

**다음 관찰 포인트 (2주 뒤):**
- `paywall_view { surface: "chat_inline" }` vs `surface: "modal"` 노출량 차이
- `paywall_tap_subscribe { source: "chat_inline" }` 전환률
- 후속 질문 칩 탭률 (chat_submit source 파라미터 추가 고려)
- high_value 트리거는 MVP에서 미발화 — parseIntent 응답 기반 감지 로직 Phase 5에서 추가

---

### 회의 59: GA4 이벤트 스키마 v2 정리 (chat-first 퍼널)
**참석:** 대표(임주용), 데이터 자문, 프로덕트
**일자:** 2026-04-16

**배경:**
- Phase 4에서 `condition_check`/메인 `Onboarding` ViewState 제거, chat-first 플로우 전환 완료
- 기존 GA 이벤트가 죽은 화면 기준으로 남아 퍼널 분석 불가
- ja/zh 랜딩 제거됐으나 sitemap/lang-check에 잔재

**발견 (audit 결과):**
- 🪦 죽은 이벤트: `condition_check_*` 4종 (정의만, 호출 0건)
- 🧟 오염 이벤트: `onboarding_start`가 로그인 시점에 발화 — 메인 온보딩 없는데 "온보딩" 이름으로 집계되어 해석 왜곡
- 🕳️ 핵심 구멍:
  - 랜딩 CTA 클릭 미추적 → 채널별 전환율 불가
  - ChatHome 제출 미추적 → 진짜 전환점 블라인드
  - `subscription_complete`에 value/currency/transaction_id 없음 → GA4 매출 리포트 작동 불가

**결정:**
1. v1 유령 이벤트 삭제, `onboarding_*` → `login` + `nutrition_onboarding_*`로 분리
2. GA4 표준 `purchase` 이벤트로 매출 추적 (KRW, transaction_id 포함)
3. `chat_submit`/`chat_plan_generated`/`chat_plan_failed` 배선이 다음 구현 최우선
4. `landing_cta_click` 랜딩 추적 신규
5. ja/zh 잔재(sitemap, lang 체크) 즉시 제거

**이번 커밋 완료:**
- sitemap.ts ja/zh 제거
- page.tsx lang 체크 ko/en만
- analytics.ts `FunnelEvent` 타입 재정의 (v2)
- 로그인 이벤트 분리 (`login`)
- 영양 온보딩 이벤트 재명명
- condition_check 유령 주석 3곳 수정
- [.planning/GA_EVENTS_v2.md](GA_EVENTS_v2.md) 스키마 문서 작성

**다음 티켓 (미배선):**
- `landing_cta_click` LandingContent
- `chat_submit`/`chat_plan_generated`/`chat_plan_failed` ChatHome + page.tsx
- `intensity_change`/`plan_regenerate` MasterPlanPreview
- `purchase` SubscriptionScreen (subscription_complete 교체)
- `report_view` 파라미터 확장

---

### 회의 56: 홈 vs 리포트 "내 상태" 일원화 + 네이밍 분리
**참석:** 대표(임주용), 기획자(PM), **박충환 교수 (USC Marshall)**, **Nir Eyal (Hook Model 저자)**, 데이터 자문, UX 디자이너, 트레이너, 현지화 전문가
**일자:** 2026-04-12

**배경:**
- 회의 54~55에서 발견: 홈화면과 리포트의 "내 상태"가 **다른 데이터 범위**를 쓰면서 **같은 이름**을 공유 → 수치 불일치 + 사용자 혼란
- 홈: 전체 히스토리 (cutoff 없음), 리포트: 최근 90일 + 오늘 세션
- 같은 사용자가 홈 66등, 리포트 72등 볼 수 있음

**3대 문제:**
- 🔴 P0: 수치 불일치 (사용자 혼란)
- 🟡 P1: "내 상태" 네이밍 모호 (오늘인가 누적인가)
- 🟡 P2: 갱신 주기 불투명

**전문가 논의 요약:**

| 역할 | 핵심 의견 |
|---|---|
| 박충환 교수 | "네이밍 분리 필수. 같은 이름 + 다른 값은 절대 금물. 두 의미를 각각 명시" |
| Nir Eyal | "홈은 최근 90일, 리포트는 더 좁게 (30일 이하). Variable Reward 빈도 높여야 Hook 유지" |
| 데이터 자문 | "단일 함수 + 범위 인자(options)로 리팩토링. 프로덕트 결정이 우선" |
| UX 디자이너 | "홈=자부심, 리포트=진전. 둘 다 필요. 이름만 다르면 해결" |
| 트레이너 | "홈=평생, 리포트=30일 분리 찬성. 현장 체감 우선" |

**대표 결정 (기존 제안보다 더 나은 구조 제시):**
- **홈화면** = 최근 90일 집약체 (실시간 계산, 오늘 시점 기준 90일)
- **리포트 "내 상태"** = **이번 세션의 운동 데이터만** 기반 (그날 프로그램 등수)
- **이름 분리 필요**

**중요 질문 — 히스토리 캡처 동작:**

Q: 과거 세션 리포트를 다시 열면 수치가 캡처인가 실시간인가?

A: **자동 캡처 효과** — 세션 데이터(`exercises`, `logs`)는 불변이므로, 리포트가 그 세션 데이터만 기반이면 언제 열어도 같은 결과. 별도 snapshot 저장 로직 불필요.

**현지화 전문가 패널 (라벨 선정):**
- `Today's Form` 영어권 오해 가능성 — "form"은 헬스 문맥에서 "자세/테크닉" 의미 우세
- 영어권 웨이트 유튜브/SNS 99% "form = technique"
- 권고: 영문은 `Form` 피하고 `Rank`/`Progress` 계열 사용

**최종 라벨 확정:**

| 화면 | 한국어 | 영어 |
|---|---|---|
| 홈화면 | 최근 90일 폼 | 90-Day Progress |
| 리포트 탭 | 오늘 폼 | Today's Rank |

**구현 설계:**
```typescript
// 단일 함수 + 범위 옵션 (데이터 자문 제안)
getCategoryBestBwRatio(exercises, logs, history, bw, {
  sessionOnly: true,  // 이번 세션만 (리포트용)
  rangeDays: 90,      // N일 내 필터 (홈용)
});
```

**구현 범위:**
- `src/utils/fitnessPercentile.ts` — options 인자 추가 (sessionOnly, rangeDays)
- `src/components/dashboard/HomeScreen.tsx` — `{ rangeDays: 90 }` + `getBestRunningPace(history, 90)`
- `src/components/report/tabs/StatusTab.tsx` — `{ sessionOnly: true }` + `recentHistory` prop 제거
- `src/components/report/WorkoutReport.tsx` — StatusTab 호출부에서 `recentHistory` 제거
- `src/locales/ko.json` / `en.json` — home.status.title, report.tab.status 업데이트
- `src/components/report/ReportHelpModal.tsx` — 측정 범위 안내 문구 추가

**자동 캡처 효과 (부가 혜택):**
- 과거 세션 리포트 재방문 시 → 그때 데이터 그대로 → 같은 결과
- 별도 스냅샷 저장 로직 불필요 (Firestore 쓰기 절약)

**남은 회의:**
- 회의 57: 구현 후 사용자 피드백 수집 + 기타 개선

**대표 최종 컨펌:** "A로" — 2026-04-12 (홈 90-Day Progress / 리포트 Today's Rank)

---

### 회의 55: 칼로리 로직 재설계 (EPOC + 볼륨 강도 + 활동 시간 + 밥공기 환산)
**참석:** 대표(임주용), 기획자(PM), **황지윤 박사 (임상영양사)**, **김진석 박사 (운동영양사, ISSN)**, 한체대 운동과학 교수, **박충환 교수 (USC Marshall)**, 트레이너
**일자:** 2026-04-12

**배경:**
- 사용자 피드백: "칼로리가 좀 낮은 거 같아요"
- 예시: 5500kg 볼륨 / 45분 / 75kg 남성 → 현재 275kcal
- 타 앱 벤치마크: Apple Watch 280~350, Fitbit 300~380, Garmin 350~420
- 사용자 성향 확정: **C (숫자 올리기)** + **ㄴ (성취감/동기부여 목적)**
- 목표 레퍼런스: 5500kg 세션 = **380~420 kcal** 수준 도달

**현재 로직 문제점:**
1. `MET × BW × 시간(휴식 포함)` → 활동 밀도 무시
2. 5분 미만 세션 45분 폴백 → 짧게 끝낸 세션 과대 추정
3. 볼륨 반영 안 됨 → 하드한 세션 보상 X
4. EPOC(운동 후 초과산소소비) 미반영 → 20%쯤 과소

**5인 전문가 입장:**

| 역할 | 의견 |
|---|---|
| 황지윤 박사 (임상영양사) | 과대 추정 경계. 380 이하 선호. 개인차 ±20% 면책 문구 필수 |
| 김진석 박사 (운동영양사) | EPOC 보정 × 1.15 + 볼륨 강도 보정 강력 추천. 380~420 동의 |
| 한체대 교수 | ACSM 순수성 관점 볼륨 보정 근거 약함. EPOC × 1.15는 문헌 지지 있음 (Schuenke 2002, Paoli 2012) |
| 박충환 교수 | 숫자보다 "해석"이 중요. 밥공기/초코파이 등 친숙한 환산 정보 필수 |
| 트레이너 | 현장 체감상 400kcal 근처가 감정적으로 맞음. 하드 세션은 500까지 |

**합의된 공식:**
```typescript
activityTimeH = totalDurationSec × 0.6 / 3600  // 휴식 40% 제외
baseKcal = MET × BW × activityTimeH  // 운동별 타이밍 있으면 정밀 계산

volumeIntensity = totalVolume / (BW × activityMin)
intensityMult = > 1.5  → 1.25  (고강도)
              : > 1.0  → 1.10  (중강도)
              : else   → 1.00  (저강도)

EPOC = 1.15  (근력 세션 후 48h 추가 소모)

kcal = baseKcal × intensityMult × EPOC
```

**폴백 정책 변경 (대표 지시):**
- 기존: 5분 미만 → 45분 폴백 → 10초 세션에도 300kcal 나옴 (부정직)
- 신규: 실제 기록 시간 우선 → 누락 시 세트 × 90초 추정 → 둘 다 없으면 0
- **"짧으면 그만큼 안 했으니 칼로리도 적게" 원칙**

**환산 단위 결정 (대표 지시):**
- 후보: 밥 / 초코파이 / 사과 / 맥주 / 전부 조합
- **선정: 햇반 일반공기 210g = 310 kcal 기준으로 단일화**
- 이유: 한국인 친숙도, 건강 관련성, 계산 단순성
- 기존 음식 pool (치킨/라면/떡볶이 등) 완전 제거

**시뮬레이션 — 75kg 남성:**

| 시나리오 | 볼륨 | 시간 | 기존 | 신규 | 변화 |
|---|---|---|---|---|---|
| 라이트 세션 | 2000kg | 30분 | 206 | ~200 | -3% |
| 중간 세션 | 4000kg | 40분 | 275 | ~332 | +21% |
| **목표 하드 세션** | **5500kg** | **45분** | **309** | **~428** | **+39%** |
| 초하드 세션 | 8000kg | 50분 | 344 | ~525 | +53% |
| 2분 끝난 세션 | - | 2분 | 309 (폴백) | ~13 (정직) | -96% |

환산 예: 428kcal ÷ 310 = 1.38 → **"밥 1.4공기 태웠어요"**

**구현 범위:**
- `src/utils/predictionUtils.ts` — calcSessionCalories 전면 재작성 + EPOC/ACTIVITY 상수
- `src/components/report/WorkoutReport.tsx` — 레거시 단순 공식 2곳 (line 215, 1350) → calcSessionCalories 통일
- `src/components/report/tabs/TodayTab.tsx` — FOOD_KO/FOOD_EN 풀 제거, RICE_BOWL_KCAL 상수 + `밥 N공기` 환산

**남은 회의 로드맵:**
- 회의 56: 홈 vs 리포트 "내 상태" 데이터 범위 불일치 일원화 + 네이밍 개선

**대표 최종 컨펌:** "네 진행해주세요!" — 2026-04-12

---

### 회의 54: 피트니스 등수 기준표 완화 + 팔 카테고리 통합
**참석:** 대표(임주용), 기획자(PM), 한체대 운동과학 교수, 트레이너(대표 겸임), 데이터 자문, **박충환 교수 (USC Marshall)**
**일자:** 2026-04-12

**배경:**
- 사용자 피드백: "피트니스 등수 측정치가 굉장히 타이트하게 되어있음"
- ACSM 기반 원본 PERCENTILE_TABLE이 엘리트 중심이라 일반인이 점수 올리기 힘듦
- 예: 30대 남자 가슴 50th = BW × 0.90 = 75kg 체중 기준 벤치 67.5kg 1RM → "헬스장 1년 꾸준히" 사람도 40~50점 초반 머무름
- 사용자가 ChatGPT 벤치마크 아닌 "일반 헬스인구 상대 평가"를 원함

**목표 설정 (사용자 컨펌):**
- 옵션 A 채택: "헬스장 1년 꾸준히 다닌 일반 성인" = 새 50th percentile 기준
- 점수가 올라가는 방향이므로 사용자 공지 불필요 ("올라가는건 설명 필요없음")

**팔 카테고리 이슈 — 사용자 추가 요구:**
- 기존: 팔 독립 카테고리 없음. 이두는 `back`에, 삼두는 `chest`에 섞여 있음
- 사용자 요구: 코어/어깨/팔을 크게 완화, 등/가슴/하체는 작게 완화
- 하지만 팔이 카테고리가 없어서 "팔만 완화" 불가능
- 사용자 제안: **"팔을 코어에 넣는 건 어떨까요?"**

**4인 전문가 패널 검토:**
| 역할 | 의견 |
|---|---|
| 운동과학 교수 | 생리학적으로 맞지 않음(체간 vs 상지). 단 사용자 이해가 목적이면 OK. 이름은 '코어'라 부르지 말 것 |
| 트레이너 | 찬성. 헬스장 사용자 입장에서 팔 점수가 따로 안 보이던 불편이 해소 |
| 데이터 자문 | 수치적으로 기존 core 표 재사용 가능. 바이셉 컬/트라이셉 푸쉬다운의 1RM BW ratio가 core 범위(0.3~0.6)에 자연스럽게 들어감. 테이블 재제작 불필요 |
| 박충환 교수 | 합치는 건 OK. 이름은 반드시 '코어 & 팔'로 명시. '코어' 라벨 유지 시 기대 불일치(expectation mismatch) 발생 |

**합의된 설계:**

1. **EASING_FACTORS 도입** (일반인 기준 완화):
```
chest    ×0.93  (7% 완화)
back     ×0.93  (7% 완화)
shoulder ×0.82  (18% 완화)
legs     ×0.93  (7% 완화)
core     ×0.80  (20% 완화)  ← 가장 크게
cardio   ×1.00  (유지, 페이스 별도 체계)
```

2. **팔 운동 재매핑:**
- 이두 (바벨 컬, 해머 컬, 덤벨 컬, 프리쳐 컬 등): `back` → `core`
- 삼두 (푸쉬다운, 스컬 크러셔, 킥백, 클로즈 그립 벤치 등): `chest` → `core`
- 플랭크/크런치/레그 레이즈는 기존 core 유지
- `getExerciseCategory` 폴백 순서 재조정: legs → **팔(core)** → chest → back → shoulder → core

3. **UI 라벨 변경:**
- 육각형 축 라벨: "코어" → **"코어 & 팔"** / "Core" → **"Core & Arms"**
- 대상 파일: `HomeScreen.tsx`, `StatusTab.tsx`, `ReportHelpModal.tsx`
- 내부 키(`core`)는 그대로 (코드 호환성 유지)

4. **원본 PERCENTILE_TABLE 보존:**
- raw 표는 건드리지 않고 lookup 시점에 easing 곱해서 threshold 조정
- 추후 easing만 조정하면 재복원 가능 (reversible)

**예상 결과 — 30대 남자 75kg 기준 50th:**
```
가슴:     0.90 → 0.837  (벤치 63kg 1RM)
등:       0.95 → 0.884  (로우 66kg 1RM)
어깨:     0.54 → 0.443  (OHP 33kg 1RM)
하체:     1.25 → 1.163  (스쿼트 87kg 1RM)
코어&팔:  0.52 → 0.416  (케이블크런치 31kg / 바이셉컬 31kg)
```

**핵심 인사이트:**
- 팔이 코어로 빠져나가서 등/가슴은 "순수 등/가슴"만 측정 → 완화 비율 크게 할 필요 없었음
- 구현 복잡도 최소화 (새 카테고리 추가 불필요, 6축 유지)

**구현 범위:**
- `src/utils/fitnessPercentile.ts`: EASING_FACTORS, bwRatioToPercentile, EXERCISE_CATEGORY_MAP 재매핑, getExerciseCategory 폴백 순서
- `src/components/dashboard/HomeScreen.tsx`: CATEGORY_LABELS.core
- `src/components/report/tabs/StatusTab.tsx`: CATEGORY_LABELS.core
- `src/components/report/ReportHelpModal.tsx`: 설명 문구

**남은 회의 로드맵:**
- 회의 55: 칼로리 로직 재설계 (영양사 + 운동영양사 참석 예정)
- 회의 56: 홈 vs 리포트 "내 상태" 데이터 범위 불일치 일원화 + "내 상태" 네이밍 개선

**대표 최종 컨펌:** "네 진행부탁드릴께요!" — 2026-04-12

---

### 회의 53: 게스트 체험 한도 버그 + 체험 라이프사이클 안내 설계
**참석:** 대표(임주용), 기획자, 평가자, 프론트엔드 개발자, 백엔드 개발자, UX/UI 디자이너, 콘텐츠 MD, 카피라이터, 그로스 마케터, **박충환 교수 (USC Marshall, Brand Admiration 3E)**, **Nir Eyal (Hook Model 저자)**, 페르소나 유저 4명
**일자:** 2026-04-11

**배경 (대표 직접 제보 + 실 유저 제보):**
- 무료 체험 IP 기반 제한은 있는데 한도 도달 시 유저에게 아무 알림 없음
- 실제 유저 "스미스_직장인"이 다른 브라우저로 재시도 → 콘솔 에러만 보고 이탈
- 근본 원인: generatePlan catch가 TRIAL_LIMIT 에러를 silently swallow

**평가자 전수조사 결과:**
- `GUEST_TRIAL_LIMIT`, `isGuest`, `planCount` 관련 UI가 HomeScreen/WorkoutReport/ConditionCheck/MasterPlanPreview **전부 0건**
- 닐슨 Usability Heuristic #1 "Visibility of System Status" 완전 위반

**Bug #1 원인:**
- `generatePlan` catch ([page.tsx:499-510](src/app/app/page.tsx#L499-L510))가 TRIAL_LIMIT 에러를 console.error + setView로 삼킴
- `handleConditionComplete` try/catch가 죽은 코드 → `setShowLoginModal(true)` 절대 호출 안 됨

**박충환 교수 진단 (Brand Admiration 3E):**
- Enable 80, Entice 50, **Enrich 20** — 치명적
- "유저가 '도구'로 인식, '브랜드'로 인식 못 함 → 결제 거부"
- "트라이얼 양은 잘못된 질문. 양 유지 + 3회/7회에 Enrich 모멘트"

**Nir Eyal 진단 (Hook Model):**
- Trigger ✓, Action ✓, Variable Reward ○, **Investment ❌**
- "양 유지 + 1회째부터 Investment 점진 축적"

**두 전문가 합의:**
- **7회 구조 유지** (게스트 3 + 로그인 4)
- "체험 종료" 언어 금지 → "완성/여정" 언어
- 3회째 페르소나 카드 + 7회째 Brand Admiration 카피 paywall

**김난도 교수 제외:** 대표 명시적 요청. 박충환 + Nir Eyal 2인 듀오로 대체. project_team_roster.md에 "소비 전략 자문단" 신설.

**구현된 것 (이 세션, P0 + P1 주요부):**

1. **Bug #1 수정** ([page.tsx:499-510](src/app/app/page.tsx#L499-L510))
   - generatePlan catch에 `if (e.message === "TRIAL_LIMIT") throw e;` 추가
   - handleConditionComplete catch 재활성화 → 로그인 모달 정상

2. **신규 유틸 2개**:
   - [src/utils/personaSystem.ts](src/utils/personaSystem.ts): 페르소나 4종 (power_builder / endurance_runner / balanced_athlete / rising_beginner) + `detectPersona()` 순수 함수
   - [src/utils/trialStatus.ts](src/utils/trialStatus.ts): 체험 상태 중앙 조회 (`getTrialStatus`, `getGuestTrialCount`)

3. **HomeScreen 체험 배지**: 도트 + "체험 1/3" 텍스트 + 단계별 문구 자동 전환

4. **WorkoutReport "오늘의 나" 카드**: 페르소나 catchphrase + 카운트 도트 + 마지막 1회 선제 고지

5. **로그인 모달 페르소나 카드화**: 3회 완료자에게 특별 모드 ("★ 3회 운동 완료 ★" + persona 이름/tagline + Brand Admiration 카피)

6. **SubscriptionScreen Brand Admiration 인트로**: status=free + 3회+ 시 표시 ("지금까지의 당신, X형이 완성되고 있어요")

**검증:**
- tsc: 0 errors
- lint (수정 파일): pre-existing warnings만, 신규 에러 0

**추가 구현 필요 (P2/P3, 다음 세션):**
- Nir Eyal Investment 질문 (1회째 목표 입력, 2회째 약속)
- 4~6회째 페르소나 진화 시각화
- 로그인 환영 토스트
- SVG 아이콘 4종 (페르소나 전용) — 디자인 자산

**대표 결정 요청 (다음 세션):**
- 페르소나 SVG 디자인 자산 방식
- 트랙 C Phase 1 (dual write) 통합 시점
- 4종 페르소나 이름/색상 최종 확정

---

### 회의 52: DA 전수조사 + 스키마 리팩토링 설계
**참석:** 대표(임주용), 기획자, 평가자, 이화식(엔코아), 박서진(Toss FE Head), 황보현우(한남대), 프론트엔드 개발자, 백엔드 개발자
**장기 출석(간접):** Thomas Davenport, Bill Inmon (DA 자문단)
**일자:** 2026-04-11

**배경:**
- 론칭 1일차, 유저 315명, 활성 ~50명, 유료 0명
- Firestore workout_history 문서에서 `totalDurationSec: 79초 / totalReps: 303회` 등 물리적으로 불가능한 데이터 발견
- 이화식 전문가가 "4개 엔티티가 한 문서에 혼재" 지적
- 대표님 판단: "유료 100명 이후 리팩토링"은 ROI 거꾸로 계산, 지금이 가장 싼 시점

**평가자 전수조사 주요 발견:**
1. Cloud Functions는 workout_history 건드리지 않음 → 백엔드 변경 0
2. Dual-source 아키텍처 이미 존재 (Firestore + localStorage)
3. 직접 localStorage 접근 19지점 × 7개 파일 → 접근 통일 필요
4. Service Worker network-first → 구버전 JS 캐시 위험 낮음
5. MasterPlanPreview는 handleIntensityChange/Regenerate로 unmount 안 됨 → abandon 이벤트는 명시적 exit path 발화로 가야 함 (unmount cleanup 부적절)
6. `saveWorkoutHistory`는 await 없이 fire-and-forget + 직후 localStorage 재읽기 → 취약 패턴
7. `stripUndefined`, 마이그레이션 유틸 이미 존재 → Strangler Fig에 재사용 가능

**결정:**
- 3개 트랙으로 분리 진행:
  - **트랙 A** (이벤트 보강): `condition_check_abandon`, `plan_preview_reject`, `setAnalyticsUserId`
  - **트랙 B** (접근 통일): 19지점을 `getCachedWorkoutHistory()` 등 유틸 경유로 + ESLint 규칙
  - **트랙 C** (스키마 분리): Strangler Fig 5단계로 workout_history → sessions + daily_snapshots + next_recommendations
- 각 트랙/Phase 후 대표님 체크포인트 → 버그 없음 확인 → 다음 진입
- Gemini 관여 범위 정정: 영양(getNutritionGuide, nutritionChat)만 Gemini, 운동 분석은 룰베이스

**장기 숙제 (본 리팩토링 이후):**
1. 서버사이드 stats 재계산 — 79초/303회 같은 조작 데이터 차단 (백엔드 개발자)
2. 사용자 피드백 루프 — 운동 완료 후 👍👎 (Davenport)
3. 코치 멘트 프롬프트 버전 실험 (Davenport)

**중요 이슈 기록:**
- Claude가 회의 도중 성급하게 구현 착수 → 대표님 지적 → 즉시 2개 파일 롤백 → 설계 회의부터 다시 시작
- 교훈: feedback_confirm_before_implement 메모리 준수 필요, 전체 그림 합의 후 실행

**메모리 업데이트:**
- `project_team_roster.md`에 "데이터 아키텍처 자문단" 섹션 신설 (이화식, Davenport, 황보현우, Inmon)

**상세:** .planning/da-refactor-design.md

---

### 회의 52 후속: 트랙 A 프로덕션 검증 + 트랙 C Step 3 완료
**참석:** 대표(임주용), 이화식, 황보현우, 평가자
**일자:** 2026-04-11

**트랙 A 프로덕션 검증 (실사이트 ohunjal.com/app, Chrome DevTools):**
- ✅ `setAnalyticsUserId` → GA4 `uid` 파라미터에 Firebase uid 전달 확인
  (예: `uid=jDkXqeAFCMgJj8cFbRZITpokS2H2`)
- ✅ `condition_check_abandon` + `ep.last_step=body_check` 발화 확인
- ✅ `plan_preview_reject` + `epn.exercise_count=12` 발화 확인
- ✅ 기존 이벤트(start/step/complete/view) regression 없음
- ✅ 트랙 B 접근 통일 — 모든 화면 정상 렌더, 콘솔 에러 0

**트랙 C Step 3 (transformToNewSchema 순수 유틸) 완료:**
- 신규 파일 3개: workoutV2.ts(타입), workoutHistoryV2.fixture.ts(0cFhit3 샘플 마스킹),
  workoutHistoryV2.ts(순수 변환 함수 + 14개 검증 케이스)
- 로컬 검증: 14/14 PASS (tsx로 실행)
- 주요 검증: dataQuality.isValid=false on 79초/303회 오염 데이터,
  logs Record→executions Array 변환, weight 문자열 숫자 정규화,
  reportTabs→session.reportSnapshot + dailySnapshot 분리
- 설계 문서 §5.1 Q2 정정 반영 (next_recommendations 컬렉션 폐기,
  reportSnapshot을 sessions 문서에 포함 — 기능 회귀 방지)

**중요 관찰 (황보현우):**
- BigQuery export가 어제 켜진 상태 + GA4 user_id 매핑 확보
- 24시간 후부터 "신규 유저 N3Q (7일 3회 운동 완료)" 같은 코호트 쿼리 가능
- 지금이 진짜 데이터 기반 의사결정 시작점

**다음 단계:**
- 트랙 C Phase 1 (dual write) 설계 세션 — 이화식 주도
- 기존 saveWorkoutHistory 등에 try-catch로 신규 스키마 병행 쓰기 추가
- Firestore security rules에 sessions/daily_snapshots 추가 필요

---

### 회의 51: 랜딩페이지 — 후킹/스토리/제안 전면 평가
**참석:** 대표(임주용), 기획자, UX 디자이너, 카피라이터, 그로스 마케터, 콘텐츠 MD, SEO 전문가, 프론트엔드 개발자, 평가자, 페르소나 유저 4명 (00-05 Gen Z)
**일자:** 2026-04-10

**현재 랜딩 평가:** 후킹 5.4 / 스토리 3.5 / 제안 4.6 (10점 만점)
**레퍼런스:** Whoop — 숫자 후킹, Sticky CTA, 미니멀, 결과 중심
**결정:** Whoop 스타일 4섹션 구조로 리디자인, /landing 경로에서 실험 후 교체
**상세:** .planning/landing-redesign-brief.md

---

### 회의 50: 랜딩 + 앱 진입 이탈 분석
**참석:** 기획자, UX 디자이너, 그로스 마케터, 카피라이터, 프론트엔드 개발자, 평가자
**일자:** 2026-04-10

**핵심 이탈:** 랜딩→/app 55%, /app→컨디션체크 43%, 플랜→운동시작 41%
**원인:** 영상 41MB, 12스크롤, CTA 5개, 정보 과부하
**게스트 전환:** 303명 중 7명만 로그인 전환 (2.3%)

---

### 회의 49: 퍼센타일 시스템 전면 보수 + 홈트 운동 풀 확장
**참석:** 대표(임주용), 한체대 교수, 운동생리학자, 국가대표 운동코치, 기획자, 프론트엔드 개발자, 백엔드 개발자, 평가자
**일자:** 2026-04-10

**발견된 문제 (총 8건):**
1. 현재 세션 맨몸 운동 weightUsed=0 스킵 → 퍼센타일 미반영
2. 맨몸 운동 14종 isBodyweightExercise 미등록
3. 홈트 모드 전 운동 "맨몸 또는 가벼운 무게" 일괄 설정 → 덤벨 운동도 무게 입력 불가
4. 중량 풀업/딥스에서 추가무게만 계산 (체중 미합산)
5. 핵 스쿼트 머신 보정 미적용
6. 랙 풀 카테고리 미등록 (120kg 기록 무시)
7. 어시스티드 풀업 100% → 50% (보조 운동)
8. 싱글암 덤벨로우, TRX 로우 정확매칭 누락

**수정 사항:**
- 맨몸 운동별 과학적 체중 환산 비율 (Suprak et al. 2011 기반)
- 서버: 홈트 운동별 장비 자동 판별 (Dumbbell/Kettlebell/Bodyweight)
- 홈트 운동 풀 22종→43종 대폭 확장
- 운동 요약 간결화 (세트 중복 제거)
- 바벨 루마니안→덤벨 루마니안 데드리프트 교체

**다음 세션:** 3000명 시뮬레이션으로 퍼센타일 전체 검증

---

### 회의 48: 결제/체험 보안 감사 + QA 검증
**참석:** 대표(임주용), 박서진(보안팀장), 기획자, 프론트엔드 개발자, 백엔드 개발자, 법무 자문, 평가자
**일자:** 2026-04-09

**보안 감사 (CRITICAL 1 + HIGH 3 + MEDIUM 5):**
- CRITICAL: 무료 플랜 제한 서버측 강제 (curl 우회 차단)
- HIGH: processing 상태 5분 TTL, 빌링키 fail-closed, paymentId 충돌 방지
- 서버 IP 기반 체험 제한 (localStorage 우회 차단)

**QA 검증 (HIGH 2 + MEDIUM 2):**
- HIGH: 로딩 오버레이 무한 폴링 → 최대 20회 제한
- HIGH: planCount 운동 시작 시점으로 이동
- MEDIUM: refundStep/cancelStep 오버레이 상호 배제
- MEDIUM: 게스트 체험 카운트 서버/클라이언트 동기화

**CRITICAL 버그 수정:**
- HomeScreen nutritionProps useMemo가 early return 아래에 있어 hooks 순서 에러
- 게스트 첫 운동 후 홈 복귀 시 앱 전체 흰색 크래시 → 초기 유저 이탈 원인이었을 가능성

---

### 회의 47: GA4 데이터 분석 — 이탈 퍼널 + 게스트 추적
**참석:** 대표(임주용), 기획자, 데이터 분석 전문가, 그로스 마케터, UX 디자이너, 평가자
**일자:** 2026-04-09

**핵심 발견:**
1. 78.7% 유저가 컨디션체크 시작도 안 하고 이탈 (268→57명)
2. 게스트 vs 로그인 추적 이벤트 전무 — 무료체험 이탈 비율 측정 불가
3. 퍼널 이벤트 4개(plan_preview~workout_complete) 정상 발화 확인
4. 마스터플랜 와우: "왜 이 운동인지" 설명 + 예상 소요시간 부재

**구현:**
- guest_to_login, guest_trial_exhausted, login_modal_view 이벤트 3종 추가
- 1-2주 데이터 수집 후 게스트 이탈 패턴 분석 예정

**다음 세션 안건:**
- 1단계 이탈 개선 (방문→컨디션체크 21%→40% 목표)
- 마스터플랜 와우 강화 (운동 선택 이유 + 예상 소요시간)

---

### 회의 46: 카카오페이 환불 처리 + 결제 보안 강화
**참석:** 대표(임주용), 기획자, 박서진(FE Head), 프론트엔드 개발자, 백엔드 개발자, 그로스 마케터, 카피라이터, UX 디자이너, 법무 자문, 평가자
**일자:** 2026-04-09

**결정 사항:**
1. 환불 기준: AI 운동 플랜 생성 1회 = 사용 (법적 적법 확인)
2. 환불 기간: 7일 유지, 전액 환불 or 환불 불가 (일할 차감 없음)
3. 환불 채널: 인앱 환불 문의 폼 (접수만) → 대표 검토 → 포트원 수동 처리
4. 인앱 환불 버튼(즉시 환불) 없음 — 문의 폼만

**구현 사항:**
1. Cloud Functions: `submitRefundRequest` (유저용), `adminRefundRequests` (어드민용)
2. Firestore: `refund_requests` 컬렉션 (uid, email, reason, status, paymentId, amount)
3. SubscriptionScreen: 취소 상태에서 "환불 문의" 폼 (사유 입력 → Firestore 접수)
4. Admin: 피드백 탭 추가 — 취소 피드백 + 환불 요청 목록 통합 조회

**QA 교차 검증 결과 (12건):**
- CRITICAL 1건: 빌링키 소유자 검증 미비 → 수정 완료 (PortOne API로 서버측 검증)
- HIGH 3건: expired 상태 미처리, 중복결제 가능성, 하드코딩 한국어 → 전부 수정
- MEDIUM 6건: 멱등성(sessionStorage), i18n 누락 등 → 주요 건 수정

---

### 회의 45: 운동 리포트 오늘 탭 — 감량 하이라이트 + 칼로리 정밀화
**참석:** 대표(임주용), 기획자, 한체대 교수, 트레이너, 러닝 코치, UX 디자이너, 콘텐츠 MD, 프론트엔드 개발자, 백엔드 개발자, 평가자
**일자:** 2026-04-08

**수정 사항:**
1. 칼로리 계산 3곳 통일 → `calcSessionCalories()` (운동 이름 기반 정밀 MET)
2. MET값 255+ 종목 전수 매핑 (고중량 5.5~6.0, 아이솔레이션 3.5~4.0, 맨몸 3.5~5.5, 머신 3.0~3.5, 코어 3.0~4.0, 러닝 6.0~10.0)
3. BMR 공식 Harris-Benedict → Mifflin-St Jeor 통일
4. 감량 하이라이트: 4주 칼로리 소모 추이 그래프 + 칼로리 판정 + 음식 비유
5. 그래프 제목 "오늘의 운동 평가", 오늘 점만 표시, 곡선 부드럽게
6. 히스토리 목표 고정: reportTabs에 goal 저장
7. 초기 로딩 화면 하단 emerald 물결 배경

---

### 회의 44: 1000명 시뮬 버그 헌팅
**참석:** 기획자, UX 디자이너, 프론트엔드 개발자, 백엔드 개발자, 평가자
**일자:** 2026-04-08

**방법:** 5개 에이전트 병렬 (200명씩) — 신규/마이그레이션/운동세션/프로필변경/공격
**결과:** 16개 버그 발견 + 전부 수정 (CRITICAL 1 + HIGH 2 + MEDIUM 10 + LOW 3)

---

### 회의 43: 모바일 /app 접속 에러 긴급 대응
**일자:** 2026-04-08
**원인:** style jsx 모바일 크래시 + Service Worker 구버전 캐시
**해결:** style jsx 제거, SW v1→v2, globals.css로 keyframes 이동

---

### 회의 42: cardio 퍼센타일 구현
**일자:** 2026-04-08
**결정:** 러닝 페이스 기반 (이지런/템포/장거리만, 2km+, 4주), 성별×연령별 기준표
**구현:** `getCardioPacePercentile()` + `getBestRunningPace()`, StatusTab + HomeScreen 적용

---

### 회의 40: 온보딩 + localStorage 리네이밍 + admin 취소 피드백
**일자:** 2026-04-08

**온보딩:** 7스텝 (안내→성별→출생연도→키→체중→목표→완료카드) + 휠피커 + 완료 후 ConditionCheck 직행
**리네이밍:** alpha_ → ohunjal_ 전면 교체 (19파일 165곳) + 기존 유저 마이그레이션
**기타:** admin 취소 피드백 탭, ConditionCheck energyLevel bodyPart 자동 추론, 입력값 범위 제한

---

### 회의 41: 온보딩 플로우 통합 설계 + 짐워크 벤치마크 분석
**참석:** 대표(임주용), 기획자, UX 디자이너, 프론트엔드 개발자, 백엔드 개발자, 트레이너, 한체대 교수, 콘텐츠 MD, 그로스 마케터, 퍼포먼스 마케터, 평가자, FE Head, 카피라이터
**일자:** 2026-04-08

**배경:** 프로필 입력이 ConditionCheck, FitnessReading, MyProfileTab 3곳에 분산되어 있고, HomeScreen "첫 운동" 화면이 온보딩 없이 노출됨.

**핵심 결정:**

1. **프로필 입력 통합** — 기존 3곳(ConditionCheck, FitnessReading, MyProfileTab) 분산 프로필 입력을 온보딩 1곳으로 통합
2. **온보딩 7스텝 확정** — 안내카드 → 성별(원탭) → 출생연도(휠피커) → 키(휠피커) → 체중(휠피커) → 목표(4택) → 완료카드
3. **HomeScreen "첫 운동" 중복 제거** — 온보딩 완료 유저는 isFirstVisit 화면 스킵
4. **온보딩 → condition_check 직행** — 완료카드에서 "첫 운동 시작하기" → 바로 컨디션체크
5. **energyLevel 자동 추론** — 항상 3이던 에너지 레벨을 bodyPart에서 자동 매핑 (full_fatigue→2, good→4, 나머지→3)
6. **localStorage 키 리네이밍** — alpha_ → ohunjal_ 전면 교체 (19파일 165곳) + 기존 유저 마이그레이션
7. **package.json** — "alphamale" → "ohunjal"
8. **admin 취소 피드백 탭** — Firestore cancel_feedbacks 조회 Cloud Function + admin 프론트 탭 추가
9. **입력값 범위 제한 통일** — 출생연도 1930~2015, 키 100~250cm, 체중 20~300kg, 1RM 0~500kg (MyProfileTab, ConditionCheck, FitnessReading 전부)
10. **온보딩 탭바 숨김** — 온보딩 중 BottomTabs 비노출

**카피 결정:**
- 웰컴: "{name}님, 반가워요!" + "진짜 내 운동을 시작할 시간!\n가볍게 답해서 나만의 핏을 찾아보세요"
- 성별: "성별이 어떻게 되세요?" + "성별에 따라 맞게 운동을 제공해요"
- 완료: "{name}님, 답변 감사해요" + "주신 정보와 {goal} 목적에 맞게 제가 도와드릴게요!" + "ACSM/NSCA 기반 운동 가이드라인과 200+ 최신 논문으로 학습했으니 트렌드에 맞게 확실하게 도와드릴게요!"
- 장기 목표 vs 세션 목표 구분 확정: 온보딩=장기목표(성장예측/리포트), ConditionCheck=세션목표(운동프로그램)

**구현 파일:**
- 신규: Onboarding.tsx, WheelPicker.tsx
- 수정: page.tsx, HomeScreen.tsx, ConditionCheck.tsx, FitnessReading.tsx, MyProfileTab.tsx, analytics.ts, ko.json, en.json, package.json, firebase.json, functions/src/admin/admin.ts, functions/src/index.ts, + localStorage 키 변경 19파일

---

### 회의 39: [다음] 탭 퀘스트 프로그레스바 + ACSM 강도 추천
**참석:** 대표(임주용), 기획자, UX 디자이너, 프론트엔드 개발자, 백엔드 개발자, 트레이너, 한체대 교수, 콘텐츠 MD, 그로스 마케터, 퍼포먼스 마케터, 평가자, FE Head
**일자:** 2026-04-07

**배경:** [다음] 탭이 "오늘 잘했어요! 꾸준히 가세요" 폴백 메시지만 표시. 구체성 없음.

**결정:**
1. **퀘스트 시스템(ACSM 주간 강도 분배) 활용** — 고/중/저강도 주간 목표 프로그레스바
2. **부족한 강도 우선 추천** — "이번 주 고강도 0/2회 — 다음엔 빡세게!"
3. **무게 목표 추가** — 추천 부위의 마지막 기록에서 +2.5kg(남)/+1.25kg(여)
4. **이번 주 기록** — recentHistory 기반 요일별 표시 + 강도 태그(색상별)
5. **todayBodyPart null 해결** — sessionDesc/exercises에서 부위 자동 추출
6. **reportTabs에 questProgress 저장** — 히스토리에서 그때 시점 데이터 표시

**구현 파일:** NextTab.tsx, WorkoutReport.tsx, workout.ts (타입)

---

### 회의 38-2: 리포트 리디자인 추가 수정 사항 (회의 38 연장)
**일자:** 2026-04-07

**수정 내역:**

| 항목 | 내용 |
|------|------|
| [오늘] 4주 그래프 | LoadTimelineChart 디자인 동일 적용 (Y축/범례/점클릭/판정+설명) |
| [오늘] 보조 카드 | 전 항목 좌우 정렬 포맷 통일 |
| 피트니스 나이/등수 도움말 | 각각 별도 ? 버튼으로 분리 |
| 4주 그래프 도움말 | 계산 공식(Load Score = 볼륨/체중) 추가 |
| 운동과학데이터/로그 버튼 | proof 디자인과 통일 (회색 텍스트+화살표만) |
| 히스토리 4탭 누수 | 운동과학/로그가 다른 탭에서 보이던 버그 수정 |
| 영양 백그라운드 프리로드 | 리포트 열리자마자 Gemini 호출 + 자동 저장 |
| reportTabs 즉시 저장 | 완료 버튼 의존 제거 → useEffect로 즉시 |
| Firestore 동기화 | updateReportTabs() 함수 추가 |
| ShareCard | fixed z-200 (네비바 포함 전체 덮기) |
| 칼로리 음식 비유 | 100kcal 미만 비유 제거 |
| 웨이티드 푸쉬업 | 맨몸 판정 버그 수정 |
| MY탭 재배치 | Account → My Info → 환경설정 → 프리미엄 → 버그 → 로그아웃 |
| MY탭 목표 변경 | Body Info에 감량/근비대/체력/건강 4버튼 추가 |
| 덤벨 프리쳐 컬 | 영상 교체 |

---

### 회의 38: [오늘 운동] 탭 성별 고정 하이라이트 + 다음 스텝 분리 유지
**참석:** 대표(임주용), 기획자, UX 디자이너, 프론트엔드 개발자, 백엔드 개발자, 트레이너, 한체대 교수, 콘텐츠 MD, 그로스 마케터, 퍼포먼스 마케터, 평가자, 페르소나 유저 2명(22세 여대생, 34세 직장인 남성)
**일자:** 2026-04-07

**배경:** [오늘 운동] 탭 UI가 "-87%" 숫자 나열로 유저에게 아무 의미 전달 못함. 대표님 지시: 영양 탭/현재 상태 탭 수준의 직관성 필요.

**핵심 결정:**

1. **하이라이트 고정 구조 (매번 안 바뀜)** — 성별+목표별 다른 메인
2. **다음 스텝 탭 분리 유지 (4탭)** — 오늘 결과와 다음 조언은 다른 맥락
3. **성별이 기본, 목표가 오버라이드** — 감량 남성→칼로리 메인, 근비대 여성→볼륨 메인

**남성 고정 구조:**
- 메인: 4주 운동량 그래프 (기존 운동과학 데이터에서 승격)
- 보조: 부위·시간·세트 / 강도 해석 / 칼로리 / vs 지난번

**여성 고정 구조:**
- 메인: 칼로리 크게 + 음식 비유 (영양 탭 칼로리 카드 수준 디자인)
- 보조: 부위·시간·세트 / 강도 해석 / vs 지난번 / 4주 추이 한줄

**PR 뱃지:** 성별 공통, 최상단에 있을 때만 표시

**탭 이름:** 내 상태 / 오늘 / 다음 / 영양

---

### 회의 37: Workout Report 전면 리디자인 — "그래서 뭐?" 해결 + 4탭 구조
**참석:** 대표(임주용), 기획자, UX 디자이너, 프론트엔드 개발자, 백엔드 개발자, 프롬프트 전문가, 콘텐츠 MD, 그로스 마케터, 퍼포먼스 마케터, 평가자, 한체대 교수(운동생리학), 트레이너, 현지화 전문가, 국가직 건강운동 전문 영양사
**일자:** 2026-04-07

**배경:** 대표님 질타 — ChatGPT에 한 줄 치면 현재상태/칼로리/식단/프로그램/주의사항 한방에 나오는데, 우리는 유저 데이터를 이미 다 갖고 있으면서 "80kg 돌파, 3650kg, 18세트" 숫자만 던지고 있음. "그래서 뭐?" 테스트 전면 실패. ChatGPT는 공짜인데 우리가 돈을 받으려면 물어볼 필요 없이 자동으로, 더 예쁜 UI로 보여줘야 함.

**핵심 철학 (대표):** "유저는 숫자를 보고 싶은 게 아니라 '잘했는지, 못했는지, 다음에 뭘 해야 하는지'를 알고 싶다. 초등학생도 이해할 수준으로."

---

#### 최종 설계 — 4탭 리포트 구조

```
┌─────────────────────────────────────┐
│   [나]    [오늘]   [다음]    [영양]   │
│   ──●────────────────────────────── │
│             (탭 내용)                 │
├─────────────────────────────────────┤
│  [접힘] 운동 로그                     │
│  [접힘] 운동 데이터                   │
└─────────────────────────────────────┘
```

스트릭: 상단 뱃지로 유지 (EXP/티어 삭제)

---

#### 탭 1: [나] — 나의 현재 상태

**육각형 레이더 차트 + 피트니스 나이**

```
피트니스 나이: 27세
실제 나이보다 8살 젊은 몸이에요

       가슴 28등
        ╱╲
  어깨 ╱  ╲ 등
  41등│ ★ │45등
  체력 ╲  ╱ 하체
  31등  ╲╱  52등
      종합 35등

30대 남성 100명 중
종합 47등 → 35등  12등 UP
```

| 항목 | 결정 |
|------|------|
| 6축 | 가슴 / 등 / 어깨 / 하체 / 체력 / 종합 |
| 종합 | 5개 가중평균 (하체30% 가슴20% 등20% 어깨15% 체력15%) |
| 표현 | "100명 중 X등" (초등학생 이해 가능) |
| 변화 | "47등→35등, 12등 UP" (2회차부터) |
| 피트니스 나이 | 카드 최상단, 전 연령대 퍼센타일 역산 |
| 데이터 없는 축 | "기록하면 열려요" |
| 퍼센타일 기준 | ACSM/NSCA 연령/성별별 표 (~15KB JSON) |
| 카테고리 매핑 | 가슴=벤치/체스트프레스/푸시업 등, 등=로우/풀업/랫풀 등 |
| 머신 환산 | 적용 (보정 계수 0.6~0.8) |
| 부정 표현 | 절대 금지 (평균 이하여도 긍정 프레이밍) |
| 소스 | 룰베이스 (Gemini 불필요) |

**이 카드에 절대 넣으면 안 되는 것:**
- "이번 주 2/3회 완료" (진행률 → 별도)
- "다음 운동 가능" (액션 → [다음] 탭)
- "32 EXP 획득" (삭제됨)
- "중급자/초급자" 라벨 (추상적 → 등수로 대체)
- 예측/전망 ("4주 뒤 85kg")

---

#### 탭 2: [오늘] — 오늘 운동이 남긴 것

**2x2 그리드, 세션 타입별 분기**

근력 세션:
```
┌──────────┬──────────┐
│ 자극      │ 칼로리    │
│ 지난주    │          │
│ 대비 +8% │ 치킨 한조각│
│ 목표에    │ 태웠어요   │
│ 충분!     │(약320kcal)│
├──────────┼──────────┤
│ 회복      │ vs 지난주 │
│ 하루쯤    │ 나       │
│ 쉬면 충분 │ 12% 더   │
│           │ 했어요!  │
└──────────┴──────────┘
```

러닝 세션:
```
┌──────────┬──────────┐
│ 페이스    │ 칼로리    │
│ 15초     │ 아아 5잔  │
│ 빨라짐    │ 태웠어요  │
├──────────┼──────────┤
│ 회복      │ vs 지난   │
│ 하루쯤    │ 러닝     │
│ 쉬면 충분 │ 0.5km 더 │
└──────────┴──────────┘
```

| 항목 | 결정 |
|------|------|
| 항목 수 | 4개 (피로 삭제 → "vs 지난주 나" 대체) |
| 자극 | 목표 연결 필수 ("감량 목표에 효과적" / "근비대에 충분한 자극") |
| 칼로리 | 음식 비유 랜덤 (치킨/아아/초코파이/소주) + 괄호 안 실제 kcal |
| 회복 | 범위 표현 ("하루쯤") |
| 칼로리 음식 비유 현지화 | KO: 밥/치킨/소주 / EN: pizza/coffee/beer |
| 세션 분기 | 근력/러닝 별도 구성 |
| 소스 | 룰베이스 (Gemini 불필요) |

---

#### 탭 3: [다음] — 다음 운동 조언

```
┌─────────────────────────────┐
│  다음 운동 조언               │
│                              │
│  "{자연어 한줄 조언}"          │
│                              │
│  추천 부위: {부위}            │
│  추천 강도: {강도 표현}        │
│                              │
│  {요일} · {부위} (스케줄)     │
└─────────────────────────────┘
```

시나리오 예시:
- 상체 밀기 후: "오늘 가슴 열심히 했으니까 다음엔 등 해주면 딱이에요" / 등·팔 / 오늘만큼
- 하체 고볼륨 후: "허벅지 많이 썼으니까 다음엔 상체 가볍게 가세요" / 가슴·어깨 / 가볍게
- 3일 연속: "3일 연속 잘 버텼어요. 내일은 가볍게 쉬어가세요" / 스트레칭·유산소 / 가볍게
- 러닝 후: "오늘 뛰느라 다리 고생했으니 다음엔 상체 해주세요" / 가슴·어깨 / 중간
- 컨디션 불량: "컨디션 안 좋은데도 나온 거 대단해요. 다음엔 무게 올려봐요" / 같은 부위 / 좀 더 세게
- 부위 공백: "등 안 한 지 10일 됐어요. 다음엔 등 먼저 챙겨주세요" / 등·팔 / 가볍게
- 첫 운동: "첫 운동 해냈어요! 이틀 뒤에 다른 부위로 한번 더 와보세요" / 다른 부위 / 가볍게

| 항목 | 결정 |
|------|------|
| 추천 로직 | 최근 7일 이력 + 오늘 피로 + 주간 볼륨 추이 + 스케줄 |
| 스케줄 연동 | 있으면 스케줄 우선, AI가 보강 코멘트 |
| 자연어 | 템플릿 ~25개 (부위6 x 강도3 + 특수조건4) |
| 톤 | 트레이너 툭 던지는 말투 |
| 소스 | 룰베이스 (Gemini 불필요) |

---

#### 탭 4: [영양] — 오늘의 영양 가이드

```
┌─────────────────────────────────┐
│  오늘의 영양 가이드               │
│                                  │
│  하루 목표 칼로리                  │
│  2,600 kcal (증량 목표 기준)      │
│                                  │
│  ┌────────┬────────┬────────┐   │
│  │ 단백질  │ 탄수화물 │ 지방    │   │
│  │ 140g   │ 330g   │ 60g    │   │
│  │ ■■■■   │ ■■■■■■ │ ■■     │   │
│  └────────┴────────┴────────┘   │
│                                  │
│  오늘 이렇게 챙겨보세요           │
│  아침: 오트밀 + 계란 3개 + 프로틴  │
│  점심: 밥 + 닭가슴살 + 견과류     │
│  간식: 프로틴 쉐이크 + 바나나     │
│  저녁: 밥 + 소고기/생선 200g     │
│                                  │
│  핵심: 단백질만 맞추면            │
│  나머지는 유동적으로 OK           │
│                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│  궁금한 거 물어보세요             │
│  ┌───────────────────┐  [>]    │
│  │ 야식 먹어도 돼?     │         │
│  └───────────────────┘         │
│                                  │
│  일반적인 영양 정보이며            │
│  개인 건강 상담을 대체하지 않습니다  │
└─────────────────────────────────┘
```

| 항목 | 결정 |
|------|------|
| 상단 자동 가이드 | Gemini JSON 응답 → 프론트 렌더링 |
| 하단 채팅 | Gemini 자유 질문 |
| 칼로리 공식 | Mifflin-St Jeor BMR x 활동계수 |
| 탄단지 공식 | 체중 기반 (목표별 계수 분기) |
| 식단 | 목표별 + 시간대별 개인화 |
| 입력 데이터 | 체중/키/나이/성별/목표/오늘운동/소모칼로리 |
| 생성 타이밍 | 운동 완료 시 Gemini 1회 (기존 코치 API 대체, 추가비용 0) |
| 면책조항 | 카드 하단 회색 작은 글씨 |
| 무료 유저 | 자동 가이드 무료, 채팅 3회/세션 제한 |
| 현지화 | KO: 밥/닭가슴살 / EN: rice/chicken |

---

#### 삭제 항목

| 항목 | 이유 |
|------|------|
| 기존 히어로 카드 | 숫자 나열, "그래서 뭐?" 실패 |
| AI 코치 3버블 | 향후 별도 탭/기능으로 재도입 |
| EXP/티어 시스템 | 육각형 + 피트니스 나이가 상위 호환 |
| `coachMessages.ts` 룰베이스 | 3버블 구조 삭제에 따라 정리 |
| 기존 코치 API (`/api/getCoachMessage`) | 영양 가이드 API로 리팩터 |

#### 유지 항목

| 항목 | 위치 |
|------|------|
| 스트릭 | 상단 뱃지 |
| 운동 로그 (세트별 그래프) | 하단 접힘 |
| Science Data 원본 (E1RM/부하/강도/피로) | 하단 접힘 |

---

#### 추가 개발 필요

| 항목 | 상세 |
|------|------|
| 온보딩 키(cm) 입력 | Mifflin-St Jeor BMR 산출 필수 |
| ACSM 퍼센타일 기준표 | ~15KB JSON, 연령x성별x카테고리x구간 |
| 카테고리-운동 매핑표 | 255+ 운동 → 5개 카테고리 분류 |
| 머신 환산 보정 계수 | 종목별 0.6~0.8 |
| 피트니스 나이 역산 로직 | 종합 퍼센타일 → 연령 매핑 |
| Gemini 영양 가이드 엔드포인트 | 기존 코치 API를 영양용으로 리팩터 |
| 영양 채팅 엔드포인트 | 추가 질문용 Gemini 호출 |
| 무료 유저 채팅 제한 | 3회/세션 카운터 |
| "다음엔" 템플릿 ~25개 | 부위x강도 + 특수조건 |
| "오늘은" 음식 비유 풀 | KO/EN 각 10~15개 |
| i18n | 새 탭 UI 텍스트 ko.json + en.json |

#### 배포 계획

- Frontend: 4탭 구조 + 육각형 + 2x2 + 다음 조언 + 영양 탭
- Functions: 영양 가이드 Gemini 엔드포인트 + 채팅 엔드포인트
- Firestore: 퍼센타일 기준표 (선택, 클라이언트 JSON도 가능)

#### 향후 과제

- AI 코치 채팅 탭 재도입 (5번째 탭)
- 푸시알림 연동 ("수요일 하체 날이에요")
- 공유카드에 육각형 + 퍼센타일 반영
- 주기화/난이도 자동 시스템

---

### 회의 36: 인터벌 러닝 4타입 전면 재설계 + 유저 타입 교체 UI
**참석:** 대표, 러닝 전문가(서브3 12년), 국대 코치, 운동생리학자, 한체대 교수, 재활의학 교수, 기획자, 프엔/백엔 개발자, UX 디자이너, 현지화 전문가, 평가자
**일자:** 2026-04-06

**배경:** 회의 35에서 워크-런 순서 버그 발견. 대표 지시로 인터벌 러닝 전체 재검토. 유저 난이도 자동 판정 논의했으나 대표 철학 "전력은 주관적, 유저 자가 조정" 반영해 단순화.

**핵심 철학 (대표):** "'전력'이라는 표현이 각자 능력에 맞게 자연스럽게 해석되는 장점이 있다. 난이도까지 우리가 판단하려는 건 과잉 엔지니어링. 기본 시간 템플릿 + 명확한 가이드만 주고 유저 스스로 강도 조절하게 하자."

**최종 설계 — 4타입 스펙 + 가중 랜덤:**
| 타입 | 스펙 | 가중치 | 의도 강도 |
|---|---|---|---|
| Walkrun (초보) | 3분 걷기 + 120초 걷기/60초 달리기 × 8 + 3분 걷기 | 40% | low |
| Tempo (중급) | 5분 조깅 + 20분 템포 + 5분 조깅 | 30% | moderate |
| Fartlek (중상급) | 5분 조깅 + 120초 전력/180초 보통 × 5 + 5분 조깅 | 15% | high |
| Sprint (상급) | 8분 조깅 + A스킵 + 30초 전력/120초 회복 × 6 + 5분 조깅 | 15% | high |

가중치 = 안전 편향 (walkrun 최다). 랜덤 결과가 맘에 안 들면 유저가 직접 교체.

**구현 (3파일):**
1. **functions/src/workoutEngine.ts** `generateRunningWorkout` — weightedPick 헬퍼 + 4타입 count 재설정
2. **src/components/FitScreen.tsx** 인터벌 UI — IntervalConfig 일반화 (phase1Sec/phase2Sec + type + phase1Key/phase2Key), 3개 regex(walkrun/fartlek/sprint), 타입별 색상(walkrun=파랑/주황, sprint/fartlek=빨강/초록), 페이즈 가이드 텍스트 RPE 힌트
3. **src/components/MasterPlanPreview.tsx** 러닝 타입 교체 — RUNNING_TEMPLATES 상수 + detectRunningVariant + handleRunningVariantSwap (main phase만 교체, warmup/core/cardio 유지) + 제목 밑 버튼 + 바텀시트

**i18n 신규 키:** ko + en 각 10개 (fit.interval.* 가이드 + plan.running.* 타입 레이블/설명)

**배포:** Frontend auto + Functions 수동 (firebase deploy --only functions:planSession)

**재발 방지:**
- 시간 기반 인터벌의 "전력/보통/회복"은 주관적 RPE임을 가이드 텍스트로 명시 (구체 km/h 금지)
- 4타입 스펙 수정 시 workoutEngine.ts + RUNNING_TEMPLATES 동시 업데이트 필수
- 주기화/난이도 시스템은 다음 스프린트 과제

---

### 회의 30: 구독 취소 플로우 탭바 숨김 (몰입형 모달 전환)
**참석:** 대표, 기획자, UX 디자이너, 그로스 마케터, 콘텐츠 MD, 프론트엔드 개발자, 평가자, 페르소나 유저 3명
**일자:** 2026-04-06

**배경:** 회의 29에서 취소 오버레이 하단 버튼이 탭바 뒤로 숨는 버그 1차 수정 (padding 128px 추가)했으나, 대표가 "탭바 자체를 숨기는 게 맞는지" UX 결정 요청.

**평가자 크로스 시뮬 (편향 차단 8축, 100점):**
| 축 | 배점 | 숨김 | 노출(현재) |
|---|---|---|---|
| 유저 자율성 | 20 | 15 | 20 |
| 취소 결정 집중력 | 15 | 15 | 8 |
| 리텐션 | 15 | 13 | 7 |
| 업계 표준 | 10 | 10 | 5 |
| Dark pattern 우회 | 15 | 11 | 15 |
| 구현 리스크 | 5 | 5 | 5 |
| 페르소나 투표(2:1) | 10 | 10 | 5 |
| 뒤로가기 경로 | 10 | 7 | 10 |
| **총점** | 100 | **86** | 75 |

**대표 결정:** 탭바 **숨김**, 뒤로가기 아이콘은 현 상태 유지 (강화 불필요).

**구현 (3파일 콜백 체인):**
1. `SubscriptionScreen.tsx`
   - `onCancelFlowChange?: (active: boolean) => void` prop 추가
   - `useEffect`로 `cancelStep > 0` 변경 감지 → 콜백 호출
   - 이전 회의 29의 `paddingBottom: calc(128px + safe-area)` → 불필요하므로 `calc(24px + safe-area)` 로 축소 (탭바 숨김 시 128px 공백 방지)
2. `MyProfileTab.tsx`
   - `onCancelFlowChange` prop 추가 → `SubscriptionScreen`에 통과
3. `src/app/app/page.tsx`
   - `cancelFlowActive` state 신설
   - `<MyProfileTab onCancelFlowChange={setCancelFlowActive} />`로 콜백 전달
   - `BottomTabs` 조건부 렌더: `!cancelFlowActive`일 때만

**데이터 흐름:**
```
cancelStep 0→1 (사용자 취소 버튼 클릭)
  ↓ useEffect
onCancelFlowChange(true)
  ↓
MyProfileTab 통과
  ↓
page.tsx setCancelFlowActive(true)
  ↓
BottomTabs 렌더 조건 false → 탭바 숨김
```

**Dark pattern 회피 체크 (평가자):**
- ✅ 취소/유지 버튼 동등 크기
- ✅ 2단계 플로우 (합리적)
- ✅ 뒤로가기 `<` 상단 유지
- ✅ 숨겨진 요금 없음
- ✅ EU DSA / 한국 공정위 다크패턴 가이드라인 안전

**향후 고려 (Phase 2 — 다음 스프린트):**
- "나중에 결정할게요" 부가 CTA (MD 제안)
- 뒤로가기 아이콘 강화 (회의 30에서 대표가 불필요 판정)

---

### 회의 27: Gemini 코치 시스템 전수 감사 — 데이터 오염 원인 발견 + 원칙 수립
**참석:** 대표, 기획자, 프론트엔드 개발자, 백엔드 개발자, 디자이너, 현지화 전문가, 프롬프트 전문가, 평가자
**일자:** 2026-04-06

**배경:** 회의 25에서 프롬프트만 영문 분기해서 "해결됐다"고 봤으나 유저 스샷으로 여전히 한글 응답 발견. 대표 지시로 전수 감사.

**평가자 자기편향 반성:**
회의 25에서 프롬프트 텍스트만 보고 "영문 분기면 끝"이라 빠르게 확신 → 데이터 파이프라인 미검증. 이번엔 데이터→프롬프트→출력 전체 파이프라인 감사.

**근본 원인 (프엔 진단):**
서버(`workoutEngine.ts`)는 운동명을 **이미 `"바벨 벤치 프레스 (Barbell Bench Press)"` 형식**으로 한글+영문 페어로 저장 중. UI는 `getExerciseName(name, locale)` 헬퍼로 올바른 언어 추출해 사용. **하지만** `fetchCoachMessages`의 L184/L199가 `.split("(")[0].trim()`으로 무조건 한글만 잘라 서버 전송. 서버가 받은 한글 데이터를 EN 프롬프트에 interpolate → Gemini가 혼합 언어 보고 혼란.

**대표 질문 명확화:**
대표: "KO 넣고 KO 받아서 EN 번역? 아니면 EN 넣고 EN 받아서 KO→EN? 어떤 로직?"
답: **어느 것도 아님**. 현재는 "영문 프롬프트 + 한글 데이터 + 번역 단계 없음" 상태. 번역이 아예 없음.

**4가지 가능 로직 비교:**
| 방법 | 설명 | 채택 여부 |
|---|---|---|
| 1. 데이터 미리 EN 정제 → 순수 EN 프롬프트 → Gemini → EN 출력 | 단일 방향, 빠름, 비용 0 | ★ **채택** |
| 2. KO 프롬프트 → KO 출력 → 번역 API → EN | 비용+지연+뉘앙스 손실 | ❌ |
| 3. 왕복 번역 (KO→EN→KO→EN) | 실용성 없음, 손실 누적 | ❌ |
| 4. 혼합 (현재) | 운에 맡김, 불안정 | ❌ |

**전문가 합의 (현지화+프롬프트+백엔+프엔):** 방법 1. "프롬프트 언어 = 데이터 언어" LLM 현지화 1원칙.

**수정 (3줄):**
1. `sessionLogs[].exerciseName`: `ex.name.split("(")[0].trim()` → `getExerciseName(ex.name, locale)`
2. `hero.exerciseName`: 동일 패턴 적용
3. `sessionDesc`: `translateDesc(sessionDesc || "", locale)` 래핑 후 전송

**원칙 수립 (재발 방지):**
- 앞으로 **JA/ZH 추가 시에도 동일 원칙**: LLM 프롬프트 호출 전 모든 동적 데이터를 target locale로 sanitize
- `isKo = locale !== "en"` 이분법 금지, `locale === "ko" / "ja" / "zh" / "en"` 명시 분기
- `name.split("(")[0].trim()` 패턴 발견 시 즉시 `getExerciseName` 교체
- LLM 응답 후처리 번역 금지 — 입력 단계에서 정제
- 코드 상단 주석으로 원칙 박음 (WorkoutReport.tsx fetchCoachMessages)
- 메모리 `feedback_llm_data_sanitization.md`에 저장 — 미래 세션 자동 참조

**남은 Phase (이번 회의 범위 초과, 다음 라운드):**
- Phase B: Gemini `systemInstruction` 필드 분리, "No Korean characters" 이중 명시
- Phase C: 타임아웃 Promise.race 패턴으로 실효성 확보
- Phase D: 저장된 coachMessages의 locale 재검증 로직
- `weatherContext` 정규식 변환 제거, 처음부터 locale 분기 빌드

**이번 수정 범위:** 3줄 (Phase A — 데이터 정제). 가장 치명적인 버그 즉시 해결.

**배포 필요:** Frontend만 (git push 자동). Functions 배포 불필요 — 서버 코드 변경 없음.

---

### 회의 26: ProofTab 캘린더 날짜 상세 시트 세션 타이틀 EN 번역
**일자:** 2026-04-05

**증상:** EN 모드에서 PROOF 탭 → 캘린더 → 날짜 탭 → 바텀시트 "4/5 Workout Records"에 **세션 타이틀이 한글 원본**으로 표시:
- "기초체력강화 · 홈트레이닝"
- "살 빼기 · 하체 + 당기기"

**원인:** `ProofTab.tsx:43` `DaySessionItem`이 `session.sessionData.title`을 **번역 없이 직접 렌더**. WorkoutReport/MasterPlanPreview에는 `translateDesc`/`translateDescription` 체인이 있지만 ProofTab에는 없었음.

**수정:**
- `translateSessionTitle(title, locale)` 함수 신설 (ProofTab 로컬) — WorkoutReport `translateDesc`와 동일 규칙
- 복합 패턴 우선 매칭 ("상체(당기기)" → "Upper (Pull)")
- 목표 라벨 (살 빼기/근육 키우기/힘 세지기/기초체력/기초체력강화)
- 카테고리 (홈트레이닝/러닝/집중 운동)
- 수량 단위 (N종/N세트)
- `DaySessionItem` 렌더에 `translateSessionTitle(session.sessionData.title, locale)` 적용

**재발 방지:**
- 서버 세션 타이틀/설명을 렌더하는 모든 위치는 **translateDesc 체인 통과 필수** (WorkoutReport/MasterPlanPreview/ProofTab 3곳 확인)
- 공통 헬퍼로 추출 검토 (다음 리팩토링 시)

---

### 회의 25: Gemini 코치 멘트 EN 응답 실패 — 프롬프트 전체 분기
**일자:** 2026-04-05

**증상:** EN 모드에서 앱을 사용 중인데 WorkoutReport AI 코치 3버블이 **한글로 생성됨**. (스샷: 푸쉬업 15회 3세트 한글 코멘트)

**프엔 진단:**
`functions/src/ai/coach.ts`의 Gemini 프롬프트가 **전부 한글**로 작성돼 있고, EN 모드일 때 프롬프트 끝에 `IMPORTANT: Respond in English` 한 줄만 추가됨. Gemini 2.5 Flash는 **프롬프트 언어 지배**에 따라 한글로 응답 — 짧은 영어 override 무시하는 경향.

**원인:**
- L285-L353 프롬프트 전체가 Korean (지침 + 울타리 + 예시 5개)
- L350 `${isKo ? "" : "IMPORTANT: Respond in English..."}` 한 줄 override로는 부족
- logSummary도 Korean 하드코딩 (`N세트`, `실패`, `쉬움`)
- `conditionText`, `timeOfDay` 등 변수도 Korean

**수정:**
1. **전체 영문 프롬프트** `promptEn` 상수 신설 — 한국 버전과 동일 구조로 Tone / Hard rules / Message structure / 5 examples 전부 영어로 재작성
2. `const prompt = isKo ? koreanPrompt : promptEn` 로 완전 분기
3. `logSummary` locale 분기 — EN은 "Set N: X reps @ Wkg → on target" 형태
4. `feedbackLabel(f)` 헬퍼 — fail/easy/too_easy/target 영문 라벨
5. `conditionText` locale 분기 — "Condition: upper stiffness / Energy 3/5"
6. `weatherContext` EN 변환 — "Season: spring (weather is nice...)", "Current weather: 18°C, clear"
7. `timeOfDay` EN 분기 — "early morning / morning / afternoon / evening"

**현지화 전문가 QA:**
- 톤: "casual-polite with lots of exclamation" — 한국어 해요체의 친근함을 영문 personal trainer DM 스타일로 매핑
- 예시 5개 영문 리라이트: barbell row / shoulder press / squat / cable face pull 등 같은 운동명 유지, 감정 표현은 한국 ㅎㅎ/ㅠㅠ 대신 "haha", "wow", "seriously" 사용
- "화이팅" → "you got this" 같은 직역 대신 자연스러운 motivational phrase 사용

**배포 필수:** Functions 수동 배포 — `firebase deploy --only functions:getCoachMessage`

**재발 방지:**
- LLM 프롬프트에 언어 override 한 줄만 추가하는 패턴 금지 — 프롬프트 전체 언어를 target locale로 작성해야 안정적
- 새 언어(JA/ZH) 추가 시 promptJa/promptZh 분기 동일 원칙

---

### 회의 24: Help modal 5개 citation lines EN 번역
**일자:** 2026-04-05

**증상:** WorkoutReport 2x2 과학 데이터 카드의 ? 버튼 도움말 모달 5종 모두 하단 "근거:" 출처 인용 라인이 한글 하드코딩. 모달 본문은 이미 locale 분기 돼 있지만 citation만 누락.

**위치 (WorkoutReport.tsx):**
- L1368 topLift (EST. 1RM): "근거: NSCA Essentials of S&C (4th ed.), Epley (1985)"
- L1408 loadStatus (LOAD STATUS): "근거: ACSM (2009), Israetel RP Strength, NSCA Volume Load"
- L1455 intensity (INTENSITY): "근거: ACSM Resistance Exercise Guidelines (2025), WHO..., Schoenfeld..."
- L1491 loadTimeline (4-Week Load Timeline): "근거: ACSM 점진적 과부하 원칙, ..."
- L1510 fatigueDrop (FATIGUE SIGNAL): "근거: Morán-Navarro et al. (2017), NSCA 세트간 피로 가이드라인, ACSM 회복 권장"

**수정:**
각 라인을 `locale === "ko" ? "근거: ..." : "Source: ..."` 인라인 ternary로 교체.
한글 혼재 부분 번역:
- "ACSM 점진적 과부하 원칙" → "ACSM progressive overload principle"
- "NSCA 세트간 피로 가이드라인" → "NSCA inter-set fatigue guidelines"
- "ACSM 회복 권장" → "ACSM recovery recommendations"
- "근거:" → "Source:"

KO 원본 그대로 유지, EN만 추가.

---

### 회의 23: Science Data 2x2 카드 UI 깨짐 — EN 배지/팁 라벨 축약
**참석:** 대표, 기획자, 프론트엔드 개발자, UX 디자이너, 현지화 전문가, 평가자
**일자:** 2026-04-05

**증상:** WorkoutReport 2x2 과학 데이터 카드에서 EN 라벨이 길어 배지 wrap 발생
- LOAD STATUS "Low Volume" → 2줄
- INTENSITY "Moderate"가 너무 넓어 "77% 1RM" 배지가 "77%" / "1RM" 세로 분리
- FATIGUE "Recovery needed: 12h" 2줄

**픽셀 계산 (phone 384px):** 카드 내부 가용 폭 ≈ 131px. "Moderate" text-2xl ≈ 110px + gap 6 + 배지 50 = 166 > 131 → wrap

**3가지 옵션 평가자 시뮬 (100점):**
| 기준 | 가중치 | A(축약) | B(flex-col) | C(혼합) |
|---|---|---|---|---|
| 정보 손실 없음 | 25 | 18 | 25 | 22 |
| 가독성 | 25 | 23 | 22 | 23 |
| KO/EN 일관성 | 15 | 14 | 12 | 14 |
| 영어권 UX 관행 | 15 | 14 | 11 | 14 |
| 3초 스캔성 | 10 | 10 | 8 | 9 |
| 코드 변경 최소 | 5 | 5 | 2 | 3 |
| JA/ZH 확장성 | 5 | 4 | 4 | 5 |
| **총점** | 100 | **88** | 84 | **90** |

**평가자 자기편향 체크:** C안이 90점 1위지만 flex-wrap은 wrap 발생 시 세로 불균형 리스크 → 실전에서 A보다 불안정. A안 채택 (88점).

**현지화 전문가 근거:** Strong/Hevy/JEFIT/Fitbod 업계 표준 = 배지 1단어 원칙 (Max, Vol, RPE, High, Low, Rest).

**수정 (en.json, 14건, KO 변경 없음):**

배지 9건:
- `report.load.deficit`: "Low Volume" → "Low"
- `report.load.lowOptimal`: "Light Optimal" → "Light"
- `report.load.highGrowth`: "High Growth" → "High+"
- `report.load.growth`: "Growth Zone" → "Growth"
- `report.load.overload`: "Overload" → "Over"
- `report.load.highLoad`: "High Load" → "High"
- `report.load.recovery`: "Recovery" → "Rest"
- `report.load.first`: "First Session" → "First"
- `report.intensityLabel.moderate`: "Moderate" → "Mid"

팁 5건:
- `report.load.overloadTip`: "Over limit · reduce next time" → "Over limit"
- `report.load.highTip`: "Above optimal · try adjusting" → "Above optimal"
- `report.load.deficitTip`: "Below optimal · try increasing" → "Below optimal"
- `report.load.lowOptimalTip`: "Light optimal · focus on recovery" → "Light zone"
- `report.load.highGrowthTip`: "High intensity optimal · good pace" → "High pace"
- `report.load.growthTip`: "Growth zone · good pace" → "On track"
- `report.load.lowRecovery`: "Light recovery · on track" → "Recovery"

Fatigue 1건:
- `report.fatigue.recoveryTime`: "Recovery needed: {hours}h" → "Rest: {hours}h"

**재발 방지:**
- 메트릭 카드 배지는 1단어/최대 2단어 원칙 수립 (앞으로 EN 라벨 추가 시 준수)
- 긴 라벨 필요하면 tooltip/help 모달로 이관 (? 버튼 이미 존재)
- UI wrap 발생 여부는 phone frame 384px 기준 사전 시뮬 필수

---

### 회의 22: Growth Prediction EN 마무리 + Exercise Science Data 라벨 축약
**참석:** 대표, 기획자, 프론트엔드 개발자, 평가자, 현지화 전문가, 카피라이터
**일자:** 2026-04-05

**증상 (대표 스샷 4건):**
1. Growth Prediction 근력 코치 멘트 — "Big 3 total: 101kg! 199kg to **입문** level!" (입문/초급/중급/상급/엘리트 한글 잔존)
2. Strength 탭 헤더 — "Current strength level **평가**" ("평가" 단어만 한글)
3. Regression chart 하단 trend 라벨 — "▲ **주간 425.8kg/주**", "▼ **주간 -3.5회/주**"
4. Endurance/Health 차트 축 & 참조선 — "**주 운동 횟수**" (Y축), "**WHO 권장 3회/주**" (점선), "**5회**/4회" (데이터 라벨)
5. (대표 추가 지시) WorkoutReport + ProofTab의 "Exercise Science Data" 카드 헤더가 EN에서 너무 길어 2줄로 wrap — 축약 필요

**프엔 진단:**
1. `FitnessReading.tsx:1680` `growth.coach.muscleGain:` 템플릿이 Korean `level` 변수를 EN 템플릿에 그대로 interpolate (회의 21의 endurance 수정과 동일 패턴)
2. `FitnessReading.tsx:1837` `.replace("현재 근력 수준", "Current strength level")`이 `.replace("현재 근력 수준 평가", ...)` 보다 먼저 실행되어 긴 매칭 실패 → **순서 의존 regex 버그**
3. `FitnessReading.tsx:721-732` endurance/health 차트 `yLabel`, `targetLabel`, `points[].label`이 Korean 하드코딩 (locale 분기 없음)
4. `FitnessReading.tsx:939` trend label도 inline JSX에 Korean 하드코딩
5. `report.scienceData` / `proof.scienceData` EN 값 "Exercise Science Data" (20자) → 작은 카드 헤더에 2줄 wrap

**카피 회의 (기획자 + 현지화 + 카피라이터 합의):**

Exercise Science Data 축약 3안:
| 안 | EN | 자수 | 장점 | 단점 |
|---|---|---|---|---|
| ⓐ | Analytics | 9 | 짧고 중립 | deep insight 뉘앙스 약함 |
| ⓑ | **Training Science** | 15 | 브랜드 톤 유지 + 의미 명확 | 여전히 긴 편 |
| ⓒ | Science | 7 | 최단 | 뭐에 대한 과학인지 모호 |

**결정:** ⓑ **"Training Science"**
- 피트니스 앱 업계 표준(Strong/Hevy/JEFIT)과 근접
- 서브 라벨 "1RM · Load · Intensity · Fatigue"가 내용 설명해주므로 헤더는 의도만 전달
- KO 라벨("운동 과학 데이터")은 변경 안 함 — 대표 지시 (공간 문제는 EN에만 해당)

**수정 (5건):**
1. `FitnessReading.tsx` `growth.coach.muscleGain:` 핸들러에 `toEnStrengthLevel` 헬퍼 추가 — 입문/초급/중급/상급/엘리트 → Novice/Beginner/Intermediate/Advanced/Elite
2. `.replace` 체인에서 `"현재 근력 수준 평가"`를 `"현재 근력 수준"`보다 **먼저** 배치 (순서 고정)
3. endurance/health 차트 `yLabel`, `targetLabel`, `points[].label`에 `locale === "en"` 분기 추가 — "Weekly workouts" / "WHO target Nx/wk" / "5x" 형태
4. trend 라벨 JSX 블록에도 locale 분기 — "▲ +425.8kg/wk" / "▼ -3.5x/wk"
5. `en.json` `report.scienceData` + `proof.scienceData` 값 "Training Science"로 축약

**현지화 전문가 QA:**
- "Novice" vs "Beginner": Novice는 "입문 단계"로 완전 초보, Beginner는 "초급"으로 약간 경험. 스포츠 과학 표준 Matveyev 레벨 분류 따라 Novice(입문) / Beginner(초급) 분리 유지
- "Weekly workouts" vs "Workouts/week": 짧고 명료한 "Weekly workouts" 채택
- "WHO target 3x/wk": 국제 기관(WHO)은 번역하지 않음, "target" + 숫자로 간결

**재발 방지:**
- `.replace` 체인에서 긴 패턴을 **항상 먼저** 배치하는 원칙 명시 — MasterPlanPreview/WorkoutReport/FitnessReading 모두 동일 패턴
- 차트 라벨/단위/참조선은 **렌더 시점**에 locale 분기 (useMemo 안에서도 locale 참조 필수)
- UI 텍스트 길이는 **가장 좁은 디바이스**(phone frame 384px) 기준으로 wrap 체크

---

### 회의 21: EN 모드 한글 대규모 정리 (Subscription / Quest / Description / Big3 / Grade / Add Exercise)
**참석:** 대표, 기획자, 프론트엔드 개발자, 평가자, 현지화 전문가
**일자:** 2026-04-05

**증상 (대표 스샷 제보 9건):**
1. Subscription "Premium Plan" 화면 — "월 정기 구독 활성화", "다음 결제일", "포함된 기능", "구독 내역", "결제 금액", "6,900원" 등 한글
2. "결제 내역" 헤더 + 날짜 포맷 + "원" 화폐 단위
3. WorkoutReport "Today's Work" 카드 — 세션 설명에 "상체(당기기)" 한글 잔존
4. WorkoutReport EXP gains — "중강도 운동 2회 완료 +3 EXP", "새 운동 3종목 시도 완료 +2 EXP"
5. ProofTab EXP 로그 — "04.03 이번 주 5일 Workout", "5일 연속 Workout", "중강도 운동 2회 Complete"
6. ProofTab Exercise Science Data 카드 — 3대 운동 이름 "스쿼트 / 데드리프트 / 벤치프레스"
7. FitnessReading Growth Prediction Endurance 탭 코치 멘트 — "150 min/week! Grade: 우수! 75 more min to 상급!"
8. WorkoutSession Add Exercise 화면 — 범주 칩 클릭 시 검색창에 한글 키워드("웜업") 자동 입력
9. (발견) ProofTab의 `tQuestLabel` 로컬 헬퍼가 regex 기반이라 새 패턴 추가 시 누락 쉬움

**프엔 진단 (원인):**
- `SubscriptionScreen.tsx` 활성 구독 뷰·결제내역 뷰에 하드코딩 한글 리터럴 다수
- `questSystem.generateWeeklyQuests`가 Korean label을 QuestDefinition에 직접 저장 → UI가 그대로 표시
- `calculateSessionExp`가 `"${def.label} 완료"` 형태로 Korean detail을 ExpLogEntry에 저장 → ProofTab의 regex 치환으로 "완료→Complete"만 바꿔도 label 부분이 Korean으로 남음
- `MasterPlanPreview.translateDescription`과 `WorkoutReport.translateDesc`의 regex가 `상체\(당기기\(Pull\)\)` 패턴을 기대하지만 실제 서버 포맷은 `상체(당기기)` (Korean only) → 매칭 실패
- `workoutMetrics.CATEGORY_LABELS`가 Korean 리터럴을 `details[].exercise`에 저장 → ProofTab이 그대로 렌더
- `FitnessReading.tsx:1713` endurance 코치 멘트가 Korean `grade` 변수를 EN 템플릿에 그대로 interpolate
- `WorkoutSession.tsx:380`의 범주 칩 onClick이 `group.keywords[0]` (한글)을 검색창에 세팅

**수정 (9건):**
1. `sub.active.header / sub.features.header / sub.history.header / sub.history.nextDate / sub.history.amount / sub.history.title / sub.history.empty / sub.amount.krw` 신규 키 ko+en 추가
2. SubscriptionScreen 활성 구독 뷰 + 결제 내역 뷰 전부 `t()` 호출로 교체, date는 locale 기반 `toLocaleDateString` 분기
3. `quest.highIntensity / moderateIntensity / lowIntensity / consistency / streak5 / newExercise3` + `quest.desc.*` + `exp.workout / weeklyBonus / questComplete / big3.*` 신규 키 ko+en 추가
4. `questSystem.ts`에 `translateQuestLabel(q, t)`, `translateQuestDescription(q, t)`, `translateExpDetail(entry, t)` 헬퍼 export — id/type 기반 safe matching + 동적 패턴 역파싱
5. ProofTab Quest 카드 + EXP 로그에 새 헬퍼 적용, 기존 `tQuestLabel` 로컬 헬퍼 dead code 제거
6. WorkoutReport EXP gains 리스트에 `translateExpDetail` 적용
7. `MasterPlanPreview.translateDescription` + `WorkoutReport.translateDesc` 체인 확장 — 실제 서버 포맷 `상체(당기기)`, `상체 + 밀기`, `당기기/밀기 단독`, 목표 라벨(살 빼기/근육 키우기/힘 세지기/기초체력), 카테고리(홈트레이닝/러닝) 추가
8. `workoutMetrics.CATEGORY_LABELS` 값을 i18n 키(`"big3.squat"` 등)로 변경, ProofTab 렌더에서 `.startsWith("big3.")` 분기로 `t()` 적용 — 기존 캐시된 한글 값은 ko 모드에서 그대로 표시되므로 하위 호환
9. `FitnessReading.tsx:1713` endurance 코치 멘트에 `toEnGrade` 헬퍼 추가 — 성장중/우수/상급/특급 → Growing/Excellent/Advanced/Elite 변환 후 EN 템플릿에 interpolate
10. `WorkoutSession.tsx:380` Add Exercise 범주 칩에 locale 분기 추가 — EN 모드에서는 `keywords.find(/^[a-z]/i)`로 영문 키워드 우선 선택

**평가자 훅 체크:**
- ✓ ko+en 동시 작업 (i18n_always)
- ✓ 기존 키 재사용 우선, 신규 키는 증상 기반으로만 추가
- ✓ 공통 헬퍼(translateQuestLabel/ExpDetail) 추출 — ProofTab + WorkoutReport 중복 제거
- ✓ 서버 응답 포맷 변경 없음 (클라이언트 전용 수정 — Functions 배포 불필요)
- ✓ 과거 캐시 데이터 하위 호환 (CATEGORY_LABELS "big3.*" 키 + KO 원본 둘 다 처리)
- ⚠️ 미처리 범위 (다음 스프린트):
  - HomeScreen 코치 버블 다수 변형 (한국 트렌드 드립 KO 전용 유지 검토)
  - FitnessReading 프로필 옵션/레벨 라벨 (입문/초급/중급/상급/엘리트)
  - FitScreen MUSCLE_GROUP_EN 매핑 확장
  - JA/ZH는 여전히 한글 fallback (이번 작업은 EN만)

**현지화 전문가 QA:**
- `sub.amount.krw = "₩{amount}"` — KRW 심볼 사용, 금액은 toLocaleString() 결과 그대로 삽입. USD 등 미래 확장 시 별도 키 필요
- `exp.questComplete = "{label} Complete"` — 영문 어순이 "Complete X"보다 "X Complete"가 자연스러운지는 논란 있지만 기존 UI 스타일(뒤쪽 상태 배지)과 일치
- Endurance grade 용어: Growing/Excellent/Advanced/Elite — 한국 군대/국대 드립은 EN에서 National team level/Olympic spirit 등 스포츠 메타포로 이미 변환됨 (기존 템플릿)
- Big3 용어: Squat / Bench Press / Deadlift / Push-ups / Pull-ups — 업계 표준 용어

**재발 방지:**
- 앞으로 UI 텍스트 추가 시 `t()` 호출 + ko/en 키 동시 추가 원칙 재강조
- 서버 응답 포맷에 의존하는 클라이언트 regex 치환은 **서버 포맷 변경 시 반드시 재확인** (MasterPlanPreview/WorkoutReport 체인이 깨진 이유)
- questSystem 같은 공통 데이터 유틸에서는 Korean 리터럴 대신 i18n 키나 structured type을 저장하는 원칙 수립 검토

---

### 회의 20: EN 버전 하드코딩 한글 잔존 — 컨디션 체크 + 무게 가이드
**참석:** 대표, 프론트엔드 개발자, 기획자, 평가자
**일자:** 2026-04-05

**증상 (대표 스샷 제보):**
1. EN 모드에서 컨디션 체크 STEP 2(basic info) 진입 시 라벨이 한글로 뜸: "성별 / 출생연도 / 체중"
2. 성별 선택 버튼 라벨도 한글: "남성 / 여성"
3. 마스터 플랜의 운동 카드 무게 가이드가 한글: "15회 이상 가능한 무게", "12-15회 가능한 무게" 등
4. (추가 발견) 기본 정보 입력 힌트 "성별·연령·체중 기반 백분위..." + "이전 대비 Nkg" 라벨도 하드코딩

**프엔 진단:**
- `ConditionCheck.tsx:227-261`에 `t()` 호출 없이 한글 리터럴 직접 사용
- `condition.gender`, `condition.gender.male/female`, `condition.birthYear`, `condition.weight` 키는 **이미 ko/en 양쪽에 존재** — 호출만 안 하고 있었음
- `MasterPlanPreview.tsx`의 `WEIGHT_MAP`에 일부 서버 무게 가이드 문자열 누락: `"15회 이상 가능한 무게"`, `"12-15회 가능한 무게"`, `"8회가 힘든 무게"`, `"10회가 힘든 무게"`, `"20회 이상 가능한 무게"`, `"점진적 증량 (매 세트 무게 UP)"`, `"가볍게 반복 가능한 무게"` → EN 모드에서 fallback으로 한글 그대로 출력
- `FitScreen.tsx:1177`에서 `setInfo.targetWeight`를 번역 없이 그대로 출력 → 운동 실행 화면도 같은 버그

**수정:**
1. `ConditionCheck.tsx` 하드코딩 한글 → 기존 i18n 키로 교체 (gender/birthYear/weight 라벨 + male/female 버튼)
2. `ko.json` + `en.json`에 2개 키 신규 추가: `condition.basicInfoHint`, `condition.weightDiff`
3. `translateWeightGuide` 함수를 `src/utils/exerciseName.ts`로 이동 — MasterPlanPreview + FitScreen 공통 사용
4. `WEIGHT_GUIDE_MAP`에 누락된 6개 서버 문자열 추가 (15+/20+/12-15/8-rep/10-rep/add-weight-each-set/easy-reps)
5. `MasterPlanPreview.tsx`의 로컬 `translateWeight` 제거, `translateWeightGuide` import로 교체
6. `FitScreen.tsx`의 `setInfo.targetWeight` 출력에 `translateWeightGuide(.., locale)` 적용

**평가자 훅 체크:**
- ✓ ko.json + en.json 동시 작업 (i18n_always 메모리 준수)
- ✓ 기존 키 재사용 우선, 신규 키는 최소
- ✓ 공통 헬퍼로 추출 (MasterPlanPreview/FitScreen 중복 제거)
- ✓ 서버 리턴 문자열 커버리지: workoutEngine.ts의 getWeightGuide 함수의 모든 리턴 경로 WEIGHT_GUIDE_MAP에 포함 확인
- ⚠️ JA/ZH 무게 가이드 번역은 이번 작업 범위 밖 (WEIGHT_GUIDE_MAP는 현재 EN만 처리) — 다음 스프린트 과제

**재발 방지:**
- 앞으로 UI 텍스트 추가 시 즉시 `t()` 호출 + ko/en 키 동시 추가 원칙 재확인
- 서버 무게 가이드 문자열 변경 시 WEIGHT_GUIDE_MAP 동기화 의무

---

### 회의 19: 다국어 랜딩 영상 매핑 버그 수정
**참석:** 대표, 기획자, 프론트엔드 개발자, 평가자
**일자:** 2026-04-05

**증상 1 — EN 소개 영상이 KO와 다름:**
KO `LandingContent.tsx`와 `en/page.tsx` FEATURES 비교 결과 video 경로가 한 칸씩 밀려있음 + `/weight-loss.mp4` 누락. 다이어트 소개에 hero.mp4가 나오는 등 매핑 오류.

**증상 2 — JA/ZH 히어로 섹션 영상 자체가 없음:**
KO/EN 랜딩의 히어로 섹션에는 전화기 프레임 안에 `/hero.mp4` autoplay 비디오가 있는데 JA/ZH 히어로 섹션에는 `<video>` 태그 자체가 없음. JA/ZH를 EN 초기 버전에서 복제할 때 비디오 블록이 누락된 것으로 추정.

**증상 3 (추가 발견) — JA/ZH에 COMPACT_FEATURES 섹션 미렌더:**
IDE `noUnusedLocals` 경고로 발견. JA/ZH 파일에 `COMPACT_FEATURES` 상수는 선언돼 있고 번역 데이터도 들어있지만(ゲーム感覚で/像打游戏一样), 실제 JSX에서 `.map()`으로 렌더하는 블록이 없음. KO/EN에는 있는 "게임처럼 운동 / AI 성장 예측" 2칸 그리드가 JA/ZH에는 통째로 빠져있음.

**수정 내용 (대표 지시 — A안, KO를 source of truth로 통일):**
- EN/JA/ZH FEATURES video 경로 KO와 동일 순서로 통일
  - [0] weight-loss.mp4 / [1] priceCard / [2] hero.mp4 / [3] is-it-right.mp4
- EN COMPACT_FEATURES[0]에 `questCard: true`, [1]에 `video: "/predictmodel.mp4"` 추가 (KO 구조 일치)
- JA/ZH 히어로 섹션에 `<video>` 블록 추가 (KO/EN과 동일 마크업, `/hero.mp4`)

**미처리 (별도 보고):**
- JA/ZH의 COMPACT_FEATURES 섹션 렌더링 자체가 빠진 건 사용자 지시 범위 밖으로 판단해 이번 작업에서는 수정하지 않음. 번역 데이터는 이미 존재하므로 다음 회의에서 렌더 블록 추가 여부 결정 필요.

**재발 방지:**
- 다국어 랜딩 파일은 KO → EN → JA → ZH 순으로 동일 구조 유지 원칙
- 신규 섹션 추가 시 4개 파일 동시 작업 의무화
- 로케일 파일 간 diff 체크를 릴리스 전 수동 검증

---

### 회의 18: 주간 퀘스트 월 경계 처리 (Case 1 이어받기 / Case 2 축소)
**참석:** 대표, 기획자, 프론트엔드 개발자, 평가자, 페르소나 유저 4명
**일자:** 2026-04-05
**증상:** 달이 바뀌어도 "이번 주 퀘스트"가 ISO 주 기준으로 이전 달 세션까지 카운팅. 유저 직관(새 달 = 리셋)과 불일치. 또한 HomeScreen은 이미 월 경계 클램핑 중이라 같은 앱에서 "이번 주" 정의가 두 가지 → 일관성 버그.

**1차 제안 (기획자):** 일괄 축소 테이블로 부분 주 목표 줄이기 → 단순하지만 유저 노력 인정 못 함

**대표 수정 제안 (채택):**
- 잘린 주에 **지난 달 부분에 활동이 있으면** → ACSM 기본 유지, 진행도 이어받기 (Case 1)
- 지난 달 부분 활동 **없으면** → 축소 테이블 적용 (Case 2)
- 초과 달성은 target 캡 (`Math.min(current, target)` 이미 적용 중)

**축소 테이블 (성인 기준, 나이/성별 base보다 크면 base로 캡):**
| 주 길이 | high | moderate | low | total |
|---|---|---|---|---|
| 7일 (정상) | 2 | 2 | 1 | 5 |
| 6일 | 2 | 2 | 1 | 5 |
| 5일 | 1 | 2 | 1 | 4 |
| 3-4일 | 1 | 1 | 1 | 3 |
| 2일 | 1 | 1 | 0 | 2 |
| 1일 | 0 | 1 | 0 | 1 |

**구현 요약:**
1. `getCurrentWeekQuestWindow(history, today)` 헬퍼 신설 — Case 0/1/2 분기, `{start, end, days, isScaled}` 반환
2. `scaleWeeklyTarget(base, weekDays)` — 축소 테이블
3. `generateWeeklyQuests`가 `weekDays` 파라미터 받아 축소된 target 생성
4. `weekDays < 5`면 `bonus_streak_5` 퀘스트 숨김 (물리적 불가능)
5. `getOrCreateWeeklyQuests` 반환값에 `window` 추가 — ProofTab이 UI 표시용 사용
6. `rebuildFromHistory`가 각 세션 시점의 윈도우로 그룹화 (과거 EXP 재계산 일관성)
7. `HomeScreen.tsx:thisWeekCount` 동일 윈도우 사용 → 두 화면 일관성 자동 확보
8. ProofTab UI: 날짜 범위 표시 ("4/1 ~ 4/5, 5일") + isScaled일 때 안내 문구 "월이 바뀌어서 이번 주는 짧아요"
9. i18n: ko + en 동시 작업 (proof.questDays, proof.questScaledNotice)

**페르소나 유저 검증 (4/4 만장일치):**
- 민지(헬린이), 수진(주부): "새 달 = 새 시작" 직관 충족
- 현수(홈트), 지훈(러너): "지난 달에 운동했으면 그 노력 인정" 만족

**엣지 케이스 처리:**
- 3/30~31 활동 후 4/1 진입 → Case 1, ACSM 유지, 진행도 이어받음
- 지난 달 활동 없이 4/1 진입 → Case 2, 5일 축소 목표
- 월 말일=일요일 달 → 새 ISO 주 정상 시작 (월 경계 안 걸침)
- 초과 달성 → target 캡, 추가 보너스 없음 (대표 지시)
- Case 2→1 전환 (백필 엣지 케이스) → EXP 델타 정상 계산, 드문 경우

**재발 방지:**
- "이번 주" 정의 변경 시 questSystem + HomeScreen + ProofTab 3곳 동시 검증
- 부분 주 target은 테이블로 관리, ad-hoc 계산 금지

---

### 회의 16: 고강도 퀘스트 미반영 버그 + intendedIntensity 도입
**참석:** 대표, 프론트엔드 개발자, 기획자, 평가자, 백엔드 개발자(필요 시)
**일자:** 2026-04-05
**증상:** 고강도 운동 완료해도 intensity_high 퀘스트에 카운트 안 됨

**근본 원인 (프엔 진단):**
`classifySessionIntensity` ([workoutMetrics.ts:750](src/utils/workoutMetrics.ts#L750))가 세션 로그 데이터에서 best1RM을 **자기참조**로 추정한 뒤 각 세트 %1RM을 계산. 워밍업·램프업 세트가 평균을 끌어내려 80% 임계값 미달 → "moderate"로 오분류.

**세션 모드별 현재 분류 (기획자 검증):**
- 부위별/밸런스: 램프업 시 moderate로 떨어짐
- 홈트(home_training): 맨몸 위주 → percentages skip → rep 폴백 → 대부분 low
- **러닝: 모든 운동이 cardio 타입 → strength/core 필터에서 전부 skip → 무조건 "low"** ❌
- 결과: 고강도 인터벌 스프린트, 플라이오메트릭 HIIT도 평생 intensity_high 못 깸

**기획자 의도-구현 갭:**
원래는 "유저가 선택한 강도 = 수행한 강도"로 인정해야 함. 현재는 데이터 역분석 → 감시 시스템이지 퀘스트 시스템이 아님. 트레이너 상식상 램프업은 당연한데 램프업 유저를 패널티 주는 구조.

**평가자 체크리스트 (각 역할 이해도 검증):**
- 프엔: 버그 재현 + 데이터 흐름 4단계 추적 ✓
- 기획자: 의도-구현 갭 구체 지목 + 해결방향 ✓
- 평가자: 양측 답변 교차 검증 + 자기편향 체크 ✓

**3개 옵션 검토:**
- A. 의도 기반 전환: 서버가 플랜 생성 시 `intendedIntensity` 필드에 값 찍어 저장, classify는 이 필드 우선
- B. 데이터 로직 수정: 워킹셋 필터, true 1RM 참조, 임계값 완화
- C. A+B 혼합

**대표 결정:** **Option A 채택**. 이유:
- 러닝은 애초에 %1RM 개념이 없어 데이터 추리 불가
- 홈트 맨몸 운동도 %1RM 계산 불가
- 서버는 이미 플랜 생성 시 강도를 알고 있음 (intensityOverride + runType + intervalType)
- 코드 변경 최소

**구현 요약:**
1. 백엔드 `WorkoutSessionData`에 `intendedIntensity?: "high"|"moderate"|"low"` 필드 추가
2. 4개 generator + legacy 경로 전부 return에 값 세팅
   - balanced/split/home/legacy: `deriveStrengthIntensity(intensityOverride, goal)` 헬퍼
   - running: runType + intervalType 기반
     - sprint/fartlek → high
     - tempo → moderate
     - walkrun → low
     - easy → low
     - long → moderate
3. 프론트엔드 동일 타입에 필드 추가
4. `WorkoutSession.tsx`의 `{ ...sessionData, exercises }` spread가 자동으로 intendedIntensity 보존
5. `classifySession`이 `h.sessionData.intendedIntensity` 우선 참조, 없으면 기존 로직 폴백 (과거 세션)

**평가자 훅 통과 항목:**
- 데이터 흐름 자동 보존 (WorkoutSession onComplete spread) ✓
- 과거 세션 하위 호환 (폴백 로직) ✓
- 타입 빌드 양쪽 통과 (functions + next) ✓

**배포:**
- Hosting: git push 자동 배포
- **Functions: `firebase deploy --only functions:planSession` 수동 배포 필수** (대표 직접)

**재발 방지:**
- 퀘스트 집계 로직 변경 시 반드시 러닝/홈트/부위별 3개 모드 전부 시뮬레이션
- 데이터 기반 분류는 "보조 신호"로만 사용, 판단의 primary source는 플랜 생성 시점 의도

---

### 회의 15: 랜딩 메타 description 재설계 (3차 자기편향 극복)
**참석:** 대표, SEO 전문가, 콘텐츠 MD, 카피라이터, 기획자, 평가자
**일자:** 2026-04-05
**트리거:** Naver URL 진단에서 description 80자 초과 경고 + "운동 루틴 추천부터 자동 기록까지…" 긴 버전이 page.tsx에서 layout.tsx를 오버라이드 중

**1차 평가 (자연스러움 편향):**
- 축: 클릭욕구/키워드/자연스러움/차별화
- 1위: B안 "헬스 홈트 러닝 뭐할지 고민될 때, 오운잘 AI가 컨디션에 딱 맞는 루틴을 추천해드려요." (91점)
- 편향: SEO 키워드 매칭 약함 (Data Lab 1위 "운동 루틴" 미포함)

**2차 평가 (대표 지적 — 필요한 사람에게 전달 + Naver Data Lab):**
- 새 축: Intent Match / 페르소나 공명 / 진짜 가치 / 검색자 발화 / 브랜드
- 3대 페르소나 설정: 민지(헬린이)·현수(홈트족)·지훈(러너+웨이트 중급)
- 1위: F안 "헬스 홈트 러닝 운동 루틴, 오운잘 AI가 매일 바뀌는 내 컨디션에 맞춰 추천해드려요." (88점)
- 편향: Data Lab 키워드에만 꽂혀서 layout.tsx 기존 브랜드 축(체중감량·헬린이·PT 없이) 무시

**3차 평가 (대표 지적 — 기존 브랜드 핀트 비교):**
- layout.tsx에 이미 박힌 5개 브랜드 축: 체중감량/헬린이/PT 없이/헬스·홈트·러닝/컨디션
- F안 정합도 40% (체중감량·헬린이·PT 없이 3개 누락)
- 자기편향 재인정: 1차는 자연스러움 편향, 2차는 키워드 편향, 양쪽 모두 브랜드 자산 무시
- **최종 F' 안 (94점, 브랜드 정합 20/20 만점):**
  > "헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요." (46자)
- "헬린이도"의 "도" 한 글자로 1차 타깃(헬린이) + 확장 타깃(PT 졸업생·중급자) 동시 포괄

**결정:**
- description (검색용): F' 안
- openGraph.description (공유용): "컨디션만 고르면 오운잘 AI가 3초 만에 헬스 홈트 러닝 루틴을 짜드려요." (41자, 랜딩 슬로건 일치)
- 적용 파일 4곳: layout.tsx(4군데)·page.tsx(2군데)·rss.xml(2군데)
- 배포 후 Naver 서치어드바이저 재수집 요청 필수

**재발 방지:**
- 메타 카피 변경 시 반드시 layout.tsx 기존 브랜드 축(title, keywords, JSON-LD)과 정합 체크
- 자기편향 방지: 매 라운드마다 이전 라운드 편향 축을 명시적으로 차단한 새 체크리스트 작성

---

### 회의 14: 러닝 실행 로직 + 러닝 코치 합류
**참석:** 대표, 러닝코치(마라톤 서브3, 12년), 국대코치, 재활의학교수, 트레이너, 기획자, 평가자, 프론트엔드, 백엔드

**핵심 문제:**
- 템포런이 인터벌 형식("30초 전력/90초 회복")으로 나옴 → 잘못됨
- 워크-런이 단순 타이머로 나옴 → 걷기/달리기 교대 없음
- 인터벌 count "8-10" → FitScreen 파서가 "8"만 인식

**러닝 코치 의견:**
- 템포런: 워밍업5분 → 20-30분 젖산역치 페이스 → 쿨다운5분 (단순 타이머)
- 워크-런: 120초 걷기 / 60초 달리기 × 10 (인터벌 모드)
- 인터벌: 초보 5-6세트, 중급 8, 상급 10-12

**결정:** 4타입 랜덤(sprint/fartlek/tempo/walkrun) + 각각 적절한 FitScreen 모드

---

### 회의 13: 기초체력 + 러닝 프로그램 확장
**참석:** 대표, 국대코치, 재활의학교수, 한체대교수, 운동관리사, 물리치료사, 트레이너, 기획자, 평가자

**러닝 개선:**
- 템포런/워크-런 추가 (중급/초보 옵션)
- 러닝 드릴(A스킵, B스킵) 인터벌 전 실행
- 싱글 레그 밸런스 러너 코어 추가

**기초체력 개선:**
- 홈트 메인에 플라이오메트릭 5종 추가 (점핑잭, 하이니즈, 마운틴클라이머, 베어크롤, 스쿼트점프)
- 터키시 겟업 제거 (초보 혼자 어려움)

**저/중강도 운동 5개 추가:**
- 스텝업, 덤벨 RDL, 글루트 브릿지, 덤벨 플로어 프레스, 케이블 우드찹

---

### 회의 12: 저강도 루틴 + 무게 가이드 개선
**참석:** 대표, 국대코치, 재활의학교수, 한체대교수, 운동관리사, 물리치료사, 트레이너, 기획자, 평가자, 프론트엔드, 백엔드

**대표 지적:** "바벨 저강도 훈련도 합니다. 자기편향적 의견 주의."

**핵심 결론 (15회 시뮬):**
- A(바벨 제외) 전원 최하위 59/90 — 과도한 제한
- **D(바벨 포함 + 무게 가이드 강화) 전원 1위 81.7/90** — 풀 변경 없이 가이드만 구체화
- 바벨 자체가 문제가 아니라 "중간 무게" 같은 모호한 가이드가 문제

**저강도 루틴 6안 크로스 평가:**
- F(트레이너 밸런스형) 70.0/80 1위 — 현재 구조 유지 + 가이드 구체화
- 무게 가이드: 반복 횟수 기준으로 전면 교체
- 유산소: 저강도 시 20분 고정, 쿨다운 제외

---

### 회의 11: 고강도 프로그램 전면 리팩토링
**참석:** 대표, 국가대표 운동코치(20년), 재활스포츠의학 교수, 한체대 교수, 건강운동관리사(15년), 물리치료사(20년+), 트레이너, 기획자, 평가자, 프론트엔드, 백엔드

**문제:** 고강도(strength/high) 선택 시 케틀벨 고블릿 스쿼트, 케틀벨 스윙 등 고중량 불가 운동이 나옴

**전문가 5개 안 크로스 평가 (15회 시뮬):**
- A. 국대코치 (전부 고중량 5×3-5): 61.5/85 — 일반인 부적합
- B. 재활의학 (피라미드): 70.5/85 — 안전 최고, 볼륨 부족
- C. 한체대 (DUP): 71.5/85 — 학술 근거 최고, 타겟층 어려움
- D. 운동관리사 (히스토리 분리): 70.2/85 — 타겟층 최적, 과부하 보수적
- **E. 트레이너 종합: 74.3/85 — 전 항목 균형 1위**

**최종 결정: E+D 합체안**
- 주력 2종(5×3-5 바벨) + 보조 2종(4×6-8) + 고립 1종(3×8-10)
- Push일: 스쿼트 + 벤치 주력 / Pull일: 데드 + 로우 주력
- 데드+스쿼트 같은 날 고강도 금지 (물리치료사 안전 규칙)
- 신규 운동 12개 추가 (바벨 힙 쓰러스트, 핵 스쿼트, 스모 데드 등)

---

### 회의 10: 콜드스타트 로딩 튕김 긴급 수정
**참석:** 대표, 프론트엔드, 디자이너, 기획자, 평가자
**아젠다:** 마스터 플랜 로딩 시 홈으로 튕기는 버그 — 유저 이탈 위험

**근본 원인:** 로딩 오버레이가 ~2초 후 onComplete 호출 → 콜드스타트 재시도 ~6초 → pendingSession 없는 채로 마스터 플랜 진입 → null 가드 → 홈 튕김

**대표 지시:** "버그 형태는 문제. 차라리 로딩을 길게. 자기편향 없이 해결하라."

**해결 (평가자 C안 합의):**
- 재시도 1회 → 3회 (2초 간격)
- onComplete에서 pendingSession 올 때까지 500ms 폴링
- 실패 시 alert 대신 조용히 condition_check 복귀
- 유저 체감: 로딩 좀 길어질 수 있지만 **절대 안 튕김**

---

### 회의 9: 홈 AI 코치 멘트 2버블 리디자인
**참석:** 대표, 기획자, 트레이너, UX/UI 디자이너, 프롬프트 전문가, 콘텐츠 MD, 대학생, 직장인, 프론트엔드, 백엔드, 평가자
**아젠다:** 홈 코치 멘트가 시스템 알림 톤 → 전우애 톤으로 변경

**평가자 시뮬 15회 결과:**
- 1버블: 46.2/65 (체류 좋지만 전우애/정보 부족)
- **2버블: 58.0/65 (전원 최고점 — 인사+추천 균형)**
- 3버블: 53.3/65 (정보 좋지만 홈에서 과함)

**평가자 자기편향 인정:** 처음 1버블 밀었으나 체류 시간(C4)만 본 편향. 시뮬 후 2버블 합의.

**결정:**
- 2버블 구조: 인사/감정 + 추천/행동
- 상황 6가지: 오늘함/스트릭3+/오랜만/시간대/빈부위/첫방문
- 룰베이스 템플릿, 날짜 시드 랜덤 (0원)
- 타이핑 애니메이션 제거 (홈은 즉시 표시)

---

## 2026-04-04 이전 세션 — 기억 기반 주요 회의 기록

### FitScreen 마지막 세트 피드백 — 다음 운동 미리보기
**참석:** 대표, 프론트엔드 개발자, UX/UI 디자이너
**결정:** 마지막 세트 피드백 바텀시트 상단에 NEXT 운동 정보 표시. 기존 active 뷰의 NEXT 뱃지 스타일과 동일한 톤.

### MasterPlanPreview 세트 수 1세트 설정 불가 버그
**원인:** `rebuildCount` 함수에서 `sets > 1` 조건 → `sets >= 1`로 수정
**결정:** 즉시 수정 완료

### ShareCard 한국어 모드 운동명 표기
**결정:** KO 모드에서 한글 운동명만 표시 (영문 괄호 제거). `getExerciseName` 함수에서 ko일 때 `.split('(')[0].trim()` 적용.

### 운동 영상 매핑 — exerciseVideos.ts
**여러 세션에 걸쳐 진행:** 빈 항목 0개 달성. 워밍업/모빌리티/러닝/홈트/쿨다운 등 전체 운동에 YouTube Shorts ID 매핑 완료.

### 캘린더 잔디 색상 범례
**결정:** GitHub 스타일 범례 하단 추가. 파스텔 그린 계열 채도 그라데이션 (#C2D8C2 → #7BA57B → #2D6A4F → #1B4332). "적음 ░▒▓█ 많음 · 운동시간 기준"

### i18n 다국어 지원
**결정:** 모든 UI 텍스트 추가 시 ko.json + en.json 동시 작업 필수. useTranslation() 훅 사용. 대표님 직접 지시 — "앞으로 UI 개발 시 이 점 꼭 참고".

### 코어/복근 운동 횟수
**결정:** 크런치, 레그레이즈 등 복근류 운동 시작 횟수를 20회로 설정. `buildCore`에서 코어 전용 렙수 적용.

### 맨몸 운동 렙수 선택 풀 확장
**결정:** `hasWeight` false인 맨몸 운동(딥스, 풀업, 푸시업 등)도 고렙 풀 [5,8,10,15,20,30,40,50,60,80,100] 사용.

### 마스터 플랜 운동명 한글만 표기
**회의 참석:** 기획자, 트레이너, UX/UI 디자이너, 평가자, 백엔드, 프론트엔드
**결정:** KO 모드에서 "바벨 벤치 프레스 (Barbell Bench Press)" → "바벨 벤치 프레스"만 표시. EN 모드에서는 영문만. `getExerciseName` 1줄 수정으로 전체 적용. 폰트 사이즈 분기 재조정 (5/8/10 → 6/9/12).

### 저강도 최소 3세트
**결정:** 살빼기/저강도 선택 시에도 세트 수 최소 3세트 보장. `Math.max(baseSets, 3)` 적용.

---

## 2026-04-04 — Workout Report 리디자인 + 보안 강화 + 코치 시스템

### 참석자
대표(임주용), 콘텐츠 MD, 퍼포먼스 마케터, 그로스 마케터, 헬스 인플루언서, 대학생 유저, 30대 직장인 유저, 퍼블릭 헬스 트레이너, UX/UI 디자이너, 평가자, 프론트엔드 개발자, 백엔드 개발자, 기획자, 데이터보안팀장, 프롬프트 전문가

---

### 회의 1: Workout Report 와우 포인트 브레인스토밍
**아젠다:** 운동 끝나고 유저들이 와우할 킥 포인트를 어떻게 줄 것인가

**주요 아이디어:**
- 콘텐츠 MD: 핵심 성취 빅 넘버 히어로
- 퍼포먼스 마케터: 공유용 비주얼 카드
- 그로스 마케터: 스트릭 + EXP 프로그레스바 상시 노출
- 헬스 인플루언서: 누적 카운트 + 마일스톤 뱃지
- 대학생: 게임 결과창 S/A/B/C 등급
- 직장인: 시간대 인정 ("6:30 AM에 해냈습니다")
- 트레이너: PR 달성 시 축하 이펙트 + **마이크로 PR** (핵심 인사이트)

**결정:** 
- 마이크로 PR (무게/렙수/볼륨 PR) 감지 → 히어로 카드
- 시간대 맥락 메시지
- EXP 항상 펼침 + 스트릭 비주얼
- 폴백 체인: PR > 완벽수행 > 스트릭 > 총볼륨 > 첫운동

**평가 결과:** 시뮬레이션 15회 돌려 자기편향 체크 완료. 조건부 히어로(UX 디자이너) 최고점.

---

### 회의 2: 코치 멘트 전우애 톤 설계
**아젠다:** AI 코치가 로봇이 아니라 함께 운동한 동료처럼 느껴지도록

**핵심 인사이트 (대표님):**
> "유저가 원하는 건 어디 부위 자극 받았다가 아니라, 함께 고생하고 이 고난을 해쳐나왔다 함께! 라는 느낌"

**결정:**
- 주어를 '우리'로 — "해냈어요" → "같이 해냈어요"
- 구체적 고생 언급 — "마지막 세트", "무게 올릴 때"
- AI의 감정 표현 — "저도 긴장했어요", "옆에서 보면서"
- 카테고리별 20개 멘트 (무게PR/렙수PR/완벽/기본/첫운동/러닝/스트릭)

---

### 회의 3: 장비별 + 운동명 연결
**아젠다:** 운동명을 멘트에 어떻게 자연스럽게 연결할 것인가

**결정:**
- 장비 분류: barbell/dumbbell/kettlebell/machine/bodyweight/running
- 렙수 구간: 저렙(1-5)/중렙(6-12)/고렙(13+)
- 맨몸 운동 특화 풀 8개
- 시간대별 분류: 새벽/점심/저녁/심야

---

### 회의 4: 보안 강화 — 서버 이동 전략
**아젠다:** 핵심 기술(알고리즘)과 룰베이스 형태를 외부에서 확인할 수 없게

**보안팀장 제안 → 평가자 검증:**
- 알고리즘 서버 이동: **필수** (ROI 최고)
- 응답 랜덤 변형: **필수** (저비용 고효과)
- 운동 풀 서버 이동: **과도** (UI에서 보이는 공개 정보)
- 엔드포인트 통합: **반대** (유지보수 리스크)

**최종 결정:**
- generateAdaptiveWorkout → functions/src/workoutEngine.ts
- coachMessages → functions/src/coachMessages.ts
- 클라이언트 workout.ts 1,408줄 → 110줄 (타입+UI풀만)
- /api/planSession, /api/getCoachMessage 엔드포인트

---

### 회의 5: Gemini API 전환
**아젠다:** 룰베이스 150개 풀 vs Gemini 동적 생성

**전원 합의:** Gemini 방식이 자연스러움/다양성/유지보수 모두 우세
- 비용: DAU 1만에도 월 ~8만원 (커피 한 잔)
- 3버블 구조: 감정 → 디테일 → 마무리
- 5초 타임아웃 + 룰베이스 폴백 (세션 데이터 기반)

---

### 회의 6: 코치 멘트 다양성 — 자유도 vs 제한
**아젠다:** A/B/C/D 선택지 방식이 제한적이지 않은가

**전원 의견:** 선택지 제거, 자유도 + 울타리 방식으로

**울타리 16개 항목 확정:**
이모지 금지(한글 이모티콘 OK), 영어 금지, 화이팅 금지, 의학용어 금지, 격식체 금지, 반말 금지, 운동명 중복 금지, 부정적 피드백 금지, 강요 금지, 체중/외모 금지, 비교 금지, 거짓 정보 금지, 3줄 초과 금지, 같은 마무리 패턴 금지, 직접 질문 금지, 숫자 나열 금지

**프롬프트 v5:** 대표님 직접 작성 예시 5개 반영, 트렌드 언급 허용

---

### 회의 7: 성장 예측 페이지 코치 멘트
**아젠다:** 목표별 기대사항을 동적으로 보여주기

**결정:**
- 룰베이스 템플릿 + 변수 치환 (0원)
- 목표별 5개 변형 (날짜 시드 랜덤)
- 기초체력: 군대/국대 드립 ("특급 전사!", "국대급!")
- 건강유지: 꾸준함 중심 ("총 45회! 12주째!")
- 탭 전환 시 해당 목표 멘트로 변경

---

### 회의 8: HOME 탭 복귀 버그 (4회 보고)
**근본 원인:** `case "home"`에서 `completedRitualIds.includes("workout")`이면 무조건 WorkoutReport 재렌더링

**해결:** 
- onClose + handleTabChange에서 completedRitualIds "workout" 제거
- 운동 플로우 중 탭 전환 차단 (master_plan_preview, workout_session)
- 이전 프론트엔드 개발자 교체 → 새 시니어 개발자 투입

**재발 방지:** 상태 변경 시 해당 state를 읽는 모든 곳 grep 추적 의무화

---

### 오늘 배포 체크리스트
| 항목 | 배포 | 상태 |
|---|---|---|
| Hosting (CI 자동) | git push | 완료 |
| Functions (수동) | firebase deploy --only functions | 대표님 배포 필요 |

### 다음 스프린트 백로그
1. 채팅 기능 (ai/chat.ts, 5턴 제한 + 역할 제한)
2. 기상청 API 연동 (공공데이터포털 키 신청)
3. 콜드스타트 모니터링

---

### 회의 38: 인터벌 타이머 Wall-clock 리라이트
**참석:** 대표, 기획자, 프엔 개발자, 평가자
**일자:** 2026-04-06

**버그:** FitScreen 러닝 인터벌에서 "처음 2분만 작동하고 다음부터 1초마다 바로 끝나는" 증상 재현. 회의 36(v2 refs 기반) + 회의 36 v3(useMemo 안정화) 두 차례 수정에도 불구 잔존.

**근본 원인:** `timeRef.current -= 1` 틱 기반 감산. setInterval 드리프트 + 백그라운드 스로틀 + 렌더 타이밍이 복합 작용하여 페이즈 전환이 불규칙적으로 빨라짐.

**해결:** Wall-clock 기반 전면 재작성 (`Date.now() - phaseStartMsRef`). 매 틱마다 경과시간 재계산 → 드리프트 수학적으로 불가능.

**주요 변경 (src/components/FitScreen.tsx 490~595):**
- 삭제: `timeRef`, `halfFiredInPhaseRef`
- 추가: `phaseStartMsRef`, `pausedAtMsRef`, `midpointFiredRef`, `lastTickSecondRef`
- 틱 주기: 1000ms → 250ms (UI 부드러움)
- Pause/resume: cleanup 시 `pausedAtMsRef = Date.now()`, 재개 시 `phaseStartMsRef += now - pausedAt`로 shift
- Midpoint 알림: `remainingInt <= floor(phaseTotal/2)` 조건으로 페이즈당 1회
- Tick 사운드: `lastTickSecondRef`로 같은 초 중복 발사 방지

**검증:** 15개 체크리스트 (페이즈 전환, 중간 알림, pause/resume, 백그라운드 복귀, 3타입 색상/라벨). 실기기 대표 확인 필요.

---

### 회의 39: 러닝 세션 공유카드 차별화 (초기 논의)
**참석:** 대표, 기획자, UX 디자이너, 러닝 코치, 프엔/백엔 개발자, 평가자, 데이터 담당
**일자:** 2026-04-06

**배경:** 현재 ShareCard는 웨이트 전용으로 설계됨. 러닝 세션 진입 시 EXERCISES 필터가 `type === "strength"`만 통과해 목록 비어있고, `isStrength=false`로 Volume 표시 안 됨. PR 감지도 `weightUsed` 기반이라 러닝에 해당 없음.

**제안된 3 Plan:**
- Plan A: 러닝 전용 2카드 신설 (Summary + Weekly)
- Plan B: A + 타입별 색상 차별화
- Plan C: 최소 수정

→ Plan A 채택, 회의 40/41에서 구체화.

---

### 회의 40: GPS 도입 결정 + Strava 스타일 UI 방향
**참석:** 대표, 기획자, UX 디자이너, 러닝 코치, 브랜드, 프엔 개발자
**일자:** 2026-04-06

**대표 핵심 결정 3가지:**
1. **GPS 도입** — 우리 앱은 인터벌 러닝 중심이라 어차피 화면 보고 뛰어야 함. PWA 백그라운드 GPS 제약이 애초에 해당사항 없음. `navigator.geolocation.watchPosition` + Wake Lock으로 Strava급 정확도 가능.
2. **지도 전면 제거** — "지도는 빼고 해도 될거같은데". Mapbox 라이브러리/토큰/Static API 불필요. html2canvas CORS 이슈 소멸. Firestore `gpsTrack` 저장도 불필요.
3. **Strava 스타일 UI** — 레이아웃/타이포/정보 밀도만 차용, 브랜드 컬러는 emerald 유지 (오렌지 금지).

**ShareCard 러닝 최종 레퍼런스:** 사용자 제공 Strava 이미지 (세로 3스탯 Distance/Pace/Time + 하단 로고). 기존 ShareCard 구조에서 벗어나지 않고 내용만 교체.

**기술 스택 확정:**
- GPS: `navigator.geolocation.watchPosition` (샘플 3초)
- Wake Lock: `navigator.wakeLock.request("screen")`
- 페이스 스무딩: 5초 이동평균
- 거리 계산: Haversine 자체 구현
- 저장: summary 숫자만 (gpsTrack X)

---

### 회의 41: 러닝 전용 인터페이스 종합 설계 락인
**참석:** 대표, 기획자(진행), UX 디자이너, 러닝 코치, 재활의학 교수, 브랜드, 프엔/백엔 개발자, 평가자, 현지화
**일자:** 2026-04-06

**목적:** 러닝 관련 모든 화면/로직/데이터 구조를 **구현 착수 전** 완전 확정. 대표 컨펌 후에만 코드 작업.

**대표 최종 지시 (확정):**
1. **ShareCard 러닝** — 기존 ShareCard UI에서 많이 벗어나지 않게 통일성 있게. 내용만 Strava 이미지 스타일 (세로 3스탯: Distance 5.01km / Pace 6:27/km / Time 32m 22s) + 하단 오운잘 로고.
2. **WorkoutReport 러닝** — 기존 웨이트 레이아웃과 비슷하게, **단 AI 코치 챗은 무조건 최상단 배치**. 나머지는 그 아래에 히어로 스탯 + 스플릿 + 인터벌 분해 + 주간.
3. **FitScreen 러닝** — 지도 미니뷰 제거. 하단 재생/완료 버튼은 기존 웨이트 FitScreen과 완전 동일. 공간이 남으면 NEXT 프리뷰 + 라운드 도트로 채움.
4. **GPS 권한** — 바텀시트 대신 툴팁형 중앙 팝업 모달.
5. **지도 제거** 확정. Mapbox 관련 작업 전면 스킵.

**전문가 의견 요약:**
- UX 디자이너: 카드 외곽은 `bg-white rounded-3xl border border-gray-100 shadow-sm` 전부 재사용, 내용만 분기. 신규 시각 언어 0개.
- 러닝 코치: NEXT 프리뷰 강력 지지, 인터벌 모드에서 페이스는 페이즈 전환 시 리셋, 스플릿은 인터벌 모드에서 km 대신 라운드 단위가 의미 있음.
- 재활의학 교수: 스프린트/파틀렉 완료 후 AI 코치 버블 3에 "48시간 회복" 하드 제약 필수. 실시간 경고 UI 금지 (리포트 회고만).
- 브랜드: emerald 고정, Strava 오렌지 `#FC4C02` 금지, "⚡" 표시는 lucide Zap 아이콘으로 (이모지 금지).
- 데이터: Firestore `runningStats` 필드에 summary만 저장 (< 2KB). `gpsTrack` 저장 안 함.
- 현지화: 30개 신규 키 × 2언어 일괄 추가 필수 (feedback_i18n_always).

**평가자 독립 체크리스트 3종:**
- 체크리스트 A (UI 통일성): rounded 값, 색상, 폰트 스케일, BrandFooter 일관
- 체크리스트 B (기능/엣지케이스): 권한 거부, 실내, 첫 러닝, GPS 끊김, pause
- 체크리스트 C (릴리즈 준비도): functions 배포, i18n diff, PROMPT_HISTORY.md, MEETING_LOG

**시뮬 E2E 결과 — 발견된 결함 4개:**
1. 권한 팝업 이중 모달 → [허용] 누르면 모달 먼저 닫고 1 tick 후 `getCurrentPosition`
2. GPS lock-on과 시작 버튼 충돌 → 독립 동작, 미잡혀도 시작 가능
3. Hero 3분할 페이스 라벨 혼란 → 평균 전체가 아닌 **전력 평균** 사용, 라벨 명시
4. pause 장기화 시 GPS 배터리 낭비 → M-B 이후 결정

**작업 마일스톤:**
- M-A: functions 회의 36/37 배포 + ShareCard 러닝 기초 레이아웃 (GPS 없이도 동작)
- M-B: GPS 스파이크 (`useGpsTracker` 훅 + Haversine 거리/페이스)
- M-C: (삭제 — Mapbox 불필요)
- M-D: `RunningReportBody` + `StrengthReportBody` 분리, AI 코치 최상단
- M-E: 러닝 프롬프트 v1 + fallback
- M-F: (삭제 — Mapbox Static 불필요)
- M-G: 실내 모드 토글
- M-H: 러닝 타입 가이드 문구 (MasterPlanPreview 하단)
- M-I: GPS 권한 중앙 팝업 모달

**대표 최종 컨펌 "진행합시다!" — 2026-04-06**
ShareCard 러닝 레이아웃 확정 + 전체 Plan 승인. M-A 즉시 착수.

**재발 방지:**
- 이모지 검수: PR 전 grep 필수 (feedback_no_emoji)
- i18n 동시 커밋 (feedback_i18n_always)
- 기존 디자인 언어 강제 재사용 (rounded-3xl 카드)

---

## 회의 59: 히스토리 탭 "레거시 아카이브" 브랜딩 리디자인 (2026-04-12)

**배경:** 론칭 2일차 결제 1명, CVC 1명. 컨디션체크→플랜 프리뷰에서 대량 이탈. "굳이 써야 할 이유"가 없는 상태.

**참석:** 대표, 기획자, 평가자, UX/UI 디자이너, 콘텐츠 MD, 카피라이터, 그로스 마케터, 박충환 교수 (브랜드), Nir Eyal (습관)

**핵심 결정:**

### 1. 메타포: 석재 벽 (Stone Wall)
- 운동 1회 = 돌 하나를 쌓는다
- "내 몸을 짓는다(Build)" = "벽을 짓는다(Build)" 은유
- 타이틀: "나의 기록, 나의 역사" / "My Legacy"

### 2. 아카이브 카드 UI (P0)
- 돌 번호 (#47) — 전체 기록 중 순번, Investment 핵심
- 종목 태그 (벤치프레스, 스쿼트 등 칩 표시)
- 한 줄 해석 — 규칙 기반, 클라이언트 사이드 (PR 달성, 체중배수, 연속일수 등)
- 강도 표시 — 좌측 세로 바 (고/중/저)
- 카드 등급 진화: #1~9 연한석재 → #10~24 일반 → #25~49 강화 → #50~99 대리석 → #100+ 흑요석

### 3. 빈 상태 디자인 (P0)
- 점선 빈 블록 + "첫 번째 돌을 놓으세요" + CTA
- Zeigarnik 효과로 "채우고 싶다" 유도

### 4. 마일스톤 시스템 (P1)
- #10, #25, #50, #100 마일스톤
- 다음 마일스톤까지 프로그레스 바 항상 표시
- "3번만 더!" 트리거

### 5. 이탈 방지 연결 (P2)
- 컨디션 체크 하단에 마일스톤 바: "이번 운동이 48번째 역사가 됩니다"
- 첫 방문자: "이 운동이 당신의 첫 번째 기록이 됩니다"

### 6. 운동 완료 토스트 (P3)
- 리포트에서 "#48번째 돌이 쌓였습니다" 토스트
- 아카이브 진입 시 새 카드 glow 하이라이트

**평가자 Hook 6개:** 이탈전환력, 쌓는쾌감, 빈상태유인력, 그래서뭐테스트, 레거시내러티브, 재방문동기
**조건부 통과:** H4 — 한 줄 해석 변형 최소 15개 필요
**주의:** 삭제해도 돌 번호 유지 여부 결정 필요, 100개+ 렌더링 최적화

**브랜드 전략 (박충환):** Brand Admiration 3E — Enable(AI플랜) + Entice(시각쾌감) + Enrich(레거시) 완성
**습관 설계 (Nir Eyal):** Hook 4단계 중 Investment(쌓은 것) 강화가 핵심. 돌 번호는 절대 리셋 불가.

**대표 컨펌:** 대기 중

---

### 회의 57: 온보딩·홈화면 전면 재설계 — LLM 채팅형 홈 채택 (2026-04-15)

**배경:** A/B v3 설문 (500명) 결과 타겟(20~30대 초보 여성) 85.4%가 B안(0질문+샘플+대화) 선호, 결제 의향 B=4,954원 vs A=880원. 기존 7스텝 휠피커 온보딩 + ConditionCheck 구조 폐기 결정.

**참석:** 대표, 기획자, 프엔, 박서진(프엔 헤더), 백엔, 프롬프트 전문가, UX/UI, 운동생리학자, 그로스, Nir Eyal, 박충환, 평가자

**핵심 결정:**

1. **온보딩·ConditionCheck 완전 폐기** — 채팅 자체가 온보딩
2. **홈화면 = 채팅 진입점**
   - 채팅 입력창 "오늘 뭐 해볼까요?"
   - 예시 프롬프트 탭 5개 (길이별 · 복붙+수정 가능)
   - 기존 대시보드 요소는 스크롤 하단
   - 잠금 카드/로그인 유도 UI 제거 (대표 지시)
3. **카드 9장/4탭 칩 모두 기각** (기획자 오버엔지니어링 반성)
4. **정규식 파싱 제안 기각** — 자연어 다양성 대비 유지보수 지옥. 온보딩 Gemini 비용은 DAU 10K 기준 월 160원 수준으로 실질 무의미. 진짜 비용 주범은 코치 멘트(세션당 호출)이며 별도 세션에서 다룸.

**Gemini Intent 스키마 확정:**
```
condition: { bodyPart, energyLevel, availableTime, bodyWeightKg?, gender?, birthYear? }
goal, sessionMode, targetMuscle?, runType?, intensityOverride?
recentGymFrequency?: "none" | "1_2_times" | "regular"  (신규)
pushupLevel?: "zero" | "1_to_5" | "10_plus"             (신규, 1RM 대체)
confidence, missingCritical, clarifyQuestion?
```

**availableTime 스냅 규칙:**
- 러닝 long run: 30/50/90 유효
- 그 외: 30/50만 (60+ 요청 시 50 캡, 과훈련 방지)
- 유저는 세트 개인 수정 가능하므로 상한 엄격 유지

**입력 3종 예시 프롬프트 (길이별):**
- 짧은: "오늘 가슴 30분 운동하고 싶어"
- 중간: "어깨 뻐근한데 하체 40분 하고 싶어. 체력은 보통."
- 긴: "35살 여 162cm 58kg 헬스 3년 정자세 푸쉬업 5개 오늘 하체 40분 살 빼고 싶어"

**단계별 실행안 (Phase 0~6):**
- Phase 0: 종속성 맵 (완료)
- Phase 1: 백엔드 계약 준비 (UserCondition 필드 추가, parseIntent Cloud Function, 프롬프트 v6)
- Phase 2: 신규 ChatHome 병행 개발 (feature flag)
- Phase 3: 라우팅 스위치 (신규 유저부터)
- Phase 4: 레거시 제거 (Onboarding.tsx, ConditionCheck.tsx 삭제)
- Phase 5: coach.ts/FitnessReading 프로필 null 그레이스풀 처리
- Phase 6: E2E + 배포 + Analytics 모니터링

**영향 범위 전수:** 프론트 11곳 + 백엔드 5곳 + Firestore/localStorage 키 + i18n ~70개 키

**대표 지시사항:**
- 절대 커밋·푸시 금지 (각 Phase 끝나도 대표 확인 전까지)
- 각 Phase 완료 시 `npm run dev` + Functions 에뮬레이터 수동 확인 후 진입
- Phase 1 종료 시 터미널 parseIntent 3케이스 JSON 출력 확인

**블라인드 스팟 평가자 지적 → 결정:**
- 부상·질병 이력 수집: 보류 (대표 지시)
- 범용 플랜 예시 3개 작성: 보류 (선택지 축소)
- 기존 유저 마이그레이션: (a) 프로필 있으면 채팅홈 직행, 카드·온보딩 재노출 없음
- 타겟 외 세그먼트(남성 20/30대) 커버: 카드 방식 폐기로 자동 해소 (채팅은 모두 공통)

**역할 분담:**
- 기획자: 스펙·수락기준·최종 판정
- 프엔: Phase 2~4 구현
- 박서진: ViewState·컴포넌트 경계 감수
- 백엔드: Phase 1 parseIntent, Phase 5 coach 컨텍스트
- 프롬프트 전문가: 프롬프트 v6 작성, PROMPT_HISTORY 기록
- 평가자: 매 Phase 체크리스트 실행, 렌더 경로 추적, 자기편향 경고

**다음 진입:** Phase 1 착수 (대표 컨펌 후)

---

### 회의 57 후기: Phase 1~5 실행 완료 (2026-04-15)

**진행 내역:**

- **Phase 1 (백엔드 계약 준비)** — UserCondition에 recentGymFrequency/pushupLevel 옵셔널 추가, 신규 parseIntent Cloud Function 작성, PROMPT_HISTORY에 parseIntent v1 기록, firebase.json rewrite 등록, functions build 그린
- **Phase 2 (ChatHome 신규)** — dashboard/ChatHome.tsx 생성, NutritionTab AI 코치챗 UI 재사용, HomeScreen 상단 greeting·date 블록 동일 이식, 예시 프롬프트 5종 pill 칩 + 좌우 fade + 가로 스냅, 무료 체험 배지 헤더 인라인, textarea auto-expand, feature flag ?chat_home 토글, ViewState home_chat 추가
- **Phase 3 (라우팅 스위치)** — flag 기본값 ON 전환, opt-out은 ?chat_home=0, condition_check/onboarding 진입을 home_chat으로 useEffect redirect, canSubmit 가드로 게스트 소진/페이월 사전 차단
- **Phase 4 (레거시 제거)** — Onboarding.tsx 347줄 삭제, ConditionCheck.tsx 544줄 삭제, SessionSelection 타입을 workout.ts로 이관, ViewState enum 축소, 6곳 setView condition_check 제거, 탭바 조건식 단순화
- **Phase 5 (coach/프로필 null 안전)** — 검토 결과 5-1/5-3/5-4 이미 만족(coach는 condition만 사용, FitnessReading은 자체 profile step 보유, WorkoutReport는 bodyWeightKg 폴백). 5-2(프로필 컨텍스트 주입 폴리시)는 대표 결정으로 스킵

**인프라 변경:**
- next.config.ts — 개발 중 /api/* → 127.0.0.1:5001/ohunjal/us-central1/* dev-only 프록시 (Node 24 IPv6 이슈 회피)
- .claude/hooks/block-commit-push.js — 배포 계열 커맨드 차단 패턴 추가, settings.json PreToolUse Bash 매처에 연결

**tsc/build 상태:** 모두 그린 (루트 npx tsc --noEmit exit 0, functions npm run build 그린)

**커밋/푸시/배포 금지 상태 유지 (대표 지시)**

**남은 선택 정리(우선순위 낮음):**
- i18n onboarding.* / condition.* 키 미사용분 정리 — 롤백 리스크 대비 현재 보존
- coach.ts 프로필 컨텍스트 주입 — 후속 세션에서 재검토 가능
- Analytics 이벤트 onboarding_* 제거 여부 — 기존 대시보드 영향 고려 필요

**대표 컨펌 대기:** E2E 수동 테스트(신규/기존 로그인 → 채팅 → 플랜 → 운동 → 리포트 → 재진입) 성공 시 커밋 승인

---

## 회의 58 (2026-04-16): 플랜 저장 기능 + AI 운동 해석 정합성

**소환:** 대표(임주용), 기획자, 프엔, 평가자, 프롬프트 전문가, 건강운동관리사(15년), 물리치료사(20년), UX/UI 디자이너, 콘텐츠 MD, 백엔드 개발자, Nir Eyal

**배경 (고객 피드백):**
1. "기구 없이" 요청했는데 덤벨 운동 포함됨 (부분 이해)
2. "등 안 구부리는 운동" 요청했는데 cat-cow 반복됨 (플랭크류 기대)
3. AI 생성 플랜을 저장해 재사용할 수단 없음 — 매번 LLM 토큰 소모

### 결정 1: 플랜 저장 기능 (이슈 #3)

| 항목 | 결정 |
|---|---|
| 저장 진입 | MasterPlanPreview CTA "내 플랜에 저장" (기존 공유 버튼 교체) |
| 공유 | 헤더 우측 상단 아이콘으로 이동 |
| 스코프 | AI 생성 플랜만 |
| 한도 | 무료 1개 / 유료 5개 |
| 이름 | 자동 명명 (`가슴·삼두·어깨 40분 · Apr 16`) + 연필 수정 |
| 리스트 진입 | 홈 화면 우측 상단 아이콘 |
| 탭 동작 | MasterPlanPreview 경유 → 강도 조정 → 운동 시작 |
| Firestore | `users/{uid}/saved_plans/{planId}` — name, sessionData, createdAt, lastUsedAt, useCount |
| 한도 초과 UX | 덮어쓰기 확인 바텀시트 + 페이월 유도 링크 (추후 A/B) |

**스토리지 비용:** DAU 10K × 유료 5개 ≈ 월 2원 (무시 가능)

### 결정 2: AI 해석 정합성 (이슈 #1, #2)

**진단 (프롬프트 전문가):** parseIntent 스키마에 `equipmentAvailable`, `avoidMovementPattern`, `injuryConcern` 필드 부재 → Gemini가 의도 추출해도 룰엔진이 필터링 못 함.

**해결책: Phase C → A → B 순서**
- **Phase C (운동 태깅)** — 255개 운동에 `equipment`, `movementPattern` 태그 부여. 선행 조건.
  - equipment: `none | dumbbell | barbell | kettlebell | cable_machine | bodyweight_only`
  - movementPattern: `horizontal_push/pull`, `vertical_push/pull`, `squat`, `hinge`, `lunge`, `spinal_flexion`, `isometric_core`, `rotation`, `anti_rotation`, `mobility`, `cardio`
  - 작업 방식: Claude 초안 작성 (~2h) → 대표 검수 (~30min)
- **Phase A (프롬프트 v2)** — parseIntent 스키마 확장
- **Phase B (룰엔진 필터)** — `equipment: none` → 맨몸만, `avoid: spinal_flexion` → 굴곡 제외 + McGill Big 3 우선

**물리치료사 코멘트:** "등 안 구부리고" = 요추 이슈 고도화 시그널. McGill Big 3 (데드버그/버드독/플랭크) 우선 추천이 임상 정답.

**평가자 강조:** 회의 55 칼로리 사건 재발 방지 → Phase B 구현 후 Vitest E2E 테스트 필수 (parseIntent → workoutEngine → 출력 운동 풀).

### 실행 순서 (대표 승인)

| Week | 작업 | 담당 |
|---|---|---|
| 1 | 플랜 저장 기능 (#3) 구현 | 프엔 + 백엔드 |
| 2 | 운동 태깅 초안 (255개) → 대표 검수 | 프엔(초안), 대표(검수) |
| 3 | parseIntent v2 + workoutEngine 필터 + E2E 테스트 | 프롬프트 전문가 + 백엔드 + 평가자 |

### 대표 지시
- 전체 승인, 착수 지시 (2026-04-16)
- 기존 회의 관례대로 각 주차 종료 시 대표 확인 후 커밋


---

## 회의 58-A (2026-04-16): 플랜 저장 기능 보안·백엔드 긴급 감사

**소환:** 평가자, 백엔드 개발자, 박충환, Nir Eyal, 기획자, 대표

### 평가자 Grep 검증 — P0 두 건 발견

**P0-1 (페이월/트라이얼 우회):**
- 저장 플랜 실행 경로가 `incrementGuestTrial()` + `FREE_PLAN_LIMIT` 체크 모두 미경유
- 게스트 1회 플랜 생성 후 저장 → 무한 실행으로 트라이얼 제한 완전 우회 가능
- 유료 한도 `getPlanCount() >= FREE_PLAN_LIMIT` 체크도 건너뜀

**P0-2 (유료 혜택 무력화):**
- 저장 개수 한도가 `localStorage`만 참조 — DevTools 한 줄로 우회 가능
- 무료 1개 / 유료 5개 차이가 클라이언트 조작만으로 돌파됨

### 추가 식별 이슈

- **P1** 데이터 유실(iOS ITP 7일 / 캐시 삭제 / 기기 변경) → Brand Admiration 훼손 (박충환)
- **P2** 무게 박제 여부: FitScreen의 `ohunjal_weight_{exerciseName}` 오버라이드 구조로 실운영엔 문제없을 가능성 높음 (최종 E2E 필요)
- **P2** 게스트 저장 허용 여부 결정 필요

### 대표 결정
- **조치 1 + 2 + 3 모두 진행**
- 조치 3은 **A안** — 게스트 저장 금지, 로그인 모달 유도

### 구현 완료

| # | 조치 | 구현 |
|---|---|---|
| 1 | 저장 플랜 실행 게이트 | `MyPlansScreen.onSelectPlan` 진입 시 게스트/페이월 체크, onStart 저장플랜 경로에서 `incrementGuestTrial` |
| 2 | Firestore 동기화 + 서버 검증 | `functions/src/plan/savedPlans.ts` 신설 (savePlan/listSavedPlans/deleteSavedPlan/markSavedPlanUsed). 서버가 `users/{uid}/billing/subscription.status`로 isPremium 조회 → 한도 강제. `firebase.json` rewrites 4개. 클라이언트 래퍼 + MasterPlanPreview/MyPlansScreen 서버 SSOT 동기화. |
| 3 | 게스트 저장 금지 | `MasterPlanPreview.openSaveSheet`에 `isLoggedIn` 가드, `onGuestSaveAttempt` 콜백 → page.tsx 로그인 모달 |

### 빌드 상태
- 루트 `npx tsc --noEmit` ✓
- `functions && npm run build` ✓

### 배포 메모 (대표 수동)
1. 프론트 push → Hosting 자동 배포
2. `cd functions && npm run build && firebase deploy --only functions` — **신규 4개 함수**
3. 주의: Hosting 선배포 후 functions 배포 사이 잠깐 /api/savePlan 호출 실패 가능 — 기능 사용 유도 자제 권장

### 후속 과제
- E2E 수동 테스트 (게스트/무료/유료 3종 시나리오)
- 무게 박제 확인 테스트
- Firestore Security Rules (현재 서버만 쓰기 중이라 기본 deny로 충분하나, 명시 규칙 추가 권장)


---

## 회의 64 — 러닝 룰엔진 설계 착수 + 자문단 디렉토리 분리 (2026-04-18)

**주제:** VO2 max / 10K / Half / Full 목표별 러닝 프로그램 룰엔진 설계 + 세계적 러닝 전문가 자문단 편성

**트리거:** 대표가 "How to Improve Your VO2 Max in 5 Levels" 영상 공유 후 "이 수준의 러닝 프로그램을 룰엔진으로 구축하면 큰 매리트"라고 판단

**소환:** Claude (조사·설계), 대표 (의사결정)

### 영상 핵심 학습 (엔진 관점)

- **Limiter 3-way** (aerobic power / anaerobic battery / speed ceiling) — 주간 분포가 180도 달라짐
- **800m 반복이 VO2 max 최적 자극** — "마라톤 준비 = 유산소만" 직관과 반대
- **80/20 법칙 (Seiler)** — 엘리트 관찰, Esteve-Lanao가 아마추어 RCT로 검증 (PMID 23752040)
- **Norwegian 4×4** (Bakken) — VO2 max 킬러 세션
- 부상 예방: cadence 180+, 300-500km 신발 교체, 수면 7-8h (Davis 근거)

### 자문단 조사 결과 (general-purpose agent 위임)

**러닝 자문단 13명** 편성 (모두 실존·URL 근거 첨부):

| 카테고리 | 인원 |
|---|---|
| 운동생리학 (VO2 max) | Seiler, San Millán |
| 엘리트 마라톤 코치 | Canova, Sang |
| 바이오메카닉스 | Davis, Nigg, Ferber |
| 훈련 방법론 | Bakken, Esteve-Lanao |
| 스포츠 의학 | Lieberman |
| 영양 | Burke, Jeukendrup, Sims |

**배제 이력:** Jack Daniels (VDOT 창시자) 2025-09-12 작고 확인 후 제외. 방법론은 Seiler/Bakken/Esteve-Lanao가 계승.

### 대표 설계 단순화 지시

원안(3-way limiter + 복잡한 페이스 소스 2가지)이 과잉이라 판단:

| 항목 | 원안 | 단순화판 (대표 컨펌) |
|---|---|---|
| Limiter | 3-way (aerobic/anaerobic/speed) | **2-way** (build_aerobic / break_ceiling) |
| 판정 입력 | 온보딩 3문항 + GPS 복합 | **1문항 (경력) + GPS 30분 기록 존재 여부** |
| 페이스 소스 | GPS + VDOT 선택형 | **목표 선택 → 테이블 역산 (고정)** |
| GPS 활용 | 초기 페이스 산출 | **주차 적응 피드백에만** |

이유 (대표 발언 요약): "대부분 anaerobic 또는 speed가 limiter니까 둘 묶어서 한 처방으로, 페이스는 쉽게 측정되면 그걸로."

### 확정 사항

1. **프로그램 카탈로그**: VO2max, 5K, 10K, Half, Full × 난이도 (총 12종)
2. **Limiter 2-way**: 러닝 경력 6개월 + 30분 연속 기록 유무 기준
3. **페이스 테이블**: Jack Daniels VDOT 수정판, 60칸 (자문 검증 필요)
4. **저장 위치**: [src/utils/savedPlans.ts](../../src/utils/savedPlans.ts) `SavedPlan.programId` 필드 재활용 (신규 도메인 없음)
5. **공존 분리**: 기존 interval 가중 랜덤은 프로그램 미가입자만, 가입자는 주차 스케줄 따름. GA 이벤트 `program_*` 신규 추가.
6. **교육형 챗**: parseIntent 키워드 감지 → 프로그램 제안 CTA. 매 세션 3-bubble "왜 이 훈련인지" 설명 (Canova/Sang/Lieberman 시드).

### 자문단 디렉토리 신설

메모리 `project_team_roster.md` 비대화 방지 목적:

```
.planning/advisors/
  README.md
  core-team.md          — 상시 코어팀
  running.md            — 러닝 13명 (신규)
  weight-training.md    — 웨이트 7명
  data-analytics.md     — 데이터·GA·재무 8명
  product.md            — 프로덕트/디자인 6명
  prompt-engineering.md — Anthropic 4명
  consumer.md           — 박충환·Nir Eyal + ad-hoc
  architecture.md       — Toss·Apple 4명
```

메모리는 축약본 + 포인터로 재작성. source-grounded 원칙 준수.

### 산출물

- [.planning/advisors/](advisors/) 디렉토리 8개 파일
- [.planning/RUNNING_PROGRAM_SPEC.md](RUNNING_PROGRAM_SPEC.md) v0 초안 (14개 섹션, Phase 1-4 구현 순서)
- 메모리 `project_team_roster.md` 축약본으로 재작성

### 오픈 이슈 (v1 구현 전 해결)

| 이슈 | 자문 대상 |
|---|---|
| 페이스 테이블 60칸 숫자 확정 | Seiler + Esteve-Lanao + Bakken |
| 주간 템플릿 5일/6일 검증 | Canova + Sang |
| 한국 아마추어용 분포 변형 | Esteve-Lanao (아마추어 RCT 원저자) |
| GA `program_*` 이벤트 스키마 | 황보현우 + Sarah Friar |

### 다음 스텝

1. 대표 SPEC 리뷰 (특히 프로그램 12종 명단 + 12개 주차 수 적절성)
2. 자문단 소환해서 오픈 이슈 4건 해결 → SPEC v1
3. Phase 1 착수 (세션 타입 5종 추가 + 페이스 테이블 상수화)

### 피드백·메모리 정합성

- `feedback_source_grounded_opinions.md` — 자문단 인물 모두 URL 명시 ✓
- `feedback_confirm_before_implement.md` — SPEC v0 → 대표 컨펌 후 v1 → 구현 ✓
- `feedback_meeting_log.md` — 본 항목으로 기록 ✓
- `project_milestone_2026_04_18.md` — "Manus 수준 답변" 러닝 버전 구축 방향 확장 ✓

---

## 회의 64-A — SPEC v1 확정 (자문단 답변 통합) (2026-04-18)

**상태**: 회의 64 연속. 대표 Q1-Q5 컨펌 후 SPEC v0.1 수정 + 자문단 파견 + 답변 통합으로 v1 확정.

### 대표 5문 답변

| # | 질문 | 답변 |
|---|---|---|
| Q1 | 프로그램 12종 vs 4종 | **v1 4종만. v2 계획 삭제** |
| Q2 | 주차 수 해석 | **A — 차등 (VO2 8주 / 10K 10주 / Half 12주 / Full 12주)** + "유저는 1개월 이상 집중 못 함, 3개월 상한" |
| Q3 | VO2 max 측정 | **"측정은 유저가, 우리는 올리는 훈련만"** — 앱 내 측정 기능 거부. VO2 max 프로그램 이름 유지하되 외부 측정 위임. |
| Q4 | Limiter 3-way vs 2-way | **2분기 (Yes/No 1문항)** |
| Q5 | 페이스 테이블 | **자문 소환 지시 + "20칸 뭔뜻?" 질문** |

### 신규 메모리 2개

- `feedback_product_scope_focus.md` — 앱 스코프 원칙: 측정은 유저, 실행은 우리. 향후 측정·진단 기능 제안 자동 차단.
- `feedback_user_attention_span.md` — 유저 집중력 1개월 한계. 12주 상한 + 4주 청킹 + 챕터 경계 재후킹 필수.

### 자문단 파견 (background agent)

**소환**: Stephen Seiler + Jonathan Esteve-Lanao + Marius Bakken 3인 통합 자문
**요청**: 20칸 페이스 테이블 + 주차 수 검증 + 4주 청킹 설계
**결과** (146초 소요):

1. **20칸 페이스 테이블 확정** — Jack Daniels VDOT 미사용, 3인 방법론 통합. PubMed/URL 근거 첨부.
2. **주차 수 검증**:
   - VO2 8주: Seiler 2010 "VO2max 개선 대부분 6-8주에 발생" + Bakken 4-week block × 2 = 8주 최소 단위. ✅
   - 10K 10주: Esteve-Lanao PMID 23752040 RCT와 정확히 일치. ✅
   - Half 12주: Seiler 8-12주 권장 + Canova general+fundamental+specific 4+4+4. ✅
   - **Full 12주**: Pfitzinger 최단 12주도 "주 88km 베이스" 전제. 베이스 없으면 위험 → **진입 게이트 룰 필수**.
3. **4주 청킹 설계**:
   - Ch1 Base (1-4주): Easy 비중, VO2 short만, **threshold 금지**
   - Ch2 Build (5-8주): Threshold 도입, VO2 long 확장, MP block long
   - Ch3 Peak+Taper (9-12주): Race-pace interval + specific long + taper (volume −40~60%, intensity 유지)
4. **TT 3종 신규** (챕터 경계 재후킹 트리거):
   - tt_2k (Day 1 + 4주차 끝) — 초기 페이스 설정 + Base Complete 배지
   - tt_5k (8주차 끝) — Threshold Unlocked 배지 + 예상 레이스 시간 업데이트
   - dress_rehearsal (10주차 끝) — "Sub-X Ready" 판정

### SPEC v1 주요 변경

1. **§4.1**: Full sub-3에 `§4.3 진입 게이트 룰` 링크 추가
2. **§4.3 신규**: `canEnterFullSub3()` 게이트 함수 + UI 처리 규정 (긍정 카피로 우회)
3. **§5.1**: Limiter 2분기 확정 (`isVeteran && has30min`)
4. **§7.2**: 세션 타입 **신규 8종 + TT 3종 = 11종 확정** (총 17종)
5. **§8.1**: 20칸 매트릭스 전체 채움 (각 칸 근거 출처 표기)
6. **§11.2-11.7 신규**: 챕터 구조 + 주간 템플릿 + 재후킹 신호 + 이탈 방지
7. **§14 Phase 1-4 재조정**: 3주 예상 (자문 대기 없이 착수 가능)

### 남은 오픈 이슈

- Full sub-3 Easy zone 한국 아마추어 조정 (사내 러닝코치 + Sang 소환)
- 주차별 볼륨 구체 수치 km/주 (Canova + 사내 러닝코치)
- v2: 부상 경고(Davis/Ferber), 여성 주기(Sims), 영양 in-session(Jeukendrup)

### 다음 스텝

1. 대표 SPEC v1 최종 리뷰
2. 승인 시 Phase 1 착수 — [functions/src/workoutEngine.ts](../functions/src/workoutEngine.ts) 세션 타입 11종 추가 + PACE_MATRIX 상수화 + limiter 함수 + Full sub-3 게이트 함수

---

## 회의 64-B — Phase 1 구현 완료 (러닝 룰엔진 인프라) (2026-04-18)

**상태**: SPEC v1 기반 Phase 1 인프라 구현 완료. 유저 노출 0 (dead code 상태). Phase 2에서 엔드포인트 연결 예정.

### 대표 지시

"해봐" (UX 미리보기 읽지 않고 Phase 1 착수 위임). 착수 중 평가자 관점 3건 점검 요청:
1. 다른 부분 영향
2. 비용 이슈
3. 개발 중 기획 이탈/돌변 여부

### 구현 산출물

**신규 파일**: [functions/src/runningProgram.ts](../functions/src/runningProgram.ts) (451줄)

포함 내용 (SPEC v1 §4-§11 기반):
- `PACE_MATRIX` 상수 20칸 (3 프로그램 × 5 페이스) + `calcVo2PaceFrom5K()` (VO2 프로그램용 5K 상대 오프셋)
- `judgeLimiter()` — 2-way limiter 판정 (`runningExp6moPlus` + 30분 연속 기록 유무)
- `canEnterFullSub3()` — Full sub-3 진입 게이트 (주 50km + Half 1:30 + 부상 없음)
- 세션 빌더 15종: strides, threshold, threshold_2x15, intervals_400/800/1000/mile, norwegian_4x4, pure_sprints, long_with_mp, race_pace_interval, specific_long, tt_2k, tt_5k, dress_rehearsal
- `CHAPTER_STRUCTURES` + `findChapter()` — 4주 청킹 + 챕터 경계 TT 매핑
- 유틸: `formatPace`, `formatPaceRange`, `getPace`, `getProgramWeeks`

**기존 파일 수정**: [functions/src/workoutEngine.ts](../functions/src/workoutEngine.ts) `UserCondition` 인터페이스에 optional 필드 2개 추가:
```ts
runningExp6moPlus?: boolean;
recentInjury?: boolean;
```

### 빌드 검증

- `cd functions && npm run build` ✓ 통과
- `npx tsc --noEmit` (루트) ✓ 통과

### 평가자 점검 결과 (3건)

**1. 다른 부분 영향 → 영향 0**
- `runningProgram.ts`를 import하는 곳 0건 (Grep 확인) → dead code 상태
- UserCondition 신규 필드 2개 모두 optional → 기존 사용처 4곳(ChatHome.tsx, page.tsx, gemini.ts, workoutEngine.ts) 시그니처 불변
- build 통과가 증명

**2. 비용 이슈 → 증가 0**
- Gemini 호출 0건 (순수 룰엔진)
- Firestore read/write 0건
- Cloud Functions 엔드포인트 0개 추가
- firebase.json 수정 없음
- 메모리 `project_cost_optimization.md` 원칙 강화 사례

**3. 기획 이탈 → 편차 0**
SPEC v1 항목 1:1 매핑 검증:
- 프로그램 4종 ✓ / PACE_MATRIX 20칸 ✓ / 2-way limiter ✓ / Full sub-3 게이트 ✓ / 신규 세션 15종 ✓ / 4주 청킹 ✓
- 대표 지시 준수: VO2 max 측정 기능 미구현 ✓, 12주 상한 ✓, v2 기능 0개 ✓, 이모지 0개 ✓

### 발견된 주의사항 4건 (Phase 2에서 해결 예정)

| 리스크 | 위치 | 내용 | 해결 시점 |
|---|---|---|---|
| A. 중간 | [runningProgram.ts:144-150](../functions/src/runningProgram.ts#L144) | `calcWeeklyAvgKm`이 placeholder(`totalDurationSec/6`). 실제 `runningStats.totalKm` 경로 필요 | Phase 2 |
| B. 중간 | [runningProgram.ts:158-166](../functions/src/runningProgram.ts#L158) | `findRecentHalfUnder`가 title 문자열 매칭. 현재 엔진 title에 "Half" 없음 → 항상 false | Phase 2 (SavedPlan.programGoal 기반으로 교체) |
| C. 낮음 | VO2 Easy 오프셋 +90~120s | SPEC 자문단 권고 준수. Seiler Z1 엄격 해석 | 수정 불필요 |
| D. 낮음 | Full sub-3 Easy 5:30~5:40/km | SPEC에 `[추정]` 꼬리표 명시. 사내 러닝코치 검증 대기 | v1.1 |

리스크 A/B는 **dead code 상태에서 노출되지 않음** — Phase 2 엔드포인트 연결 전까지 런타임 영향 0.

### 다음 스텝

1. 대표 Phase 1 최종 승인 / 수정 지시
2. Phase 2 착수 — 프로그램 생성기 (`generateRunningProgram(goal, limiter, weeksPerTraining)`) + SavedPlan 확장 필드 + 프로그램 선택 UI
3. Phase 2에서 리스크 A/B 해결 (runningStats.totalKm + programGoal 기반 판정)

---

## 회의 64-C — Phase 2 구현 완료 (프로그램 생성기 + 엔드포인트) (2026-04-18)

**상태**: SPEC v1 Phase 2 완료. 서버 측 완성. UI는 Phase 3로 분리.

### 대표 지시
"착수해주세요" — Phase 1 완료 직후 Phase 2 즉시 착수.

### Phase 2 산출물

#### 1. 오케스트레이터 (`functions/src/runningProgram.ts` append)
- `generateRunningProgram(args)` — 4종 프로그램 전체 세션 생성. 주차별 챕터 phase 판정 + 주간 템플릿 적용 + 경계 TT/Dress Rehearsal 삽입.
- 주간 템플릿 4종 (base/build/peak/taper) + tt_5k_week (VO2 전용)
- `getWeeklySlots()` — 주차별 SlotType[] 결정
- `buildSessionFromSlot()` — 17개 SlotType → ExerciseStep[] 변환
- `getTrainingDays(daysPerWeek)` — 요일 매핑 (3일=Tue/Thu/Sun, 4일=+Sat, 5일=+Wed recovery)

**스모크 테스트 결과** (4종 프로그램 전부):
```
VO2 max 키우기    8주 × 4일 =  32세션  W1/W4=TT2K, W8=TT5K
10K sub-50       10주 × 4일 =  40세션  W4=TT2K, W8=TT5K, W9=Dress, W10=race
Half sub-2       12주 × 5일 =  60세션  W10=Dress, W12=race
Full sub-3       12주 × 5일 =  60세션  W10=Dress, W12=race
```

**수정 사항**: 초기 테스트에서 10K Ch3 (2주)의 W9가 taper로 오판정 → Ch3 길이 ≤ 2주이면 taper 생략 peak+race 구조로 수정 ([runningProgram.ts getWeekPhase](../functions/src/runningProgram.ts)).

#### 2. Phase 1 리스크 A/B 해결
- **A 해결**: `calcWeeklyAvgKm`이 `runningStats.distance` (meters)를 직접 집계. placeholder 제거.
- **B 해결**: `canEnterFullSub3` 시그니처 전면 개편 — 명시적 입력(`FullSub3GateInput`)을 받음. title 문자열 매칭 제거. 호출자가 유저 프로필/이전 프로그램 기록에서 `recentHalfMarathonSec` 추출해서 전달.

**서버 WorkoutHistory 확장**: `runningStats?: { distance; duration; avgPace? }` 필드 추가 ([workoutEngine.ts](../functions/src/workoutEngine.ts)). 클라이언트 RunningStats와 필드명 일치.

**게이트 테스트 결과** (4케이스):
- volume 65km + Half 1:26 → pass ✓
- volume 30km → fail "주간 30km (필요 50km+)" ✓
- volume 55km + 30K 최근 3주 → pass ✓
- volume 60km + Half + 부상 → fail "부상 회복 중" ✓

#### 3. SavedPlan 타입 확장 (클라+서버 양쪽)
[src/utils/savedPlans.ts](../src/utils/savedPlans.ts) `SavedPlan` 인터페이스 8개 optional 필드 추가:
- `programCategory`, `programGoal`, `limiterAtStart`, `weekIndex`, `chapterIndex`, `dayOfWeek`, `targetPaceSec`, `slotType`

서버 `saveProgram` 엔드포인트도 동일 필드 Firestore merge ([functions/src/plan/savedPlans.ts](../functions/src/plan/savedPlans.ts)).

#### 4. Cloud Function 엔드포인트 2개 (신규 파일 [functions/src/plan/runningProgramApi.ts](../functions/src/plan/runningProgramApi.ts))
- `POST /api/generateRunningProgram` — 프로그램 세션 배열 생성. 인증 필수. 입력 validation (programId/limiter/daysPerWeek 화이트리스트). 반환: `SavedPlan[]` 형식.
- `POST /api/checkFullSub3Gate` — Full sub-3 진입 가능 여부. 인증 필수. `FullSub3GateInput` 받아 `GateResult` 반환.

[firebase.json](../firebase.json) rewrites 2개 추가.
[functions/src/index.ts](../functions/src/index.ts) re-export 추가.

### 평가자 점검 결과 (회의 64-B 동일 기준 적용)

**1. 다른 부분 영향 → 0**
- SavedPlan 신규 필드 전부 optional → 기존 호출 2곳(MasterPlanPreview.tsx:305,336) 영향 없음
- saveProgram 신규 필드는 `raw.xxx ?? null` → 기존 운동 프로그램 저장 정상
- WorkoutHistory.runningStats 추가 필드 optional → 기존 사용처 무영향
- **`npm run build` ✓ + `npx tsc --noEmit` ✓** — 정적 타입 검증 통과

**2. 비용 → Gemini 0, Firestore 0 (생성), 저장은 기존 /api/saveProgram 재사용**
- 신규 엔드포인트 2개 모두 순수 룰엔진 (LLM 호출 0)
- `generateRunningProgramFn`: Firestore R/W 0 (생성만, 저장은 클라가 별도 /saveProgram 호출)
- `checkFullSub3GateFn`: Firestore R/W 0 (순수 판정)
- Cloud Functions 무료 티어 2M 호출/월 내 충분
- 메모리 `project_cost_optimization.md` "LLM 최소 + 룰엔진 극대화" 강화

**3. 기획 이탈 → 편차 0**
- 4종 프로그램 화이트리스트 강제 (VALID_PROGRAMS 서버 검증)
- 12주 상한 준수 (getProgramWeeks 최대 12)
- VO2 측정 기능 미구현 ✓ (user5kPaceSec는 유저 입력만 받음)
- 4주 청킹 준수 (CHAPTER_STRUCTURES)
- TT 3종 경계 삽입 준수 (getWeeklySlots)
- 이모지 0, 한글 세션명 ✓

### 한 가지 관찰 (Phase 3 논의 필요)
- `generateRunningProgramFn`에 **Premium 체크 없음** — 미리보기 자유롭게, 저장(/saveProgram)만 premium. UX상 자연스러우나 남용 방지용 rate limiting 검토 필요 (Phase 3).

### 남은 작업 (Phase 3)
1. 프로그램 선택 UI (4 카드 + Full sub-3 게이트 잠금 UI)
2. 유저 프로필 필드 확장 (`recentRaceRecords`, `recentInjury`, `runningExp6moPlus`)
3. parseIntent 키워드 확장 ("sub3", "마라톤", "10km" 등)
4. MyPlans 탭에 프로그램 미리보기/진행률 UI
5. 챕터 경계 이벤트 UI (배지, PR 카드)
6. 세션 시작 3-bubble 교육형 챗 카피
7. GA 이벤트 `program_*` 7종 발화 연동

### 배포 주의 (대표 수동)
- **functions 배포 필수**: `cd functions && npm run build && firebase deploy --only functions` — 신규 2개 엔드포인트
- Hosting은 `git push` 자동 배포 (firebase.json rewrite 변경 포함)
- 신규 엔드포인트는 UI 미연결 상태 — 유저 관찰 불가능. Phase 3 UI 연동 후 실사용.

---

## 회의 64-D — Phase 3 UI 구현 완료 (바텀시트 B-1) (2026-04-18)

**상태**: SPEC v1 Phase 3 완료. 유저 노출 기능 완성 — 배포 후 실제 러닝 프로그램 생성 가능.

### 대표 의사결정

- **진입 경로**: 입력창 우측 하단 "달리는 아이콘" (B-1) — 대표 "B 로하고"
- **UX 패턴**: 바텀시트 스택 (풀스크린 아님) — 대표 "b1으로!!!"
- UX 미리보기 문서는 대표가 "길어서 모르겠고 해봐" → 기획 확정 상태로 바로 구현

### 구현 산출물

#### 신규 컴포넌트
[src/components/dashboard/RunningProgramSheet.tsx](../src/components/dashboard/RunningProgramSheet.tsx) — 약 410줄 단일 파일
- 진입 가드: isLoggedIn+isPremium 아니면 시트 열지 않고 로그인/페이월 발화
- 5단계 step 머신: `select → gate_check → gate_fail → settings → preview → loading`
- Sub-step 컴포넌트 5개 (StepSelect / StepGateCheck / StepGateFail / StepSettings / StepPreview)
- API 호출 2개: `/api/checkFullSub3Gate`, `/api/generateRunningProgram`
- 저장: 로컬 `saveProgramSessions` + 서버 `remoteSaveProgram` 병행

#### ChatHome 통합
[src/components/dashboard/ChatHome.tsx](../src/components/dashboard/ChatHome.tsx)
- 입력창 하단 `justify-end` → `justify-between`
- 좌측: 달리는 사람 SVG 라인아트 (36×36, emerald border)
- 우측: 기존 전송 버튼 유지
- `showRunningSheet` 스테이트 + `RunningProgramSheet` 렌더
- `onProgramCreated` → 토스트 + `onOpenMyPlans()` 자동 전환

#### i18n
[src/locales/ko.json](../src/locales/ko.json), [src/locales/en.json](../src/locales/en.json)
- `running_program.*` 네임스페이스 53 key 추가 (ko+en 동시)
- 메모리 `feedback_i18n_always` 준수

#### GA 이벤트 7종
[src/utils/analytics.ts](../src/utils/analytics.ts) `FunnelEvent` union 확장
- `running_program_sheet_open` — 아이콘 탭 (진입)
- `running_program_select` — 프로그램 카드 탭 (program param)
- `running_program_gate_pass` / `running_program_gate_fail`
- `running_program_created` — 저장 완료 (program/days_per_week/total_sessions)
- `running_program_create_failed` — API 실패
- `running_program_sheet_abandoned` — 중간 이탈 (step param)

### 빌드 검증
- `npx tsc --noEmit` ✓ 통과
- `cd functions && npm run build` ✓ 통과
- `npm run lint`: 내가 추가/수정한 파일 lint 에러 0 (기존 파일의 기존 에러만)

### 평가자 점검

**1. 다른 부분 영향 → 0**
- ChatHome 입력창 layout: `justify-end` → `justify-between` (기존 전송 버튼 위치 동일)
- 신규 state 2개 격리 (`showRunningSheet`, `runningToast`)
- RunningProgramSheet는 `!open`일 때 null 반환 → 비활성 상태 DOM 영향 없음
- SavedPlan 신규 필드는 모두 optional (Phase 2.3에서 이미 확인)
- 기존 운동 프로그램 플로우 (`chat_program_generated` 등) 완전 격리

**2. 비용 → 0 증가**
- Gemini 호출 0 (모든 API 호출이 룰엔진)
- Firestore: 저장 시 기존 `/api/saveProgram` 엔드포인트 재사용 (기존 운동 프로그램과 동일 비용)
- 프리미엄 하드락 유지 (saveProgram 서버가 403 반환)

**3. 기획 이탈 → 편차 0**
- SPEC v1 §4.2 선택 플로우 1:1 매핑
- 4종 프로그램 화이트리스트 서버 + 클라 이중 검증
- Full sub-3 게이트 서버 재검증 (클라 답변만으로 판정 안 함)
- 12주 상한 준수 — 카드 서브텍스트는 "3단계 · 10주 여정" 형식 (단계 강조, 주 보조)
- VO2 측정 기능 미구현 — 유저가 5K 기록 "입력"만 받음 (메모리 `feedback_product_scope_focus` 준수)
- 이모지 0, SVG 라인아트만
- 부정 카피 금지 준수 — Full sub-3 게이트 실패는 "부족함" 아닌 "다치는 경로" 카피

### 발견 관찰 (Phase 4 논의)
- 비프리미엄/비로그인 유저에게도 **달리는 아이콘은 노출**. 탭 시 로그인/페이월 유도 → 기존 paywall 패턴과 일관이지만 "탭했더니 막힘" 경험. Phase 4에서 아이콘 자체를 티저 형태로 전환 검토 가능.
- 게이트 질문에서 유저가 Yes 선택 시 값은 고정 placeholder(55km, 5200s) → 서버 재검증이 sanity check만 수행. 정밀 검증은 실제 GPS 히스토리 + 프로필 연동 필요 (Phase 4).
- 프로그램 생성 후 MyPlans로 자동 이동 — 유저가 첫 세션 바로 탭 가능하나 안내 카피 없음. Phase 4에서 "첫 세션부터 시작해보세요" 코치 메시지 자동 발화 검토.

### 배포 필수 순서 (대표 수동)
1. `cd functions && npm run build && firebase deploy --only functions` — **신규 2개 엔드포인트 (generateRunningProgramFn, checkFullSub3GateFn)**
2. Hosting: `git push` 자동 배포 (firebase.json rewrite + 클라 코드 포함)
3. 순서 주의: Hosting 선배포 시 달리는 아이콘 탭 → 404. 반드시 **functions 먼저**.

### Phase 3 유저 골든 패스 (배포 후)

1. 홈 챗 입력창 좌측 하단 "달리는 아이콘" 탭
2. 바텀시트 슬라이드업 → 4 프로그램 카드 (10K에 "추천" 배지)
3. 카드 탭 → Full sub-3면 3문항 게이트, 아니면 바로 설정
4. 설정: 주 3/4/5일 + 시작일 + VO2는 5K 기록 입력
5. "여정 짜기" → 미리보기 3단계 카드
6. "시작하기" → API 호출 → 로컬+서버 저장 → 토스트 "여정이 저장됐어요" + MyPlans 자동 이동
7. MyPlans에서 프로그램 진행률 보이고, 첫 세션 탭 → 실행

---

## 회의 64-E — Phase 4 (4.1 + 4.3 + 4.6) + 교차검증 (2026-04-18)

**상태**: SPEC v1 Phase 4 중 4.1(게이트 정밀화) / 4.3(코치 자동 안내) / 4.6(평가자 루브릭 강화) 완료. 4.2(챕터 경계 이벤트) + 4.4(비프리미엄 티저) + 4.5(이탈 자동 개입)는 별도 세션.

### 대표 지시
"진행해주시고 평가자님은 체크 및 교차검증 기획자랑 같이 기획대로 가는건지 아니면 편향적으로 혹시 하고있지는 않는지 체크" — 작성자=평가자 편향 차단 요구.

### 4.6 평가자 루브릭 강화 (첫 집행)

**메모리 변경**:
- [feedback_evaluator_strict.md](../../../../.claude/projects/-Users-joord-Desktop-Joord-ohunjal-ai/memory/feedback_evaluator_strict.md) 체크리스트에 3항 추가:
  - 6. 추가된 UI 요소마다 `feedback_*` 메모리 전부 스캔
  - 7. 기획자와 교차검증 (작성자=평가자 편향 차단)
  - 8. 평가 범위 밖 판정은 명시적 "체크 범위 밖" 선언
- `## 교차검증 프로토콜` 섹션 신설 — 기획자 역할 / 평가자 역할 분리 수행 + 편향 자가검진 3문
- [feedback_no_decorative_svg.md](../../../../.claude/projects/-Users-joord-Desktop-Joord-ohunjal-ai/memory/feedback_no_decorative_svg.md) 신규 — "의미 없는 장식 SVG 금지" (회의 64-D 번개/재생 SVG 사건 후속). 허용/금지 케이스 + 3문 자가검진
- MEMORY.md 인덱스 업데이트

### 4.1 Full sub-3 게이트 정밀화

**변경**:
- **Q1 "주간 50km+?" Yes/No 제거** → `getCachedWorkoutHistory()` 기반 GPS 실제 집계 자동 계산 + 읽기전용 표시. 유저 거짓 답변 우회 불가.
- **Q2 "Half 1:30?" Yes/No → mm:ss 숫자 입력 + "없음" 체크**. placeholder 5200초 전송 제거, 실제 값 전송.
- Q3 부상은 유저 Yes/No 유지 (변동성).

**구현**: [RunningProgramSheet.tsx](../src/components/dashboard/RunningProgramSheet.tsx) — `useMemo`로 `autoWeeklyAvgKm` 계산 (runningStats.distance 합산 ÷ 8주), StepGateCheck UI 개편, `halfMarathonSec: number | null | undefined` 3-state.

**i18n 추가**: `running_program.gate.auto_km_*`, `running_program.gate.half_*`, `running_program.gate.injury_label` (ko+en).

### 4.3 프로그램 생성 직후 코치 자동 안내

**변경**:
- `onProgramCreated(programId)` → `onProgramCreated({ programId, programName, firstSessionTitle })` 시그니처 확장
- ChatHome에서 콜백 수신 시 assistant text bubble 자동 push (3줄): 여정 시작 + 첫 세션명 + "이 기록이 앞으로 페이스의 기준점" 카피
- `feedback_chatgpt_benchmark` "그래서 뭐?" 테스트 통과 — 왜 이 세션부터 해야 하는지 인과 설명 포함

**i18n**: `running_program.coach.intro_line1~3` (ko+en).

### 교차검증 결과 (기획자 + 평가자)

**기획자 역할** (SPEC/메모리 원문 재검토):
- SPEC §4.3 Full sub-3 게이트 요구사항 1:1 대조
  - `weeklyAvgKm8wk ≥ 50` ✓ (GPS 자동)
  - `recentHalfMarathonSec ≤ 5400` ✓ (유저 입력)
  - `!recentInjury` ✓ (유저 Yes/No)
  - **"30K 연속 러닝 4주 내" OR 조건 UI 미노출** — 누락 투명 신고. Phase 4.2에서 workoutHistory 3시간+ 세션 자동 감지 추가 예정.
- SPEC §12.2 "세션 시작 3-bubble" 확장 안 함 — 본 Phase 스코프는 "생성 직후 1회"로 명시 유지.

**평가자 역할** (Grep + bias 검진):
- `npx tsc --noEmit` ✓
- `npm run lint` 내 변경 파일 에러 0
- **Phase 3 결함 발견**: [RunningProgramSheet.tsx StepSettings](../src/components/dashboard/RunningProgramSheet.tsx) 내부에서 `Chip` 컴포넌트를 매 렌더 재정의 — React 에러 "Cannot create components during render". Phase 3 평가자 점검에서 lint 전체 스캔 부족으로 놓침. **Phase 4에서 같이 수정** (파일 스코프로 이동).
- **편향 자가검진 3문**:
  1. 내 구현 옹호? → 오히려 Phase 3 결함 공개 수정 + 30K 조건 누락 자진 신고
  2. SPEC 우회? → 30K OR 조건 우회가 아닌 누락 명시 신고 + Phase 4.2 이관
  3. 범위 밖 이슈? → "Phase 3 lint 결함이 Phase 4 범위 밖이지만 발견 시점에 바로 수정"으로 처리

### Phase 3 회귀 수정 (교차검증에서 발견)
- `const Chip = ...` StepSettings 내부 → 파일 스코프로 이동. 매 렌더 재생성 안티패턴 해소. React 에러 0.

### 산출물

- [src/components/dashboard/RunningProgramSheet.tsx](../src/components/dashboard/RunningProgramSheet.tsx) — 게이트 개편 + Chip 스코프 이동 + onProgramCreated 시그니처 확장
- [src/components/dashboard/ChatHome.tsx](../src/components/dashboard/ChatHome.tsx) — 코치 자동 안내 메시지 추가
- [src/locales/ko.json](../src/locales/ko.json) / [en.json](../src/locales/en.json) — 신규 key 14개 ko+en 동시
- 메모리: `feedback_evaluator_strict.md` 강화 + `feedback_no_decorative_svg.md` 신규

### 영상 반영률 자체 평가 (대표 질문)

| Level | 반영률 | 사유 |
|---|---|---|
| L1 Foundation (영양/혈액) | 0% | 대표 "측정은 유저가" 지시 — v2 영양 자문 소환 시 부분 추가 가능 |
| L2 Vehicle (러닝/사이클/수영) | 20% | 러닝만 v1 스코프 |
| L3 Training Plan | **85%** | 세션 17종, phase 4종, limiter 분포, TT 경계 등 핵심 IP 대부분 실림 |
| L4 Injuries (케이던스/신발/수면) | 10% | Davis/Ferber 자문 v2 |
| L5 Volume (90일 사이클) | 40% | 12주 상한 + 주 3/4/5일 OK, 계절 사이클은 미구현 |

**종합 ~52% (전체) / 85% (훈련 코어만) / 80%+ (v1 의도적 스코프 내)**. v2 자문 소환 시 95%+ 가능.

### 남은 Phase 4 sub-phases (별도 세션)
- 4.2 챕터 경계 이벤트 UI (Base Complete 배지 + PR 카드 + 다음 챕터 미리보기) — 애니메이션·디자인 필요, 큰 작업
- 4.4 비프리미엄 티저 UI — paywall UX 재설계 논의 필요
- 4.5 3주 연속 미완주 자동 챗 개입 — 백그라운드 체크 로직

### 배포 준비 상태

- 신규 Cloud Functions 엔드포인트 0개 (Phase 4.1~4.3 모두 클라 측 변경)
- **배포 명령 불변**: `cd functions && firebase deploy --only functions` → `git push`
- Phase 4 끝낸 시점에 배포 권장 — Phase 4.1 게이트 정밀화가 들어가야 Full sub-3 거짓 답변 우회 리스크 제거됨

---

## 회의 64-P — 종아리(calf) 근육 아이콘 활성화 (2026-04-19)

**맥락**: 회의 62 후속에서 남아있던 calf 전용 아이콘 SVG가 Figma (node 51:16531, kenko-ui-kit-update-1)에서 도착. 대표가 SVG 직접 붙여넣기로 전달.

**변경**:
- [public/icons/body/calf.svg](../public/icons/body/calf.svg) — 신규 (2-tone 하이라이트, 양쪽 종아리 #059669, stroke #353E82)
- [src/components/plan/bodyIcon.ts](../src/components/plan/bodyIcon.ts) — `CALF_SVG_READY` true 전환

**적용 대상 (3종)**:
- 스탠딩 카프 레이즈 (Standing Calf Raises)
- 시티드 카프 레이즈 (Seated Calf Raises)
- 동키 카프 레이즈 (Donkey Calf Raises)

**남은 fallback**: `WIDE_SQUAT_SVG_READY` 여전히 false — wide-squat SVG 미도착 (딥 스쿼트 홀드, 와이드 스쿼트 3종 leg-press.svg fallback 유지).

**배포**: 클라 전용 변경, Hosting 자동 배포만 필요. Functions 변경 없음.

---

## 회의 64-Q — 와이드/딥 스쿼트 4종 → Glutes 아이콘 통일 (2026-04-19)

**맥락**: 회의 62 후속에서 WIDE_SQUAT 전용 아이콘(wide-squat.svg, Figma node 28:15782)을 기획했으나, 대표 판단으로 전용 아이콘 폐기 후 기존 glutes.svg로 통일.

**근거**: 와이드/딥 스쿼트 4종의 주동근은 엉덩이(glutes)·내전근 복합이고, 유저가 시각적으로 "스쿼트 계열 ≈ 엉덩이 운동"으로 인식하는 편이 덜 혼란스러움. 아이콘 1개 줄여 번들·관리 부담 감소.

**변경**:
- [src/components/plan/bodyIcon.ts](../src/components/plan/bodyIcon.ts)
  - WIDE_SQUAT Set·WIDE_SQUAT_SVG_READY 플래그·WIDE_SQUAT 라우팅 라인 전체 제거
  - GLUTE Set에 와이드/딥 스쿼트 4종 병합
- 적용 대상: 딥 스쿼트 홀드, 케틀벨 와이드 스쿼트, 덤벨 와이드 스쿼트, 와이드 스쿼트

**배포**: 클라 전용 변경, Hosting 자동 배포. tsc 통과 확인.

---

## 회의 64-R — Kenko UI Kit 하체 아이콘 4종 최종본 적용 (2026-04-19)

**맥락**: 대표가 Figma Kenko UI Kit에서 glutes·adductor·calf 3개 SVG를 직접 export해 `public/icons/body/`에 배치. 기존 파일(이전 세션 SVG 붙여넣기 버전) 교체.

**사용 파일 (4종 확정)**:
- [public/icons/body/glutes.svg](../public/icons/body/glutes.svg) — 엉덩이 (교체, 19,914B, 대표 직접 export)
- [public/icons/body/adductor.svg](../public/icons/body/adductor.svg) — 내전근·사이드 플랭크 (교체, 19,229B, 대표 직접 export)
- [public/icons/body/calf.svg](../public/icons/body/calf.svg) — 종아리 (교체, 14,546B 최적화 버전, 대표 직접 export)
- [public/icons/body/deadlift.svg](../public/icons/body/deadlift.svg) — 후면 체인 (기존 유지)

**변경**:
- [src/components/plan/bodyIcon.ts](../src/components/plan/bodyIcon.ts)
  - `*_SVG_READY` 플래그 3종 전부 제거 (파일 존재 보장)
  - 주석 정리 — "하체 아이콘 4종 운용" 명시
  - 나머지 라우팅 로직·Set 구성 유지 (GLUTE/ADDUCTOR/CALF/ANTERIOR_LEG/POSTERIOR_LEG + isSidePlank)

**배포**: 클라 전용, `git push`만 필요. Functions 변경 없음. tsc 통과.

---

## 회의 64-T — 러닝 UI 아키타입별 리디자인 Wave 1 (인터벌 A+B) (2026-04-19)

**맥락**: 대표가 "400m 인터벌 / 7세트/1회"만 찍히는 휑한 플랜 프리뷰 지적. Phase A 실태조사 결과 인터벌 구성이 `count` 통문자열에 꾸겨져 있고, 플랜 프리뷰는 이를 분해하지 않음. FitScreen은 시간기반만 3분할 UI 지원.

### 아키타입 분류 (20+ 러닝 세션 → 5 아키타입)

| 아키타입 | 예시 | 상태 |
|---|---|---|
| A 시간기반 인터벌 | 워크런, fartlek, strides, Norwegian 4×4 | FitScreen 3분할 존재, 플랜 휑 |
| B 거리기반 인터벌 | **400m/800m/1000m/mile 인터벌**, pure sprints | FitScreen GPS 폴백, 플랜 휑 |
| C 연속 유산소 | 이지런, LSD, 70분 Z1런, Threshold Run | Wave 2 예정 |
| D 하이브리드 | Threshold 2×15, long_with_mp | Wave 3 예정 |
| E 특수 | TT 2k/5k, dress_rehearsal | Wave 3 예정 |

**Wave 1 결정**: 아키타입 A+B 일괄 진행 (대표 확인).

### 자문단 (7인)

- Seiler, Esteve-Lanao, Bakken (러닝 학계) — 강도 구조·아마추어 순응도
- 사내 러닝코치 — 한국 실전 라벨
- UX 디자이너 + 콘텐츠 MD (core-team) — 컴포넌트 분리·카피
- 평가자 (core-team) — 회귀 가드레일

### 합의 UI-SPEC

**데이터 스키마 (옵션 3 하이브리드, tag-at-source 준수)**:
```ts
ExerciseStep.intervalSpec?: {
  rounds: number;
  sprintSec?: number; recoverySec?: number;       // 시간기반
  sprintDist?: number; recoveryDist?: number;     // 거리기반
  sprintLabel?: string; recoveryLabel?: string;
  paceGuide?: string;
}
```
`count` 문자열 유지 (back-compat). `deriveIntervalSpec(ex)` 유틸: intervalSpec 우선, 없으면 regex fallback.

**플랜 프리뷰 UI**: 웨이트 SET 카드와 동일 행 레이아웃, 콘텐츠만 분기 — `SET 1: [400m 전력] × [2분 회복]`. 헤더에 "N회 반복" 뱃지.

**FitScreen**: 시간기반 3분할 UI 불변 (회귀 위험 0), 거리기반은 동일 UI로 확장.

**카피 통일**: 전력/회복 (Burst/Recover). walkrun 맥락만 "걷기/달리기" 유지.

### 회귀 격리 (평가자 가드레일)

- 웨이트 SET 카드 불변
- 코어 SET 카드 불변
- 연속 러닝 UI 불변 (Wave 2까지)
- 레거시 히스토리 (intervalSpec 없음) regex fallback 동일

### 구현 단계 (C 단계)

1a. 스키마 + 서버 빌더 10+종 수정
1b. IntervalSetRow 컴포넌트 + 플랜 프리뷰 렌더
1c. FitScreen 거리기반 3분할 확장
1d. i18n (ko+en 동시)
1e. 평가자 회귀 스위트

**배포**: Functions(빌더 변경) + Hosting 둘 다 필요. Wave 1 완료 후 일괄.

---

## 회의 64-U — 러닝 UI 리디자인 Wave 2 (연속 유산소 C) (2026-04-19)

**맥락**: Wave 1(인터벌) 완료 후 대표 "착수" 지시. 아키타입 C(이지런·LSD·Z1·Threshold·Tempo·대화가능) 플랜 프리뷰에서 `tempoGuide` 필드가 완전히 숨겨져 있던 갭 해결.

### 자문 의견 (압축)

- **Seiler · Esteve-Lanao** (폴라라이즈드·아마추어 RCT) — Zone 구분이 시각적으로 명확해야 유저의 강도 순응도 ↑. easy/tempo/long 3종은 구분해서 표시.
- **Bakken** — Threshold 구간은 "역치" 인지가 핵심. 페이스 가이드 노출 필수.
- **사내 러닝코치** — 한국 러너 용어: "Zone 2 · 대화 가능", "역치 · Threshold", "Zone 1 · LSD"가 익숙.

### Zone 라벨 합의

| runType | 한국어 | 영어 |
|---|---|---|
| easy | Zone 2 · 대화 가능 | Zone 2 · Conversational |
| tempo | 역치 · Threshold | Threshold |
| long | Zone 1 · LSD | Zone 1 · LSD |

### 변경

- [PlanExerciseDetail.tsx](../src/components/plan/PlanExerciseDetail.tsx)
  - `isContinuousRun` 감지 (runKind="continuous" && !isInterval)
  - 헤더에 Zone 뱃지 에메랄드 (인터벌 "N회 반복" 뱃지와 동일 스타일)
  - SET 행/정적 표시 하단에 **페이스 가이드 박스** (tempoGuide 값 노출)
- [ko.json](../src/locales/ko.json) / [en.json](../src/locales/en.json) — 5개 키 (run.zone.easy/tempo/long, run.pace_guide_label, run.duration_label)

### 회귀 격리

- 웨이트·코어·인터벌 SET 카드 전부 불변
- 레거시 히스토리 (runType 없음) — Zone 뱃지만 누락, 기존 렌더 동일
- FitScreen 불변 (Wave 1과 동일)

**배포**: 서버 스키마 변경 없음(Wave 1에 포함됨). 클라만 `git push`.

---

## 회의 64-W — 러닝 UI 리디자인 Wave 3 (하이브리드 D + 특수 E) (2026-04-19)

**맥락**: Wave 1(인터벌) + Wave 2(연속 유산소) 완료 후 Wave 3 착수. 분석 결과 대부분의 D/E 세션이 Wave 2의 연속 러닝 렌더로 자동 커버됨.

### 분석 결과 — 이미 커버되는 세션

| 빌더 | 렌더 경로 | 상태 |
|---|---|---|
| Threshold 2×15 | 3개 연속 러닝 카드 (tempo/easy/tempo) | Wave 2 Zone 뱃지 ✓ |
| Long with MP | 2개 연속 카드 (long + tempo) | Wave 2 ✓ |
| Specific Long | runType별 Zone 뱃지 | Wave 2 ✓ |
| Race-Pace Interval | intervalSpec 있음 → Wave 1 | Wave 1 ✓ |
| Dress Rehearsal | runType="tempo" → "역치" 뱃지 | Wave 2 ✓ |

### 유일한 갭 — TT 2K/5K

- `buildTT2K`, `buildTT5K` — runType="sprint" 연속 카드 (단발 전력 측정)
- Wave 2 Zone 뱃지 매핑에 sprint 누락 → 뱃지 안 나옴
- 추가: `run.zone.sprint` = "시간 측정 · Time Trial" / "Time Trial"

### 변경

- [ko.json](../src/locales/ko.json) / [en.json](../src/locales/en.json) — `run.zone.sprint` 키 추가
- [PlanExerciseDetail.tsx](../src/components/plan/PlanExerciseDetail.tsx) — `continuousZoneKey` 매핑에 sprint 추가

### 회귀

- 웨이트 / 코어 / 인터벌 / 연속 러닝 UI 전부 불변
- tsc 통과, Vitest 22/22 통과

**배포**: 클라만 (서버 스키마 변경 없음).

---

## 회의 64-β (2026-04-19): 월간 러닝 과학데이터 3서브탭

### 요청
"히스토리>운동과학데이터>이번달 러닝 데이터가 있어야겠는데?
저정도면 운동과학데이터도 탭을 나눠야하는거아닌가여?"

### 자문 합의 (Seiler/Esteve-Lanao/Bakken/Davis/Sang)
- 7지표: 볼륨(거리/횟수/시간/페이스) + 시간가중 Z1/Z2/Z3 + Davis 10% + 지난달 delta + 요일 히트맵 + 세션믹스 4종
- 3서브탭 구조: 볼륨 / 강도 / 패턴
- Zone 매핑 (duration-based, Seiler 원논문 기준):
  - Z1(저): easy · long · walkrun
  - Z2(중): tempo · threshold
  - Z3(고): vo2_interval · sprint_interval · time_trial + legacy(fartlek/sprint)

### 변경
- 신규: `src/utils/monthlyRunning.ts` — 월간 집계 + 지난달 비교
- 신규: `src/components/report/MonthlyRunningScience.tsx` — Kenko 3탭 UI
- 수정: `src/components/report/WorkoutReport.tsx` — `isRunningSession` 플래그 + 과학데이터 펼치기 러닝 분기 추가
- 선행(63cddd7): `ProofTab.tsx` 부위도감 유산소 카운트 버그 수정 (runningStats 가드 → strength 정규식 앞)

### 평가자 결과
- PASS: isRunningSession 판별, 버튼 조건, mixed 세션 회귀 방지, Seiler duration-based 매핑, 빈 상태 3탭, 부위도감 runningStats 가드 순서, tsc, Kenko 스타일
- FLAG (경미): (1) i18n 인라인 → locales 리소스 이전 권장(JA/ZH 확장 대비) (2) 영문 요일 T/S 중복 (3) 세션믹스 interval 0 임계 8회

### 배포
클라만. 커밋 d697893, push 완료.

---

## 회의 2026-04-24 — AdviceCard ↔ MasterPlan 운동 동기화 (workoutTable exerciseList 바인딩)

### 유저 리포트
"그날 하루 운동 플랜에 하체 1·어깨 2·팔 2로 짜달라 했는데, 플랜엔 하체 2·등 2·팔 1이 나옴. 확인 부탁."

### 근본 원인 (구조적 결함)

- AdviceCard 의 `workoutTable` 은 Gemini가 직접 채운 **디스플레이 텍스트**였음.
- "오늘 이 운동 시작" 클릭 시 클라이언트는 `recommendedWorkout.{sessionMode, targetMuscle, goal, ...}` **enum 3개만** 서버로 전송.
- 서버 `generateAdaptiveWorkout` 은 workoutTable 을 모른 채 `sessionMode==="balanced"` 분기로 진입 → `generateBalancedWorkout()` 의 **하드코딩된 "하체 2 + 상체 3 (push/pull 교대)" 템플릿** 실행.
- 결과: 유저가 본 운동(workoutTable) ≠ MasterPlan 운동. 이번 케이스는 고강도 pull day → 하체2(트랩바 데드리프트/힙쓰러스트) + 등2(펜들레이/체스트 서포티드) + 이두1(프리처 컬).
- `targetMuscle` enum(`chest|back|shoulders|arms|legs`)은 **단일 부위**만 허용 — "하체1+어깨2+팔2" 같은 복합 비율 표현 자체가 불가능.

### 결정

"유저 needs 최우선" 원칙 → Option 2(workoutTable → 실행 연동) 채택. 구조 결함 해소를 위해 AdviceCard 에 표시된 운동 = MasterPlan 에 실행되는 운동 **일치 보장**.

### 변경

**Server (functions/):**
- `functions/src/ai/parseIntent.ts`:
  - `AdviceContent.recommendedWorkout.exerciseList?: Array<{name, sets, reps, rpe?}>` 추가.
  - 프롬프트에 exerciseList 규칙 신설(workoutTable 있으면 REQUIRED / 복합 부위 비율 요청의 유일 전달 경로 / exercise_catalog 한국어 풀명 한정 / main 운동만, 최대 8개).
  - 출력 스키마 line + 새 예제(`advice-mode-composite-ratio`) 추가.
  - `sanitizeExerciseList()` 헬퍼 — 유효성 검증·정규화·최대 8개 제한.
- `functions/src/workoutEngine.ts`:
  - `ExerciseListInput` export 타입 + `POOL_INDEX` lazy 인덱스(LEG/PUSH/PULL/HEAVY_* + CORE 10개 카테고리).
  - `resolveExercise()` — 4단계 매칭(정확·한국어·normalize·부분포함) 후 실패 시 그룹=`other` fallback.
  - `generateFromExerciseList()` — warmup/core/cardio 기존 빌더 재사용, main만 유저 리스트. ACSM tempo guide + RPE 병기. title/description 을 그룹 카운트("하체 1종 + 어깨 2종 + 팔 2종")로 동적 생성.
  - `generateAdaptiveWorkout()` 시그니처에 `exerciseList?` 추가 + **최우선 routing**(존재 시 sessionMode 무시).
- `functions/src/plan/session.ts`:
  - body 파싱에 `exerciseList` 추가 → 엔진 전달.
  - 보안 셔플(last-2 main swap)은 exerciseList 경로에서는 **제외** — 유저가 지정한 순서 = 계약.

**Client (src/):**
- `src/constants/workout.ts`: `SessionSelection.exerciseList?` 추가.
- `src/app/app/page.tsx`:
  - `lazyGenerateWorkout` 시그니처 확장 + body 에 `exerciseList` 포함.
  - push/pull localStorage rotation을 `exerciseList` 경로에서는 **스킵** (generateBalancedWorkout 미실행이므로 rotation 상태 훼손 방지).
  - `handleIntensityChange` / `handleRegenerate` 에서 `currentSession?.exerciseList` 유지 전달.
- `src/components/dashboard/ChatHome.tsx`: `onStartRecommended` 에서 `rec.exerciseList` 를 SessionSelection 으로 forward.
- `src/components/dashboard/AdviceCard.tsx`: 클라이언트 `AdviceContent` 타입에도 `exerciseList` 미러링.

### 안전 장치

- exerciseList 부재/빈 배열 → 기존 sessionMode 라우팅으로 **완전 fallback** (기존 balanced/split/running/home_training 경로 무손실).
- 풀 매칭 실패 → 입력값 그대로 사용 + 그룹=`other` (세션 생성 자체는 실패하지 않음).
- 프롬프트는 workoutTable/복합 비율 시에만 exerciseList 요구 — 기존 "가슴 30분" 같은 split 요청은 영향 없음.

### 검증

- functions `npm run build` PASS (tsc clean).
- Next.js `npm run build` PASS (15 static pages).

### 시뮬레이션 검증 (2026-04-24 추가)

배포 전 10종 시나리오 시뮬레이션. 발견 버그 2건 즉시 수정.

**BUG 1 — 러닝 요청 + exerciseList 충돌**: `generateAdaptiveWorkout` 라우팅 순서상 exerciseList 체크가 `sessionMode==="running"` 보다 먼저였음. Gemini 가 실수로 러닝 응답에 exerciseList 를 채우면 러닝 인터벌 구조 손실되고 strength 세션으로 둔갑. **Fix**: running 가드를 exerciseList 라우팅보다 앞으로 이동. 프롬프트에도 "러닝 요청은 exerciseList 금지" 명시.

**BUG 2 — 코어 운동이 main/strength로 잘못 분류**: 유저가 "코어 5개만" 요청 시 Gemini 가 exerciseList 에 플랭크/크런치를 넣으면, 서버는 모든 item 을 `type:"strength", phase:"main"` 으로 고정해 FitScreen 이 웨이트 픽커 UI 로 렌더 → UX 파괴. **Fix**: `resolveExercise` 결과 `group==="core"` 면 `type:"core", phase:"core"` 로 전환 + weight 생략. 유저가 core 를 직접 지정했으면 자동 `buildCore` 스킵해서 중복 방지.

**통과 시나리오**: 하체1 어깨2 팔2 (원본 버그), 가슴 30분 (기존 split), 상체당기기 4개, 등 3개만, 친업(back/arm 중복 등록), 동일 운동 중복, home_training 등. 프롬프트 완화 — "코어 명시 요청 시만 코어 허용".

**미해결 / 회귀 리스크**:
- Gemini 가 `exerciseList` 필드를 일관 채우는지 프로덕션 관찰 필요.
- 풀에 없는 운동명 → `other` 그룹 수납되어 title 이 "기타 N종" 어색할 수 있음. 로그 추적 후 catalog 보강.
- home_training + exerciseList 조합 시 equipment=bodyweight_only 필터가 exerciseList 경로에 적용 안 됨 — Gemini 프롬프트 책임에 의존. 실제 BW 위반 발생 시 서버 필터 추가.
- 배포 순서: **functions 먼저** (`firebase deploy --only functions`) → Hosting (`git push` CI).

---

## 회의 2026-04-24 후속 — 인터벌 러닝 마지막 라운드 sprint 수동 완료 UX fix

### 유저 리포트
"인터벌 러닝 완료시 완료 버튼 클릭이 안되던데 확인해줄래?"

### 원인
[FitScreen.tsx:382-385](../src/components/workout/FitScreen.tsx#L382) 의 `handleRunningCompleteClick` 에서 인터벌 플레이 중 수동 완료는 `manualCompleteRef.current = true` 플래그로 다음 tick 에서 페이즈 전환. 하지만 tick 처리부 [L521-530](../src/components/workout/FitScreen.tsx#L521) 은 `phaseRef.current === "sprint"` 면 **무조건 recovery 로 전환** — 라운드가 마지막이어도 같음. 결과: 마지막 라운드 sprint 에서 완료 클릭 → sprint → recovery 전이만 되고 세션 종료 안 됨. 버튼 라벨이 "완료" 인데 동작은 "다음 페이즈" 라 유저가 "안 눌림" 으로 인식.

회의 64-V 후속 주석("마지막 라운드 recovery가 끝나지 않은 경우에만 의미") 으로 이미 설계 누락 자체는 인지 상태였으나 처리가 빠져있었음.

### 수정

[src/components/workout/FitScreen.tsx](../src/components/workout/FitScreen.tsx) 인터벌 tick 핸들러에 가드 추가:

```ts
if (manualComplete && phaseRef.current === "sprint" && roundRef.current >= cfg.rounds) {
  setIsPlaying(false);
  setTimerCompleted(true);
  playAlarmSound("end");
  navigator.vibrate([300, 100, 300, 100, 300]);
  if (onRunningStatsComputed) {
    // computeRunningStats + 콜백 (기존 recovery-end 로직과 동일)
  }
  return;
}
```

조건 3개 모두 충족해야 발동:
- `manualComplete`: 유저 수동 완료 (자연 `remainingFloat<=0` 이나 `distanceReached` 는 기존 recovery 전환 유지)
- `phaseRef.current === "sprint"`: sprint 페이즈
- `roundRef.current >= cfg.rounds`: 마지막 라운드

### 영향 범위
- **마지막 라운드 sprint + 수동 완료**: 즉시 세션 종료 (새 동작) ← 수정 대상
- **마지막 라운드 recovery + 수동 완료**: 기존대로 즉시 종료 (기존 else 분기)
- **비마지막 라운드 sprint + 수동 완료**: 기존대로 recovery 로 전환 (페이즈 스킵 유지)
- **자연 완료**: 기존대로 recovery-end 에서 종료

### 검증
- Next.js `npm run build` PASS.
- FitScreen.tsx 고위험 파일 — share-card.md / workout-session.md 룰 재확인 후 편집.

### 배포
클라만 (서버 변경 없음). `git push` 하면 CI 자동 배포.

---

## 회의 2026-04-24 후속 ②: FitScreen 우측 상단 스킵·종료 2-아이콘

### 대표 요청
"운동 종료 버튼 왼쪽에 아이콘으로 스킵 버튼이랑 운동종료 버튼을 아이콘으로 두개 fitscreen 우측 상단에 있도록 만들어줄래? 이건 웜업, 메인, 코어, 추가유산소 다 있도록"

### 설계 컨펌
SKIP 의미 3안 중 **A) 현재 운동 스킵 → 다음 운동으로** 확정 (대표 컨펌). SVG 라인 아이콘 스타일 (기존 back 버튼 규약).

### 변경
- [src/components/workout/FitScreen.tsx](../src/components/workout/FitScreen.tsx): `onSkipExercise?: () => void` prop 추가. 기존 "운동 종료" 텍스트 필 → 아이콘 2개(⏩ 스킵 이중 chevron · ⎋ 운동종료 logout-arrow). `isDoneAnimating || view === "feedback"` 중엔 opacity 30 + pointer-events-none.
- [src/components/workout/WorkoutSession.tsx](../src/components/workout/WorkoutSession.tsx): `handleSkipExercise()` 신설. `timingsRef.push` (세션 시간 정합 유지) + 세트 로그 없음 + `currentIndex++`. 마지막 운동 스킵 시 `showAddExercise=true` 로 add-exercise 화면 진입.
- 기존 `onEndClick` (중도종료 팝업) 동작 동일 유지.

### 검증
Next.js `npm run build` PASS. 모든 phase (warmup/strength/core/cardio) 노출 확인. 커밋 `0df4513`.

### 배포
클라만 — `git push` 하면 CI 자동 배포.

---

## 회의 2026-04-24 후속 ③: ShareCard margin 간격 벌어짐 재발 fix

### 대표 리포트 (스샷 첨부)
"쉐어 카드 다운받으니깐 왜 또 벌어져있지? 분명히 그때 잡았는데 줄간격..."

러닝 공유카드 다운로드 PNG 에서 Distance/Pace/Time 사이 거대한 공백.

### 원인
[.claude/rules/share-card.md](../.claude/rules/share-card.md) 룰 #2 위반. `<p>` 브라우저 UA 디폴트 margin 1em 을 html2canvas 가 그대로 반영 → fontSize 52 값에 top 52px 추가됨.

**회의 64-η(2026-04-21)에서 웨이트 카드만 `margin:0` 처리하고 러닝 카드는 누락된 상태**였음. 수정 스윕이 특정 카드에만 적용된 누수.

### 변경 (재발 방지 전면 sweep)
- [src/components/report/ShareCard.tsx](../src/components/report/ShareCard.tsx):
  - Card 0 러닝 (Distance/Pace/Time) — 모든 `<p>` `margin:0` 명시
  - Card 1 러닝 weekly — `gap:28` → `marginBottom`, 모든 `<p>` `margin:0`
  - Card 2 웨이트 PR 카드 — `gap:28/24` → `marginBottom`, 모든 `<p>` `margin:0`
  - Card 2 웨이트 노력요약 — `gap:28` → `marginBottom`, 모든 `<p>` `margin:0`
- [src/components/plan/PlanShareCard.tsx](../src/components/plan/PlanShareCard.tsx): 헤더·Stats·Phase 전체에 `margin:0` + `gap` → `marginRight` 마이그 (선제적 재발 방지).

### 검증
Next.js `npm run build` PASS. 시각적 미리보기는 그대로 유지 (spacing 값 동일, 소스만 변경). 커밋 `7935ba6`.

### 배포
클라만. 렌더 타임 fix 라 **과거 저장 세션도 재다운로드 시 정상** 표시됨.

---

## 회의 2026-04-24 후속 ④: 인터벌 상세 라운드 1 sprintPace 누락 fix

### 대표 리포트 (스샷)
"라운드 1 짤리는거 보이지 UI 확인부탁드려요 디자이너님"
→ 재확인 결과 "UI 가 아니라 데이터 문제" 로 판명.

### 원인 (데이터 생성 단계 결함)
[src/components/workout/FitScreen.tsx](../src/components/workout/FitScreen.tsx) 의 `gpsMarkPhase(phase, round)` 가 **페이즈 전환 시점에만 호출**됨 (L564 sprint→recovery, L602 recovery→sprint). 세션 최초 round 1 sprint 시작 시점은 `phaseStartMsRef` 만 세팅하고 mark 기록 안 함.

결과 phaseMarks: `[{rec,1}, {sprint,2}, {rec,2}, ...]` — round 1 sprint 마크 빠짐. `computeIntervalRounds` 가 mark 기반 segment 를 만들므로 round 1 sprint 구간 자체가 존재하지 않음 → `sprintPace: null` 로 Firestore 저장 → UI 가 `formatPace(null) = "—"` 정확히 렌더.

"UI 짤림" 처럼 보였지만 실제로는 null 의 em dash 렌더였음 (UI 착시).

### 변경
[FitScreen.tsx:483-486](../src/components/workout/FitScreen.tsx#L483) 최초 시작 분기에 `gpsMarkPhase("sprint", 1)` 1회 기록. pause/resume 시 `phaseStartMsRef !== 0` 이라 분기 미진입 → 중복 mark 없음.

### 한계
`RunningStats.intervalRounds` 는 세션 종료 시점에 1회 계산돼 Firestore 에 저장. 원본 `phaseMarks` 와 GPS `points` 는 용량 이슈로 저장 안 함. **기존 broken 세션은 재계산 불가** — 새 세션부터 유효.

### 검증
Next.js `npm run build` PASS. 커밋 `33c79ed`.

### 배포
클라만. 새 인터벌 세션 1회 돌려서 라운드 1 sprint 값 숫자 표시 확인 필요.

---

## 회의 2026-04-24 후속 ⑤: 인터벌 거리 midpoint 정확도 + 휴식종료 사운드 가청성

### 대표 리포트
"400m 인터벌때 200m 에서 중간 알람이 아니아 230m? 그쯤에서 울리고 그리고 휴게시간 끝나도 알림음이 나왔으면 좋겠어!"

두 이슈:
1. 400m 인터벌 중간 알람이 200m 가 아닌 ~230m 에서 울림
2. 휴식 끝날 때 알림음이 없거나 안 들림

### 원인

**#1 중간 알람**: [FitScreen.tsx:613-619](../src/components/workout/FitScreen.tsx#L613) 의 midpoint 로직이 `Math.floor(phaseTotal / 2)` — **시간 절반 기반**. 거리 기반 sprint 는 `phaseTotal` 이 `estimateSprintSec()` 추정치 (paceGuide 평균 × 거리). 유저가 추정보다 빠르면 시간 절반 시점에 이미 더 먼 거리 도달 (400m 목표에 ~230m 울림).

**#2 휴식종료 사운드**: 인터벌 사운드 의미가 뒤집혀있음.
- sprint→recovery (rest 시작): `playAlarmSound("rest_end")` — 3 bells 큰 소리 (이름 역설적 — rest 가 시작하는 순간에 rest_end 재생)
- recovery→sprint (rest 끝남): `playAlarmSound("start")` — 단일 퍼커션, 조용 → 유저가 놓침
- 강엉잠 rest 타이머 [L838](../src/components/workout/FitScreen.tsx#L838)는 정상: rest 끝날 때 `"rest_end"` (3 bells)
- **인터벌만 반대 매핑**

### 변경

**#1 거리 midpoint**: 거리 기반 sprint (`cfg.sprintDist != null && gpsIsAvailable && !isIndoor`) 는 거리 절반(예: 200m) 도달 시 발동. 시간 기반 인터벌·recovery 는 기존 시간 기준 유지.

```ts
const isDistanceSprint = phaseRef.current === "sprint"
  && cfg.sprintDist != null && gpsIsAvailable && !isIndoor;
midReached = isDistanceSprint
  ? (gpsDistanceRef.current - phaseStartDistRef.current) >= (cfg.sprintDist! / 2)
  : (midpoint > 0 && remainingInt <= midpoint);
```

**#2 사운드 의미 정리**:
- sprint→recovery: `"rest_end"` → `"start"` (짧은 stop 신호)
- recovery→sprint: `"start"` → `"rest_end"` (3 bells "가자!" 신호). 강엉잠 rest 와 통일.
- rec→sprint 진동도 `[100]` → `[200,100,200]` 2-pulse 로 강화.

### 검증
Next.js `npm run build` PASS. 커밋 `b1c3452`.

### 배포
클라만. 400m 인터벌 1회 돌려서 200m midpoint + rec→sprint 3-bell 확인 필요.

---

## 회의 2026-04-24 후속 ⑥: 러닝 세션 전종 감사 (동일 클래스 버그 유무 점검)

### 대표 요청
"다른 러닝 프로그램에서도 비슷한 문제 있는지 다 확인부탁드려요"

최근 4건 fix (#1 거리 midpoint, #2 사운드 swap, #3 round1 sprint mark, #4 라스트 라운드 manual complete) 의 적용 범위 및 놓친 세션 타입 점검.

### 감사 방법
러닝 세션 생성기 전수 조사:
- [functions/src/workoutEngine.ts](../functions/src/workoutEngine.ts) `generateRunningWorkout` (4 legacy 타입)
- [functions/src/runningProgram.ts](../functions/src/runningProgram.ts) 17 slotType 빌더
- FitScreen 라우팅 (`deriveIntervalSpec` → `isIntervalMode` 판정)

### 결과: **4 fix 전종 자동 커버리지**

| 세션 타입 | 구조 | 적용 상태 |
|---|---|---|
| 시간 기반 인터벌 (walkrun, fartlek/vo2_interval, sprint_interval 30s, strides, norwegian_4x4, pure_sprints) | sprintSec+recoverySec | #2/#3/#4 ✓, #1 은 N/A (시간 정확) |
| 거리 기반 인터벌 (intervals_400/800/1000/1600m, race_pace_interval) | sprintDist+recoverySec, `runKind:"continuous"` 태그지만 intervalSpec 포함 → FitScreen interval UI | **4 fix 전부 ✓** |
| 연속 러닝 (tempo, easy, long, threshold, threshold_2x15, long_with_mp, specific_long) | 단일 시간/거리, phase 전환 없음 | 해당 없음 |
| 타임트라이얼 (tt_2k, tt_5k, dress_rehearsal) | 단일 거리 continuous | 해당 없음 |
| 워밍업/쿨다운 타이머 | isTimerMode 별도 useEffect | 별도, 이슈 없음 (고정 시간, 추정 아님) |

**커버리지 달성 이유**: 모든 인터벌이 FitScreen 단일 useEffect 통과. `deriveIntervalSpec` 이 `runKind:"continuous"` 여도 intervalSpec 있으면 interval UI 활성 (박서진 회의 64-I 원칙). `recoveryDist` 필드는 정의만 있고 실사용 0건.

### 경미 리팩터 2건 (보류 — 유저 리포트 없음)

1. **거리 기반 sprint 의 3-2-1 tick 이 시간 기반**: 유저가 추정보다 빠르면 실제 거리 도달 전 "3초 남음" 울림. 개선 방향: 거리 기반이면 tick 도 거리(50m/30m/10m 남음) 기준 변경. 유저 요청 없음 → 보류.
2. **pause 중 GPS 드리프트 가능성**: `phaseStartDistRef` 가 pause 시 shift 안 됨. useGpsTracker 의 auto-pause (10초 정지)가 대부분 막지만 edge case. 유저 리포트 없음 → 보류.

### 배포
감사만 — 코드 변경 없음.

---

## 회의 2026-04-24 후속 ⑦: 피트니스 나이 raw ACSM 분리 + cardioOnly 경고 제거

### 대표 지시
"나이 측정에서는 조금 더 타이트해도 될 것 같은데, 엘리트 체육인까진 아니더라도" → **A안 채택 (raw ACSM)**.
"유저에게 우리 앱이 빈틈이 있다 보여주는 것 같은데?" → 자기 결함 노출 금지 (`feedback_product_positioning` 룰).

### 배경 및 원인
- 회의 54 (2026-04-12) EASING_FACTORS 적용 — chest/back/legs ×0.93 / shoulder ×0.82 / core ×0.80 — 화면 표시 percentile 동기부여 톤.
- **부수효과**: 같은 EASING 이 fitness age 산출에도 그대로 적용 → 30대 일반인이 fitness age 27-28세 (3-3.5살 어림) → 너무 후함.
- 추가 발견: cardio-only 케이스에 amber 경고 ("체력 축만 측정됨") 띄우고 있었으나, 학문적으론 **HUNT3 정통 fitness age 모델이 cardio 단일 기반 (Nes BM et al. 2014, [PubMed 24576865](https://pubmed.ncbi.nlm.nih.gov/24576865/))** — 즉 가장 정통한 케이스에 가장 큰 경고를 띄우는 모순. 게다가 weight-only 경고는 0건 → 일관성 무너짐.

### 자문단 (3차 회의)
- **한체대 교수 (체력평가)**: HUNT3 모델 = VO2max 기반 단일 지표. 우리 앱의 "근력+체력 종합" fitness age 는 학계 검증된 모델 아님. ±12.5 cap 자체는 합리적 (HUNT3 ±15).
- **운동생리학자 (ACSM)**: 비선형 매핑보다 현재 선형 0.25 가 정규분포 변환된 percentile 입력엔 더 적절. 다만 EASING 적용된 percentile 이 fitness age 입력으로 들어가면 over-correction.
- **건강운동관리사**: 5살 이상 어림 = 신뢰 역효과 zone. 1-2살 어림이 동기부여+신뢰 둘 다 잡음.
- **김경록·Seth Godin·박충환 (마케팅)**: "참고용" / "신뢰도 N/6" 같은 라벨은 자기 결함 광고. 브랜드 캐즘 Stage 1 에서 치명적. UI 라벨 강화 X.

### 변경

**[src/utils/fitnessPercentile.ts](../src/utils/fitnessPercentile.ts)**:
- `bwRatioToPercentile(bwRatio, cat, gender, age, opts?: { skipEasing?: boolean })` — 신규 옵션 인자.
- 기본 동작 (default): EASING 적용 (회의 54 그대로) — 화면 표시용.
- `skipEasing: true`: raw ACSM 사용 — fitness age 산출 전용.

**[src/components/report/tabs/StatusTab.tsx](../src/components/report/tabs/StatusTab.tsx)**:
- `categoryPercentilesForAge` 신설 — 각 부위 percentile 을 `skipEasing: true` 로 재계산 (cardio 는 별도 페이스 percentile 그대로).
- `overallPercentileForAge` → `computeFitnessAge` 입력. 화면 표시 percentile (기존 `categoryPercentiles`) 은 변화 없음.
- `cardioOnlyMode` 변수 + amber 경고 블록 제거. i18n key `status.fitnessAge.cardioOnly` 는 잔존 (다른 곳 사용 가능성, 후속 정리).

### 영향 시뮬 (30대 남자 75kg, 평균 능력)

| | 화면 표시 (육각형/등수) | fitness age |
|---|---|---|
| Before | 평균 percentile ~62 (변화 없음) | 27-28세 (3-3.5살 어림) |
| After | 평균 percentile ~62 (**변화 없음**) | **30세 ± 1** (정확) |

→ 유저가 보는 화면 변화 0. fitness age 만 학문 정확성 회복.

### 검증
Next.js `npm run build` PASS. 대표 컨펌 받고 진행.

### 배포
클라만 — `git push` 하면 CI 자동.

---

## 회의 2026-04-25 — 저장소 정리 세션 (용량 회수 + 문서 구조 개선)

### 대표 요청
"불필요하게 남은게 많은거 같아서 좀 하나하나 씩 정리하게" — 루트 디렉토리 전수 감사 + 미사용 에셋/스테일 문서/중복 의존성 정리.

### 1. 삭제 — 빌드/실험 산물 (~425M)

| 대상 | 용량 | 근거 |
|---|---|---|
| `experiments/` | 42M | README 명시 "쓰고 폐기" · .gitignore 등록 · 마지막 활동 Apr 15 |
| `.firebase/ounjal/` + 캐시 | 4.2M | typo 프로젝트 잔재 (.firebaserc default=ohunjal). 마지막 Mar 8 |
| `.next/` | 381M | 빌드 캐시. dev 서버 확인 후 (3000 비어있음) 삭제. `npm run build` 재생성 |
| `.gstack/` | 1M | gstack QA 로그 · .gitignore 등록 |
| `.DS_Store` 잔재 4개 | 소량 | macOS 메타 |

### 2. `.planning/` 구조 개선

**archive 이동 8건** (git mv 이력 보존):
- `landing-redesign-brief.md` (실행 완료: 04-21 브랜드 캐즘 재작성)
- `proof-tab-redesign-prep.md` (prep 후 리디자인 실행 완료)
- `master-plan-redesign/AUDIT.md` (PlanLibraryPane/PlanSelectedPane 분리 반영)
- `SPEC-64-XYZ.md` (Batch D/E 완료 → CURRENT_STATE 러닝리포트 Wave1-3)
- `DESIGN-RUNNING-REPORT-KENKO.md` (회의 64-α Kenko 리디자인 실행 완료)
- `audits/GEO-AUDIT-2026-04-02.md` (23일 전 감사, JSON-LD 5종 등 개선됨)
- `da-refactor-design.md` (트랙 A 이벤트 보강만 실행, 트랙 B/C 대표 킬 확정)
- `metrics-guide.md` (46일 방치, 컴포넌트 SSOT 역할 이관 — 참고문헌만 보존 가치)

**삭제 7건 — `.planning/codebase/`**:
- ARCHITECTURE/CONCERNS/CONVENTIONS/INTEGRATIONS/STACK/STRUCTURE/TESTING.md
- 2026-03-31 자동 생성 (25일 전), 이후 러닝 프로그램/Kenko/Paddle/AdviceCard 동기화 대량 변경 → 실제와 괴리
- `.claude/rules/` 가 실질 규칙 역할 중이라 중복

### 3. `public/` 미사용 에셋 삭제 (-43M)

전 프로젝트 grep 0 refs 검증 후:
- `is-it-right2.mp4` (41.6M) — 랜딩 리디자인으로 제거된 영상
- `login-logo` 구버전 2개 (3.1M)
- `bigdog.png`, `favicon_emerald_10B981_transparent.png`
- `icons/body-blue-backup/` (6 SVG) — 이름만 backup 폴더 (실사용 `favicon_backup.png` 는 AI 코치 아바타 7곳 사용 중, 유지)
- Next.js 템플릿 잔재 5개 SVG (file/globe/next/vercel/window)

### 4. `package.json` 의존성 제거 (3개)

정밀 검증 후:
- `@google/genai` — frontend 0 imports (functions/ 에만 사용, functions/package.json 별도 선언됨)
- `framer-motion` — src/ + functions/ 전체 0 imports
- `pretendard` — CDN 로드 중 ([layout.tsx:117](../src/app/layout.tsx#L117) jsdelivr), npm 패키지 중복

검증: `npm run build` + test 22/22 통과.

### 5. `README.md` 재작성

- Before: Next.js create-next-app 보일러플레이트 33줄, "ohunjal" 0회 언급
- After: 오운잘 제품 소개 + 기술 스택 + 개발/배포 명령어 + .env.local 카탈로그 + 프로젝트 구조 + CLAUDE.md/CURRENT_STATE/MEETING_LOG 링크 (80줄)

### 6. `package.json` 스크립트 보강

신규 4개 추가:
- `typecheck`: `tsc --noEmit` (빌드 없이 타입 체크)
- `functions:build`, `functions:serve`, `functions:deploy`: CLAUDE.md 명시된 `cd functions && ...` 패턴을 루트 스크립트로 노출

### 커밋 (총 5개)

| 해시 | 메시지 |
|---|---|
| `0771300` | chore(planning): 완료 문서 archive 이동 + 스테일 codebase 스냅샷 제거 |
| `f9d69f5` | chore(public): 미사용 에셋 정리 (-43M) |
| `c9f2f3f` | chore(deps): 미사용·중복 의존성 3개 제거 |
| `8233977` | docs(readme): 프로젝트 소개 재작성 |
| `7c2ae4a` | chore(scripts): 편의 npm 스크립트 4개 추가 |

### 검증
- `npm run build` PASS (15/15 정적 페이지)
- `npm run test` 22/22 통과
- `npm run typecheck` exit 0
- Firebase Hosting CI 자동 재배포 완료

### 결과

- **용량 회수:** ~471M (디스크) + 43M (저장소 bundle)
- **문서 구조:** `.planning/` 정리 — 핵심 4개 + archive/ + advisors/ + design/ + strategies/ 만 남음
- **개발자 경험:** README 정상화 + typecheck 스크립트 + functions:* 편의 스크립트

### 미해결 과제
- `public/` 에 1ref 파일들 (price/how-it-works/로고 등) 재검증 — 대표 판단: **필요한 파일**로 유지 (랜딩·프라이싱 실사용 의심)
- 이번 세션 CURRENT_STATE.md 업데이트 — 유저 미노출 내부 인프라 변경이므로 기록 불요 (MEETING_LOG 로 충분)

### 재발 방지 룰
- `.planning/` 완료 문서는 실행 확인 후 archive/ 이동 원칙 (신규 적용)
- npm 의존성 추가 시 실사용 확인 — CDN 사용 시 npm 중복 지양

---

## 회의 2026-04-25 ②: setDetails 플랜 편집 → FitScreen 미전달 버그 fix

### 대표 발견
"플랜에서 무게랑 횟수설정하면 fitscreen에 적용이 잘되는지도 확인한번해줘"

### 진단 (코드 감사)
MasterPlanPreview 의 useSetEditor.updateSetDetail 은 `ex.setDetails[setIdx]` 에만 저장하고 `ex.reps`/`ex.weight` 는 건드리지 않음. 그런데 WorkoutSession → FitScreen 의 setInfo 는:
```tsx
setInfo={{ targetReps: currentExercise.reps, targetWeight: currentExercise.weight }}
```
로 단일 값만 읽음. 결과: **세트별 편집이 실제 운동 실행에 0 반영**.

CURRENT_STATE.md L311 "세트/반복/무게 — useSetEditor 훅으로 개별 set 편집" 문구와 실제 동작 괴리.

### 영향 범위
- setDetails undefined (AI 자동 생성 플랜 대다수): 영향 X — ex.reps/weight 경로 동일 동작
- setDetails 존재 (유저가 MasterPlan에서 세트별 손댐): **모든 세트가 첫 세트 값 or 원래 값으로 균일 실행** → 세트별 편집 의도 손실

### 해결 — A안 채택 (WorkoutSession/FitScreen 이 setDetails 소비)
대표 컨펌 후 진행. B안(useSetEditor 가 ex.reps/weight 동기화)은 기능 축소라 기각.

### 변경
**[src/components/workout/WorkoutSession.tsx](../src/components/workout/WorkoutSession.tsx)** 2 지점:

1. **setInfo prop 구성** (L562-577): IIFE 로 `currentExercise.setDetails?.[currentSet-1]` 우선 lookup → 없으면 `ex.reps`/`ex.weight` fallback. FitScreen 의 render-time sync ([FitScreen L165-184](../src/components/workout/FitScreen.tsx#L165)) 이 setInfo 변경 감지해 adjustedReps/selectedWeight 재동기화.

2. **handleSetComplete 피드백 루프** (L221-235): easy/too_easy/fail 시 `exercise.reps = newReps` 유지 (setDetails 없는 경로 호환) + **setDetails 존재하면 다음 세트 인덱스만 패치**:
   ```ts
   if (exercise.setDetails && exercise.setDetails.length > 0) {
     const nextIdx = currentSet; // 방금 완료가 1-indexed currentSet, 다음은 0-indexed currentSet
     if (nextIdx < exercise.setDetails.length) {
       const patched = [...exercise.setDetails];
       patched[nextIdx] = { ...patched[nextIdx], reps: newReps };
       exercise.setDetails = patched;
     }
   }
   ```

### 설계 결정: 피드백 cascade 범위
**정책: 다음 세트 1개만 패치.** 이유:
- 유저가 set 2 (85kg 8), set 3 (90kg 6) 처럼 피라미드 세트를 의도적으로 플랜했으면 set 1 피드백이 set 3 까지 뒤엎는 건 의도 파괴
- 기존 ex.reps 기반 구동 시엔 모든 세트가 ex.reps 공유라 전체 적용이 자연스러웠음. setDetails 세계에선 각 세트가 독립적 intent → **next set only** 가 유저 의도 보존 원칙에 맞음
- 기존 AI 자동 플랜 케이스(setDetails 미존재)는 ex.reps 경로로 모든 세트 적용 — 이전 동작 보존

### 검증
- `npm run typecheck` exit 0
- `npm run build` PASS (15/15 정적 페이지)
- `npm run test` 22/22 통과

### 배포
클라만. 커밋 `022b141` main 푸쉬 완료 → GitHub Actions Hosting CI 자동 재배포.

### UAT (대표 확인 필요)
재현 시나리오:
1. 플랜 화면에서 벤치프레스 선택
2. 세트 2 무게를 +10kg (예: 70kg → 80kg)
3. "운동 시작" → 세트 2 진입 시 80kg 로 등장하는지 확인
4. 추가: 세트 1 완료 시 "+ 2회" 피드백 주고 세트 2 targetReps 가 기본값+2 로 바뀌는지 확인 (단, 세트 2 에 reps 도 미리 편집했다면 그 값이 보인 뒤 피드백으로 +2 반영)

### 재발 방지
- CURRENT_STATE.md L311 문구 실제 동작과 일치 여부 재확인 필요 (이번 수정으로 일치 회복, 갱신 불요)
- useSetEditor 편집 시 setDetails / ex.reps / ex.weight 3 소스 일관성 주의 — 추후 refactor 시 setDetails 단일 SSOT 로 통일 고려 가능

---

## 회의 2026-04-27 — ROOT 진입 화면 카드 도입 (웨이트/러닝/홈트 3카드)

### 맥락
대표 지시: 앱 접속 직후 채팅창이 바로 뜨는 게 아니라 **선택적으로 시작**할 수 있게 변경. ChatHome 직진입의 진입 장벽(텍스트 입력 강제) 해소가 목표. 1x3 → 3x1 세로 버튼 카드로 확정. 디자인은 Kenko 톤(회의 64-α 토큰 재사용).

### 결정 (10건)
1. ROOT 첫 진입을 **3x1 세로 버튼 카드** — 웨이트 / 러닝 / 홈트
2. ROOT 화면은 **하단 네비바 X**. 카드 진입 후 화면들에서만 부활
3. 우상단 아이콘 **2개만**: [📋 내 플랜] [👤 프로필]. 영양은 카드 진입 후 네비바로 (1탭 깊어짐 OK)
4. 첫 카드 클릭 시 **온보딩 7스텝 부활** (welcome→gender→birth_year→height→weight→**goal**→done). 기존 `Onboarding.tsx` 자산 그대로 재활용. 한 번 끝나면 어떤 카드도 패스.
5. 웨이트 → 기존 `ChatHome` 흡수. 러닝/홈트 의도가 ChatHome에 들어오면 **(다)변형** "짧은 안내 + 단일 이동 버튼" 처리 (응답 빠르게)
6. 러닝 → `RunningProgramSheet` 4프로그램(vo2_boost / 10k_sub_50 / half_sub_2 / full_sub_3) 자산을 풀스크린 화면 `RunningHub`로 변환
7. 홈트 → `generateHomeWorkout` (`equipment: "bodyweight_only"`, 회의 64-M4) 호출판 신설. 부위/시간/강도 픽커. 추후 유튜브 채널 운동 프로그램으로 진화 예정 — 1차는 placeholder.
8. 카드 위계 **동일 사이즈**. 진행 중 장기 프로그램 있으면 우상단 내플랜 아이콘 활성·바로 진입. dynamic time-of-day highlight는 1차 보류.
9. 히스토리는 **통합 유지** (ProofTab 그대로). 분리 X.
10. 디자인 언어 **Kenko** — colored container 금지, 흰 배경 + 얇은 보더 + uppercase 라벨 (회의 64-α 토큰 재사용)

### ChatHome 좁히기
- 예시 프롬프트 칩에서 "러닝 10km" / "홈트 30분" 제거
- "더보기" 7개 중 러닝/홈트 관련 제거
- parseIntent 응답에 `mode: "redirect"` + `target` 분기 추가 → AssistantMessage + 단일 CTA 버튼
- 시스템 프롬프트에 "웨이트 전용" 컨텍스트 박아 응답 토큰 절약

### ViewState 확장
```ts
| "root_home"        // 3카드 진입 화면
| "running_hub"      // 러닝 4프로그램 선택
| "home_workout_hub" // 홈트 룰엔진 입력
```

### 보류 항목
- "이전 플랜 이어서" 띠 위치 (1차는 ChatHome 안만)
- 체험/프리미엄 배지 위치 (1차 보류)
- 카드 SVG 출처 (Figma Kenko UI Kit vs 신규 inline) — 1차 inline 단순 stroke
- dynamic highlight (시간대/이력 기반) — 차후 회의
- 홈트 유튜브 진화 — 별도 회의

### 산출물
- `.planning/PLAN-ROOT-HOME-CARDS.md` (작업 분해 11섹션)

### 분리 커밋 8개 (예정)
1. `feat(root): ViewState root_home 추가 + RootHomeCards 컴포넌트 골격`
2. `feat(root): 카드 첫 클릭 → Onboarding 게이트 부활`
3. `feat(running-hub): RunningHub 화면 — 4프로그램 선택판 풀스크린화`
4. `feat(home-workout-hub): HomeWorkoutHub 화면 — bodyweight_only 진입판`
5. `refactor(chat-home): 러닝/홈트 의도 → redirect 안내 카드 + 칩 정리`
6. `feat(root): 우상단 내플랜/프로필 아이콘 동작 연결`
7. `chore(i18n): root_home 화면 ko/en 키 추가`
8. `docs: CURRENT_STATE.md ROOT 카드 섹션 + MEETING_LOG.md 갱신`

### 리스크 / 롤백
- 자유 입력 가치 약화 → parseIntent 시스템 프롬프트 재조정 + redirect 안내로 보완
- Onboarding 7스텝 마찰 → 길면 후속 회의에서 압축 검토
- 영양 진입 1탭 깊어짐 → GA `nutrition_tab_view` 이탈률 모니터링
- 환경변수 `NEXT_PUBLIC_ENABLE_ROOT_CARDS=0` 게이트로 즉시 롤백 가능

### 후속 결정 — 러닝/홈트 허브 디테일 (같은 날 후속 핑퐁)

**러닝 5단계 화면 디테일**
1. **gate_check**: 회의 64-F에서 잠금 해제됨 — 사실상 죽은 경로. 그대로 통과, 권장 안내만.
2. **추천 뱃지**: `10k_sub_50` 추천 뱃지 **제거**, `full_sub_3` "경험자" 태그 **유지**
3. **시작일 옵션 (StepSettings)**: 빼지 않고 **그대로 유지** — 빈약화 방지(주당 일수만 남으면 빈 화면)
4. **완료 후 흐름**: 토스트만 → **별도 완료 화면 신설** — 회색 체크 + 프로그램명·기간 + 코치 3줄(`coach.intro_line1~3` 재사용) + 2버튼 [내 플랜 보기 / 오늘 시작하기]
5. **Kenko 톤다운**: amber 배너 제거, preview 챕터 카드 gradient 제거, hover 중성화

**홈트 허브 디테일**
6. **부위 칩**: 1차 라이트 추가 (전신/상체/하체/코어 4종). 백엔드 `generateHomeWorkout`에 `muscleGroup?` 파라미터 추가 (10줄 내외 필터)
7. **시간 옵션**: 15/30/45분
8. **강도 칩**: 가벼움/보통/강함 (현 intensity 시스템 그대로)
9. **goal 디폴트**: 온보딩 `fp.goal` 사용 → 개인화 (없으면 `health` fallback)
10. **condition_check**: 스킵 (자동 디폴트로 master_plan_preview 직진입)
11. **placeholder 카드**: "유튜브 운동 프로그램 곧 출시" 카드 **제거** — 1차 노출 X

### 향후 방향 메모 (참고만 — 1차 코드 결정에 영향 X)

**홈트 자체 유튜브 콘텐츠 피벗 + do-or-not 트래킹 철학** (대표 2026-04-27)
- 홈트 1차 룰엔진은 **땜빵**. 추후 대표 본인 유튜브 채널 콘텐츠로 전환 예정
- 트래킹 철학도 함께 변화: 정밀 트래킹(reps/sets/weight) → **do-or-not** 단순화 ("그날 했냐 안 했냐"만)
- Why: 유저가 어떻게든 그날 운동을 한다는 행동 자체가 핵심 가치. 정밀 트래킹 강제 → 진입 장벽 ↑
- 웨이트/러닝의 정밀 트래킹은 유지. 홈트만 가벼운 컬렉션으로 분리 설계 예정.
- memory: `project_homeworkout_youtube_pivot.md`

---

## 회의 2026-04-28 — Paddle Live 전환 검증 (기획자/평가자 교차 검증)

**배경:** Paddle MoR 활성화 메일 도착 (`Your account is live`). Sandbox→Live 전환 전 코드 정합성을 기획자(UX 흐름)/평가자(코드 엣지케이스) 분리 에이전트로 교차 검증.

### 평가자 🔴Critical 4건 직접 재검증 결과

| 평가자 주장 | 직접 검증 | 등급 |
|---|---|---|
| Webhook HMAC 검증 버그 (`paddleWebhook.ts:47-55`) | ❌ 평가자 오류 — `digest("hex")` + `Buffer.from(hex, "hex")` 표준 패턴, `timingSafeEqual` 정상 | 🟢 OK |
| customData camelCase vs custom_data snake_case 불일치 | ❌ 평가자 부정확 — Paddle.js SDK 표준(클라 camelCase → webhook payload snake_case 자동 변환) | 🟡 sandbox 실거래 1회 검증 권장 |
| successUrl race condition (webhook 폴링 없음) | 🟡 일부 사실 — `/api/getSubscription` 1회만 호출, 단 영구 유실 아님 (재로드 시 active 잡힘) | 🟡 Warning |
| `adminProcessRefund` Paddle provider 분기 누락 | ✅ 사실 — PortOne API만 호출, Paddle 결제자 환불 요청 승인 시 404 → 카드 환불 X + 권한 회수 X | 🔴 Critical |

평가자가 `feedback_evaluator_strict` 룰("머릿속 시뮬 금지") 일부 위반 — HMAC hex 변환 동작/SDK 컨벤션 검증 없이 단정. 그래도 환불 누락 1건 발굴은 의미 있음.

### 결정사항 (2026-04-28-α)

1. **`adminProcessRefund` Paddle provider 분기 추가** — 즉시 수정 (이번 커밋)
   - `secrets: ["PORTONE_API_SECRET", "PADDLE_API_KEY"]`
   - `subscriptions/{uid}.provider === "paddle"` → Paddle Adjustments API
     - `GET /transactions/{paymentId}` → `data.details.line_items[].id` 추출 (Paddle Adjustments는 item_id 필수)
     - `POST /adjustments` (action=refund, transaction_id, items=[{item_id, type:"full"}])
   - API 키 prefix(`sdbx_`/`pdl_sdbx_`) 로 sandbox/live URL 자동 분기 — `subscription.ts:318` 패턴 재사용
   - `admin_logs.refund_approve` 에 `provider` 필드 추가 (감사용)
2. **환불 정책 변경 없음** — 7일/AI 미사용/전액 정책 그대로. 자동 검증(submitRefundRequest)도 PortOne/Paddle 공통 동작이라 미수정.
3. **successUrl webhook 폴링** — 1차에선 보류 (영구 유실 아니라 재로드로 자동 동기화). 환불 분기 안정화 후 후속 회의에서 결정.

### Live 전환 차단 요인 (Phase별 체크리스트, PLAN-PADDLE-LIVE는 이 회의 말미 첨부)

- **Phase A** (사용자) — `.github/workflows/firebase-hosting-{merge,pull-request}.yml` 두 파일에 PADDLE env 4줄 (`NEXT_PUBLIC_PADDLE_ENV/CLIENT_TOKEN/PRICE_MONTHLY/ENABLED`) 주입 추가 — 누락 시 production 빌드가 sandbox→비활성으로 fallback
- **Phase A-2** (이번 커밋) — `adminProcessRefund` Paddle 분기 추가
- **Phase B-0** (사용자) — Sandbox 정리: Paddle Sandbox 대시보드 webhook destination 비활성화(URL 무효화 또는 events 해제) + Firestore `subscriptions` 컬렉션에서 `paddleSubscriptionId` prefix `sub_sdbx_` 문서 정리
- **Phase B** (사용자) — Paddle Live 대시보드: Product/Price(USD $4.99/mo) + Client-side token + API key + Webhook destination(`https://ohunjal.com/api/paddleWebhook`, 7개 이벤트) + Payout settings(SWIFT/IBAN)
- **Phase C** (사용자) — GitHub repo Secrets 4개 (`NEXT_PUBLIC_PADDLE_*`) + functions secrets 2개 (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`)
- **Phase D** — `.env.local` 4개 갱신 (코드 변경) + `firebase functions:secrets:set` 2회 + `firebase deploy --only functions`
- **Phase E** — 본인 카드 $4.99 실거래 → Firestore 활성화 → 환불 요청 → admin 승인 → Paddle 카드 환불 + 권한 회수 검증

### 분리 커밋 계획

1. `fix(billing): adminProcessRefund Paddle provider 분기 + Adjustments API 호출` — `functions/src/admin/admin.ts` + 본 회의 기록
2. `docs(current-state): ROOT 카드 + Paddle Live 전환 컨텍스트 반영` — `.planning/CURRENT_STATE.md`
3. `chore(claude-md): JA/ZH 라우트 잔재 정정` — `CLAUDE.md`
4. (사용자) `chore(ci): GitHub Actions 워크플로우에 Paddle env 주입 추가` — Phase A

push는 Phase B/C 끝난 후 일괄. 단독 push 시 PADDLE_API_KEY 미등록 상태에서 functions 배포 실패 가능.

### 후속 (Phase E 통과 후 회의)

- successUrl webhook 폴링 추가 (race 완화)
- locale 자동 감지 (한국 유저 EN 우연 진입 → Paddle USD 결제 방지) — CURRENT_STATE.md:528 pending 항목 해소
- 어드민 패널 환불 요청 탭에 provider 필터/배지 검증 (CURRENT_STATE.md:814)

---

## 회의 2026-04-28-β — EN 러닝 프로그램 라벨 표준 어법 정리

**발단:** 대표가 RunningHub select 화면에서 `Break Full sub-3` 카드의 영문 라벨이 wrap 되어 우측 `50KM+/WEEK RECOMMENDED` caption 과 충돌하는 스크린샷 공유 + "현지 전문가 시각 확인" 요청.

**진단:**
- "Break Full sub-3" 16자라 wrap 발생 (사이즈 문제는 결과)
- 근본 원인: 4개 카드 EN 카피 전체가 한국어 영문 사용자 시점 어법
  - `Break + 거리 + sub-시간` 패턴
  - `Half`/`Full` 단독 사용 → "절반/전체" 모호 (EN 네이티브는 `Half Marathon` / `Marathon` 명시)
  - EN 러닝 커뮤니티 표준: `Sub-X 거리` 또는 `거리 in Sub-X`

**대표의 추가 제안 — Half를 sub-2 → sub-1:30 으로 어렵게 변경?**
- 페이스 검증: Half(21.0975km) ÷ 1:30 = 4:15.96/km ✅ 정확
- 그러나 비추 결정 (3가지 이유):
  1. 위계 무너짐 — full_sub_3 (4:16/km) 와 페이스 동일 → 두 프로그램 차별성 사라짐
  2. 시장 타겟 너무 좁음 — sub-1:30 = Elite 상위 5-10%, OUJ 입문/중급 다수 타겟과 미스매치
  3. full_sub_3 입장 자격(Half 1:30 이내, [runningProgram.ts:188]) 시스템과 충돌
- 페이스 매트릭스 [runningProgram.ts:30] `half_sub_2: 341초/km = 5:41/km` 코드 정합 — 라벨 그대로 유지

**결정:**
1. **페이스 매트릭스/프로그램 ID/위계 변경 없음** — sub-2/sub-3 그대로
2. **EN 라벨만 표준 어법으로 정리** (KO는 "X시간 돌파" 한국어 자연 표현 그대로 유지)
3. 톤: A (표준) — OUJ "Own Your Journey" 브랜드와 정합 (B 어그레시브/C 영감 둘 다 검토 후 A 결정)

**변경 영역 (9곳, en.json):**

| 키 | Before | After |
|---|---|---|
| `program.vo2_boost.title` | `Boost VO2 max` | `Boost VO2 Max` (대문자 통일) |
| `program.10k.title` | `Break 10K sub-50` | `Sub-50 10K` |
| `program.half.title` | `Break Half sub-2` | `Sub-2 Half` |
| `program.full.title` | `Break Full sub-3` | `Sub-3 Marathon` |
| `program.full.sub` | `Marathon sub-3, the top tier · 3 chapters · 12 weeks` | `Elite tier · 3 chapters · 12 weeks` (한국어 직역 "the top tier" 제거) |
| `program.full.locked` | `Build your base with Half sub-2 first` | `Build your base with Sub-2 Half first` |
| `step1.notice` | `10K sub-50` / `Half sub-2` / `Full sub-3` 3건 | `Sub-50 10K` / `Sub-2 Half` / `Sub-3 Marathon` |
| `gate.auto_km_hint_ok/low` | `Full sub-3 entry threshold` | `Sub-3 Marathon entry threshold` |

**후속 보류 — Elite 트랙 신설 회의**
- 만약 진짜 sub-1:30 Half 또는 sub-elite 마라톤 트랙이 필요하면 별도 신규 프로그램 신설
  - 예: `half_sub_1_45` (1:45, 5:00/km, 중상급) — 현 위계 사이 끼움
  - 예: `half_elite` (sub-1:30, 4:16/km) — full_sub_3 직전 단계
- 4 → 5+ 프로그램 확장은 회의 64-C/E/F 결정 변경이라 별도 회의 필요
