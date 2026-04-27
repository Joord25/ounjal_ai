# PLAN-ROOT-HOME-CARDS — ROOT 진입 화면 카드 도입 (웨이트/러닝/홈트)

**작성일**: 2026-04-27
**회의**: 2026-04-27 (ROOT 카드 화면 도입)
**대상**: `/app` 로그인 후 첫 진입 화면 + 러닝 허브 신설 + 홈트 허브 신설 + ChatHome 좁히기
**디자인 언어**: Kenko (회의 64-α 토큰 재사용)

---

## 0. 코드 사전 조사 결과

### 0.1 핵심 파일·라인
| 파일 | 역할 | 핵심 라인 |
|---|---|---|
| `src/app/app/page.tsx` | 단일 오케스트레이터, `ViewState` 라우팅 | L173-181 (ViewState), L235 (activeTab), L240 (view), L884-948 (탭 분기), L1414 (PhoneFrame 렌더) |
| `src/components/dashboard/ChatHome.tsx` | 현 홈 (채팅) | 전체 (러닝 칩·예시 포함) |
| `src/components/layout/Onboarding.tsx` | 7스텝 프로필 수집 (자산 완성) | L18 Step type, L20 GOAL_OPTIONS, L32 STEP_ORDER |
| `src/components/dashboard/RunningProgramSheet.tsx` | 러닝 4프로그램 선택 시트 (재활용 대상) | — |
| `functions/src/workoutEngine.ts` | `generateHomeWorkout` + `bodyweight_only` 모드 (회의 64-M4) | L1326 타이틀, L1542+ |
| `src/components/layout/BottomTabs.tsx` | 4탭 네비 (root_home에서는 미노출) | — |

### 0.2 현재 ViewState
```ts
type ViewState =
  | "login" | "prediction_report"
  | "home" | "home_chat" | "my_plans"
  | "master_plan_preview" | "workout_session" | "workout_report";
```
- `home` = 4탭 컨테이너 (proof/nutrition/my 활성 시)
- `home_chat` = ChatHome 본체 (현 기본 홈 탭 진입점)
- 4탭 진입 가드: `(view === "home" || view === "home_chat")` 패턴 다수

### 0.3 Onboarding 자산 (그대로 부활)
- 7스텝: welcome → gender → birth_year → height → weight → **goal**(fat_loss/muscle_gain/endurance/health) → done
- 진입 게이트 키: `localStorage.ohunjal_onboarding_done === "1"`
- 현재 진입 트리거: 영양 탭 첫 진입(필수 3개 부재 시)만. **카드 첫 클릭 트리거 추가 필요**.

### 0.4 보호해야 할 기존 기능
1. ChatHome의 "이전 플랜 이어서" / lastPlanSummary
2. AdviceCard 2버튼 (오늘 운동 / 프로그램 저장)
3. parseIntent 의도 분기 (chat/plan/advice/program/redirect)
4. 운동 흐름 보호: `master_plan_preview`/`workout_session` 동안 탭 전환 차단
5. ProofTab pull-to-refresh, 영양 탭 프로필 게이트
6. 비로그인 체험 카운터 (parseIntent 3회 제한)
7. Cold start 재시도 (lazyGenerateWorkout 1.5s)

---

## 1. 결정 요약 (회의 2026-04-27)

