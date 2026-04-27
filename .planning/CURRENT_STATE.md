# CURRENT_STATE.md — 앱 UI/기능 인벤토리 SSOT

**최종 갱신:** 2026-04-28 (회의 ε — 초보자 모드 Phase 1 코드 완료: 옵트인 모달 / 프로필 토글 / WorkoutSession overlay (warmup_intro + main_equipment) / 벤치프레스 휴식 90·150 / 폼 cue 5줄 ACSM·NSCA 출처. 5일 5분리 커밋. SEED-001 status=active. 실 디바이스 검증 대기. 이전: 2026-04-27 ROOT 카드 도입 — 웨이트/러닝/홈트 3카드 + 단위 토글 / PWA layout / Paddle Live)

이 문서는 "오운잘 앱의 각 화면에 어떤 UI와 기능이 실제로 구현되어 있는지"의 단일 진실 공급원입니다.
모든 항목은 코드 검증 기반 (`file:line` 인용). 추측 금지. 미검증은 **⚠ 미검증** 마킹.

---

# 🗂️ 메인 앱 4탭 (`/app`)

탭 정의: [BottomTabs.tsx:6](../src/components/layout/BottomTabs.tsx#L6) — `home / proof / nutrition / my`

> **진입 구조 (회의 2026-04-27, ROOT 카드 도입):**
> 로그인 후 첫 화면 = **ROOT 카드** (`view === "root_home"`, [page.tsx:265](../src/app/app/page.tsx#L265) — `view === "home" && activeTab === "home"` 시 자동 치환). 하단 네비바 비노출. 3개 카드(웨이트/러닝/홈트) 중 클릭 시 각 진입판으로 분기:
> - **웨이트** → ChatHome (`home_chat`)
> - **러닝** → RunningHub (`running_hub`)
> - **홈트** → HomeWorkoutHub (`home_workout_hub`)
>
> 첫 카드 클릭 시 `localStorage.ohunjal_onboarding_done !== "1"` 이면 Onboarding 7스텝 게이트 발동, 완료 후 `pendingRootTarget` 으로 자동 진입 ([page.tsx:1019-1034](../src/app/app/page.tsx#L1019-L1034)). 4탭(proof/nutrition/my) 진입은 ROOT가 아니라 ChatHome/Hub 내부에서만 가능.

---

## 🏠 홈 탭 (`home`) — ROOT 카드

**진입:** `/app` 로그인 후 기본 화면
**컴포넌트:** [src/components/dashboard/RootHomeCards.tsx](../src/components/dashboard/RootHomeCards.tsx)

### 화면 구성

**① 헤더 영역** ([RootHomeCards.tsx:108-149](../src/components/dashboard/RootHomeCards.tsx#L108-L149))
- 사용자명 + 시간대별 인사말 (새벽/아침/점심/오후/저녁/밤 6구간 — ChatHome과 동일)
- 날짜 표시 (KO: "4월 27일 (월)", EN: "Apr 27 (Mon)")
- 우측 상단 "내 플랜" 북마크 아이콘 — 진행 중 장기 프로그램 있으면 채워진 emerald, 없으면 회색 dim
- 상태 배지 (우측 하단):
  - 프리미엄 → emerald pill "프리미엄"
  - 체험/무료 → "체험 N번 남음" / "무료 N번 남음" (잔여 1번 이하면 amber)

**② 3카드 (세로 정렬, gap-5, Kenko 톤)** ([RootHomeCards.tsx:152-173](../src/components/dashboard/RootHomeCards.tsx#L152-L173))

| 카드 | caption (영문) | label (한글) | 아이콘 |
|---|---|---|---|
| **웨이트** | WEIGHT | 웨이트 / Weight | Figma Kenko ic-tonnage-lifted (덤벨 fill SVG) |
| **러닝** | RUNNING | 러닝 / Running | `/icons/root/running.png` (대표 제공, 좌우반전, emerald CSS filter) |
| **홈트** | HOME WORKOUT | 홈트 / Home Workout | Heroicons "home" solid (집 fill SVG) |

- 카드 스펙: `bg-white border border-gray-100 rounded-3xl shadow-sm px-6 py-7`, 영문 caption `text-[10px] uppercase tracking-[0.18em]`, 한글 라벨 `text-3xl font-black text-[#1B4332]`, 우측 아이콘 `text-[#2D6A4F]`
- colored container 금지(흰 배경 + 보더만), 장식 SVG 금지 (의미 연결 명확한 픽토그램만)

### 주요 기능

| 기능 | 동작 |
|---|---|
| 카드 클릭 | `trackEvent("root_card_click", { target })` → onboarding 게이트 → `setView("home_chat" \| "running_hub" \| "home_workout_hub")` ([page.tsx:1019](../src/app/app/page.tsx#L1019)) |
| Onboarding 게이트 | `pendingRootTarget` state + `trackEvent("root_onboarding_trigger", { target })`. 완료 후 자동으로 해당 카드 진입 |
| 내 플랜 아이콘 | `setMyPlansReturnTo("root_home")` → `setView("my_plans")`. 진행 중 프로그램 카운트로 dim/active 분기 |
| ROOT는 4탭 네비바 X | BottomTabs 가드: `view === "root_home"` 시 비노출 |

### 권한별 차이 (parseIntent / 플랜 저장 — 실제 호출은 ChatHome 진입 후)

| 권한 | ROOT 진입 | parseIntent (ChatHome) | 플랜 저장 | 장기 프로그램 |
|---|---|---|---|---|
| 비로그인 | ✓ | 3회 | ✗ 로그인 필요 | ✗ guest_exhausted CTA |
| 로그인 무료 | ✓ | 3회 | 1개 ([savedPlans.ts:5](../functions/src/plan/savedPlans.ts#L5)) | ✗ free_limit CTA |
| 프리미엄 | ✓ | 무제한 | 5개 | ✓ |

---

## 🏋️ 웨이트 진입 — ChatHome (`view === "home_chat"`)

**진입:** ROOT 카드 "웨이트" 클릭
**컴포넌트:** [src/components/dashboard/ChatHome.tsx](../src/components/dashboard/ChatHome.tsx)

### 화면 구성 (위에서 아래로)

**① 헤더 영역**
- 사용자명 + 시간대별 인사말 (새벽/아침/점심/오후/저녁/밤 6구간)
- 날짜 표시 + 상태 배지(프리미엄 / 체험·무료 N/M)
- 우측 상단 "내 플랜" 북마크 아이콘 — 프로그램 생성 시 pulse 애니메이션

**② 진행 중 웨이트 프로그램 띠** (회의 2026-04-27 in-progress, 조건부)
- 인사말 직후 노출 — 진행률 바(완료/총) + "이어가기" CTA → `master_plan_preview` 직진입 ([page.tsx, ChatHome.tsx 진행중 섹션](../src/components/dashboard/ChatHome.tsx))
- i18n 키: `chat.activeProgram.*`

**③ 채팅 메시지 영역**
- 첫 진입: `AssistantMiniHeader` + 초기 인사말
  - **goal 있음 또는 이력 있음**: `buildInitialGreeting` 이력·프로필 기반 (Phase 10 인과관계 reasoning)
  - **goal 없음 + 이력 없음** (비로그인 체험 + 온보딩 미완): `buildInitialSuggestion` 시즌 후킹 + AI 선제안 (회의 62)
- **초기 CTA 카드** (비로그인·이력無 한정): "오늘 추천 · {라벨}" + [바로 시작]
- **초기 후속질문 칩**: "하체 말고 가슴" / "30분 말고 짧게" / "초보라 더 쉽게" 등 (러닝 칩은 회의 2026-04-27에서 제거됨, [ChatHome.tsx:1075](../src/components/dashboard/ChatHome.tsx#L1075))
- 사용자 메시지: 우측 진녹색 말풍선 (#1B4332)
- 어시스턴트 메시지 5가지 variant:
  1. **일반 텍스트** (mode: "chat")
  2. **AdviceCard** (mode: "advice") — "MASTER ADVICE" 카드
  3. **Program 카드** (mode: "program") — 주차별 세션 + "생성"/"수정"
  4. **Upgrade 카드** — `guest_exhausted` / `free_limit` / `high_value`
  5. **Redirect 카드** (mode: "redirect", 회의 2026-04-27 신설) — parseIntent가 러닝/홈트 의도 감지 시 한 줄 안내 + 단일 CTA "러닝 화면으로" / "홈트 화면으로" ([ChatHome.tsx:719-736](../src/components/dashboard/ChatHome.tsx#L719-L736))
- 진행 상태/라우팅/플랜 확인 카드 + AI 후속 질문 칩(QuickFollowupList)

**④ 입력 영역**
- **이전 플랜 이어서** 버튼 (조건부: `lastPlanSummary` 있을 때)
- 텍스트 입력창 (자동 높이 1~5줄, Enter 전송 / Shift+Enter 개행)
- 전송/정지 버튼 (AbortController로 mid-flight 중단 가능)
- **러닝 아이콘 제거됨** (회의 2026-04-27, [ChatHome.tsx:1389](../src/components/dashboard/ChatHome.tsx#L1389))

**⑤ 예시 프롬프트** (messages.length === 0 + 초기 CTA 카드 없을 때만)
- 기본 칩: "가슴 30분" / "하체 40분" / "등 50분" / "홈트 30분" — 회의 2026-04-27에서 "러닝 10km" 제거 ([ChatHome.tsx:88](../src/components/dashboard/ChatHome.tsx#L88))
- **더보기** 팝오버 추가 항목: "여름 다이어트 3개월" / "생리주기 다이어트 3개월" / "상급자 등 루틴" / "어깨 부상 회피 가슴" / "거북목·굽은등 교정" / "휴가 전 7일 팔뚝" / "내 스펙 맞춤 플랜"

### 주요 기능

| 기능 | 동작 |
|---|---|
| 채팅 입력 | `POST /api/parseIntent` — `{ text, locale, userProfile, history, workoutDigest, intentDepth }` |
| 응답 mode 분기 | chat / plan / advice / program / **redirect** 5가지 |
| Redirect 응답 | 러닝 의도 → "러닝 화면으로" 버튼 / 홈트 의도 → "홈트 화면으로" 버튼 (회의 2026-04-27) |
| "플랜 시작" | `onSubmit(condition, goal, session)` → master_plan_preview 뷰 |
| AdviceCard "오늘 운동" | `onStartRecommended()` → onSubmit |
| AdviceCard "프로그램 저장" | `POST /api/generateProgramSessions` + localStorage + Firestore |
| 진행 중 프로그램 "이어가기" | 다음 세션을 `master_plan_preview` 직진입 (`workoutReturnTo = "home_chat"`) |
| Reasoning 스트림 | Gemini reasoning 배열 → 400ms 간격 순차 표시 |
| Safety 검증 | selfCheck.safety="warning/risky" → concerns를 reasoning 앞에 prepend |
| Google Search 출처 | sourceRefs 있으면 "외부 자료 N건 교차 검증" 표기 |
| 프리미엄 + 프로필 완성 시 | 5초 후 `/api/getNutritionGuide` 사전 로드 (백그라운드) |

### AdviceCard CTA (2버튼)

[AdviceCard.tsx:294](../src/components/dashboard/AdviceCard.tsx#L294)
- **오늘 운동** (primary, 녹색 필드) — 추천 세션 즉시 시작
- **프로그램으로 저장** (secondary, 아웃라인, sessionParams 있을 때만) — 장기 루틴 저장 (프리미엄 전용)

---

## 🏃 러닝 진입 — RunningHub (`view === "running_hub"`)

**진입:** ROOT 카드 "러닝" 클릭
**컴포넌트:** [src/components/dashboard/RunningHub.tsx](../src/components/dashboard/RunningHub.tsx) (RunningProgramSheet `variant="fullscreen"` 호출)

### 화면 구성

**우상단 오버레이 (RunningHub 자체)** ([RunningHub.tsx:106-122](../src/components/dashboard/RunningHub.tsx#L106-L122))
- [📋] 내 플랜 아이콘 — 진행 중 러닝 프로그램 1+ 시 emerald 닷
- [👤] 프로필 아이콘 — 클릭 시 `setActiveTab("my")` + `setView("home")` (네비바 부활)

**5단계 풀스크린 (RunningProgramSheet `variant="fullscreen"`)**
1. **C-1 select** — 4프로그램 카드 (vo2_boost / 10k_sub_50 / half_sub_2 / full_sub_3)
   - **진행 중 러닝 프로그램 섹션** (회의 2026-04-27 in-progress) — select 화면 상단에 진행률 바(완료/총) + "이어가기 →" 버튼. 신규 시작 카드는 "새로 시작" 라벨 아래로 분리
   - amber 권장 배너 제거(Kenko colored container 위반), 10k_sub_50 추천 뱃지 제거, full_sub_3 "경험자" 태그만 유지
2. **C-2 settings** — 주당 일수(3/4/5) + 시작일(오늘/내일/다음월요일) + [vo2_boost 전용] 5K 기록
3. **C-3 preview** — 챕터 카드 (Kenko 톤다운: 흰 배경 + border-gray-100, 좌측 챕터 번호 뱃지만 emerald 액센트)
4. **C-4 loading** — 스피너 + "러닝 여정을 만드는 중..."
5. **C-5 완료 화면** (회의 2026-04-27 신설, [RunningHub.tsx:60-101](../src/components/dashboard/RunningHub.tsx#L60-L101))
   - 회색 체크 아이콘 + "PROGRAM CREATED" 라벨 + 프로그램명·기간
   - 코치 메시지 3줄 (`running_program.coach.intro_line1~3` 재사용)
   - 2버튼: [내 플랜 보기] (secondary) / [오늘 시작하기] (primary, 첫 세션 → master_plan_preview)

### 주요 기능

| 기능 | 동작 |
|---|---|
| 4프로그램 선택 | RunningProgramSheet 5단계 흐름 (회의 64-C/E/F 가이드 그대로) |
| 이어가기 | `onResumeProgram(programId, nextSessionId)` → 다음 세션 master_plan_preview 진입 (`workoutReturnTo = "running_hub"`, [page.tsx:1069](../src/app/app/page.tsx#L1069)) |
| 오늘 시작하기 (완료 화면) | `onStartFirstSession(programId)` → `getNextProgramSession(programId)` → master_plan_preview |
| 뒤로 | `onBack` → `setView("root_home")` |
| 비로그인/비프리미엄 가드 | `onRequestLogin` / `onRequestPaywall` — 저장 시점에만 검증 (회의 64-F 게이트 해제) |

---

## 🧘 홈트 진입 — HomeWorkoutHub (`view === "home_workout_hub"`)

**진입:** ROOT 카드 "홈트" 클릭
**컴포넌트:** [src/components/dashboard/HomeWorkoutHub.tsx](../src/components/dashboard/HomeWorkoutHub.tsx)

> 1차 룰엔진 땜빵 — 추후 자체 유튜브 콘텐츠로 전환 예정 ([memory:project_homeworkout_youtube_pivot]).

### 화면 구성

**우상단 오버레이** — [📋] 내 플랜 / [👤] 프로필 (RunningHub와 동일 패턴)
**좌상단 ←** — 뒤로 → root_home

**입력 카드 (Kenko: 흰 배경 + border-gray-100, [HomeWorkoutHub.tsx:103-142](../src/components/dashboard/HomeWorkoutHub.tsx#L103-L142))**
- **부위 칩** (4택, 디폴트 `full`): 전신 / 상체 / 하체 / 코어
- **시간 칩** (3택, 디폴트 30): 15분 / 30분 / 45분
- **강도 칩** (3택, 디폴트 `moderate`): 가볍게 / 보통 / 강하게
- **시작하기** 버튼 (primary, emerald)

### 주요 기능

| 기능 | 동작 |
|---|---|
| 시작하기 | `onStart({ muscleGroup, duration, intensity })` → [page.tsx:1112-1166](../src/app/app/page.tsx#L1112-L1166) |
| 백엔드 호출 | `lazyGenerateWorkout` → `/api/planSession` with `equipment: "bodyweight_only"`, `muscleGroup`, `condition.energyLevel` (low=2/moderate=3/high=4), `availableTime` (15→30, 30→30, 45→50 매핑) |
| Goal 매핑 | Onboarding `fp.goal` → WorkoutGoal: `fat_loss/muscle_gain` 직매핑, `endurance/health` → `general_fitness` ([page.tsx:1121-1127](../src/app/app/page.tsx#L1121-L1127)) |
| 세션 진입 | condition_check **스킵** → master_plan_preview 직진입 (`workoutReturnTo = "home_workout_hub"`) |
| 분석 이벤트 | `trackEvent("chat_plan_generated", { mode: "home_training", muscle_group, duration, intensity })` |

### 백엔드 muscleGroup 라이트 분기 (회의 2026-04-27 신규, commit `89eea72`)
- `functions/src/workoutEngine.ts` `generateHomeWorkout` 시그니처에 `muscleGroup?: "full" | "upper" | "lower" | "core"` 추가
- `functions/src/plan/session.ts` planSession 핸들러에서 파싱·전달

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
| **내 등수** (구 '부위도감', 회의 2026-04-25 ①) | **HexagonChart 레이더** (StatusTab 동일 디자인), 6 카테고리: 가슴/등/어깨/하체/코어&팔/체력. 데이터: 전체 history 기반 누적 best bwRatio + 러닝 페이스 percentile. 헤더 부제 "${연령대} ${성별} 100명 중", 종합 등수 텍스트 ("종합 N등"). cardio tentative 회색 틴트 (회의 64-X). **월 네비게이션 무관** (전체 누적 기준). EN: 'My Rank' |
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
| ProofView 탭 전환 | calendar/bodypart(내부 키 유지 — UI 라벨은 '내 등수')/weight/tier |
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
- **초보자 모드 토글** (회의 2026-04-28-ε, SEED-001 Phase 1) — localStorage `ohunjal_beginner_mode` (`"1"`/`"0"`). ON 시 워크아웃 진행 중 BeginnerGuideOverlay (warmup_intro / main_equipment) 노출 + 벤치프레스 휴식 90/150초. CustomEvent `beginner_mode_change` 로 다중 화면 동기화
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

- **localStorage**: `ohunjal_gender`, `ohunjal_birth_year`, `ohunjal_fitness_profile`, `ohunjal_settings_sound`, `ohunjal_settings_vibration`, `ohunjal_beginner_mode`
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
- **초보자 모드 옵트인 모달** (회의 2026-04-28-ε, SEED-001 Phase 1) — "운동 시작" 클릭 + paywall 통과 후 `localStorage.ohunjal_beginner_mode === undefined` 일 때 1회 노출. "네 안내받을게요" / "괜찮아요 익숙해요" 2버튼. dismiss 후 workout_session 진입. 이후 변경은 프로필 토글

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

**초보자 모드 통합** (회의 2026-04-28-ε, SEED-001 Phase 1):
- `BeginnerGuideOverlay` 마운트 (FitScreen 위 z-[70]) — `beginnerEnabled === true` + currentExercise 진입 시 phase별 1회:
  - `currentExercise.type === "warmup"` → `warmup_intro` overlay (스트레칭존 안내 5줄 + 영상 따라하기 CTA)
  - `currentExercise.name === "벤치프레스"` → `main_equipment` overlay (`EquipmentFinderCard` = 사진 `/machine/bench-press.png` + 찾는법 5줄 + 폼 cue 5줄 ACSM/NSCA 출처)
- `dismissedOverlays: Set<string>` — 한 세션 내 phase별 1회 보장 (재진입 시 미노출)
- 휴식 시간 분기 (L271-285): 초보자 + 벤치프레스 = target/easy 90s, fail 150s, min 60s (ACSM Guidelines 11th 컴파운드 90-120s)
- 일반 모드는 기존 60/45/90 (min 30) 그대로 — 회귀 X
- `BEGINNER_MODE_EVENT` (`"beginner_mode_change"`) CustomEvent 리스너 — 프로필 토글 변경 즉시 반영

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

**Paddle.js 결제 연동 (EN)** (회의 2026-04-21 도입 / 2026-04-28 Live 활성):
- [src/utils/paddle.ts](../src/utils/paddle.ts) — `getPaddle()` 인스턴스 싱글톤, `initializePaddle({ environment, token })`
- env: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV` (sandbox/**production** 활성) + `NEXT_PUBLIC_PADDLE_PRICE_MONTHLY`
- `paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customer: { email }, customData: { firebaseUid } })`
- successUrl: `/app?paddle_success=1`
- Paddle 심사용 **환불정책 페이지** + Pricing 앵커 (landing) — `/terms`·`/privacy`·`/refund`
- **2026-04-28 Live 전환:** Paddle 머천트 오브 레코드(MoR) 활성화 → 해외 카드 결제 정식 운영. functions secrets `PADDLE_API_KEY`(Live) + `PADDLE_WEBHOOK_SECRET`(Live) 갱신. CI 워크플로우(`firebase-hosting-{merge,pull-request}.yml`) PADDLE env 4개 주입 추가. (회의 2026-04-28)
- **payout settings:** 한국 외화계좌(SWIFT/IBAN), Threshold $100, 매월 1일 잔액 확정 → 15일까지 송금

**환불 정책 (KO 카카오페이 + EN Paddle 이중 채널, 회의 2026-04-28):**
- 결제 후 7일 이내 + AI 운동 플랜 미생성 시 전액 환불 (provider 무관 동일)
- 처리 시간 분기: 카카오페이 3~5 영업일, Paddle 5~10 영업일 (카드사 정책에 따라 변동 가능)
- 회사 귀책(시스템 오류, 중복 결제) 시 위 기한·이용 이력 제한 없이 환불
- 어드민 환불 처리: [admin.ts:1180+](../functions/src/admin/admin.ts#L1180) `provider === "paddle"` 분기 — Paddle Adjustments API (`POST /adjustments`, transaction의 line_items[].id 추출 → `type: "full"`) 호출. KO 결제는 PortOne `/payments/{id}/cancel` 기존 호출 유지.

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

**ROOT 카드 화면 도입** (2026-04-27, 회의 2026-04-27, [PLAN-ROOT-HOME-CARDS.md](./PLAN-ROOT-HOME-CARDS.md)):
- ViewState 확장: `root_home` / `running_hub` / `home_workout_hub` ([page.tsx:180-191](../src/app/app/page.tsx#L180-L191))
- 신규 컴포넌트 3종: `RootHomeCards.tsx` / `RunningHub.tsx` / `HomeWorkoutHub.tsx`
- 진입 전환: 로그인 후 `home` + `activeTab === "home"` 시 자동 `root_home` 치환 ([page.tsx:262-266](../src/app/app/page.tsx#L262-L266))
- 출처 기억 state 신설: `myPlansReturnTo` / `workoutReturnTo` — MyPlans/master_plan_preview 뒤로가기 시 진입 출처(root_home/home_chat/running_hub/home_workout_hub) 복귀 ([page.tsx:255-258](../src/app/app/page.tsx#L255-L258))
- Onboarding 게이트 부활: 카드 첫 클릭 시 `pendingRootTarget` 으로 7스텝 띄우고 완료 후 자동 진입
- BottomTabs 가드: ROOT/Hub 진입 시 비노출, ChatHome/Hub 진입 후 부활
- ChatHome 좁힘: 러닝 칩/아이콘 제거, parseIntent `mode === "redirect"` 분기 신설 — 러닝/홈트 의도 감지 시 단일 CTA 안내 카드

**진행 중 프로그램 UI 노출** (2026-04-27, commit `612e375`):
- `getActivePrograms()` 반환에 `programCategory` + `programGoal` 노출 (RunningProgramId enum이면 fallback "running" 추론, [src/utils/savedPlans.ts](../src/utils/savedPlans.ts))
- RunningHub select 화면 상단 "진행 중" 섹션 — 진행률 바(완료/총) + "이어가기 →" 버튼. 신규 시작 카드는 "새로 시작" 라벨 아래로 분리.
- ChatHome 인사말 직후 "진행 중 웨이트 프로그램" 띠 추가 — 동일 진행률 바 + "이어가기" CTA
- i18n: `runningHub.inProgress.*` + `runningHub.startNew.label` + `chat.activeProgram.*`

**운동 음악 기능 전부 제거** (2026-04-27, commit `b8201a3`):
- 회의 64-(workout-music) 4커밋(`e187790` 도입 → `385494a`/`b90f2cb`/`fb989b7` 패치) 누적된 IFrame Player + 미니바 + visibility 동기화 전부 제거.
- 사유: React + IFrame DOM 충돌(`Uncaught NotFoundError: insertBefore` 등) 재발 + 외부 YouTube Music 등으로 대체 가능.
- 잔여 코드 0건 (`grep -r "MusicMiniBar\|workout_music"` 결과 없음).

**fitness-age 운동 직후 vs 히스토리 뷰 불일치 fix** (2026-04-27, commit `510caa5`):
- 버그: 운동 직후 리포트와 히스토리 재진입 리포트의 fitness age 값이 다름.
- 수정: bodyWeightKg/gender/birthYear 가 분석 시점에 누락된 경우 localStorage fallback 추가 (`ohunjal_body_weight` / `ohunjal_gender` / `ohunjal_birth_year`).

**MyPlans 편집 모드 휴지통 톤다운** (2026-04-27, commit `de836e0`):
- 빨간 마이너스(`-`) 아이콘 → 회색 휴지통 아이콘 (Kenko 톤 통일).

---

**ProofTab '부위도감' → '내 등수' 헥사곤** (2026-04-25, 회의 2026-04-25 ①):
- 기존 7부위 횡 바그래프 (제목 정규식 매칭) 폐기 — '코어' 항상 0 + '그래서 뭐?' 가치 부족.
- StatusTab(`src/components/report/tabs/StatusTab.tsx`) 의 부위별 퍼센타일 로직 + `HexagonChart` 재사용.
- ProofTab.tsx — `categoryPercentiles` / `hexAxes` / `computeOverallPercentile` 미러링. `fitnessPercentile.ts` 단일 SSOT.
- 데이터 소스: 전체 history 누적 best bwRatio + 러닝 페이스 percentile (월 네비 무관).
- 라벨: KO '부위도감' → '내 등수' / EN 'Body Log' → 'My Rank'. 내부 ProofView key (`bodypart`) 는 그대로 유지.

**setDetails FitScreen 실제 전달 fix** (2026-04-25, 회의 2026-04-25 ②):
- 버그: MasterPlanPreview 에서 세트별 무게·횟수 편집 (`ex.setDetails[]`) → WorkoutSession 이 단일 `ex.reps/ex.weight` 만 FitScreen 에 넘겨 세트별 차이 미반영. 예: '세트 1 80kg 10회 / 세트 2 85kg 8회' 편집해도 모든 세트 동일 실행.
- 수정 ([WorkoutSession.tsx](../src/components/workout/WorkoutSession.tsx)):
  1. `setInfo` prop — `setDetails[currentSet-1]` 우선 소비, 없으면 단일 값 fallback.
  2. `handleSetComplete` — easy/too_easy/fail 피드백 시 다음 세트(0-indexed=`currentSet`) `setDetails.reps` 도 함께 패치. 이후 세트는 플랜 의도 유지 (피드백 cascade 없음).
- 호환: setDetails undefined (AI 자동 생성) → 기존 adaptive 루프 그대로. setDetails 존재 (수동 편집) → 세트별 정확 + 다음 세트만 피드백 반영.

**fitness-age raw ACSM 분리 산출** (2026-04-24, 회의 2026-04-24 fitness-age):
- 대표 지시: 나이 측정은 EASING 적용 안 한 raw ACSM 으로 타이트하게. 화면 표시 percentile (육각형/등수) 는 회의 54 EASING 그대로 유지.
- [src/utils/fitnessPercentile.ts](../src/utils/fitnessPercentile.ts): `bwRatioToPercentile` 에 `opts.skipEasing` 추가. true 시 raw ACSM threshold.
- [src/components/report/tabs/StatusTab.tsx](../src/components/report/tabs/StatusTab.tsx): `categoryPercentilesForAge` 신설 (fitness age 계산 전용). 화면 표시 `categoryPercentiles` 는 별도.
- **cardioOnly amber 경고 블록 제거** — 모든 케이스 일관되게 fitness age 표시. 자기 결함 노출 금지 룰 (`feedback_product_positioning`) 준수.
- 영향 (30대 남자 75kg 평균 시뮬): 화면 percentile ~62 변화 없음, fitness age 27-28세 → 30세 ±1 (3살 빡세짐).

**홈 BW 보강 8종 bwOnly 분기** (2026-04-24, 회의 64-M4 누수):
- 버그: 일반 home_training (장비 가정) 에서 "프론 코브라" / "힙 힌지 홀드" 같은 BW 보강 운동이 50%+ 확률로 메인 등장. 클라 3곳(LABELED_EXERCISE_POOLS / bodyIcon / exerciseVideos) 미등록 → 부위 아이콘 "?" + 교체 검색 누락 + 영상 폴백.
- 서버 [functions/src/workoutEngine.ts](../functions/src/workoutEngine.ts): BW 보강 8종을 `bwOnly === true` 스프레드 분기로 격리 (homePull/homeHinge). 일반 home 은 익숙한 장비 운동만, bwOnly 모드만 다양성.
- 클라 동기화 (3곳):
  - [src/constants/exerciseVideos.ts](../src/constants/exerciseVideos.ts) — 8종 YouTube Shorts ID 추가 (대표 큐레이션).
  - [src/constants/workout.ts](../src/constants/workout.ts) `LABELED_EXERCISE_POOLS` — 후면 어깨 / 등 / 하체 카테고리에 8종 분배.
  - [src/components/plan/bodyIcon.ts](../src/components/plan/bodyIcon.ts) — GLUTE / POSTERIOR_LEG 매핑 추가.

**운동 풀 자잘한 정리** (2026-04-25):
- 오버헤드 트라이셉 영상 갱신 + 케이블 OH 풀네임 통일 ([exerciseVideos.ts](../src/constants/exerciseVideos.ts) / [workout.ts](../src/constants/workout.ts)).

**저장소 정리 세션** (2026-04-25, 회의 2026-04-25 저장소 정리):
- README 재작성 (Next.js 템플릿 보일러플레이트 → 오운잘 프로젝트 소개).
- 편의 npm 스크립트 4개 추가 (`package.json`).
- 미사용·중복 의존성 3개 제거 (`package.json`/`package-lock.json`).
- public/ 미사용 에셋 정리 (-43M).
- `.planning/codebase/` 스테일 스냅샷 제거 + 완료 문서 archive 이동.

**FitScreen 우측 상단 스킵·종료 2-아이콘** (2026-04-24 PM):
- 기존 "운동 종료" 텍스트 필을 **아이콘 2개**로 교체: ⏩ 스킵 (이중 chevron) + ⎋ 운동종료 (logout-arrow).
- 스킵: 현재 운동을 세트 기록 없이 다음 운동으로 이동 ([WorkoutSession.handleSkipExercise](../src/components/workout/WorkoutSession.tsx)). 마지막 운동 스킵 시 add-exercise 화면.
- warmup / strength / core / cardio 전 phase 공통 노출. `isDoneAnimating || view==="feedback"` 중엔 opacity 30 + pointer-events-none.

**인터벌 러닝 4종 fix** (2026-04-24 PM, 회의 2026-04-24):
- **라스트 라운드 sprint 수동 완료 즉시 종료** ([FitScreen.tsx](../src/components/workout/FitScreen.tsx)): 기존엔 manualComplete 가 sprint→recovery 전이만 해서 "완료 버튼 안 눌림"처럼 보였음. `manualComplete && sprint && 라스트 라운드` 3조건 AND 시 즉시 `timerCompleted=true` + runningStats 콜백.
- **라운드 1 sprintPace 누락 fix** ([FitScreen.tsx:483](../src/components/workout/FitScreen.tsx#L483)): 최초 세션 시작 시 `gpsMarkPhase("sprint", 1)` 1회 기록. 이전엔 phaseMarks 가 `[{rec,1}, {sprint,2}, ...]` 로 시작해 computeIntervalRounds 가 round 1 sprint 구간을 못 만들어 `sprintPace=null` → UI 가 "—" 로 표시. 새 세션부터 유효 (과거 레코드는 이미 null 저장됨, 재계산 불가).
- **거리 기반 midpoint 알람**: 거리 기반 sprint(`sprintDist != null + GPS`)는 거리 절반 도달 시 발동 (400m → 200m). 기존 `phaseTotal/2` 는 estimateSprintSec 추정치 기반이라 유저가 빠르면 ~230m 에서 울림.
- **인터벌 사운드 의미 정리**: sprint→recovery = `"start"` (짧은 stop), recovery→sprint = `"rest_end"` (3 bells 큰 소리). 강엉잠 rest 종료 (L838) 와 사운드 통일. 진동도 rec→sprint 를 `[200,100,200]` 2-pulse 로 강화.

**러닝 세션 전종 감사** (2026-04-24 PM):
- 시간 기반 인터벌 (walkrun/fartlek/sprint30s/strides/norwegian_4x4/pure_sprints), 거리 기반 인터벌 (400m/800m/1000m/1600m/race_pace_interval), 연속 러닝 (tempo/easy/long/threshold/threshold_2x15/long_with_mp/specific_long), 타임트라이얼 (tt_2k/tt_5k/dress_rehearsal) 전부 점검.
- 결론: 4 fix 가 **모든 관련 인터벌 타입에 자동 적용**됨. 이유 — 모든 인터벌이 FitScreen 단일 useEffect 통과, `deriveIntervalSpec` 이 `runKind: "continuous"` 여도 intervalSpec 있으면 interval UI 활성화. `recoveryDist` 필드는 정의만 있고 실사용 0건.
- 미해결 경미 리팩터 2건: (1) 거리 기반 sprint 의 3-2-1 tick 이 timer 기반이라 유저가 빠르면 실제 도달 전 울림. (2) pause 중 GPS 드리프트로 `phaseStartDistRef` 과대 계산 가능성. 둘 다 유저 리포트 없어 보류.

**ShareCard 간격 재발 fix** (2026-04-24 PM, 회의 2026-04-24):
- 러닝 공유카드 다운로드 PNG 에서 Distance/Pace/Time 간격이 거대하게 벌어짐. 원인: `<p>` UA 디폴트 margin 1em 을 html2canvas 가 반영 (회의 64-η 에서 웨이트 카드는 잡았으나 러닝 카드 누락).
- 재발 방지 차원 전면 sweep: [ShareCard.tsx](../src/components/report/ShareCard.tsx) Card 0 러닝/Card 1 weekly/Card 2 PR·노력 요약 전부 `margin:0` + `gap` → `marginBottom/marginRight` 마이그. [PlanShareCard.tsx](../src/components/plan/PlanShareCard.tsx) 헤더/Stats/Phase 도 동일.
- 룰: [.claude/rules/share-card.md](../.claude/rules/share-card.md) (4대 gotcha 포함).

**AdviceCard ↔ MasterPlan 운동 동기화** (2026-04-24, 회의 2026-04-24):
- **배경**: AdviceCard `workoutTable` 은 디스플레이용 텍스트였고, "오늘 이 운동 시작" 클릭 시 서버는 `sessionMode/targetMuscle/goal` enum 3개만 받아 고정 balanced/split 템플릿으로 재생성 → 유저가 본 운동과 실제 세션 불일치.
- **해결**: `AdviceContent.recommendedWorkout.exerciseList?: Array<{name, sets, reps, rpe?}>` 신설 + 서버 `generateFromExerciseList()` 최우선 routing.
- 서버: [functions/src/ai/parseIntent.ts](../functions/src/ai/parseIntent.ts) 타입/프롬프트/sanitize + [functions/src/workoutEngine.ts](../functions/src/workoutEngine.ts) `POOL_INDEX` + `resolveExercise()` (4단계 매칭) + [functions/src/plan/session.ts](../functions/src/plan/session.ts) body 파싱·보안 셔플 제외.
- 클라: [src/constants/workout.ts](../src/constants/workout.ts) `SessionSelection.exerciseList` + [src/app/app/page.tsx](../src/app/app/page.tsx) `lazyGenerateWorkout` body 확장 + push/pull rotation 스킵 가드 + [src/components/dashboard/ChatHome.tsx](../src/components/dashboard/ChatHome.tsx) `onStartRecommended` forward + [src/components/dashboard/AdviceCard.tsx](../src/components/dashboard/AdviceCard.tsx) 타입 미러링.
- **안전 장치**: exerciseList 부재 → 기존 sessionMode 라우팅 완전 fallback. 풀 매칭 실패 → 입력값 그대로 사용 + 그룹=`other`.
- **복합 부위 비율 요청** (예: "하체1 어깨2 팔2") 지원 — `targetMuscle` enum 단일 제약 해소. sessionMode 는 "balanced" 유지하되 exerciseList 가 실제 구성 결정.
- **배포 주문**: functions 먼저 (`firebase deploy --only functions`) → Hosting (`git push` CI). 순서 바뀌면 클라가 새 필드 보내도 서버가 무시.

**구독 결제 자동화** (2026-04-23):
- **Paddle 백엔드 통합** — `functions/src/billing/paddleWebhook.ts` HMAC-SHA256 서명 검증, `subscription.activated/updated/canceled/resumed/past_due` + `transaction.completed/paid` 이벤트 처리. `custom_data.firebaseUid` 로 유저 매칭, `subscriptions/{uid}` 에 `provider:"paddle"` upsert. cancelSubscription provider 분기 (Paddle Management API `effective_from: next_billing_period`). subscription.updated 시 `canceled_at`/`scheduled_change.action==="cancel"` 있으면 cancelled 보존 (race fix).
- **PortOne 자동갱신** (`functions/src/billing/renewPortOneSubscriptions.ts`, 매시 정각 KST) — expiresAt 6시간 내 도래하는 active PortOne 구독 재결제, +1개월 연장. 실패 시 다음 사이클 재시도. 만료까지 실패하면 expireSubscriptions가 expired 마킹.
- **만료 자동 비활성화** (`functions/src/billing/expireSubscriptions.ts`, 03:00 KST) — active/cancelled + expiresAt < now → expired 배치 업데이트. adminDashboard 는 lazy expiry 체크 추가로 크론 전에도 즉시 정확.
- **Paddle waitlist 게이트** — `NEXT_PUBLIC_PADDLE_ENABLED` flag (unset=비활성). 비한국어 + 비활성 시 SubscriptionScreen 에 "Coming soon" + Notify me 버튼 → `international_waitlist/{uid}` Firestore 저장. firestore.rules 권한 추가.
- **결제 탭 통화 분리** (어드민) — KRW/USD totalsByCurrency 별도 합계, formatMoney 유틸로 행별 통화 표기, paddle 배지.

**GA / 어드민 분석 안정화** (2026-04-23):
- **유저 행동 퍼널 stage 레이블 정정** — "앱 진입" → "계정 생성" / "챗 시작" → "첫 채팅". 코드 감사 결과 anonAuthRows/emailAuthUsers 가 실제로는 Auth 가입 시점 카운트라 "방문" 이 아님. 헤더 부제 "방문 ≠ 계정 생성 주의".
- **퍼널 커스텀 날짜 범위** — adminDashboard `req.body.customStart/customEnd` ISO date 파싱, countByRange 가 custom 버킷 추가. 어드민 UI date input + 적용/초기화 + "MM.DD~MM.DD" 6번째 컬럼.
- **trackEvent 이중화** — `window.dataLayer.push` 직접 push + gtag 호출 병행. async gtag 늦게 로드되면 queue 드롭되던 케이스 대응. dev 모드 console.debug.
- **chat_home_initial_greeting_shown 2x 중복 fix** — useRef 가드로 세션 1회.

**ChatHome UX 보강** (2026-04-23):
- 페이월 트리거 분리: `free_chat_limit` (parseIntent 3회) vs `free_plan_limit` (planSession 2회). "이번 달 무료 대화 다 썼어요" / "이번 달 무료 플랜 다 썼어요" 분리 표기.
- 첫 로그인 무료 한도 안내 배너 (1회, localStorage `ohunjal_trial_intro_shown`).
- 배지 옆 ? 툴팁 바텀시트 — 플랜 2회 / 대화 3회 + 러닝·기록·리포트 무제한 안내.
- 배지 카피 "1/2" → "1번 남음" 으로 전환 (남은 횟수 기준 친절도).
- 게스트 한도 소진 시 textarea·송신 버튼·기본 칩·Quick plan·More examples 팝오버 disabled. placeholder 안내.

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
