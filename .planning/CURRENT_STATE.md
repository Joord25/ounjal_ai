# CURRENT_STATE.md — 앱 UI/기능 인벤토리 SSOT

**최종 갱신:** 2026-04-23 (회의 64-M2/M3 · 64-ζ/η · 랜딩 브랜드 캐즘 재작성 · Paddle 통합 · 러닝 UI Wave 1~3 · 중도 종료 반영)

이 문서는 "오운잘 앱의 각 화면에 어떤 UI와 기능이 실제로 구현되어 있는지"의 단일 진실 공급원입니다.
모든 항목은 코드 검증 기반 (`file:line` 인용). 추측 금지. 미검증은 **⚠ 미검증** 마킹.

---

# 🗂️ 메인 앱 4탭 (`/app`)

탭 정의: [BottomTabs.tsx:6](../src/components/layout/BottomTabs.tsx#L6) — `home / proof / nutrition / my`

---

## 🏠 홈 탭 (`home`) — ChatHome

**진입:** `/app` 로그인 후 기본 화면
**컴포넌트:** [src/components/dashboard/ChatHome.tsx](../src/components/dashboard/ChatHome.tsx)

### 화면 구성 (위에서 아래로)

**① 헤더 영역**
- 사용자명 + 시간대별 인사말 (새벽/아침/점심/오후/저녁/밤 6구간)
- 날짜 표시 (KO: "4월 17일 (목)", EN: "Apr 17 (Thu)")
- 우측 상단 "내 플랜" 북마크 아이콘 — 프로그램 생성 시 pulse 애니메이션
- 상태 배지 (우측):
  - 프리미엄 → "프리미엄"
  - 체험/무료 → "체험/무료 N/M" (잔여 횟수 표시)

**② 채팅 메시지 영역**
- 첫 진입: `AssistantMiniHeader` + 초기 인사말
  - **goal 있음 또는 이력 있음**: `buildInitialGreeting` 이력·프로필 기반 (Phase 10 인과관계 reasoning)
  - **goal 없음 + 이력 없음** (비로그인 체험 + 온보딩 미완): `buildInitialSuggestion` **시즌 후킹 + AI 선제안** (회의 62, 2026-04-18) — 봄(3~6월) "여름까지 N주" 동적 countdown + 시간대별 운동 추천
- **초기 CTA 카드** (비로그인·이력無 한정, messages.length === 0): "오늘 추천 · {라벨}" + [바로 시작] 버튼 1개
- **초기 후속질문 칩** (비로그인·이력無 한정): `QuickFollowupList` 재사용 룰베이스 4개 — "하체 말고 가슴" / "30분 말고 짧게" / "러닝도 가능해요" / "초보라 더 쉽게"
- 사용자 메시지: 우측 진녹색 말풍선 (#1B4332)
- 어시스턴트 메시지 5가지 variant:
  1. **일반 텍스트** (mode: "chat") — 마크다운 볼드
  2. **AdviceCard** (mode: "advice") — "MASTER ADVICE" 카드
  3. **Program 카드** (mode: "program") — 주차별 세션 + "생성"/"수정" 버튼
  4. **Upgrade 카드** (조건부, 3 trigger):
     - `guest_exhausted` → "Google로 로그인" CTA
     - `free_limit` → "프리미엄 열기" CTA
     - `high_value` → "프리미엄 열기" CTA
  5. **에러 메시지** — 주황색 (tone=error)
- **진행 상태 카드** (busy): 체크/스핀 + 단계별 라벨 (예: "질문 의도 분석 중")
- **라우팅 카드** (routing): "맞춤 플랜 짜는 중…"
- **플랜 확인 카드** (pendingIntent): 요약 + "플랜 시작"/"다시" 버튼
- **AI 후속 질문 칩** (QuickFollowupList): 아이콘+라벨 칩 최대 4개

**③ 입력 영역**
- **이전 플랜 이어서** 버튼 (조건부: `lastPlanSummary` 있을 때)
- 텍스트 입력창 (자동 높이 1~5줄, Enter 전송 / Shift+Enter 개행)
- 전송/정지 버튼 (AbortController로 mid-flight 중단 가능)

**④ 예시 프롬프트** (messages.length === 0 + **초기 CTA 카드 없을 때만** — 로그인·이력 있음 등)
- 기본 4칩: "가슴 30분" / "하체 40분" / "러닝 10km" / "홈트 30분"
- **더보기** 팝오버 추가 7개:
  - "여름 다이어트 3개월"
  - "생리주기 다이어트 3개월"
  - "상급자 등 루틴"
  - "어깨 부상 회피 가슴"
  - "거북목·굽은등 교정"
  - "휴가 전 7일 팔뚝"
  - **"내 스펙 맞춤 플랜"** — 유저 프로필 기반 동적 생성

### 주요 기능

| 기능 | 동작 |
|---|---|
| 채팅 입력 | `POST /api/parseIntent` — `{ text, locale, userProfile, history, workoutDigest, intentDepth }` |
| 응답 mode 분기 | chat / plan / advice / program / redirect 5가지 |
| "플랜 시작" | `onSubmit(condition, goal, session)` → master_plan_preview 뷰 |
| AdviceCard "오늘 운동" | `onStartRecommended()` → onSubmit |
| AdviceCard "프로그램 저장" | `POST /api/generateProgramSessions` + localStorage + Firestore |
| Program 카드 "생성" | `handleGenerateProgram()` — sessionParams 순환 생성 + saveProgramSessions |
| Reasoning 스트림 | Gemini reasoning 배열 → 400ms 간격 순차 표시 |
| Safety 검증 | selfCheck.safety="warning/risky" → concerns를 reasoning 앞에 prepend |
| Google Search 출처 | sourceRefs 있으면 "외부 자료 N건 교차 검증" 표기 |
| 프리미엄 + 프로필 완성 시 | 5초 후 `/api/getNutritionGuide` 사전 로드 (백그라운드) |

### 권한별 차이

| 권한 | 진입 | parseIntent | 플랜 저장 | 장기 프로그램 |
|---|---|---|---|---|
| 비로그인 | ✓ | 3회 | ✗ 로그인 필요 | ✗ guest_exhausted CTA |
| 로그인 무료 | ✓ | 3회 | 1개 ([savedPlans.ts:5](../functions/src/plan/savedPlans.ts#L5)) | ✗ free_limit CTA |
| 프리미엄 | ✓ | 무제한 | 5개 | ✓ |

### AdviceCard CTA (2버튼)

[AdviceCard.tsx:294](../src/components/dashboard/AdviceCard.tsx#L294)
- **오늘 운동** (primary, 녹색 필드) — 추천 세션 즉시 시작
- **프로그램으로 저장** (secondary, 아웃라인, sessionParams 있을 때만) — 장기 루틴 저장 (프리미엄 전용)

---

## 📜 히스토리 탭 (`proof`) — ProofTab

**컴포넌트:** [src/components/dashboard/ProofTab.tsx](../src/components/dashboard/ProofTab.tsx)

### 화면 구성 (위에서 아래로)

**① 히어로 존**
- 월 네비게이션 (`< 월이름 >`): 이전 달 / 현재 달 복귀 (다음 달은 현재월 비활성)
- 월별 운동 카운트 + 통계 (총 무게 / 총 시간 / 총 세트)
- 조건부 문구: 현재월 기록 없음 → "첫 운동 기록을 남겨보세요" / 과거월 없음 → "이 달엔 기록이 없어요"

**② 업적 가로스크롤** (조건부: `detectAchievements(history).length > 0`)
- 최대 10개 업적 카드
- 타입 배지: PR(황색) / Streak(녹색) / Milestone(회색) / 시작

**③ Pull-to-Refresh** — 최상단 60px 끌어내리면 스핀 로더

**④ 통합 4탭 카드** (proofView 상태)

| 탭 | 내용 |
|---|---|
| **캘린더** | 월 그리드 (일~토), 날짜별 잔디 색상 5단계 (운동시간 기반), 오늘 표시 링, 세션 多개 시 배지. **중도 종료 표현 (회의 64-M3):** 중도 전용일 = 단일 앰버 색 · 혼합일(완주+중도) = emerald + 느낌표 배지 · 하단 범례 노출 |
| **부위도감** | 7부위 횡 바그래프 (가슴/등/어깨/하체/팔/코어/유산소), maxCount=8 정규화. **러닝 세션도 유산소 카운트에 집계** (2026-04-20 버그 fix) |
| **체중변화** | `WeightTrendChart` + "모두 보기" (조건부: weightLog.length > 0) |
| **티어** | 시즌 그래디언트 카드 (Diamond~Bronze 5티어), 프로그레스 바, 최근 10개 경험치 로그 |

**⑤ 과학 데이터 토글** (showAdvancedStats)
- 훈련 레벨 카드 (Advanced/Intermediate/Beginner)
- `LoadTimelineChart` (4주 로드 타임라인)
- `VolumeTrendChart` (부피 트렌드)
- **`MonthlyRunningScience` — 월간 러닝 과학데이터 3서브탭** (회의 64-β, 2026-04-19/20): `src/components/report/MonthlyRunningScience.tsx` 기반, 히스토리 탭 과학데이터 토글 안으로 이동됨
- 성장 예측 버튼 (조건부: `onShowPrediction` prop 있을 때)

**⑥ 전체 기록 없을 때 안내** (history.length === 0)

**⑦ 하단 모달**
- `DayPickerModal` — 같은 날 여러 세션 선택 (SwipeToDelete 래퍼)
- `HelpCardModal` — "trainingLevel" / "loadTimeline" 도움말

### 주요 기능

| 기능 | 동작 |
|---|---|
| 세션 카드 클릭 | `view → report`, selectedHistory 설정 (returnView: dashboard/list) |
| 월 네비게이션 | monthOffset ±1 |
| ProofView 탭 전환 | calendar/bodypart/weight/tier |
| 좌측 스와이프 | 세션 삭제 (history 제거 + deleteWorkoutHistory + EXP 재계산) |
| Pull-to-Refresh | refreshData() — 터치 이벤트 감지 |

### 데이터 소스
- `loadWorkoutHistory()` — Firestore `users/{uid}/workout_history`
- `localStorage.ohunjal_weight_log` — 체중 로그
- `getOrRebuildSeasonExp()` — 시즌 EXP 재계산

### 하위 View State
- `dashboard` (기본) / `list` (WorkoutHistory) / `report` (WorkoutReport) / `weight_detail` (WeightDetailView)

---

## 🥗 영양 탭 (`nutrition`)

### 비프리미엄 유저 화면 ([app/page.tsx:800-846](../src/app/app/page.tsx#L800-L846))

- 헤더: "영양 코치 · 프리미엄"
- 설명: "맞춤 칼로리·탄단지·식단 플랜 + 무제한 영양 코치 채팅. 프리미엄 전용 기능이에요."
- 혜택 리스트 4개:
  - 일일 칼로리 · 단백질·탄수·지방 목표
  - 자동 4끼 식단 플랜
  - 무제한 영양 코치 채팅
  - 실시간 대체 메뉴 추천
- CTA: "프리미엄 시작 · 월 6,900원" → `setShowPaywall(true)` + `trackEvent("paywall_view", { trigger: "nutrition_tab" })`

### 프로필 미설정 프리미엄 유저

- `Onboarding` 컴포넌트 노출 (필수 3항목: gender + bodyWeight + goal)
- 완료 시 `setNutritionProfileVersion(v => v+1)` — 리마운트 트리거

### 프리미엄 + 프로필 완성 화면 — NutritionTab

**컴포넌트:** [src/components/report/tabs/NutritionTab.tsx](../src/components/report/tabs/NutritionTab.tsx)

**① 상단 고정 헤더** (sticky)
- 일일 목표 칼로리 (큰 숫자) + "kcal" + 목표 기저 텍스트
- 단백질 프로그레스 바 (메인 강조, 진녹색 h-2.5) + 그램 수치
- 탄수화물 / 지방 프로그레스 바 (얇은 h-1, 앰버/분홍)
- 우상단 ❓ 버튼 → 칼로리 도움말 모달

**② 식단 섹션**
- "오늘 이렇게 챙겨보세요" 헤더
- 4끼 식단 카드 (아침/점심/간식/저녁)
- 핵심 팁 박스 (진녹색 5% 배경)

**③ 채팅 영역**
- 무료 횟수 배지 (조건부: 무료 + chatCount > 0 → "N/3")
- 메시지 리스트 (마크다운 `**bold**`, 리스트 지원)
- 시간대별 Quick Chips (메시지 없을 때만) — 5시간대 분기:
  - < 10시: 아침 단백질, 점심 외식, 프로틴 타이밍, 공복 커피
  - < 14시: 점심 외식, 400kcal 이하, 탄수 적정량, 오후 간식
  - < 18시: 지금 배고픔, 운동 전 식사, 카페인 한도, 물
  - < 22시: 저녁 단백질, 술 조절, 야식, 회복 음식
  - ≥ 22시: 야식 한계, 수분, 내일 아침 준비, 식단 기록
- 입력창 (Textarea 자동 높이 max 120px) + Send/Stop 버튼

**④ 하단 면책조항:** "일반적인 영양 정보이며 개인 건강 상담을 대체하지 않습니다"

**⑤ 칼로리 도움말 모달** — Mifflin-St Jeor 공식 + 활동계수 + 목표 조정 설명 + 4줄 출처

### 주요 기능

| 기능 | 동작 |
|---|---|
| 식단 가이드 로드 | `POST /api/getNutritionGuide` — `{ locale, bodyWeightKg, heightCm, age, gender, goal, weeklyFrequency, todaySession }` |
| 응답 구조 | `{ dailyCalorie, goalBasis, macros: {protein, carb, fat}, meals, keyTip }` |
| 영양 채팅 | `POST /api/nutritionChat` — `{ question, locale, context }` |
| 무료 채팅 한도 | `MAX_FREE_CHATS = 3` (단, 비프리미엄은 탭 진입 자체가 차단이므로 실질적 의미 미미) |
| 가이드 캐싱 | `onGuideLoaded(g)` → localStorage `ohunjal_nutrition_cache` (날짜+locale 키) |
| 채팅 캐싱 | 전역 `sessionCachedNutritionChat` (탭 전환 유지, 새로고침 리셋) |
| Stop 버튼 | AbortController로 Gemini 호출 중단 |

### 계산 공식 (노출되는 수치 근거)

- **BMR**: Mifflin-St Jeor (1990)
- **TDEE**: BMR × 활동계수 (weeklyFrequency 기반)
- **목표 조정**: fat_loss -400 / muscle_gain +300 / health·endurance 0
- **단백질**: bodyWeight × 1.6~2.0g/kg (ISSN Position Stand 2017)
- **지방**: bodyWeight × 0.9g/kg
- **탄수화물**: 남은 칼로리 / 4

---

## 👤 프로필 탭 (`my`) — MyProfileTab

**컴포넌트:** [src/components/profile/MyProfileTab.tsx](../src/components/profile/MyProfileTab.tsx)

### 화면 구성 (위에서 아래로)

**① 프로필 헤더** (고정)
- 프로필 사진 (업로드 가능, 티어 색상 테두리, 카메라 오버레이 hover)
- 티어 배지 (우하단, 배경색=티어 색상)
- 닉네임 (최대 10자 편집) + 연필 아이콘
- 이메일 (회색)
- 시즌-티어 표시 (예: "Season 25 - Gold")

**② Account 드롭다운** (토글 showAccount)
- **Subscription 상태 행** — loading/active/cancelled/free 4가지
  - 클릭 → `SubscriptionScreen`으로 전환
- **로그아웃** 버튼 — confirm 모달
- **회원 탈퇴** 버튼 (빨강) — 2단계 모달 워크플로우

**③ My Info 드롭다운** (토글 showBodyInfo)
- **Gender**: 남/여 토글 (순환)
- **Birth Year**: 숫자 입력 (1930~2015)
- **Height**: 단위별 입력 (metric 100~250cm / imperial 40~100in)
- **1RM** (벤치/스쿼트/데드리프트): 3필드, 항상 kg 정규화, lb↔kg 자동 변환, `autoEdit1RM` prop 시 자동 오픈+스크롤
- **Goal**: 4버튼 (fat_loss/muscle_gain/endurance/health)
- **내 정보 초기화**: 빨강 버튼 → 모달 → localStorage+Firebase 전체 삭제 → 리로드

**④ Settings 드롭다운** (환경설정)
- 사운드 토글 (localStorage `ohunjal_settings_sound`)
- 진동 토글 (localStorage `ohunjal_settings_vibration`)
- 언어: KO / EN (useTranslation.setLocale)
- 단위: kg/cm / lb/ft (useUnits.setSystem)

**⑤ 프리미엄 구독 배너** — 그라디언트 배경, "월 6,900원" (할인 표시)

**⑥ 버그 신고 배너** — Google Form 외부 링크

**⑦ 푸터**
- 약관 / 개인정보 / 환불 정책 링크 (모달 팝업, KO/EN 버전)
- 회사명, 사업자 번호, 통신판매 번호, 주소, 전화, 이메일
- Copyright

### 주요 기능

| 기능 | 동작 |
|---|---|
| 프로필 사진 업로드 | Firebase Storage `ref(storage, ...)` + `uploadBytes` + updateProfile |
| 닉네임 편집 | updateProfile (Firebase Auth) |
| 구독 상태 조회 | `POST /api/getSubscription` |
| 회원 탈퇴 | `POST /api/selfDeleteAccount` — 이메일 재입력 검증, 활성 구독 시 "구독 취소하러 가기" CTA, 성공 시 localStorage 전체 정리 (ohunjal_* + alpha_*) + alert + logout |
| 내 정보 초기화 | `resetUserBodyInfo()` → 페이지 리로드 (온보딩 재진입) |
| 약관 모달 | 내장 상수 (`TERMS_TEXT` / `TERMS_EN`), 영문 시 상단 법적 고지 박스 |

### 데이터 키

- **localStorage**: `ohunjal_gender`, `ohunjal_birth_year`, `ohunjal_fitness_profile`, `ohunjal_settings_sound`, `ohunjal_settings_vibration`
- **Firebase**: `auth.currentUser`, `updateProfile()`, Storage 프로필 사진

---

# 🔄 플로우 화면 (탭 외)

### MasterPlanPreview (플랜 확인)

**컴포넌트:** [src/components/plan/MasterPlanPreview.tsx](../src/components/plan/MasterPlanPreview.tsx)
**진입:** 홈에서 AI 플랜 생성 후 `view === "master_plan_preview"` (또는 저장된 플랜 재편집 시 `savedPlanId` 전달)

**화면 구성:**
- **Header** — 뒤로가기, "Master Plan" 타이틀, 공유 버튼, 설정 버튼(기어)
- **PlanHero** — 플랜 제목, 강도 뱃지(High/Moderate/Low 색상 구분), 러닝 타입 드롭다운(러닝 세션 한정), 세션 설명, 부위별 경험 메시지
- **Split Pane (8:2 ↔ 2:8 슬라이드, 300ms)**
  - **LIBRARY (좌)** — Phase별 섹션 (Warmup / Main / Core / Cardio), 운동 행(아이콘+이름+근육군 태그+카운트), 각 Phase 끝에 "+운동 추가"
  - **SELECTED (우)** — `PlanExerciseDetail` (세트/반복/무게 편집, 세트 ±, 운동 교체/삭제, 폼 가이드 YouTube)
- **하단 CTA** — "플랜 저장"(흰색) + "운동 시작"(녹색, primary)

**주요 기능:**
- **강도 조절** — 설정 기어 → 바텀시트(High/Moderate/Low), 추천값 "Recommended" 배지, `onIntensityChange` 콜백 있을 때만
- **플랜 재생성** — 설정 시트 내 "재생성" 버튼 → `onRegenerate` 콜백
- **러닝 타입 교체** — Walk-Run / Tempo / Fartlek / Sprint 4개 템플릿 (러닝 세션에만 노출, Main phase만 교체)
- **운동 추가** — Phase별 바텀시트 + 검색/근육군 필터, 동일 근육군 추천 우선, 기본 세트값 자동 부여
- **운동 교체 (Swap)** — `getAlternativeExercises` 기반 동일 근육군 추천, 세트/반복 유지한 채 운동명만 교체
- **운동 삭제** — Main phase는 최소 1개 유지 가드
- **세트/반복/무게** — `useSetEditor` 훅으로 개별 set 편집 + 세트 ± (strength/core)
- **시간 조절** — cardio/warmup의 count 필드 직접 편집, 플랭크류 hold 운동은 reps(초) 동기화

**플랜 저장:**
- 비로그인 → `onGuestSaveAttempt` 콜백 (로그인 유도)
- 로그인 → 이름 입력 시트 → `savePlan` + `remoteSavePlan` (무료 1개 / 프리미엄 5개)
- 한도 초과 시 "oldest 덮어쓰기" 옵션

**조건부 요소:**
- 러닝 변종 드롭다운 → `isRunningSession && currentRunningVariant !== null`
- 운동 교체 버튼 → 대체 운동 있을 때만
- 운동 삭제 버튼 → Main phase 1개 남았을 때 비활성
- 설정 기어 → `onIntensityChange` prop 있을 때만

**튜토리얼 오버레이** — 3단계(intro / settings / guide) 최초 1회, localStorage 기반

**서브 컴포넌트:** PlanHero, PlanSplitShell, PlanLibraryPane, PlanSelectedPane, PlanExerciseDetail, PlanBottomSheets, PlanTutorialOverlays, PlanShareCard

### WorkoutSession (운동 진행 화면)

**컴포넌트:** [src/components/workout/WorkoutSession.tsx](../src/components/workout/WorkoutSession.tsx) (+ [FitScreen.tsx](../src/components/workout/FitScreen.tsx))
**진입:** MasterPlanPreview "운동 시작" → `sessionData` props 전달

**화면 구성:**
- **Header** — 뒤로가기, `SET N/M · EXERCISE X/Y`, 경과 시간(MM:SS), 타이머 모드 SKIP 버튼
- **콘텐츠 (flex column, 3섹션 균등)**
  - ① 운동명(동적 크기) + 교체 버튼 + 자세 가이드 영상(16:9 iframe, strength만)
  - ② 타이머/무게+렙
  - ③ 재생·일시정지·완료 CTA
- **Feedback Bottom Sheet** (strength 완료 시 등장)

**운동 타입별 UI 분기:**
- **Strength**: 무게 픽커(+/-0.5kg, 프리셋) + 렙 픽커(타입별 추천) + 스톱워치 + DONE 버튼
- **Cardio/Warmup (Timer)**: 카운트다운 + 3초 틱음 + 절반 알림
- **Running (인터벌)**: 라운드 도트 + 페이즈 배지(sprint 빨강/walk 파랑) + GPS 3분할 카드(거리·페이스·시간) + 자동 일시정지 감지
- **Running (연속)**: 카운트업 + GPS 3분할 + 목표 시간 힌트
- **Core (hold)**: 플랭크류 시간 기반 타이머

**피드백 시스템 (Bottom Sheet):**
- **EASY** (짙은 녹색) — "추가로 N회 더 할 수 있음" (N ≥ 5 시 too_easy 자동 격상)
- **TARGET** (연녹) — "딱 맞음"
- **FAIL** (연빨강) — "여기서 실패 (N회)" (0 ~ target-1)
- 다음 세트 targetReps 자동 조정 (easy +N / fail = failedReps)
- **휴식 타이머** — 피드백별 base(easy 45 / target 60 / fail 90초), 성별·연령 보정(여성 -10, 60세+ +30, 최소 30초), ±15s 수동 조정

**GPS 러닝:**
- `useGpsTracker` 훅 — distance/pace/phaseMarks
- 첫 진입 시 `GpsPermissionDialog` (localStorage `ohunjal_gps_asked` 플래그)
- 완료 시 `computeRunningStats()` → runningStats 객체 onComplete에 포함

**사운드/진동:**
- `useAlarmSynthesizer` — start/half/tick/rest_end/end 5종 음성
- `navigator.vibrate` — 페이즈 전환 [200,100,200], 완료 [300,100,300,100,300]
- 설정 localStorage `ohunjal_settings_sound` / `_vibration` 체크

**추가 기능:**
- **운동 교체** — 동일 근육군 알트 바텀시트
- **세션 중 운동 추가** — 모든 세트 완료 후 검색/필터 화면 → 추가하거나 "마침"
- **운동 스킵** — Timer SKIP 버튼
- **중간 이탈** — 뒤로가기 누를 때마다 세트 역추적, 첫 세트에서 누르면 세션 이탈
- **중도 종료** (회의 64-M3, 2026-04-22) — FitScreen 하단 "운동 종료" 버튼 → 인용 기반 설득 팝업 (명언 + 진행도 + 경고) → 2버튼(계속 / 지금 종료). 1세트 이상 기록 시 `abandoned: true` 플래그로 workout_history 저장, 0세트면 onBack 폴백. onAbandon prop 있을 때만 버튼 노출.
- **백그라운드 복귀 자동 복원** (회의 64-γ, 2026-04-20) — 카톡/인스타 앱 전환 후 브라우저가 페이지 discard 시 `ohunjal_active_session` (localStorage, TTL 12h) 에서 view/sessionData/progress 자동 hydrate. 러닝은 `isPlaying=false` 기본값으로 재개 버튼 필요 (GPS 백그라운드 추적 불가 물리 제약). 유틸: [activeSessionPersistence.ts](../src/utils/activeSessionPersistence.ts).

**완료 흐름:**
```
Strength: DONE → 피드백 선택 → 휴식 타이머 → 다음 세트/운동
Timer/Running: 완료 or 자동 → DONE 펄스 → handleSetComplete
모든 운동 완료 → "운동 추가?" → 마침 → onComplete(sessionData, logs, timing, runningStats) → WorkoutReport
```

**서브 컴포넌트:** FitScreen(핵심 렌더), AiCoachChat(모달), GpsPermissionDialog, useGpsTracker, useAlarmSynthesizer

### WorkoutReport (운동 완료 리포트)

**컴포넌트:** [src/components/report/WorkoutReport.tsx](../src/components/report/WorkoutReport.tsx)
**탭 구조:** 3탭 — `status(오늘 폼) / today(요약) / next(다음)`

**탭별 내용:**
- **오늘 폼** (`status`): 피트니스 나이, 6부위 랭킹(가슴/등/어깨/코어&팔/하체/체력), 종합 등수
- **요약** (`today`): 4주 칼로리 추이 그래프, 운동 요약, 강도/볼륨, 지난번 대비, 운동과학 데이터 토글
- **다음** (`next`): 다음 운동 조언, 이번 주 퀘스트(고/중/저강도), 이번 주 기록

**러닝 리포트 Kenko 리디자인 Wave 1~3** (회의 64-T/U/W, 2026-04-19):
- runType 8종 분기 렌더 — interval A/B, 연속 유산소 C, 하이브리드 D, 특수 E 등 아키타입별 카드 레이아웃
- Batch D: Time Trial v1 카드 (회의 64-Y)
- Batch E: 러닝 → 체력 축 연결 (회의 64-X)
- RunningReportBody 가 runType 감지 후 해당 카드 선택

**중도 종료 표시** (회의 64-M3, 2026-04-22):
- `abandoned` prop 전달되면 헤더 공유 버튼 옆에 **붉은색 인라인 "중도 종료" 라벨** 노출
- 중도 종료 세션은 AI 코치/피드백 영역 숨김 (`!sessionDate && !abandoned` 조건)

**하단 CTA:** 공유 / 완료

**⚠ Dead path (실유저 경로 없음):**
- `RpgResultCard` (AI 코치 3 bubble) — [WorkoutReport.tsx:743, 810](../src/components/report/WorkoutReport.tsx#L743) `!!sessionDate && !savedReportTabs` 조건에서만 렌더 (레거시 히스토리 전용)
- `getCoachMessage` API 호출 경로 없음 → 실유저 Gemini 호출 0
- 영양 탭 분기 ([WorkoutReport.tsx:597-647](../src/components/report/WorkoutReport.tsx#L597-L647)) — 탭 네비에서 제거됐으나 코드 잔존

### SubscriptionScreen (구독 관리 + 결제 + 해지 + 환불)

**컴포넌트:** [src/components/profile/SubscriptionScreen.tsx](../src/components/profile/SubscriptionScreen.tsx)
**진입:** 프로필 탭 → "Subscription" 클릭 (`onClose`, `initialStatus` props)

**비프리미엄 화면:**
- **Brand Admiration 인트로** (운동 ≥3회 시 노출) — "지금까지의 당신, [페르소나]형이 완성되고 있어요"
- **가격 카드** (Early Bird 배지) — ~~9,900원~~ **6,900원/월** (KO), ~~$7.99~~ **$4.99/mo** (EN)
- **혜택 bullet** — unlimited / prediction / levelAnalysis / sessionReport / nutritionCoach
- **CTA — locale 기반 결제 분기** ([SubscriptionScreen.tsx:534-536](../src/components/profile/SubscriptionScreen.tsx#L534-L536)):
  - `locale === "ko"` → **KakaoPay 결제** (Yellow #FEE500) · PortOne SDK 빌링키 발급
  - `locale !== "ko"` → **Subscribe** 버튼 · Paddle.js `Checkout.open()` 으로 결제, successUrl 리다이렉트
- **EN 구독 UI 리디자인** (2026-04-21): 미국 SaaS 스타일 Apple-inspired → Linear 조정 → 최종 오운잘 톤앤매너 통일
- **에러 박스** (결제 실패/취소 시)
- ⚠ 현재 `locale` 기준 분기라 "한국인이 EN 버전 보면 Paddle로 빠짐" — **지역(IP/타임존) 기반 전환 과제 pending**

**프리미엄 화면:**
- **구독 상태 카드** (진녹색) — 체크마크 + "프리미엄 구독 중" + 다음 결제일(locale 포맷)
- **혜택 카드** (회색) — 5개 체크마크
- **결제 이력 상세 보기** 버튼 → `showSubDetail` 토글 → payments 배열 렌더
- **해지 버튼** (회색 언더라인, 하단 고정)

**PortOne 결제 연동 (KO):**
- 동적 로드: `https://cdn.portone.io/v2/browser-sdk.js`
- `window.PortOne.requestIssueBillingKey` — storeId/channelKey/billingKeyMethod=EASY_PAY, PC는 IFRAME / Mobile은 REDIRECTION
- 성공 시 `POST /api/subscribe` (billingKey, Bearer 토큰) + analytics `purchase`
- 모바일 리다이렉트: URL `billing_key` 감지 → sessionStorage 중복 방지 → 자동 처리

**Paddle.js 결제 연동 (EN)** (회의 2026-04-21):
- [src/utils/paddle.ts](../src/utils/paddle.ts) — `getPaddle()` 인스턴스 싱글톤, `initializePaddle({ environment, token })`
- env: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV` (sandbox/production) + `NEXT_PUBLIC_PADDLE_PRICE_MONTHLY`
- `paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customer: { email }, customData: { uid } })`
- successUrl: `/app?paddle_success=1`
- Paddle 심사용 **환불정책 페이지** 추가 + Pricing 앵커 (landing) — `/terms`·`/privacy`·환불정책

**해지 플로우 (2단계 오버레이, 탭바 숨김):**
- **Step 1** — 잃게 될 혜택 5개 X 표시 + 취소 이유 라디오(가격/기능/다른이유/쉬고싶음/기타) + 기타 선택 시 textarea
- **Step 2** — 환불 경고 3줄 + 확인 단어 입력 + **5초 카운트다운** (버튼 활성 조건: 단어 일치 + 카운트다운 0 + 처리중 아님)
- `POST /api/cancelSubscription` — `{ reason: string | null }`

**환불 플로우:**
- **조건** — 결제 후 7일 이내 + 프리미엄 기능 미사용
- **Step 1** — 안내 박스 + 환불 이유 textarea (필수)
- **Step 2** — 체크마크 성공 메시지
- `POST /api/submitRefundRequest` — `{ reason }` → status "cancelled", 어드민 승인 대기

**FAQ (6개, 아코디언):**
- Q1 무료 vs 프리미엄, Q2 결제 방식, Q3 해지 방법, Q4 환불, Q5 환불 정책+신청하기(특수, active/cancelled만 노출), Q6 데이터 보호

**모달/오버레이:**
- Terms / Privacy / **Refund Policy** (KO/EN 각 별도 텍스트 상수)
- Cancel / Refund 전체화면 오버레이 (z-50)

**API:** `/api/subscribe`, `/api/getSubscription`, `/api/cancelSubscription`, `/api/submitRefundRequest`
**Analytics:** `paywall_tap_subscribe`, `purchase`(transaction_id, value, currency, plan, payment_method)

### Onboarding (프로필 수집 7스텝)

**컴포넌트:** [src/components/layout/Onboarding.tsx](../src/components/layout/Onboarding.tsx) (346줄)
**진입:** `localStorage.ohunjal_onboarding_done !== "1"` 상태에서 호출 (영양 탭 게이트 / 신규 가입 직후)
**스킵:** 불가 (Back 버튼만, welcome 제외)

**7스텝 구조:**
| # | 스텝 | 입력 방식 | 범위 / 옵션 |
|---|---|---|---|
| 1 | welcome | 버튼 클릭 | — (인사말 + `/welcome.png`) |
| 2 | gender | 2버튼 택일 (128×128 rounded-2xl) | male / female |
| 3 | birth_year | `WheelPicker` 수직 | 1931~2010 (기본 1995) |
| 4 | height | `WheelPicker` 수직 | cm 120~200 / in 47~80 (기본 170cm, useUnits 자동 전환) |
| 5 | weight | `RulerPicker` 수평 | kg 30~160 / lb 66~352 (기본 70kg) |
| 6 | goal | 4버튼 카드 staggered 애니메이션 | fat_loss / muscle_gain / endurance / health |
| 7 | done | 체크마크 + 확인 버튼 | (onComplete 트리거) |

**각 스텝 공통:**
- 진행도 인디케이터 (5개 점)
- "← Back" 버튼 (welcome 제외)
- 다국어 (useTranslation, `onboarding.*` 키 + 동적 파라미터)

**최종 저장:**
- **localStorage** `ohunjal_fitness_profile` (JSON: gender/birthYear/height/bodyWeight/goal)
- **localStorage** `ohunjal_onboarding_done = "1"`
- **Firestore** `saveUserProfile({ fitnessProfile })` (async, 에러 무시)
- 개별 헬퍼: `updateGender()`, `updateBirthYear()`, `updateWeight()`

**Analytics 이벤트:** `nutrition_onboarding_start` / `_profile` / `_goal` (goal 값) / `_complete`

**유닛 변환:** cmToInches, inchesToCm, kgToLb, lbToKg (useUnits 훅 기반)

### 랜딩 페이지 (`/`, `/en`)

**라우트:** KO `/` + EN `/en` 2종 (ja/zh 없음). 공통 렌더러 `LandingContent`, 텍스트는 `landingTexts.ts`

**컴포넌트/파일:**
- [src/app/page.tsx](../src/app/page.tsx) / [src/app/en/page.tsx](../src/app/en/page.tsx)
- [src/app/landing/LandingContent.tsx](../src/app/landing/LandingContent.tsx) / [src/app/landing/landingTexts.ts](../src/app/landing/landingTexts.ts)
- SEO: [src/app/layout.tsx](../src/app/layout.tsx)

**섹션 순서 (위 → 아래, 섹션별 `scroll-snap-type: y mandatory` 스냅 스크롤):**
1. **Top Nav** (스크롤 시 숨김) — 로고+브랜드, 언어 전환(`/` ↔ `/en`), "바로 시작" CTA
2. **Hero** — **브랜드 캐즘 재작성 (2026-04-21)**, Hero Sub 2줄 분리 신뢰 강화, 통계 3개 카운트업(`3.2x / 94% / 28%`), EN 버전은 **네이티브 카피** (2026-04-22) + PC/모바일 반응형 줄바꿈
3. **How It Works** — **브랜드 캐즘 재작성**, 4단계 (AI와 대화 → 루틴 완성 → 코치 피드백 → **영양(Premium)**). **데스크톱**: 폰 프레임 3초 자동 사이클 + 클릭 전환. **모바일 (2026-04-21)**: 가로 캐러셀 + 섹션별 스냅 스크롤, 카드 높이·스와이프 감도 개선
4. **Trust** — "Backed by\n한체대 · ACSM · NASM" + 7개 기관 무한 스크롤 로고 (KNSU/Inha/KISED/MSS/NASM·KFTA/ACSM/NSCA Korea) + 사용자 후기(KO 9개, EN "coming soon")
5. **Pricing** — "기존 19,800원 vs 오운잘 6,900원" / Free 플랜(비로그인 1회 + 무료 2회 + 채팅 3회 + 기록 저장) / Premium 플랜(6,900원/월 ~~9,900원~~, 6개 혜택 — AI 플랜 무제한/세션 리포트/코치 피드백/영양 코칭/성장 예측/**장기 프로그램 모드 저장**). 모바일 compact + **Paddle 심사용 앵커 ID** 추가
6. **FAQ** — 6개 아코디언 (유튜브와 차이 / AI 안전성 / PT 대비 / 의지 걱정 / 무료 vs 프리미엄 / 취소·환불·데이터), 검수 용어 정리
7. **Footer** — 미션 + 회사 정보(KO 5줄/EN 4줄) + 약관·개인정보 링크(`/terms`·`/privacy` 또는 `/en/*`) + 환불정책 (Paddle 심사용 신설)

**주요 CTA:**
- **상단 네비 CTA** — `/app?lang=ko` or `/app?lang=en`, analytics `landing_cta_click {section: "nav"}`
- **Bottom Sticky CTA** — 데모·푸터 모두 화면 밖일 때만 노출, 큰 초록 버튼, `{section: "bottom_sticky"}`

**SEO 메타 (layout.tsx):**
- Title/Description KO·EN 각 별도 (자연어형, 구분자 없음)
- Keywords (KO 17개), Open Graph, Canonical, hreflang(ko/en)
- 검증: Google·Naver site verification 토큰
- **JSON-LD 5종**: SoftwareApplication(HealthApplication, 6,900원) / Organization(주드) / **FAQPage 10개** / HowTo 4단계 / Person(임주용 — 한체대 석사, NASM-CPT/ACSM-CPT/NSCA-FLC 등)

**KO vs EN 차이 (주요):**
- Hero 제목 구조 (KO 3줄 vs EN 4줄)
- Trust 기관명 (한체대 → KNSU)
- 후기 (KO 9개 / EN 빈 상태)
- 가격 숫자·단위·통화
- Footer 회사 정보 (사업자등록번호는 KO만)
- 약관 링크 경로 (`/terms` vs `/en/terms`)

**Hooks & 유틸:** useAtTop, useAuthRedirect(로그인 유저 `/app` 리다이렉트), useBodyScroll, useCountUp(1000~1200ms), `<RevealOnScroll>`(Intersection Observer)

### 관리자 패널 (`/admin`)

**컴포넌트:** [src/app/admin/page.tsx](../src/app/admin/page.tsx) (~1712줄)

**접근 권한:**
- Google OAuth → `POST /api/adminCheckSelf` (Firestore `admins/{uid}` 또는 BOOTSTRAP_ADMIN_UIDS)
- 미로그인 → Google 로그인 버튼 / 비어드민 → "접근 권한이 없습니다"

**탭 6개:**

**① 대시보드** (회의 64-M2 단순화, 2026-04-22 — 데이터 부족·broken 섹션 5종 제거)
- **오늘 할 일** (Inbox Zero) — 환불 대기 / 3일 내 만료 / 7일 해지 피드백 (0건이면 완료 표시)
- **핵심 메트릭 카드** (드릴다운) — 전체/구독중/무료/3일만료
- **매출 카드** — 이번 달 매출 + 전월 대비 %, ARPU, 결제 건수
- **성장 지표** — CVR(체험→가입/가입→결제/체험→결제) · ARPU 누적 · Churn · Total Revenue
- **월간 추이 6개월** — 매출 바차트 + 가입/신규결제 듀오 바 + 테이블
- **유저 행동 퍼널 (회의 64-M2 Step B, 2026-04-22)** — 신규. 세그먼트 2종(비로그인/로그인) × 5단계(앱 진입 → 챗 시작 → 플랜 생성 → 운동 기록 → 운동 완주) × 5시간 버킷(오늘/어제/이번주/이번달/전체). 각 단계 이탈률 % 표시
- **Funnel · GA4** (회의 63) — 7/14/30일 window 토글. ① 차별성 KPI (plan→start→complete) ② 후킹 효과 (greeting→CTA) ③ 페이월 트리거 분포
- **무료 풀 소진** — 비로그인 1회 한도 / 로그인 무료 2회 한도
- **사용자 세그먼트** — 체험/가입/결제 × 오늘·어제·이번주·이번달·전체 + 증감률

**② 유저 탭**
- 실시간 필터 (이메일·이름·UID, 300ms debounce)
- 상세 조회 (이메일 정확히) → 검색 결과 카드
- 활성화 기간 드롭다운 (1주/1개월/3개월/6개월/12개월) + [활성화] / [비활성화] 버튼
- 필터 버튼: 전체/구독중/무료/만료/만료 임박/페이월 hit
- **CSV 내보내기** (현재 필터 기준, 최대 5000명)
- **일괄 선택 Bulk Action** (체크박스 + 하단 플로팅 바)
- 페이지네이션 (20명/페이지)

**③ 결제 탭** — 최근 100건 요약 + 결제 내역 리스트, ⚠ Firestore 기반 (PortOne 직접 취소 미반영)

**④ 취소 피드백 탭** — 최근 30일 키워드 자동 분류 차트 (9 카테고리: 가격·기능·UX·결과·서비스·자주 안 씀·대체·개인 사정·기타) + 원본 피드백

**⑤ 환불 탭** — 요청 카드(대기/승인/거부 필터) + 플랜 사용 여부 표시 + 상세 패널(on-demand 로드) + **2단계 확인 모달**(승인 시 PortOne API로 실제 환불, 되돌릴 수 없음)

**⑥ 이력 탭** — 관리자 활동 로그 (3개월 활성화, 비활성화 등 타임스탬프)

**API 엔드포인트:**
`/api/adminCheckSelf`, `/api/adminDashboard`, `/api/adminListUsers`, `/api/adminCheckUser`, `/api/adminActivate`, `/api/adminDeactivate`, `/api/adminLogs`, `/api/adminCancelFeedbacks`, `/api/adminRefundRequests`, `/api/adminProcessRefund`, `/api/adminListPayments`, `/api/adminAnalyticsFunnel` (회의 63 신설)

**상태 색상 토큰:** active(emerald) · free(gray) · cancelled(amber) · expired(red)

---

# 📋 권한 매트릭스 (부록)

| 기능 | 비로그인 | 로그인 무료 | 프리미엄 |
|---|---|---|---|
| 홈 탭 / ChatHome 진입 | ✓ | ✓ | ✓ |
| parseIntent (채팅) | 3회 (IP 해시) | 3회 (users.chatCount) | 무제한 |
| planSession (플랜 생성) | 1회 (IP 해시) | 2회 (users.planCount) | 무제한 |
| generateProgramSessions (장기) | ✗ | ✗ | ✓ |
| 히스토리 탭 | ✓ (비어있음) | ✓ | ✓ |
| 영양 탭 진입 | ✗ (안내만) | ✗ (안내만) | ✓ |
| getNutritionGuide / nutritionChat | ✗ 프리미엄 하드락 | ✗ 프리미엄 하드락 | ✓ |
| 세션 플랜 저장 (savePlan) | ✗ | 1개 | 5개 |
| 장기 프로그램 저장 (saveProgram) | ✗ | ✗ | ✓ |
| 프로필 탭 | ✗ (로그인 필요) | ✓ | ✓ |
| 구독 관리 / 해지 / 환불 | - | ✗ | ✓ |

---

# ⚠ 미검증 영역

없음 (2026-04-17 기준, 모든 주요 화면·플로우 검증 완료).

---

# 🔧 내부 인프라 (유저 미노출)

**러닝 룰엔진 Phase 1+2+3** (2026-04-18, 회의 64-B/64-C/64-D):
- **서버**: [functions/src/runningProgram.ts](../functions/src/runningProgram.ts) — 엔진 + 오케스트레이터 (`generateRunningProgram()`, 17 SlotType, 4 chapter phase, TT/Dress Rehearsal 경계). [functions/src/plan/runningProgramApi.ts](../functions/src/plan/runningProgramApi.ts) — 2개 엔드포인트 `/api/generateRunningProgram`, `/api/checkFullSub3Gate`
- **타입**: `SavedPlan` 확장 필드 8개. `WorkoutHistory.runningStats` 서버 필드 추가
- **UI**: [src/components/dashboard/RunningProgramSheet.tsx](../src/components/dashboard/RunningProgramSheet.tsx) — 바텀시트 B-1 (select/gate_check/settings/preview 4 sub-step)
- **진입**: [ChatHome.tsx](../src/components/dashboard/ChatHome.tsx) 입력창 좌측 하단 "달리는 아이콘". 로그인+프리미엄 아니면 모달 유도.
- **i18n**: `running_program.*` 네임스페이스 53 key ko+en 동시
- **GA**: 7개 이벤트 (`running_program_sheet_open`/`select`/`gate_pass`/`gate_fail`/`created`/`create_failed`/`sheet_abandoned`)
- **배포 주문 필수**: functions 먼저 (`firebase deploy --only functions`) → Hosting (`git push` 자동). 순서 바뀌면 404.
- **Phase 4** (회의 64-E): 게이트 GPS 자동 계산 + Half 실제 입력 (placeholder 제거) / 생성 직후 코치 자동 안내 3줄 / 평가자 루브릭 강화 + `feedback_no_decorative_svg.md` 신규
- **Phase 5 완료 판정 SSOT 전환** (회의 64-ζ-γ, 2026-04-21): 장기 프로그램 완료 표시는 `saved_plans.completedAt` 대신 **`workout_history` 컬렉션 기준**으로 교체. [src/utils/programCompletion.ts](../src/utils/programCompletion.ts) 의 `deriveProgramCompletions(sessions, workoutHistory)` 가 `exerciseNameSet` 키 + `sessionNumber ASC` 매칭. 구 함수(`getActivePrograms`/`getProgramProgress`/`getNextProgramSession`) 신규 코드 사용 금지
- **동일 slotType 맥락 라벨** (회의 64-ζ, 2026-04-21): Week 1 tt_2k vs Week 4 tt_2k 같이 같은 slotType이 다른 훈련 맥락에 재편성될 때 구분을 위한 라벨 매핑. [src/utils/programSessionLabels.ts](../src/utils/programSessionLabels.ts)
- 상세 SPEC: [.planning/RUNNING_PROGRAM_SPEC.md](./RUNNING_PROGRAM_SPEC.md)

**ShareCard 안정화** (회의 64-η, 2026-04-20/21):
- 웨이트 공유카드 + 러닝 공유카드 폰트 **Rubik 통일** (var(--font-rubik)) · letterSpacing 통일
- html2canvas 4대 gotcha 전면 대응 — `flex gap` → `marginBottom`/`marginRight` 마이그레이션 / `<p>` 브라우저 디폴트 margin 제거 / iOS Safari `linear-gradient` + `backgroundColor` solid fallback 병용 / `document.fonts.ready` await
- 공유카드 상단 날짜·타입 라벨 제거 (대표 지시 2026-04-19/21)
- scale: 3 이상 캡처 (Retina)
- 룰: [.claude/rules/share-card.md](../.claude/rules/share-card.md)

**중도 종료 기능 full stack** (회의 64-M3, 2026-04-22):
- Type: `WorkoutHistory.abandoned?: boolean`
- FitScreen 하단 "운동 종료" 버튼 → WorkoutSession 설득 팝업
- ProofTab 캘린더 앰버 색상 + 혼합일 느낌표 + 하단 범례
- WorkoutReport 헤더 공유 버튼 옆 붉은색 인라인 라벨
- Coach/feedback 영역 숨김 (`!abandoned` 조건)

**브랜드 전략 시스템** (2026-04-21):
- 마케팅 자문단 + 브랜드 캐즘 전략 시스템 구축 — [.planning/strategies/brand-chasm-marketing.md](./strategies/brand-chasm-marketing.md) / [.planning/advisors/marketing.md](./advisors/marketing.md)
- 릴스 #1 제작 자산 (스토리보드 + Seedance 프롬프트) — [.planning/design/reel-1-seedance-prompts.md](./design/reel-1-seedance-prompts.md)
- 룰: [.claude/rules/marketing-meeting.md](../.claude/rules/marketing-meeting.md) — 마케팅/홍보/브랜딩 회의 자동 자문단 소환

---

# 🗂️ 관련 파일

- [CLAUDE.md](../CLAUDE.md) — 프로젝트 규칙 + 아키텍처
- [.claude/rules/cloud-functions.md](../.claude/rules/cloud-functions.md) — Cloud Functions 구조
- [.claude/rules/firestore-schema.md](../.claude/rules/firestore-schema.md) — Firestore 스키마
- [.claude/rules/workout-session.md](../.claude/rules/workout-session.md) — 운동 세션 규칙
- [.claude/rules/coach-system.md](../.claude/rules/coach-system.md) — 코치 메시지 시스템 (⚠ dead path)
- [.planning/MEETING_LOG.md](./MEETING_LOG.md) — 회의 기록
- [.planning/codebase/](./codebase/) — 기술 스택 / 아키텍처 문서
