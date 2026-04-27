# PLAN-BEGINNER-MODE-PHASE-1 — 초보자 모드 MVP Phase 1 (벤치프레스 1종)

**작성일**: 2026-04-28
**Seed**: [SEED-001](seeds/SEED-001-beginner-mode.md) Phase 1 부분 distill
**범위**: 벤치프레스 1종 + Warmup 1단계 + Main 1단계 + 안전 보완 1·2 (휴식 90-120초 / 폼 cue 5줄)
**기간**: 1주 (5-6일 코드)
**검증 지표**: 완주율 ≥60% / 기구 찾기 CTA 클릭률 ≥60%
**컨벤션**: PLAN-ROOT-HOME-CARDS.md 패턴 따름 (GSD ROADMAP 미채용)

---

## 0. 코드 사전 조사

### 0.1 핵심 파일·라인

| 파일 | 역할 | 핵심 라인 (Phase 1 진입점) |
|---|---|---|
| `src/components/workout/FitScreen.tsx` | 운동 진행 핵심 (2283 라인) | L40 onSetComplete 콜백 / L919 target 분기 / L949 일반 분기 / L74 `restTimer` prop |
| `src/components/workout/WorkoutSession.tsx` | 세션 컨테이너 (663 라인) | L61 currentExerciseIndex / L98 currentExercise / L191 setComplete / L243 warmup/mobility 분기 / L269 다음 운동 전환 |
| `src/components/layout/Onboarding.tsx` | 7스텝 온보딩 (366 라인) | L32 `STEP_ORDER` (welcome→gender→birth_year→height→weight→goal→done) |
| `src/utils/personaSystem.ts` | Rising Beginner 자동 판정 (3회차) | 자동 모드 전환 후행 활용 (Phase 1 X) |
| `src/components/UnitToggle.tsx` | 공용 토글 패턴 | BeginnerModeToggle 시그니처 참고 |
| `src/constants/exerciseVideos.ts` | YouTube Shorts 매핑 | 신규 `exerciseEquipment.ts` / `formCues.ts` 패턴 참고 |

### 0.2 현재 isBeginner 상태

- **localStorage / state / Firestore 모두 부재** — grep 0건. 신규 도입.
- 페르소나 시스템(`personaSystem.ts`)은 별개 — "Rising Beginner" 자동 판정용. 모드 분기와 직접 연결 X (Phase 3에서 자동 전환 시그널로 활용).

### 0.3 보호해야 할 기존 기능

1. FitScreen 무게 picker / 세트 카운터 / 휴식 타이머
2. WorkoutSession 피드백 시스템 (easy/target/fail) → onSetComplete 분기
3. activeSessionPersistence (세션 복원)
4. 운동 흐름 보호: `master_plan_preview`/`workout_session` 동안 탭 전환 차단
5. exerciseVideos 매핑 (255+ YouTube Shorts) — 그대로 사용
6. 알람·진동 시스템 (`useAlarmSynthesizer`)

### 0.4 Phase 1 미포함 (Phase 2+ 이월)

- 자동 모드 전환 (Day 7 + 3회 완주 + "쉬움" 50%) → Phase 3
- 컴파운드 5종(스쿼트/데드/OHP/로우) → Phase 2
- Core/Cardio 안내 → Phase 3
- 대체 운동 순차 추천 → Phase 3
- 선형 진행/점진적 과부하 (±2.5kg, deload -10%) → Phase 2
- BeginnerGuideOverlay phase enum 8개 → Phase 1은 **enum 2개만** (warmup / main_equipment)

---

## 1. 결정 요약

