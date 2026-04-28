---
id: SEED-001
status: active — **Phase 1.5 코드 완료 + 본인 폰 검증 정정 5건 + B-5 워크아웃 툴팁 (회의 ζ-2 2026-04-28). 측정 지표 1주 누적 후 Phase 2 진입 결정**
planted: 2026-04-28
planted_during: 회의 2026-04-28-δ (Paddle Live 검증 트랙 진행 중)
phase_1_completed: 2026-04-28 (회의 ε, PLAN-BEGINNER-MODE-PHASE-1.md)
phase_1_5_planned: 2026-04-28 (회의 ζ, PLAN-BEGINNER-MODE-PHASE-1-V2.md — Pajak 영입 + Walter 역할 분담)
phase_1_5_completed: 2026-04-28 (회의 ζ-2 — 본인 폰 검증 후 정정: 뒤로가기 / 한 세션 1회 / 튜토리얼 풀스크린 폐기 → 워크아웃 툴팁 / chat_weight 폐기 / B-5 추가)
trigger_when: Paddle Live 본인 카드 검증 통과 + 콘텐츠(기구 사진 1-2장) 준비 완료
scope: Large
---

# SEED-001: 초보자 모드 — 헬스장 헤매지 않게 안내 시스템

## Why This Matters

오운잘의 진짜 차별 무기. ChatGPT/Apple Fitness+/Stronglifts/Strong 어느 곳도 안 주는 가치 — "헬스장에서 기구 어떻게 쓰는지 + 다음 단계 자동 진행" 의 통합. 본인이 트레이너+개발자라 콘텐츠와 코드 동시 만질 수 있는 유일한 위치([memory:user_trainer_founder]).

### 페르소나 (Seth Godin "최소 유효 시장")

> "의욕은 넘쳐서 헬스장 등록은 했지만, 막상 가면 런닝머신만 타다가 눈치 보며 집에 돌아오는 2030 직장인"

**욕망(Ego):** 보디빌더 X. **"바쁜 일상 속에서도 주 3회 헬스장에서 헤매지 않고 깔끔하게 내 할당량을 채우고 샤워실로 향하는 갓생러"** 정체성.

**메시지:** "오늘 컨디션만 입력하세요. 헬스장 입구에서부터 씻고 나갈 때까지, 뇌를 빼고 따라만 하면 되는 완벽한 통제권(커맨드 모드)을 쥐여 드립니다."

> ⚠ 카피 룰: "통증 없이" / "부상 위험" 같은 부정 단어 X. 긍정 위주 — "헤매지 않게", "깔끔하게", "정확하게" (대표 결정 2026-04-28-δ).

### 시장 시점
- 한국 헬스장 회원 350만 추정, 월 1회 이상 = 약 70만, 그 중 "기구 헤매는 초보" = 21~28만 → Seth Godin "최소 유효 시장" 5만+ 충족
- 글로벌 (Paddle Live 후) — 유럽/미국 헬스장 초보자 시장 추가
- 이탈률 60-70% 잡히면 LTV 직격타

---

## When to Surface

**Trigger 조건:**
- ✅ Paddle Live 본인 카드 실거래 검증 통과 (회의 2026-04-28-α/γ 후속)
- ✅ 본인 헬스장 사진 1-2장 (바벨 벤치 프레스 (Barbell Bench Press) + 컴파운드 1종) 준비 완료
- ✅ 현재 진행 트랙 (러닝/홈트 ROOT 카드 + 카피 정합성) 안정화

`/gsd:new-milestone` 실행 시 다음 milestone 스코프와 매칭되면 surface:
- "차별화 무기 / 핵심 기능 강화" 영역
- "초보자 / 입문자 / 헬스장" 키워드 milestone
- "콘텐츠 + 코드 통합" milestone
- "글로벌 출시 (Paddle Live)" 후속 milestone

---

## Scope Estimate