| # | 결정 | 비고 |
|---|---|---|
| 1 | ROOT 첫 진입을 **3x1 세로 버튼 카드** 로 변경 | 웨이트/러닝/홈트 |
| 2 | ROOT 화면은 **하단 네비바 X**. 카드 진입 후 화면들에서만 부활 | 영양 진입 1탭 깊어짐 OK |
| 3 | 우상단 아이콘 **2개만**: 내 플랜 / 프로필 | 영양은 카드 진입 후 네비바로 |
| 4 | 첫 클릭 시 **온보딩 7스텝 부활** (운동 목적 포함, 기존 자산 그대로) | 한 번 끝나면 어떤 카드도 패스 |
| 5 | 웨이트 → 기존 ChatHome 흡수, 러닝/홈트 의도는 **(다)변형** "안내 + 이동 버튼 1개" | 응답 빠르게 |
| 6 | 러닝 → 기존 4프로그램 선택판 (RunningProgramSheet 자산 재활용) | vo2 시 5K 기록 입력 그대로 |
| 7 | 홈트 → `generateHomeWorkout` 호출판 신설 (간단 부위/시간 픽커) | 추후 유튜브 채널 프로그램으로 진화 예정 |
| 8 | 카드 위계 **동일 사이즈**, 진행 중 프로그램 있으면 우상단 내플랜 아이콘 활성·바로 진입 | dynamic highlight 1차 보류 |
| 9 | 히스토리는 **통합 유지** (분리 X) | ProofTab 그대로 |
| 10 | 디자인 언어 **Kenko** (회의 64-α 토큰 재사용) | colored container 금지, 흰 배경 + 얇은 보더 + 라벨 uppercase |

---

## 2. 와이어프레임

### 2.1 ROOT 카드 화면 (`view === "root_home"`)
```
┌──────────────────────────┐
│              [📋]  [👤]  │  ← 내플랜 / 프로필 (24×24)
│                          │
│  ┌────────────────────┐  │
│  │ WEIGHT             │  │  ← labelSm uppercase tracking-[0.18em]
│  │ 웨이트              │  │  ← text-3xl font-black text-[#1B4332]
│  │              [SVG] │  │  ← 우측 아이콘 anchor (덤벨)
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ RUNNING            │  │
│  │ 러닝                │  │
│  │              [SVG] │  │  ← 러너
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ HOME WORKOUT       │  │
│  │ 홈트                │  │
│  │              [SVG] │  │  ← 매트
│  └────────────────────┘  │
│                          │
└──────────────────────────┘
   (하단 네비바 X)
```

**카드 스펙 (Kenko 토큰):**
- 카드 컨테이너: `bg-white border border-gray-100 rounded-3xl shadow-sm px-6 py-7`
- 카드 간 gap: `flex flex-col gap-5`
- 영문 caption: `text-[10px] font-black tracking-[0.18em] uppercase text-gray-400`
- 한글 라벨: `text-3xl font-black text-[#1B4332] mt-2`
- SVG 아이콘: 우측 정렬, `w-12 h-12 text-[#2D6A4F]` (의미 연결 명확 → 장식 X)
- 탭 시 `active:scale-[0.98] transition-transform`
- 진행 중 프로그램 있는 카드: 좌측 `w-1 h-full bg-[#2D6A4F] rounded-full` 사이드 바 + "오늘 N주 D일" 마이크로 캡션 (`text-[10px] font-bold text-[#2D6A4F]`)

**우상단 아이콘:**
- 컨테이너: `absolute top-6 right-6 flex gap-3`
- 각 아이콘: `w-10 h-10 rounded-full border border-gray-100 bg-white flex items-center justify-center`
- 내플랜: 북마크 아이콘. 장기 프로그램 0건이면 `text-gray-300` dim, 1+이면 `text-[#1B4332]` + 우측상단 `w-2 h-2 bg-[#2D6A4F] rounded-full` 닷
- 프로필: 사람 실루엣 아이콘. 클릭 → `setActiveTab("my")` + `setView("home")`

### 2.2 러닝 허브 (`view === "running_hub"`) — 5단계 풀스크린화

기존 RunningProgramSheet 5단계(select → settings → preview → loading → 완료)를 풀스크린 화면으로 변환. 회의 2026-04-27 8개 결정 반영.

**C-1 select (정리됨)**
- 4프로그램 카드 (vo2_boost / 10k_sub_50 / half_sub_2 / full_sub_3)
- amber 권장 배너 **제거** (Kenko colored container 위반)
- 진행 중 프로그램 띠 **1차 제외** (대표 지시: 처음 시작 화면이라 불필요)
- 추천 뱃지 — `10k_sub_50` 추천 뱃지 **제거**, `full_sub_3` "경험자" 태그 **유지**
- 카드 hover/press: `bg-emerald-50/30` → `bg-gray-50` 중성화
- gate_check 경로는 **건드리지 않음** (회의 64-F에서 잠금 해제, 사실상 죽은 경로)

