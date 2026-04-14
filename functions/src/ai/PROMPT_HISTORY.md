# Coach Prompt Version History

프롬프트 변경 이력. 문제 발생 시 이전 버전으로 롤백 가능.

---

## running_v1 (2026-04-06) — 러닝 세션 전용 프롬프트 (회의 41)
- **웨이트 프롬프트 v5와 독립 이터레이션**. `runningStats` body에 포함되면 웨이트 프롬프트 전체 오버라이드.
- 입력 데이터: runningType, distance(m), duration(s), avgPace/sprintAvgPace/recoveryAvgPace/bestPace (sec/km), intervalRounds[], completionRate, isIndoor, gpsAvailable
- **포맷 강제 규칙:**
  - 페이스: `4:32` (m:ss). "4분 32초" 풀어쓰기 금지
  - 거리: `2.43km`. "킬로미터" 풀어쓰기 금지
  - 데이터에 없는 숫자 생성 금지 (할루시 방지)
- **3버블 구조:**
  1. 감정 공감 + 완주 칭찬 + 러닝 타입 1회 언급
  2. 세션 데이터 한 가지 인상적 지표 (전력/회복 격차, 페이스 변화, 라운드 패턴)
  3. 내일 조언. **스프린트/파틀렉은 48시간 회복 강제 권고** (재활의학 권고)
- **조건부 브랜치:**
  - `isIndoor`: 거리/페이스 언급 금지, 라운드/시간 중심
  - `!gpsAvailable && !isIndoor`: 거리/페이스 언급 금지
- 허용 용어: LSD, 템포, 인터벌, 스플릿, 라운드 (러너 문화)
- 금지: 의학 용어(심박, 젖산, 무릎, 발목), 체중/외모, "화이팅", 이모지
- **Fallback (Gemini 실패 시):** `buildRunningFallback()` — 완주율/강도/실내 여부에 따른 룰베이스 3버블

## v5 (2026-04-04) — 대표님 예시 + 트렌드
- few-shot 예시 5개를 대표님 직접 작성 톤으로 교체
- "득근득근", "ㅠㅠ", "캬!", "붙습니다잉!" 등 생생한 구어체
- 한글 이모티콘(ㅎㅎ, ㅠㅠ) 명시적 허용
- 한국 유행 트렌드 자연스럽게 언급 허용
- 성별 기반 표현 분기

## v4 (2026-04-04) — 자유도 + 울타리 방식
- 선택지(A/B/C/D) 제거, 자유 가이드라인
- "절대 하지 마" 울타리 16개
- few-shot 예시 5개
- 계절/날씨 컨텍스트 추가
- 기상청 API 연동 준비 (KMA_API_KEY)

## v3 (2026-04-04) — 다양성 확대 + 날씨
- 2번째 버블 4가지 선택지 (디테일/성장관찰/운동팁/자기성찰)
- 3번째 버블 5가지 선택지 (조언/날씨/동기부여/일상/기대감)
- 계절 기반 날씨 컨텍스트

## v2 (2026-04-04) — Gemini 전환 + 3버블
- 룰베이스 → Gemini 2.5 Flash 전환
- 3버블 순차 대화 구조
- 전우애 톤 ("같이 해서 뿌듯", "저도 긴장했어요")
- 세션 로그 분석 (실패/성공/무게변화)
- 5초 타임아웃 + 룰베이스 폴백

## v1 (2026-04-04) — 룰베이스 150개 풀
- 장비별 분류 (barbell/dumbbell/kettlebell/machine/bodyweight/running)
- 렙수 구간별 (저/중/고렙)
- 시간대별 (새벽/점심/저녁/심야)
- 세션 날짜 시드 랜덤 선택
- coachMessages.ts 파일 기반

## parseIntent v1 (2026-04-15, 회의 57)

**파일:** `functions/src/ai/parseIntent.ts`

**목적:** 채팅형 홈 진입 — 유저 자연어 → planSession 파라미터 JSON.

**모델:** gemini-2.5-flash, temperature 0.2 (추출 결정성 우선), responseMimeType=application/json

**추출 스키마:** condition{bodyPart, energyLevel, availableTime, bodyWeightKg?, gender?, birthYear?}, goal, sessionMode, targetMuscle?, runType?, intensityOverride?, recentGymFrequency?, pushupLevel?, confidence, missingCritical, clarifyQuestion?

**핵심 규칙:**
1. 누락 필드 중립 기본값 (energyLevel=3, bodyPart="good", sessionMode="balanced", goal="general_fitness")
2. 기존 프로필 컨텍스트 제공 시 대화에 없는 gender/birthYear/bodyWeightKg는 그 값 사용
3. 나이("35살") → (현재 연도) - 나이 = birthYear
4. availableTime 스냅: running+long만 30/50/90, 그 외 30/50 (60+ 요청도 50 캡, 과훈련 방지)
5. bodyPart 키워드 매핑: 어깨/목/허리 뻐근 → upper_stiff, 다리 무거움 → lower_heavy, 전신 피로 → full_fatigue, 그 외 → good
6. sessionMode: 러닝 → running, 홈트 → home_training, 특정 부위 하나 → split, 그 외 → balanced
7. pushupLevel: 0개 → zero, 1~5 → 1_to_5, 10+ → 10_plus
8. recentGymFrequency: 안 함 → none, 가끔 → 1_2_times, 꾸준히/경력 → regular
9. 모호하면 clarifyQuestion 1개로 되묻기

**Fallback:** JSON parse 실패 / Gemini 예외 시 `buildFallbackIntent()` — 안전 중립값 + clarifyQuestion.

**후처리 sanitize():** Gemini가 enum 밖 값 내더라도 방어적 스냅. availableTime 90은 long run 아니면 50으로 다운캡.

**입력 예시 3종 (수동 테스트 기준):**
- 짧은: `"오늘 가슴 30분"` → sessionMode=split, targetMuscle=chest, availableTime=30, confidence≈0.7
- 중간: `"어깨 뻐근한데 하체 40분 체력은 보통"` → bodyPart=upper_stiff, targetMuscle=legs, availableTime=50, confidence≈0.9
- 긴: `"35살 여 162cm 58kg 헬스 3년 정자세 푸쉬업 5개 오늘 하체 40분 살 빼고 싶어"` → gender=female, birthYear=1991, bodyWeightKg=58, goal=fat_loss, pushupLevel=1_to_5, recentGymFrequency=regular, confidence≈0.98