**Large** — 12-15일 코드 + 별도 콘텐츠 트랙 (기구 사진 큐레이션) + 4 phase MVP 단계. 새 milestone 1개 통째 가치.

### MVP Phase 1~4

| Phase | 기간 | 범위 | 검증 지표 |
|---|---|---|---|
| Phase 1 | 1주 | 벤치 1종 + warmup 1단계 + main 1단계 + 안전 보완 1·2 (휴식 90-120/폼 cue 5줄) | 완주율 ≥60% / 기구 찾기 CTA 클릭률 ≥60% |
| **Phase 1.5** (신규, 회의 ζ) | **4-5일** | **Walter+Pajak 학습 흐름 / 친밀 톤 보강 — 채팅형 무게 픽커 + scaffolding 미리보기 + cue 헷갈림 self-check + fail 격려 3줄** | **warmup→main 이탈률 -30% / 무게 픽커 → 첫 세트 시작률 ≥80% / fail → 다음 세트 진입률 ≥75%** |
| Phase 2 | 2-3주 | 컴파운드 5종 (벤치/스쿼트/데드/OHP/로우) + warmup/main 풀 + 선형 진행 + 점진적 과부하 | Day 3+ 재사용 ≥50% |
| Phase 3 | 4-6주 | 보조 근육 15종 + Core/Cardio + 대체운동 순차 추천 + 모드 분기 정식 노출 | 3주 연속 운동 ≥40% |
| Phase 4 | 출시 | "헤매지 않는 헬스장 가이드" 랜딩 재작성 + Paddle Live 글로벌 차별화 | 초보자 모드 ON vs OFF DAU 유지율 |

### 작업 분해 (8개)
| # | 작업 | 난이도 | 예상 |
|---|---|---|---|
| 1 | 모드 분기 (isBeginner localStorage + Firestore 백업) | 쉬움 | 1일 |
| 2 | BeginnerGuideOverlay 공통 컴포넌트 (phase enum 8개) | 중간 | 2-3일 |
| 3 | Warmup phase 안내 (스트레칭존 → 영상 → 완료) | 중간 | 2일 |
| 4 | Main phase 안내 (기구 사진 → 무게 → 영상 → 폼 cue → 피드백 → 휴식) | 큼 | 4-5일 |
| 5 | Core/Cardio (Main 재사용 + 스킵) | 작음 | 1-2일 |
| 6 | 대체 운동 순차 추천 (1개씩, 선택지 X) | 작음 | 1일 |
| 7 | **콘텐츠 큐레이션 — 기구 사진 (별도 트랙)** | 매우 큼 | 2-3주 (병렬) |
| 8 | i18n KO/EN 카피 ~50개 | 작음 | 1일 |

**총 코드:** 12-15일 / 1인. **콘텐츠:** 별도 트랙 (기구 사진 핵심 컴파운드 5종 + 머신 5종 = 10장 우선).

---

## 핵심 기능 설계

### 모드 분기
- Onboarding 직후 옵트인 ("처음이에요 / 조금 / 꽤 해봤어요")
- 프로필 탭 토글 (수동 전환)
- 자동 전환: Day 7 + 3회 완주 + "쉬움" 피드백 50% → 일반 모드 제안

### 초보자 모드 흐름
**Warmup:** 스트레칭존 안내(5줄 카피) → 영상 따라하기 → 완료
**Main (기구):** 기구 사진 카드(5줄 안내) → 무게 추천(이전 기록 + 1RM 자동) → 영상 → 폼 cue 5줄 → 실행 → 피드백(easy/target/fail) → 자동 조정 + 휴식
**Core/Cardio:** Main 패턴 재사용 + 스킵 가능

### 대체 운동 (Hick's Law 준수)
- 선택지 X. **1개씩 순차 추천** — "또 다른 거?" → 다음 1개 → 끝까지
- 자문단 권장 운동 우선순위 (안전성 + 부위 매칭)