**C-2 settings (그대로 유지 + Kenko 톤다운)**
- 주당 일수 (3/4/5) + 시작일 (오늘/내일/다음월요일) + [vo2_boost 전용] 5K 기록 — **현 자산 그대로 유지** (대표 결정: 빼지 않음)
- Chip 비활성: `bg-gray-50` → `bg-white border border-gray-200`로 정리

**C-3 preview (Kenko 톤다운)**
- 챕터 카드 `bg-gradient-to-br from-emerald-50 to-white border border-[#2D6A4F]/15` → **흰 배경 + `border border-gray-100`**
- 좌측 챕터 번호 뱃지 `bg-[#2D6A4F]` 유지 (액센트 OK)
- "10주 동안 3챕터로 진행됩니다" 서브타이틀 1줄

**C-4 loading**
- 현 자산 그대로 (스피너 + "러닝 여정을 만드는 중...")

**C-5 완료 화면 신설 (NEW)**
- 토스트만 띄우고 my_plans 점프하던 기존 흐름 → **별도 완료 화면 신설**
- 구성:
  - 상단 회색 체크 아이콘 (장식 X, 의미 = 완료 시그널)
  - "PROGRAM CREATED" 라벨 + 프로그램명·기간 (예: "10K SUB 50 · 10주")
  - 코치 메시지 3줄 (`running_program.coach.intro_line1~3` 재사용 — i18n 자산 그대로)
  - 2버튼: [내 플랜 보기] (secondary, my_plans 점프) + [오늘 시작하기] (primary, 첫 세션 → master_plan_preview)
- ChatHome에 있던 코치 메시지 push 로직은 **제거** (러닝 허브 흐름으로 이전)

### 2.3 홈트 허브 (`view === "home_workout_hub"`)

대표 결정: 1차 룰엔진 땜빵, 추후 자체 유튜브 콘텐츠로 전환 예정 ([memory:project_homeworkout_youtube_pivot]).

**입력 (3종)**
- **부위 칩** (라이트 추가): 전신 / 상체 / 하체 / 코어 (4택, 디폴트 전신)
- **시간 칩**: 15분 / 30분 / 45분 (3택, 디폴트 30분)
- **강도 칩**: 가볍게 / 보통 / 강하게 (3택, 디폴트 보통)

**흐름**
1. 시작하기 → `POST /api/planSession` with:
   - `equipment: "bodyweight_only"`
   - `goal`: 온보딩 `fp.goal` 사용 (없으면 `health` fallback) — 개인화
   - `duration`: 15/30/45 (분)
   - `intensityOverride`: low/moderate/high
   - `muscleGroup`: full/upper/lower/core (백엔드 신규 파라미터 — Phase D에서 추가)
   - `condition`: 자동 디폴트 (`{ energy: "normal", body: "ok" }`) — condition_check **스킵**
2. 응답 → `master_plan_preview` 직진입 (강도 변경은 거기서 가능)
3. 운동 → 리포트 → root_home 복귀

**제거**
- "유튜브 운동 프로그램 곧 출시" placeholder 카드 — 1차 노출 X (대표 지시)
- condition_check 단계 — 스킵

### 2.4 ChatHome (`view === "home_chat"`) — 좁힘
- 진입: ROOT 화면에서 "웨이트" 카드 클릭 시
- 변경:
  - 헤더 우상단 "내 플랜" 아이콘 그대로 유지 (기존)
  - 예시 프롬프트 칩에서 "러닝 10km" / "홈트 30분" 제거
  - "더보기" 7개 중 러닝/홈트 관련 제거
  - parseIntent 응답 분기: `mode === "redirect"` + `target: "running"|"home_workout"` 시 → AssistantMessage 한 줄 + **단일 버튼** "러닝 화면으로 이동" / "홈트 화면으로 이동"
  - 그 외 흐름은 전부 동일