| # | 결정 | 비고 |
|---|---|---|
| 1 | 모드 분기 키: `localStorage.ohunjal_beginner_mode` (`"1" \| "0"`) | Firestore 백업은 Phase 2 |
| 2 | 옵트인 진입: **온보딩 7스텝 끝난 직후 1회 모달** | "처음 헬스장 가시나요?" 2버튼 (네/아니요). 카드 클릭 진입 흐름 보호 (`pendingRootTarget` 그대로) |
| 3 | 프로필 탭 토글: MyProfileTab 신규 섹션 "초보자 모드" — UnitToggle 패턴 재사용 | 즉시 ON/OFF |
| 4 | BeginnerGuideOverlay 컴포넌트: `phase: "warmup_intro" \| "main_equipment"` enum 2개 | Phase 2에서 enum 확장 |
| 5 | EquipmentFinderCard: 벤치프레스 1장만 (`/public/equipment/bench-press.png`) | 사진 미준비 시 placeholder + "사진 준비 중" 캡션 |
| 6 | 폼 cue 5줄: SEED-001 박힌 ACSM/NSCA 인용본 그대로 | i18n ko/en 동시 |
| 7 | 휴식 시간: 컴파운드 90-120초 / fail 시 150-180초 | FitScreen `restTimer` 계산 로직 분기 (`isBeginner && exercise.equipment === "barbell"`) |
| 8 | 카피 룰 강제: "통증/부상" 부정 단어 X. "헤매지 않게/깔끔하게/정확하게" 긍정만 | `feedback_native_copy_frame` + SEED-001 룰 |
| 9 | 진입 조건: `isBeginner === true && currentExercise.name === "벤치프레스"` | Phase 1은 벤치만. 나머지 운동은 일반 모드로 폴백 |
| 10 | i18n 카피 신규: KO/EN 동시 ~12개 (모달 2 + 폼 cue 5 + 기구 카드 5) | `feedback_i18n_always` |

---

## 2. 와이어프레임

### 2.1 옵트인 모달 (온보딩 done 직후)

```
┌──────────────────────────┐
│                          │
│  처음 헬스장 가시나요?    │  ← 24px font-bold #1B4332
│                          │
│  헤매지 않게 기구 찾기부터│  ← 14px text-gray-600
│  무게 추천까지 안내해     │
│  드릴게요.               │
│                          │
│  ┌────────┐  ┌────────┐  │
│  │  네    │  │ 아니요  │  │  ← primary / secondary
│  └────────┘  └────────┘  │
│                          │
└──────────────────────────┘
```

- 진입: `localStorage.ohunjal_onboarding_done === "1"` set 직후 + `localStorage.ohunjal_beginner_mode === undefined`
- "네" → `localStorage.ohunjal_beginner_mode = "1"` → `pendingRootTarget` 진행
- "아니요" → `localStorage.ohunjal_beginner_mode = "0"` → `pendingRootTarget` 진행
- 1회만 노출. 이후 변경은 프로필 탭 토글

### 2.2 BeginnerGuideOverlay — phase: "warmup_intro" (Warmup 진입)

```
┌──────────────────────────┐
│  WARMUP                  │  ← 10px uppercase tracking-wide
│  스트레칭존 찾기          │  ← 28px font-black
│                          │
│  헬스장 입구에서 좌측에    │  ← 5줄 안내 (ACSM 표준)
│  매트가 깔린 공간이        │
│  보일 거예요. 거기로       │
│  가서 영상을 따라하면      │
│  완벽한 5분 워밍업.        │
│                          │
│  ┌────────────────────┐  │
│  │  [영상 따라하기]    │  │  ← primary CTA → 일반 운동 화면 진입
│  └────────────────────┘  │
└──────────────────────────┘
```

- 진입 트리거: `isBeginner && currentExercise.type === "warmup" && !overlayDismissed[index]`
- CTA 클릭 → overlay dismiss + 일반 FitScreen warmup 화면 진입
- "건너뛰기" 버튼 우상단 (text-gray-400) — 즉시 dismiss

### 2.3 BeginnerGuideOverlay — phase: "main_equipment" (벤치 진입)