### 폼 cue 예시 (Phase 1 벤치 기준, ACSM/NSCA)
- 발은 바닥에 고정, 어깨너비
- 등 아래 약간 아치 (큰 동전 정도)
- 손목 곧게 (손등 일직선)
- 바벨은 가슴 중앙(유두선)으로 내리기
- 팔꿈치 45도 — 너무 벌리면 어깨 부상

---

## 안전성 보완 (운동과학 자문 권장 4건)

| # | 항목 | 출처 | 적용 Phase |
|---|---|---|---|
| 1 | 휴식 시간 60→90-120초 (컴파운드) / fail 시 150-180초 | ACSM Guidelines 11th, ch.7 — Resistance Training | Phase 1 필수 |
| 2 | 운동별 폼 cue 5줄 (벤치/스쿼트/데드/OHP/로우) | NSCA Essentials of Strength Training 2nd Ed. | Phase 1 필수 (벤치만) |
| 3 | 선형 진행 + 점진적 과부하 (피드백 기반 ±2.5kg / 3주 fail 연속 시 deload -10%) | StrongLifts 5x5, Starting Strength | Phase 2 |
| 4 | Core 배치 재검토 (Main 직후 X, Main 중간 또는 마지막 옵션) | NSCA periodization 표준 | Phase 2-3 |

---

## 자문단 (출처 박힌 정식 소환)

**core-team (자동 참석):** 대표 / 기획자 / 평가자 / 프엔 / 백엔드(Phase 4)

**weight-training:**
1. 건강운동관리사 (15년) — 초보자 프로그램·안전 범위
2. 물리치료사 (20년+) — 스트레칭/워밍업·부상 예방
3. 국가대표 운동코치 (20년) — 새 운동 추가·주기화

**product:**
4. UX/UI 디자이너 — BeginnerGuideOverlay 새 화면 / V2 sequencer 컴포넌트 설계 (Aaron Walter 보조)
5. 그로스 마케터 — 옵트인 전환율·자동 모드 전환 시점
6. 콘텐츠 MD — 카드 시스템 문구 (찾는 법 vs 사용법 분리, 회의 ζ-walter 결정)
7. 카피라이터 — "갓생러" 메시지 + KO/EN 카피 + 친절 피드백 톤 (Stronglifts 5x5 첫 세션 가이드 차용)

**보조 레퍼런스 (회의 ζ-walter 도입):** Duolingo onboarding (Vesselinov & Grego 2012) / Apple Fitness+ 오디오 코치 / Stronglifts 5x5 (Mehdi Hadim) / Raph Koster *A Theory of Fun for Game Design* (Paraglyph, 2004)

**learning-flow / emotion (회의 ζ 정식 영입, Phase 1.5+ 적용):**
8. **Aaron Walter (보조 자문, 1차: 톤·감정 카피)** — Walter, A. (2011). *Designing for Emotion*. New York: A Book Apart. **ISBN 978-1-9374-5712-0**. Ch.3 "Emotional Engagement" / Ch.5 "Personality" / Ch.6 "Engagement". 시스템 1인칭 톤 / 캐릭터 친밀감 (마스코트 X, Freddie 패턴) / micro-copy 감정 카피. 보조 자료: MailChimp Voice & Tone Guide (mailchimp.com/voice-and-tone) / "Personality in Design" UX London 2012 강연
9. **Bozena Pajak (의장, 1차: 학습 흐름 설계)** — Duolingo VP of Learning & Curriculum, PhD Linguistics (Northwestern). 학습 흐름 단계 설계 / scaffolding (단계별 도움 점진 감소) / immediate corrective feedback / low-stakes practice + encouragement / spaced repetition.
   - Pajak, B., Bicknell, K., & Settles, B. (2017). *A practical approach to language complexity: a Wikipedia case study*. **PLoS ONE 12(11): e0185682**. DOI: 10.1371/journal.pone.0185682 — https://doi.org/10.1371/journal.pone.0185682
   - Pajak, B. & Levy, R. (2014). *Inductive biases for second language learning*. **Cognitive Psychology 75: 18-46**
   - Settles, B. & Meeder, B. (2016). *A Trainable Spaced Repetition Model for Language Learning*. ACL 2016 (Pajak Duolingo 동료 논문, half-life regression 모델)
   - Duolingo Blog (URL): "How we use experiments to inform design decisions" (2021) / "Designing Duolingo Streak" (2020) — blog.duolingo.com
   - ACTFL 2019 발표: "Adaptive feedback in computer-assisted language learning"
   - **운동 도메인 적용 한계:** Pajak 영역 = 언어 학습 / 본 케이스 = 신체 운동 학습. 학습 흐름 패턴 (scaffolding / immediate feedback / low-stakes) 자체는 도메인 독립 (회의 ζ 합의), 단 카피 ("X% accuracy" 같은 정답률 표현) 운동 맥락 변형 필수