---

## 3. 라우팅 / ViewState 변경

### 3.1 ViewState 확장
```ts
type ViewState =
  | "login" | "prediction_report"
  | "root_home"        // [NEW] 3카드 진입 화면
  | "home" | "home_chat"
  | "running_hub"      // [NEW] 러닝 4프로그램 선택
  | "home_workout_hub" // [NEW] 홈트 룰엔진 입력
  | "my_plans"
  | "master_plan_preview" | "workout_session" | "workout_report";
```

### 3.2 진입 변경
- 로그인 직후 (page.tsx L1344, `setView("home")` 또는 `setView("root_home")`):
  - 비로그인 체험: `setView("root_home")`
  - 로그인 완료: `setView("root_home")`
- BottomTabs 이전 진입(home/home_chat) → ChatHome 흡수 시점:
  - "홈" 탭 클릭 → `setView("root_home")` (카드로 복귀)
  - 기존 "home_chat"은 웨이트 카드 클릭 시에만 진입
- 운동 흐름 종료 후 복귀: `setView("root_home")`
- 4탭 진입 가드 갱신: `(view === "home" || view === "home_chat" || view === "root_home")` — proof/nutrition/my는 root_home에서도 활성 가능해야 함? **NO** — root_home은 네비바 자체가 없으니 4탭 가드는 그대로 두고, root_home 진입 시 PhoneFrame 하단 padding 제거.

### 3.3 카드 클릭 핸들러
```ts
const handleRootCardClick = (target: "weight" | "running" | "home_workout") => {
  trackEvent("root_card_click", { target });
  const onboardingDone = localStorage.getItem("ohunjal_onboarding_done") === "1";
  if (!onboardingDone) {
    setPendingRootTarget(target); // 새 state
    setView("onboarding"); // 또는 직접 Onboarding 컴포넌트 모달
    return;
  }
  if (target === "weight") setView("home_chat");
  else if (target === "running") setView("running_hub");
  else setView("home_workout_hub");
};
```
- 온보딩 완료 콜백에서 `pendingRootTarget` 해소 후 해당 카드로 진행
- ViewState에 `"onboarding"` 추가 vs Onboarding을 모달로 띄움 — 후자 권장 (라우팅 오염 X)

### 3.4 PhoneFrame 영향
- L1414: `pullToRefresh={view === "home" || view === "home_chat"}` → root_home 추가 (당기면 lastPlanSummary 갱신)
- L1416: bottom padding 분기에 `view === "root_home"` 시 padding 제거 (네비바 없음)
- BottomTabs 렌더 가드: `view === "root_home"` 시 비노출

---

## 4. Kenko 디자인 토큰 적용 (회의 64-α 재사용)

| 토큰 | 적용 위치 |
|---|---|
| `radius.cardOuter` `rounded-3xl` | 3카드 외곽 + 우상단 아이콘 컨테이너(rounded-full로 변형) |
| `border.card` `border border-gray-100` | 모든 카드 |
| `shadow.card` `shadow-sm` | 모든 카드 |
| `type.labelSm` `text-[10px] font-black tracking-[0.18em] uppercase` | WEIGHT/RUNNING/HOME WORKOUT 영문 캡션 |
| `type.statLg` `text-3xl font-black` | 한글 카테고리명 |
| `color.primary` `#1B4332` | 한글 라벨 색 |
| `color.primaryAlt` `#2D6A4F` | 진행 사이드 바, SVG 아이콘 색 |
| `color.neutralText` `text-gray-400` | 영문 캡션 색 |
| `space.cardPadLg` `px-6 py-7` | 카드 내부 패딩 |
| `space.stackGap` `gap-5` | 카드 간 |

**금지:**
- colored container (배경 fill 박스, pill 뱃지). 카드는 흰 배경 + 보더만.
- 장식 SVG (의미 없는 패턴/배경 일러스트).
- 그라디언트 배경.

