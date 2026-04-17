# 회의록

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