**역할 분담 (회의 ζ):**
- **Pajak (의장):** 학습 흐름 단계 설계 1차 의사결정 권위
- **Walter (보조):** 톤·감정 카피 영역만 1차 권위, 학습 흐름은 Pajak 의장에 1차 권한 위임
- **운동과학 (1차: 수치):** ACSM 11th Ed. (ISBN 978-1-9751-5009-5) / NSCA 4th Ed. (Haff & Triplett eds., 2016, ISBN 978-1-4925-0162-6). **NSCA 정정:** 기존 "2nd Ed" 표기는 현재 표준 4th Ed 로 정정 (대표 지시 2026-04-28)
- 자세한 매핑은 [PLAN-BEGINNER-MODE-PHASE-1-V2.md](../PLAN-BEGINNER-MODE-PHASE-1-V2.md) §8

**편입 검토 (대표 승인 시):** Greg Nuckols (Stronger by Science) / Brad Schoenfeld (CUNY Lehman, hypertrophy 연구) / Mike Israetel (Renaissance Periodization).

---

## Breadcrumbs (관련 코드/문서)

- [src/components/workout/FitScreen.tsx](../../src/components/workout/FitScreen.tsx) — 운동 진행 핵심 (2283 라인). BeginnerGuideOverlay 진입 지점 line 1244 근처
- [src/components/workout/WorkoutSession.tsx](../../src/components/workout/WorkoutSession.tsx) — 세션 관리 + 피드백 시스템 + activeSessionPersistence
- [src/constants/workout.ts](../../src/constants/workout.ts) — LABELED_EXERCISE_POOLS (운동 풀)
- [src/constants/exerciseVideos.ts](../../src/constants/exerciseVideos.ts) — YouTube Shorts 매핑 (255+ 운동) — 신규 exerciseEquipment.ts/formCues.ts 패턴 참고
- [src/utils/personaSystem.ts](../../src/utils/personaSystem.ts) — Rising Beginner 페르소나 자동 판정 (3회차)
- [src/components/dashboard/HomeWorkoutHub.tsx](../../src/components/dashboard/HomeWorkoutHub.tsx) — bodyweight_only 진입 패턴 참고
- [src/components/UnitToggle.tsx](../../src/components/UnitToggle.tsx) — 공용 토글 컴포넌트 패턴 (BeginnerModeToggle 참고)
- [src/app/app/page.tsx](../../src/app/app/page.tsx) — ViewState 라우팅
- [.planning/CURRENT_STATE.md](../CURRENT_STATE.md) — 현재 앱 인벤토리 SSOT
- [.planning/MEETING_LOG.md](../MEETING_LOG.md) — 회의 2026-04-28-δ 등록 예정
- [.planning/advisors/weight-training.md](../advisors/weight-training.md) — 자문단 7명 출처
- [.planning/advisors/product.md](../advisors/product.md) — 자문단 출처

---

## 신규 파일 예정