---

## 5. 작업 분해

### Phase A — 기반 구조 (라우팅 + 빈 카드 화면)
1. `ViewState` 확장 (root_home, running_hub, home_workout_hub)
2. `RootHomeCards.tsx` 신규 컴포넌트 — 3카드 + 우상단 아이콘 (라벨·아이콘·핸들러만, 진입은 stub)
3. page.tsx 라우팅 분기 추가 + 로그인 후 진입 변경 + PhoneFrame 가드 (네비바·padding)
4. SVG 아이콘 3개 준비 (덤벨 / 러너 / 매트) — Figma Kenko UI Kit 참조 또는 inline SVG 신규
5. i18n 키 신설 (영문/한글 라벨)

### Phase B — 온보딩 게이트
6. 카드 클릭 시 `ohunjal_onboarding_done` 체크 → Onboarding 모달 띄움 (`pendingRootTarget` state)
7. Onboarding 완료 시 해당 카드 진입 자동 진행
8. 진입 분석 이벤트 추가 (`root_card_click`, `root_onboarding_trigger`)

### Phase C — 러닝 허브 (5단계 풀스크린화 + Kenko 톤다운 + 완료 화면 신설)
9. `RunningHub.tsx` — RunningProgramSheet 본문(StepSelect/StepSettings/StepPreview/loading) 풀스크린 화면으로 추출
10. C-1 select: amber 배너 제거, 10k_sub_50 추천 뱃지 제거(`full_sub_3` "경험자" 유지), hover 중성화
11. C-2 settings: 현 자산 그대로 (주당 일수 + 시작일 + vo2 5K), Chip 비활성 톤만 정리
12. C-3 preview: 챕터 카드 gradient/colored container 제거 → 흰 배경 + border-gray-100
13. C-5 완료 화면 신설: 회색 체크 + 프로그램명 + 코치 3줄(`coach.intro_line1~3` 재사용) + 2버튼 (내플랜 보기 / 오늘 시작하기)
14. 뒤로 → root_home

### Phase D — 홈트 허브 + 백엔드 muscleGroup 라이트 추가
15. **백엔드**: `functions/src/workoutEngine.ts` `generateHomeWorkout` 시그니처에 `muscleGroup?: "full" | "upper" | "lower" | "core"` 추가 (10줄 내외 필터)
16. **백엔드**: `functions/src/plan/session.ts` planSession 핸들러에서 `muscleGroup` 파싱·전달
17. `HomeWorkoutHub.tsx` — 부위/시간/강도 칩 (Kenko 톤) + 시작 버튼
18. 시작 → `/api/planSession` 호출 (`equipment: "bodyweight_only"`, `goal: fp.goal ?? "health"`, `muscleGroup`, `intensityOverride`, `condition: 자동`)
19. condition_check 스킵 → master_plan_preview 직진입
20. placeholder 카드 노출 X

### Phase E — ChatHome 좁히기
21. 예시 프롬프트 칩에서 러닝/홈트 제거 (4 → 2칩, 더보기 7개 중 러닝/홈트 항목 제거)
22. parseIntent 응답에서 `mode === "redirect"` 분기 — 단일 버튼 안내 카드 ("러닝 화면으로" / "홈트 화면으로")
23. 시스템 프롬프트에 "웨이트 전용" 컨텍스트 박기 (응답 속도 최적화 + 러닝/홈트 의도 감지 시 redirect 응답)
24. ChatHome에 있던 러닝 코치 메시지 push 로직 제거 (러닝 허브 완료 화면으로 이전됨)

### Phase F — 우상단 아이콘 동작
25. 내 플랜 아이콘 — 장기 프로그램 카운트 → dim/active + 클릭 시 `setView("my_plans")`
26. 프로필 아이콘 — 클릭 시 `setActiveTab("my")` + `setView("home")` (네비바 부활)

