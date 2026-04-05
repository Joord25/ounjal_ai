# 회의록

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