- `src/components/workout/BeginnerGuideOverlay.tsx` — 안내 화면 공통 (phase enum 8개)
- `src/components/workout/EquipmentFinderCard.tsx` — 기구 사진 + 안내 카드
- `src/constants/exerciseEquipment.ts` — 운동 → 기구 매핑
- `src/constants/formCues.ts` — 운동 → 폼 cue 5줄
- `public/equipment/*.png` — 기구 사진 (사용자 큐레이션, 배경 제거)

---

## Notes

### 진행 시 강제 룰
- **[memory:feedback_evaluator_strict]** + **[memory:feedback_evaluator_render_trace]** — 매 phase 평가자 코드 grep 검증
- **[memory:feedback_confirm_before_implement]** — 설계 컨펌 후 구현
- **[memory:feedback_meeting_log]** — 매 결정 MEETING_LOG 기록
- **[memory:feedback_source_grounded_opinions]** — 자문단 출처(저서/논문) 박기
- **[memory:feedback_no_emoji]** — 이모지 X
- **[memory:feedback_native_copy_frame]** — KO/EN 현지 광고 문법 1차
- **[memory:feedback_user_attention_span]** — 1개월 한계 → Day 7 자동 모드 전환

### 회귀 테스트 + 평가자 책임
- 각 phase 완료 시 평가자가 코드 실제 grep 으로 정합성 검증
- 기획 이탈 즉시 차단 (gsd:plan-checker 자동)
- UAT 기반 검증 (gsd:verify-work)
- 분리 커밋 — 작업 단위(8개 분해 표) 별로 분리

### mega-component 분해 결정
- FitScreen(2283 라인) 분해는 후행
- BeginnerGuideOverlay 별도 컴포넌트로 시작 (병행 권장)
- 후속 milestone 에서 FitScreen 분해 검토

### 회의 기록
- 회의 2026-04-28-δ — 초보자 모드 비전 확정 + 3 자문 종합 (기획자/평가자/운동과학)
- 회의 2026-04-28-ε — Phase 1 코드 5일 완료 (Day 1~6 분리 커밋, UAT 14건)
- 회의 2026-04-28-ζ — Phase 1.5 plan-V2 작성. **Bozena Pajak 자문단 정식 영입** + Aaron Walter 와 역할 분담 명확화. 5 갭 → 처방 매핑 (scaffolding / immediate feedback / low-stakes practice / Freddie 패턴 / Duolingo "X% accuracy" 격려). 마스코트 도입 X, 시스템 1인칭 톤 채용
- 자문 보고에서 발견된 일부 부정확 인용은 GSD plan-phase 진입 시 정식 자문단(9명) 출처(ACSM/NSCA/Walter/Pajak) 박힌 RESEARCH.md 로 대체

### 우선순위 콘텐츠 (사용자 직접 큐레이션)
**Phase 1:** 바벨 벤치 프레스 (Barbell Bench Press) 기구 1-2장
**Phase 2 (10장 우선):**
- 컴파운드 5: 플랫 벤치+바벨거치대 / 스쿼트 랙 / 바벨+플레이트 / 오버헤드 거치 / 바벨로우 셋업
- 머신 5: 케이블(렛풀다운 위치) / 시티드 로우 / 레그프레스 / 덤벨 거치대 / 케이블 머신 듀얼풀리

**촬영 가이드:** 정면 또는 측면 / 빈 기구 상태 (사람·무게 X) / 단색 벽 배경 권장 / 1024×1024 / remove.bg 로 배경 제거

---

**Status:** active — Phase 1 코드 완료 (2026-04-28-ε). **Phase 1.5 plan-V2 컨펌 완료 (2026-04-28-ζ, Pajak 의장 영입 반영 + 대표 컨펌 7건 일괄 적용 = Q1 mode prop / Q2 마스코트 Phase 2 이월 / Q3 카피만 변경 / Q4 dismissedOverlays 제거 / Q5 Phase 1.5 = 벤치만 / Q6 hour 추정+buffer 1일 / Q7 평가자 책임 §0.5).** Day 7 코드 진입 준비 완료. PASS 5 / FLAG 5 / FAIL 0.