### Phase G — 검증·문서·i18n
27. ko.json + en.json 신규 키 동시 추가 (`root.*`, `homeWorkoutHub.*`, `runningHub.*`, `chat.redirect.*` 등)
28. `npm run build` 성공 + `npm run lint` 통과 + `cd functions && npm run build` (홈트 muscleGroup 파라미터 추가 후)
29. CURRENT_STATE.md 홈 탭 섹션 + 신규 화면 섹션 추가 (workout-music 5커밋 드리프트도 같이 처리)
30. MEETING_LOG.md 회의 2026-04-27 기록 (이미 추가됨)
31. 수동 QA: 비로그인/로그인무료/프리미엄 3패스 + 첫방문/재방문 분기 + 운동 흐름 복귀

---

## 6. i18n 키 신설 목록

```json
{
  "root.title": "오운잘 / OHUNJAL",
  "root.weight.caption": "WEIGHT",
  "root.weight.label": "웨이트 / Weight",
  "root.running.caption": "RUNNING",
  "root.running.label": "러닝 / Running",
  "root.homeWorkout.caption": "HOME WORKOUT",
  "root.homeWorkout.label": "홈트 / Home Workout",
  "root.myPlan.aria": "내 플랜 / My Plans",
  "root.profile.aria": "프로필 / Profile",
  "root.programInProgress": "오늘 {week}주 {day}일 / Today: Week {week} Day {day}",
  "chat.redirect.running": "러닝은 러닝 화면에서 더 정교한 프로그램이 가능해요. / Running has a dedicated program flow.",
  "chat.redirect.homeWorkout": "홈트는 홈트 화면에서 시작해주세요. / Start home workouts from the home workout screen.",
  "chat.redirect.cta.running": "러닝 화면으로 / Open Running",
  "chat.redirect.cta.homeWorkout": "홈트 화면으로 / Open Home Workout",
  "runningHub.title": "러닝 프로그램 / Running Programs",
  "homeWorkoutHub.title": "홈트레이닝 / Home Workout",
  "homeWorkoutHub.area.label": "부위 / Area",
  "homeWorkoutHub.duration.label": "시간 / Duration",
  "homeWorkoutHub.intensity.label": "강도 / Intensity",
  "homeWorkoutHub.start": "시작하기 / Start",
  "homeWorkoutHub.youtubeComing": "유튜브 운동 프로그램 곧 출시 / YouTube workout programs coming soon"
}
```
- 실제 키 형식은 기존 ko.json/en.json 컨벤션에 맞춰 분리 작성 ([feedback_i18n_always](../../memory/feedback_i18n_always.md))

---

## 7. 검증 체크리스트

### 기능
- [ ] 로그인 후 첫 화면이 `root_home` 카드 3장
- [ ] 하단 네비바 비노출 (root_home 한정)
- [ ] 우상단 [📋][👤] 아이콘 노출, 내플랜 dim/active 정상 분기
- [ ] 첫 카드 클릭 시 Onboarding 7스텝 등장 (목적 포함)
- [ ] 온보딩 완료 후 선택했던 카드로 자동 진입
- [ ] 두 번째 카드 클릭 시 온보딩 패스
- [ ] 웨이트 → ChatHome (러닝/홈트 칩 없음)
- [ ] ChatHome에서 "러닝 10km" 입력 → 안내 + 단일 "러닝 화면으로" 버튼
- [ ] 러닝 → 4프로그램 선택 → 기존 흐름 그대로
- [ ] vo2_boost 선택 시 5K 입력 단계 보존
- [ ] 홈트 → 부위/시간/강도 → planSession (bodyweight_only)
- [ ] 운동 흐름 종료 후 root_home 복귀
- [ ] proof/nutrition/my 탭 진입은 카드 진입 후에만 가능 (네비바)

### Kenko 디자인
- [ ] 카드: 흰 배경 + 얇은 보더 + 둥근 외곽
- [ ] colored container 0건 (배경 fill 박스/pill 뱃지 X)
- [ ] 영문 캡션 uppercase tracking-[0.18em] font-black
- [ ] amber 색 ROOT 화면 0건
- [ ] SVG 아이콘 의미 연결 명확 (덤벨/러너/매트)