```
┌──────────────────────────┐
│  EQUIPMENT               │
│  벤치프레스               │  ← 운동명
│                          │
│  ┌────────────────────┐  │
│  │                    │  │
│  │  [벤치 사진]        │  │  ← /public/equipment/bench-press.png
│  │                    │  │     (없으면 placeholder + "사진 준비 중")
│  └────────────────────┘  │
│                          │
│  찾는 법:                │
│  • 긴 벤치 + 거치대 세트 │  ← 5줄 (간결)
│  • 보통 자유 웨이트존 중앙│
│  • 바벨 양쪽에 플레이트  │
│  • 안전바 높이 확인       │
│  • 세이프티 핀 위치 체크  │
│                          │
│  폼 cue:                  │
│  1. 발 바닥 고정 (어깨너비)│  ← ACSM/NSCA 인용 5줄
│  2. 등 아래 약간 아치      │
│  3. 손목 곧게              │
│  4. 가슴 중앙으로 내리기   │
│  5. 팔꿈치 45도            │
│                          │
│  ┌────────────────────┐  │
│  │  [무게 설정 시작]   │  │  ← primary CTA → FitScreen 무게 picker
│  └────────────────────┘  │
└──────────────────────────┘
```

- 진입 트리거: `isBeginner && currentExercise.name === "벤치프레스" && !overlayDismissed[index]`
- 폼 cue는 운동 진행 중 화면에서도 작은 toggle ("폼 cue 보기")로 재호출 가능 — Phase 1은 단순화: overlay 1회만, 운동 화면 내 toggle은 Phase 2

### 2.4 프로필 탭 토글

MyProfileTab 신규 섹션 (기존 UnitToggle 섹션 아래):

```
┌──────────────────────────┐
│  초보자 모드              │  ← section header
│  기구 찾기 안내 + 폼 cue  │  ← 12px text-gray-500
│                  [● ON]  │  ← UnitToggle 패턴 재사용
└──────────────────────────┘
```

- ON ↔ OFF 즉시 반영 (`localStorage.ohunjal_beginner_mode`)
- 운동 진행 중 변경 무효 (`workout_session` view 가드)

---

## 3. 신규 파일

| 파일 | 역할 | 라인 추정 |
|---|---|---|
| `src/components/workout/BeginnerGuideOverlay.tsx` | overlay 공통 컴포넌트 (phase enum 2개) | ~150 |
| `src/components/workout/EquipmentFinderCard.tsx` | 기구 사진 + 5줄 안내 + 폼 cue 카드 | ~80 |
| `src/components/onboarding/BeginnerModeOptInModal.tsx` | 온보딩 done 직후 1회 모달 | ~60 |
| `src/constants/exerciseEquipment.ts` | 운동 → 기구 메타데이터 (Phase 1: 벤치 1종) | ~30 |
| `src/constants/formCues.ts` | 운동 → 폼 cue 5줄 (Phase 1: 벤치 1종) | ~40 |
| `src/utils/beginnerMode.ts` | localStorage helper (`getBeginnerMode` / `setBeginnerMode`) | ~30 |
| `public/equipment/bench-press.png` | 벤치 사진 (대표 큐레이션 대기) | — |

## 4. 수정 파일

| 파일 | 수정 내용 |
|---|---|
| `src/components/workout/FitScreen.tsx` | (a) BeginnerGuideOverlay 마운트 (warmup/벤치 분기) (b) `restTimer` 계산 분기 (벤치 + isBeginner → 90-120초) |
| `src/components/workout/WorkoutSession.tsx` | overlayDismissed state (per-exercise) + currentExercise 변경 시 reset |
| `src/components/layout/Onboarding.tsx` | onComplete 직후 BeginnerModeOptInModal 트리거 (콜백 추가) |
| `src/app/app/page.tsx` | Onboarding onComplete 콜백에 모달 표시 로직 추가 + BeginnerModeOptInModal 렌더 |
| `src/components/profile/MyProfileTab.tsx` | "초보자 모드" 섹션 추가 (UnitToggle 패턴) |
| `src/locales/ko.json` + `src/locales/en.json` | 신규 키 ~12개 (모달 / overlay / 폼 cue / 토글 라벨) |

---

## 5. 작업 분해 (5-6일 / 단계별 분리 커밋)

| Day | 작업 | 파일 | 검증 |
|---|---|---|---|
| 1 | 데이터 계층: `beginnerMode.ts` + `exerciseEquipment.ts` + `formCues.ts` (벤치 1종) + i18n 키 추가 | 신규 3 + locales 2 | unit test (vitest) `beginnerMode.test.ts` |
| 2 | UI 컴포넌트: BeginnerGuideOverlay + EquipmentFinderCard + BeginnerModeOptInModal | 신규 3 | Storybook 없음 → /app 내 토글 ON 후 수동 진입 |
| 3 | 통합 1: Onboarding onComplete → 모달 트리거 + page.tsx 렌더 + MyProfileTab 토글 | 수정 3 | E2E: 신규 유저 → 온보딩 완주 → 모달 노출 / 토글 ON↔OFF 반영 |
| 4 | 통합 2: FitScreen overlay 마운트 (warmup + 벤치 분기) + WorkoutSession overlayDismissed state | 수정 2 | E2E: 벤치 포함 운동 생성 → warmup 카드 → main 카드 → 일반 흐름 |
| 5 | 휴식 시간 분기: FitScreen `restTimer` 90-120초 (벤치 + isBeginner) + 카피 정합성 점검 + i18n 동시 검증 | 수정 1 | 벤치 세트 완료 → 90-120 카운트다운 / fail → 150-180 |
| 6 (예비) | 평가자 grep 검증 + 빌드 + lint + 회귀 테스트 + 분리 커밋 정리 | — | `npm run build` + `npm run lint` + `npm run test` 전부 통과 |

**커밋 단위 (분리):**
- `feat(beginner-mode): 데이터 계층 + helper + i18n` (Day 1)
- `feat(beginner-mode): Overlay/Modal 컴포넌트 3종` (Day 2)
- `feat(beginner-mode): 온보딩 옵트인 + 프로필 토글 통합` (Day 3)
- `feat(beginner-mode): FitScreen overlay 진입 로직 (warmup + 벤치)` (Day 4)
- `feat(beginner-mode): 휴식 시간 분기 + 카피 정합성` (Day 5)
- `chore(beginner-mode): 빌드/린트 통과 + 회귀 점검` (Day 6, 변경 있을 때만)

---

## 6. UAT 기준 (verify-work)

**Must pass (Phase 1 출시 게이트):**

1. ✅ 신규 유저 온보딩 완주 → BeginnerModeOptInModal 1회 노출 → "네" 선택 시 `localStorage.ohunjal_beginner_mode === "1"`
2. ✅ "아니요" 또는 모달 dismiss 시 `"0"` 저장. 재방문 시 모달 미노출
3. ✅ 프로필 탭 → 초보자 모드 토글 ON ↔ OFF 즉시 반영. 새로고침 후 유지
4. ✅ isBeginner=ON + 벤치 포함 운동 → warmup 운동 진입 시 BeginnerGuideOverlay (warmup_intro) 노출
5. ✅ isBeginner=ON + 벤치 차례 진입 → EquipmentFinderCard (벤치 사진 + 5줄 안내 + 폼 cue 5줄) 노출
6. ✅ overlay "건너뛰기" 클릭 → 일반 FitScreen 즉시 진입. 같은 운동 같은 세션에서 재노출 X
7. ✅ overlay CTA 클릭 → 일반 FitScreen 무게 picker 진입
8. ✅ isBeginner=ON + 벤치 세트 완료 (target) → 휴식 90초 카운트다운
9. ✅ isBeginner=ON + 벤치 세트 fail → 휴식 150초 카운트다운
10. ✅ isBeginner=OFF → overlay 0건 노출. 휴식 시간 기존 값 유지 (회귀 X)
11. ✅ 벤치 외 운동 (스쿼트/덤벨컬 등) → overlay 노출 X (Phase 1 범위)
12. ✅ i18n KO/EN 양쪽 동일 흐름 동작. 신규 키 누락 0건
13. ✅ `npm run build` + `npm run lint` + `npm run test` 전부 통과
14. ✅ 운동 흐름 보호: workout_session 진행 중 토글 변경 무효

**측정 지표 (Phase 1 종료 후 1주):**
- 완주율 ≥60% (초보자 모드 ON 유저 운동 시작 → 리포트 도달률)
- 기구 찾기 CTA 클릭률 ≥60% (EquipmentFinderCard 노출 → "무게 설정 시작" 클릭률)