### 회귀
- [ ] master_plan_preview / workout_session 동안 root_home 진입 차단
- [ ] 비로그인 체험 카운터 정상
- [ ] lastPlanSummary "이전 플랜 이어서" 동작 (ChatHome 또는 root_home에 표시 위치 결정 필요 — 1차는 ChatHome 유지)
- [ ] 프리미엄 배지/체험 카운터 노출 위치 — root_home 우상단 좌측? 1차는 ChatHome 진입 후에만 노출
- [ ] i18n ko/en 동시 갱신
- [ ] `npm run build` 성공
- [ ] `npm run lint` 통과

---

## 8. 결정 보류 항목 (PLAN 후 1차 구현 중 확정)

1. **"이전 플랜 이어서" 띠 위치** — root_home에 노출? ChatHome 안에만 유지? 1차는 ChatHome 안만 (대표 "버튼만" 지시 존중).
2. **체험/프리미엄 배지 위치** — root_home 헤더에 작게? 우상단 아이콘 옆? 1차 보류, ChatHome 진입 후 표시.
3. **카드 SVG 출처** — Figma Kenko UI Kit에서 export vs 신규 inline SVG. 1차는 inline 단순 stroke 아이콘으로 시작, Kit 자산 도착 시 교체.
4. **dynamic highlight** — 시간대/이력 기반 카드 강조. 1차 정적 동일 사이즈, 차후 회의.
5. **홈트 유튜브 진화** — placeholder만 1차, 본 구현은 별도 회의.

---

## 9. 리스크 / 롤백

### 리스크
- ChatHome 좁히기로 인한 자유 입력 가치 약화 (회의 62 "Manus 수준 답변") → parseIntent 시스템 프롬프트 재조정 + redirect 안내 카드로 보완
- Onboarding 카드 첫 클릭 트리거 시 마찰 1회성 → 7스텝이 너무 길면 후속 회의에서 압축 검토
- 영양 진입 1탭 깊어짐 → GA `nutrition_tab_view` 이벤트 추적해서 이탈률 변화 모니터링

### 롤백
- ViewState `root_home` 진입 분기에 환경변수 `NEXT_PUBLIC_ENABLE_ROOT_CARDS=0` 게이트 → 기존 home_chat 직진입으로 즉시 복귀 가능
- ChatHome 칩 제거는 별도 커밋으로 분리 → 단독 revert 가능

---

## 10. 분리 커밋 계획

[feedback_meeting_log + workflow.md 룰: 도메인별 분리 커밋]
1. `feat(root): ViewState root_home 추가 + RootHomeCards 컴포넌트 골격`
2. `feat(root): 카드 첫 클릭 → Onboarding 게이트 부활`
3. `feat(running-hub): RunningHub 화면 — 4프로그램 선택판 풀스크린화`
4. `feat(home-workout-hub): HomeWorkoutHub 화면 — bodyweight_only 진입판`
5. `refactor(chat-home): 러닝/홈트 의도 → redirect 안내 카드 + 칩 정리`
6. `feat(root): 우상단 내플랜/프로필 아이콘 동작 연결`
7. `chore(i18n): root_home 화면 ko/en 키 추가`
8. `docs: CURRENT_STATE.md ROOT 카드 섹션 + MEETING_LOG.md 회의 2026-04-27 기록`

`Co-Authored-By` 트레일러 금지 ([feedback_commit_attribution](../../memory/feedback_commit_attribution.md)).

---

## 11. 다음 단계

1. 대표 컨펌 → Phase A 시작 (ViewState + RootHomeCards 골격 + 라우팅)
2. Phase A 끝나면 화면 캡처 공유 → Kenko 톤 검증
3. OK면 Phase B~G 순차 진행
4. 마지막에 CURRENT_STATE.md + MEETING_LOG.md 갱신 (workout-music 5커밋 드리프트도 같은 패스에서 처리)