---

## 7. 리스크 + 완화

| 리스크 | 완화 |
|---|---|
| **벤치 사진 부재** | placeholder + "사진 준비 중" 캡션. 사진 추가는 별도 커밋. UI 흐름은 사진 없이도 동작 |
| **FitScreen 2283라인 추가 분기로 더 비대** | overlay 진입 로직만 추가 (10-20라인). mega-component 분해는 후행 (SEED-001 Notes 참조) |
| **운동 흐름 보호 깨짐** | overlay는 modal 패턴 (z-index 높지만 view state 변경 X). workout_session view 그대로 유지 |
| **i18n 누락 (자주 발생)** | Day 1에 키만 먼저 추가하고 Day 2 컴포넌트 작성 시 참조. `feedback_i18n_always` 강제 |
| **카피 부정 단어 (자주 발생)** | "통증/부상/위험" 검색 grep 으로 PR 전 점검. SEED-001 카피 룰 박힘 |
| **온보딩 완주 흐름 회귀** | Onboarding.tsx 수정은 onComplete 콜백 한 줄만. STEP_ORDER 변경 X |
| **자동 모드 전환 페르소나 시스템 충돌** | Phase 1은 자동 전환 X. personaSystem.ts 건드리지 않음 |

---

## 8. 회의 / 자문 / 메모리 룰

**필수 적용 룰 (PR 전 평가자 grep 검증):**

- `feedback_evaluator_strict` + `feedback_evaluator_render_trace` — 매 단계 코드 실제 grep
- `feedback_confirm_before_implement` — 본 PLAN 컨펌 후 Day 1 진입
- `feedback_meeting_log` — 회의 2026-04-28-δ 후속 결정 시 MEETING_LOG 기록
- `feedback_source_grounded_opinions` — 폼 cue / 휴식 시간 출처 (ACSM/NSCA) 박기
- `feedback_no_emoji` — 이모지 0건
- `feedback_native_copy_frame` — KO/EN 카피 현지 광고 문법
- `feedback_i18n_always` — ko.json / en.json 동시
- `feedback_no_decorative_svg` — Equipment 카드 사진 외 장식 SVG X
- `feedback_product_positioning` — UI 카피에 "사진 준비 중" 외 마이너스 노출 X
- `feedback_commit_attribution` — Co-Authored-By Claude 트레일러 X
- `share-card.md` — 본 phase는 ShareCard 미수정 (참고만)

---

## 9. Open Questions (Day 1 진입 전 컨펌)

1. **벤치 사진** — 대표가 직접 헬스장 가서 1-2장 촬영? 아니면 placeholder로 진행 후 사진 합류?
2. **옵트인 모달 시점** — 온보딩 done 직후 즉시 (현 plan) vs 첫 카드 클릭 후 ROOT 진입 시점?
3. **자동 모드 전환** — Phase 1에 단순 버전 (3회 완주 + "쉬움" 50% → 토스트 "일반 모드 어때요?") 포함 vs Phase 3 이월 (현 plan)?
4. **EquipmentFinderCard 폼 cue 인-운동 toggle** — Phase 1 포함 vs Phase 2 이월 (현 plan)?

> 컨펌 후 Day 1 진입. 미컨펌 시 현 plan 기본값 진행.

---

## 10. Out of Scope (Phase 2+ 명시)

- 컴파운드 5종 (스쿼트/데드/OHP/로우)
- Core/Cardio 안내
- 대체 운동 순차 추천
- 선형 진행 / 점진적 과부하 (±2.5kg, deload -10%)
- 자동 모드 전환 (Day 7 + 페르소나)
- BeginnerGuideOverlay phase enum 8개 확장
- "헤매지 않는 헬스장 가이드" 랜딩 카피 재작성
- Paddle Live 글로벌 차별화 마케팅
- mega-component (FitScreen) 분해
- Firestore 백업 (`isBeginner` 서버 동기화)

---

**Status:** draft — 대표 컨펌 + Open Questions 4건 답변 후 Day 1 진입.
