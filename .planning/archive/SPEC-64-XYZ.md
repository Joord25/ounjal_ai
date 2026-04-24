# SPEC-64-XYZ — Day-1 구현 스펙 (회의 64-X/Y/Z 통합)

**작성일**: 2026-04-19
**기획자**: Planner Agent (오운잘 앱 Day-1 구현 스프린트)
**관련 회의**: 64-X (러닝 → 체력 축 반영), 64-Y (runType 8종 재분류 + 마이그레이션), 64-Z (거리 도달 자동 신호)
**출력 위치**: `/Users/joord/Desktop/Joord/ohunjal-ai/.planning/SPEC-64-XYZ.md`

---

## 0. 코드 사전 조사 결과 (Planner 직접 확인)

| 항목 | 결과 | 위치 |
|---|---|---|
| `RunningType` 정의 | `"walkrun" \| "tempo" \| "fartlek" \| "sprint" \| "easy" \| "long"` (6종) | `src/constants/workout.ts:103` |
| `IntervalSpec` 정의 | `rounds/sprintSec/recoverySec/sprintDist/recoveryDist/sprintLabel/recoveryLabel/paceGuide` | `src/constants/workout.ts:16-25` |
| `ExerciseStep.runKind` 정의 | `"interval" \| "continuous"` (optional) | `src/constants/workout.ts:44` |
| `ExerciseStep.runType` 정의 | `RunningType` (optional) | `src/constants/workout.ts:46` |
| `RunningStats.runningType` | `RunningType` 그대로 저장됨 | `src/constants/workout.ts:119-132` |
| `runType:"sprint"` 서버 발생 위치 (총 9건) | 1) `functions/src/runningProgram.ts:225,253,260,267,274,289,376,387,805` 2) `functions/src/workoutEngine.ts:1179` | — |
| `runType:"fartlek"` 서버 발생 위치 (총 2건) | 1) `functions/src/runningProgram.ts:282` 2) `functions/src/workoutEngine.ts:1170` | — |
| `getCardioPacePercentile` 존재 여부 | **존재** (신설 불필요) | `src/utils/fitnessPercentile.ts:483-505` |
| `getBestRunningPace` 필터 기준 | `easy/tempo/long`, `distance ≥ 2000m` | `src/utils/fitnessPercentile.ts:523-525` |
| `StatusTab` cardio `hasData:false` 하드코딩 | 확정 | `src/components/report/tabs/StatusTab.tsx:66-68` |
| StatusTab 사용처 (WorkoutReport) | 2곳 (current + history) | `src/components/report/WorkoutReport.tsx:502-510, 668-677` |
| 연속 주행 useEffect | 현재 tick만 업데이트, 거리 도달 로직 없음 | `src/components/workout/FitScreen.tsx:570-592` |
| 인터벌 거리 도달 로직 (참조) | `distanceReached` 판정 + `playAlarmSound("end")` + vibrate | `src/components/workout/FitScreen.tsx:475-506` |
| `gpsDistanceRef/phaseStartDistRef` | 이미 선언됨 (스코프 내) | `src/components/workout/FitScreen.tsx:416-425` |
| 하단 완료 버튼 (isRunningExercise) | `handleRunningCompleteClick`, `className="... bg-[#1B4332] ..."` | `src/components/workout/FitScreen.tsx:1567-1573` |
| `isDistanceMode` 판정 | `name.includes("LSD") \|\| count.includes("km") \|\| count.includes("Distance")` | `src/components/workout/FitScreen.tsx:261` |
| `playAlarmSound("end")` | smallBell×3, 600ms (기존) | `src/hooks/useAlarmSynthesizer.ts:169-173` |
| vibration gate 패턴 | `localStorage.getItem("ohunjal_settings_vibration") !== "false"` | FitScreen 4곳 |
| `RunningType` 소비처 (클라) | `RunningReportBody`, `FitScreen`, `runningFormat`, `WorkoutReport`, `ShareCard`, `runningStats.ts`, `fitnessPercentile.ts` | 7개 파일 |
| `getRunningTypeShareLabel` switch | 6종 case — threshold/vo2_interval/sprint_interval/time_trial **누락됨** (신규 필수) | `src/utils/runningFormat.ts:108-119` |
| `detectExerciseRunningType` fallback | regex 6종 — threshold/vo2_interval/sprint_interval/time_trial **누락됨** | `src/utils/runningFormat.ts:87-100` |

**중요 발견 (스펙에 반영됨):**
1. `RunningType`은 `src/constants/workout.ts`와 `functions/` 양쪽에 **별도 타입으로 선언 안 됨** — 서버 `ExerciseStep` 인터페이스는 `shared`인 듯하나 커밋 관점에서 두 타입이 분리됨. 서버 쪽 `ExerciseStep.runType`은 암묵적으로 동일한 6종 union을 따름. 클라 쪽 타입 확장만으로 서버에서 반환되는 `"threshold"`/`"vo2_interval"` 값이 컴파일 통과하려면 **서버 빌드 파이프라인 안 거치는 직접 런타임 값**이므로 문제 없음 (Firebase Functions는 JSON 반환). 단, 서버 TS 내부에서도 `runType` 리터럴이 `RunningType`과 매칭돼야 한다면 `functions/src/workoutEngine.ts` / `functions/src/runningProgram.ts`에 있는 `runType: "X"` 문자열이 **TS 리터럴 타입 추론**으로 통과해야 한다. 서버 쪽 코드는 `runType: "vo2_interval"`을 `ExerciseStep.runType`에 쓰는데, 서버 `ExerciseStep`은 `src/constants/workout.ts`를 import하지 **못함** (shared import 불가, CLAUDE.md 명시). 따라서 서버는 자체 union을 재정의했을 가능성이 높음 — Batch B 수행 전 반드시 `functions/src/runningProgram.ts` 상단 import/type 섹션 확인 후 서버 타입 동기화.
2. `RunningType`의 `"fartlek"`을 `"vo2_interval"`로 완전 renaming하면 과거 Firestore 레코드의 `runningStats.runningType: "fartlek"` 값과 충돌. **마이그레이션은 Firestore 소급 업데이트 (Batch C)**. 클라 렌더 경로는 `"fartlek"` **legacy alias**도 살려두고 switch에서 동일 처리 (이중 케이스 or 서버 마이그 후 `"fartlek"`은 TS 타입에서 제거하되 런타임은 백워드 호환).

---

## 1. 스코프 요약 (한눈 보기)

| Batch | 회의 | 제목 | 주 파일 | 예상 라인 변경 |
|---|---|---|---|---|
| A | 64-Z | 연속 주행 거리 도달 자동 신호 | FitScreen.tsx, ko/en.json | +80 / −0 |
| B | 64-Y | runType 6→8 재정의 + 서버 태깅 | RunningType 정의, runningProgram.ts, workoutEngine.ts, runningFormat.ts, ShareCard | +120 / −30 |
| C | 64-Y | Firestore 과거 데이터 마이그레이션 | functions/src/admin/ 신규 스크립트 | +100 / −0 |
| D | 64-Y | 리포트 카드 조건부 렌더 + TT v1 | RunningReportBody.tsx, WorkoutReport.tsx, 신규 TTCard.tsx, ko/en.json | +160 / −20 |
| E | 64-X | 러닝 → 체력 축 연결 + 잠정 상태 | fitnessPercentile.ts, StatusTab.tsx, WorkoutReport.tsx, ko/en.json | +90 / −15 |

**스펙 외 변경 금지.** 평가자는 Batch A~E에 명시된 파일/함수/키 외의 수정이 있으면 "이거 스펙 외입니다" 지적해야 한다.

---

## 2. Batch A — 64-Z 연속 주행 거리 도달 자동 신호

### 2.1 목적
`isContinuousRun && !isIntervalMode` 모드 실행 중, GPS 누적 거리(`gpsDistance`)가 `exercise.count`에 명시된 목표 거리(예: "2km", "5km", "1600m")에 도달하면:
1. 종소리 (`playAlarmSound("end")`) 1회
2. 진동 `navigator.vibrate([300, 100, 300, 100, 300])` 1회
3. 거리 표시 아래 "2.00 / 2.00 km ✓" 초록 체크 + 뱃지 (신규 컴포넌트 or inline 요소)
4. 하단 완료 버튼(`bg-[#1B4332]`)에 `animate-pulse` 클래스 토글 추가
5. **자동 종료 X** — 유저가 계속 달릴 수 있음. 완료 버튼 직접 클릭해야 종료
6. 중복 발동 방지: `distanceGoalReachedRef` useRef로 1회 한정

### 2.2 변경 파일
- `src/components/workout/FitScreen.tsx`
- `src/locales/ko.json`
- `src/locales/en.json`

### 2.3 구체 변경 — FitScreen.tsx

#### 변경 1: 새 useRef + useState 추가 (line 420 바로 다음, `manualCompleteRef` 근처)
```tsx
// 회의 64-Z (2026-04-19): 연속 주행 거리 도달 자동 신호 — 중복 발동 방지 플래그
const distanceGoalReachedRef = useRef<boolean>(false);
// UI 상태: 뱃지 + 완료 버튼 펄스 트리거용
const [distanceGoalReached, setDistanceGoalReached] = useState(false);
```

#### 변경 2: 거리 목표 파싱 헬퍼 (useMemo, line 312 `runExerciseMode` 선언 바로 다음)
```tsx
// 회의 64-Z: 연속 주행 목표 거리(m) 파싱
// "2km" / "5km" / "1600m" / "1.5km" / "21km" 등 지원. 파싱 실패 → null (신호 비활성).
const continuousRunTargetMeters = useMemo((): number | null => {
  if (!isContinuousRun || isIntervalMode) return null;
  const c = exercise.count || "";
  // km 우선 (소수 허용): "2km", "21.1km"
  const kmMatch = c.match(/(\d+(?:\.\d+)?)\s*km/i);
  if (kmMatch) {
    const km = parseFloat(kmMatch[1]);
    if (isFinite(km) && km > 0) return Math.round(km * 1000);
  }
  // m (km 아니어야): "1600m", "800m"
  const mMatch = c.match(/(\d{3,5})\s*m(?!in)(?![a-z])/i);
  if (mMatch) {
    const m = parseInt(mMatch[1]);
    if (isFinite(m) && m > 0 && m < 100000) return m;
  }
  return null;
}, [exercise, isContinuousRun, isIntervalMode]);
```

#### 변경 3: 연속 주행 useEffect 확장 (현행 line 570-592 블록 교체)
**Before (line 570-592):**
```tsx
useEffect(() => {
  if (!isPlaying || !isContinuousRun || isIntervalMode) return;
  const now = Date.now();
  if (sessionStartMsRef.current === 0) {
    sessionStartMsRef.current = now;
  } else if (pausedAtMsRef.current > 0) {
    const pauseDelta = now - pausedAtMsRef.current;
    sessionStartMsRef.current += pauseDelta;
    pausedAtMsRef.current = 0;
  }
  const iv = setInterval(() => {
    const nowTick = Date.now();
    if (sessionStartMsRef.current > 0) {
      setIntervalElapsedSec(Math.max(0, Math.floor((nowTick - sessionStartMsRef.current) / 1000)));
    }
  }, 250);
  return () => {
    clearInterval(iv);
    if (!pausedAtMsRef.current) {
      pausedAtMsRef.current = Date.now();
    }
  };
}, [isPlaying, isContinuousRun, isIntervalMode]);
```

**After:**
```tsx
useEffect(() => {
  if (!isPlaying || !isContinuousRun || isIntervalMode) return;
  const now = Date.now();
  if (sessionStartMsRef.current === 0) {
    sessionStartMsRef.current = now;
  } else if (pausedAtMsRef.current > 0) {
    const pauseDelta = now - pausedAtMsRef.current;
    sessionStartMsRef.current += pauseDelta;
    pausedAtMsRef.current = 0;
  }
  const iv = setInterval(() => {
    const nowTick = Date.now();
    if (sessionStartMsRef.current > 0) {
      setIntervalElapsedSec(Math.max(0, Math.floor((nowTick - sessionStartMsRef.current) / 1000)));
    }
    // 회의 64-Z: 거리 목표 도달 신호 (1회 한정)
    if (
      continuousRunTargetMeters != null
      && gpsIsAvailable
      && !isIndoor
      && !distanceGoalReachedRef.current
      && gpsDistanceRef.current >= continuousRunTargetMeters
    ) {
      distanceGoalReachedRef.current = true;
      setDistanceGoalReached(true);
      playAlarmSound("end");
      if (navigator.vibrate && localStorage.getItem("ohunjal_settings_vibration") !== "false") {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    }
  }, 250);
  return () => {
    clearInterval(iv);
    if (!pausedAtMsRef.current) {
      pausedAtMsRef.current = Date.now();
    }
  };
}, [isPlaying, isContinuousRun, isIntervalMode, continuousRunTargetMeters, gpsIsAvailable, isIndoor]);
```

#### 변경 4: 운동 전환 시 플래그 리셋 — line 427-441 근처 exercise 변경 리셋 useEffect에 추가
```tsx
// 기존 리셋 블록 마지막 라인(setIntervalElapsedSec(0);) 바로 다음에:
distanceGoalReachedRef.current = false;
setDistanceGoalReached(false);
```
**deps 배열**에 `exercise` 또는 `exercise.name`이 이미 있는지 확인 — 없으면 `intervalConfig` deps와 같은 위치에 `exercise.name` 추가 고려. (현재 `[intervalConfig?.phase1Sec, intervalConfig?.phase2Sec, intervalConfig?.rounds]`이므로 연속 러닝 전환 시 호출 안 됨 → 별도 리셋 useEffect 필요.)

**별도 리셋 useEffect 추가** (`runExerciseMode` useMemo 근처):
```tsx
// 회의 64-Z: exercise 변경 시 거리 목표 플래그 리셋
useEffect(() => {
  distanceGoalReachedRef.current = false;
  setDistanceGoalReached(false);
}, [exercise.name]);
```

#### 변경 5: 거리 도달 뱃지 UI — line 1419-1423 (연속 주행 Distance 표시 블록) 수정
**Before:**
```tsx
<p className="text-xl font-black text-[#1B4332] leading-none tabular-nums">
  {formatRunDistanceKm(gpsDistance)}
</p>
<p className="text-[9px] font-bold text-gray-400 mt-0.5">km</p>
```

**After:**
```tsx
<p className={`text-xl font-black leading-none tabular-nums ${distanceGoalReached ? "text-emerald-600" : "text-[#1B4332]"}`}>
  {formatRunDistanceKm(gpsDistance)}
</p>
<p className="text-[9px] font-bold text-gray-400 mt-0.5">
  {continuousRunTargetMeters != null
    ? `/ ${(continuousRunTargetMeters / 1000).toFixed(2)} km`
    : "km"}
</p>
{distanceGoalReached && (
  <div className="flex items-center gap-1 mt-1 animate-fade-in">
    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.15em]">
      {t("running.goalReached")}
    </span>
  </div>
)}
```

#### 변경 6: 완료 버튼 펄스 — line 1567-1572 (isRunningExercise 분기 내 완료 버튼) 수정
**Before:**
```tsx
<button
  onClick={handleRunningCompleteClick}
  className="w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-xl active:scale-95 transition-all"
>
  <span className="font-black text-base tracking-wider">{t("fit.complete")}</span>
</button>
```

**After:**
```tsx
<button
  onClick={handleRunningCompleteClick}
  className={`w-20 h-20 rounded-full flex items-center justify-center bg-[#1B4332] text-white shadow-xl active:scale-95 transition-all ${distanceGoalReached ? "animate-pulse ring-4 ring-emerald-300" : ""}`}
>
  <span className="font-black text-base tracking-wider">{t("fit.complete")}</span>
</button>
```

### 2.4 i18n 키 추가

**`src/locales/ko.json`** (running.gps.denied 근처 line 748 뒤에 추가):
```json
"running.goalReached": "목표 달성!",
```

**`src/locales/en.json`** (동일 위치):
```json
"running.goalReached": "Goal reached!",
```

### 2.5 Acceptance Criteria (A)
- [ ] `FitScreen.tsx`에서 `distanceGoalReachedRef` useRef 선언 1건
- [ ] `FitScreen.tsx`에서 `setDistanceGoalReached(true)` 호출 1건 (useEffect 내부)
- [ ] `FitScreen.tsx`에서 `playAlarmSound("end")` 호출이 총 **2건 이상** (기존 인터벌 완주 line 505 + 신규 연속 주행 거리 도달)
- [ ] `FitScreen.tsx`에서 `continuousRunTargetMeters` 식별자 2곳 이상 (useMemo 선언 + useEffect deps/사용)
- [ ] `FitScreen.tsx`에서 `distanceGoalReached &&` 조건부 렌더 1건 이상 (뱃지)
- [ ] `FitScreen.tsx`에서 `animate-pulse ring-4 ring-emerald-300` 클래스 조합 1건
- [ ] `running.goalReached` 키가 `ko.json` + `en.json` 양쪽 존재 (total 2건)
- [ ] exercise 변경 리셋 useEffect에서 `distanceGoalReachedRef.current = false;` 1건
- [ ] 기존 인터벌 useEffect (line 443-566)는 **변경 없음** (touch만 해도 스펙 외 취급)

### 2.6 평가자 검증 명령어 (A)
```bash
grep -n "distanceGoalReachedRef" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/workout/FitScreen.tsx
grep -n "continuousRunTargetMeters" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/workout/FitScreen.tsx
grep -cn 'playAlarmSound("end")' /Users/joord/Desktop/Joord/ohunjal-ai/src/components/workout/FitScreen.tsx  # >=2
grep -n "animate-pulse ring-4 ring-emerald-300" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/workout/FitScreen.tsx
grep -n '"running.goalReached"' /Users/joord/Desktop/Joord/ohunjal-ai/src/locales/ko.json /Users/joord/Desktop/Joord/ohunjal-ai/src/locales/en.json
```

### 2.7 브라우저 테스트 시나리오 (A)
1. `/app` 로그인 → 러닝 플랜 생성 (2km easy run 포함 세션)
2. GPS 권한 허용 → 재생 버튼 누름
3. 실외 상황 모사 (브라우저 DevTools Sensors로 이동 override)
4. 누적 2.00km 도달 시:
   - "삐-삐-삐" 종소리 1회 재생 확인
   - 휴대폰 진동 (모바일에서만 실제 체감)
   - "2.00 / 2.00 km ✓ 목표 달성!" 뱃지 표시
   - 완료 버튼이 초록 링 + 펄스
5. **완료 버튼 누르기 전까지 계속 타이머/거리 진행** (2.10km까지 찍힘) 확인
6. 완료 버튼 누름 → 정상 종료
7. 같은 운동을 다시 진행(일시정지→재개) 시 플래그 재발동 안 함 (useRef 유지), exercise 다음으로 넘기면 플래그 리셋 확인

---

## 3. Batch B — 64-Y runType 6종 → 8종 재정의 + 서버 태깅

### 3.1 목적
현 6종 (`walkrun/tempo/fartlek/sprint/easy/long`)을 **8종** (`walkrun/easy/long/tempo/threshold/vo2_interval/sprint_interval/time_trial`)으로 확장.
- `fartlek` → `vo2_interval` rename (Canova 근거, Norwegian 4×4는 fartlek 아님)
- `sprint` → 3-way 분할: **TT (2km/5km/dress_rehearsal)** → `time_trial`, **단거리 인터벌 (400/800/1000/mile/strides/pure_sprints/race_pace_interval/walk-run strides 100m)** → `sprint_interval`, 기존 fartlek (workoutEngine 변속주 포함) → `vo2_interval`
- 신규 `threshold`: Bakken 2x15 `buildThreshold2x15` Threshold1/2 블록

### 3.2 변경 파일
- `src/constants/workout.ts` — `RunningType` union 확장
- `functions/src/runningProgram.ts` — 서버 태깅 10곳 재매핑
- `functions/src/workoutEngine.ts` — `fartlek`/`sprint` 2곳 재매핑
- `src/utils/runningFormat.ts` — switch 8종 + regex fallback 확장
- `src/components/report/ShareCard.tsx` — RunningType 사용처 라벨 확장 확인
- `src/locales/ko.json` + `src/locales/en.json` — 신규 라벨 키

### 3.3 구체 변경

#### Change B-1: `src/constants/workout.ts` line 103
**Before:**
```ts
export type RunningType = "walkrun" | "tempo" | "fartlek" | "sprint" | "easy" | "long";
```
**After:**
```ts
/**
 * 회의 64-Y (2026-04-19): 6종 → 8종 재분류
 * - fartlek → vo2_interval rename (Canova 근거, Norwegian 4×4는 fartlek 아님)
 * - sprint → 3-way 분할: time_trial (TT/dress rehearsal), sprint_interval (400m/800m/strides 등), vo2_interval (시간 기반)
 * - threshold 신규 (Bakken 2x15 Sub-T 블록)
 * - 과거 Firestore 레코드의 "fartlek"/"sprint"은 Batch C 마이그레이션으로 소급 갱신
 * - legacy alias ("fartlek"/"sprint") 은 2026-04-19 시점 이후 서버에서 미사용이나, 과거 레코드 호환용으로 타입 유지.
 */
export type RunningType =
  | "walkrun"
  | "easy"
  | "long"
  | "tempo"
  | "threshold"
  | "vo2_interval"
  | "sprint_interval"
  | "time_trial"
  // legacy (Firestore 과거 레코드 호환 — Batch C 완료 후 제거 예정)
  | "fartlek"
  | "sprint";
```

> **중요**: `sprint`/`fartlek`는 legacy로 **유지**. 서버는 새 8종으로만 태깅, 클라는 두 값 모두 인식 (switch에서 alias로 처리). Batch C 마이그레이션 완료 후 차기 PR에서 legacy 제거 검토.

#### Change B-2: `functions/src/runningProgram.ts` 태깅 재매핑 (10곳)

| Line | Before `runType` | After `runType` | 근거 |
|---|---|---|---|
| 225 (buildStrides) | `"sprint"` | `"sprint_interval"` | 20초×N 스트라이드 = 단거리 인터벌 |
| 253 (buildIntervals400) | `"sprint"` | `"sprint_interval"` | 400m 인터벌 |
| 260 (buildIntervals800) | `"sprint"` | `"sprint_interval"` | 800m 인터벌 |
| 267 (buildIntervals1000) | `"sprint"` | `"vo2_interval"` | 1000m×5 = Norwegian-like VO2 (5min @ VO2max) |
| 274 (buildIntervalsMile) | `"sprint"` | `"vo2_interval"` | 1600m×2 = 5-6min @ VO2max |
| 282 (buildNorwegian4x4) | `"fartlek"` | `"vo2_interval"` | Norwegian 4×4 본체 |
| 289 (buildPureSprints) | `"sprint"` | `"sprint_interval"` | 20-30초 100% |
| 376 (buildTT2K) | `"sprint"` | `"time_trial"` | 2K TT |
| 387 (buildTT5K) | `"sprint"` | `"time_trial"` | 5K TT |
| 805 (taper short strides) | `"sprint"` | `"sprint_interval"` | 100m×4 스트라이드 |

**추가 변경 — `buildThreshold2x15` (line 241, 243):** 현재 `runType: "tempo"`는 유지 가능하지만, 회의 64-Y Q3에서 "Bakken 2x15 threshold 세션 카드는 전체 평균만 표시" 결정이 있음. 카드 렌더에서 `threshold`/`tempo` 구분이 필요하면 **여기서도 `"threshold"`로 태깅**:
- Line 241: `runType: "tempo"` → `runType: "threshold"`
- Line 243: `runType: "tempo"` → `runType: "threshold"`
- Line 242 (Recovery Jog): `"easy"` 유지

`buildThreshold` (line 233, 단일 블록 tempo run): `runType: "tempo"` **유지** (threshold 아님, 20-40분 tempo).

`buildRacePaceInterval` (line 335): `runType: "tempo"` **유지** (race pace, threshold 범위).

`buildSpecificLong` MP 블록 (line 306, 351, 356, 407): `runType: "tempo"` **유지**.

#### Change B-3: `functions/src/workoutEngine.ts` 태깅 재매핑 (2곳)
- Line 1170 (Fartlek Run 변속주): `runType: "fartlek"` → `runType: "vo2_interval"` (이름은 "변속주 (Fartlek Run)" 유지 — UI 라벨일 뿐, tag만 수정)
- Line 1179 (Interval Sprints 30초 전력/120초 회복): `runType: "sprint"` → `runType: "sprint_interval"`

#### Change B-4: `src/utils/runningFormat.ts`

**`getRunningTypeShareLabel` switch (line 108-119) 확장:**
```ts
export function getRunningTypeShareLabel(type: RunningType, locale: string): string {
  void locale;
  switch (type) {
    case "walkrun": return "WALK-RUN";
    case "easy": return "EASY RUN";
    case "long": return "LONG DISTANCE";
    case "tempo": return "TEMPO RUN";
    case "threshold": return "THRESHOLD";
    case "vo2_interval": return "VO2 INTERVAL";
    case "sprint_interval": return "SPRINT INTERVAL";
    case "time_trial": return "TIME TRIAL";
    // legacy (Firestore 과거 레코드 호환)
    case "fartlek": return "VO2 INTERVAL";
    case "sprint": return "SPRINT INTERVAL";
  }
}
```

**`detectExerciseRunningType` regex fallback (line 87-100) 확장:** (tag-at-source 없는 과거 Firestore 레코드 대응)
```ts
export function detectExerciseRunningType(exercise: ExerciseStep): RunningType | null {
  if (exercise.runType) return exercise.runType;
  const c = exercise.count || "";
  const n = exercise.name || "";
  // 회의 64-Y: 8종 regex fallback
  if (/Time\s*Trial|All-out|전력\s*질주|기록\s*측정|2km\s*전력|5km\s*전력/i.test(n + " " + c)) return "time_trial";
  if (/Threshold|Sub-?T(?:hreshold)?|Bakken/i.test(n)) return "threshold";
  if (/Norwegian|4x4|4\s*×\s*4|변속주|Fartlek/i.test(n)) return "vo2_interval";
  if (/걷기\s*\/?\s*\d+초\s*달리기/.test(c)) return "walkrun";
  if (/전력\s*\/?\s*\d+초\s*보통/.test(c)) return "vo2_interval";
  if (/전력\s*\/?\s*\d+초\s*회복/.test(c)) return "sprint_interval";
  if (/스트라이드|Strides|Pure\s*Sprints|\d+m\s*[×x]\s*\d+/i.test(n + " " + c)) return "sprint_interval";
  if (/템포|tempo/i.test(n)) return "tempo";
  if (/LSD|장거리|long.*slow|long.*distance/i.test(n)) return "long";
  if (/이지\s*런|회복\s*러닝|easy.*run|recovery.*run|zone\s*2/i.test(n)) return "easy";
  return null;
}
```

> **주의:** `runningFormat.ts:37 detectRunningType`(세션 단위)도 비슷한 구조이나 `exercises[0].runType` 우선이므로 추가 수정 **불필요**.

#### Change B-5: `src/components/report/ShareCard.tsx`
Grep 결과 `getRunningTypeShareLabel(runningType, locale)` 1건만 사용 (line 323). `RunningType` union 확장 + switch 확장으로 자동 처리됨. **수정 없음**.

#### Change B-6: i18n 키 (선택적, share label이 대문자 고정이라 필수는 아님)
현 switch는 locale 무시하고 대문자 라벨 반환 — i18n 키 추가 불필요. 스킵.

### 3.4 Acceptance Criteria (B)

- [ ] `src/constants/workout.ts`에서 `RunningType` 정의에 `"threshold"`, `"vo2_interval"`, `"sprint_interval"`, `"time_trial"` 4개 신규 값 존재
- [ ] `src/constants/workout.ts`에서 legacy `"fartlek"`, `"sprint"` 유지 (호환)
- [ ] `functions/src/runningProgram.ts`에서 `runType: "fartlek"` 발생 **0건** (원 1건 → 0)
- [ ] `functions/src/runningProgram.ts`에서 `runType: "sprint"` 발생 **0건** (원 9건 → 0)
- [ ] `functions/src/runningProgram.ts`에서 `runType: "time_trial"` 발생 **2건** (TT2K + TT5K)
- [ ] `functions/src/runningProgram.ts`에서 `runType: "sprint_interval"` 발생 **5건** (strides/400/800/pure_sprints/taper short strides)
- [ ] `functions/src/runningProgram.ts`에서 `runType: "vo2_interval"` 발생 **3건** (1000/mile/Norwegian 4×4)
- [ ] `functions/src/runningProgram.ts`에서 `runType: "threshold"` 발생 **2건** (Threshold 1 + Threshold 2 in buildThreshold2x15)
- [ ] `functions/src/workoutEngine.ts`에서 `runType: "fartlek"` 발생 **0건** (원 1건 → 0)
- [ ] `functions/src/workoutEngine.ts`에서 `runType: "sprint"` 발생 **0건** (원 1건 → 0)
- [ ] `src/utils/runningFormat.ts` switch에 8개 case + 2개 legacy case 존재
- [ ] `detectExerciseRunningType`에 `time_trial`/`threshold`/`vo2_interval`/`sprint_interval` regex 각 1건 이상
- [ ] `cd functions && npm run build` 에러 0
- [ ] `npx tsc --noEmit` 에러 0

### 3.5 평가자 검증 명령어 (B)

```bash
# 신규 union 확인
grep -n '"threshold"\|"vo2_interval"\|"sprint_interval"\|"time_trial"' /Users/joord/Desktop/Joord/ohunjal-ai/src/constants/workout.ts

# 서버 태깅 재매핑 (before=9건 sprint + 1건 fartlek; after=0+0)
grep -c 'runType: "sprint"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/runningProgram.ts  # expect 0
grep -c 'runType: "fartlek"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/runningProgram.ts  # expect 0
grep -c 'runType: "time_trial"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/runningProgram.ts  # expect 2
grep -c 'runType: "sprint_interval"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/runningProgram.ts  # expect 5
grep -c 'runType: "vo2_interval"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/runningProgram.ts  # expect 3
grep -c 'runType: "threshold"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/runningProgram.ts  # expect 2

# workoutEngine
grep -c 'runType: "sprint"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/workoutEngine.ts  # expect 0
grep -c 'runType: "fartlek"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/workoutEngine.ts  # expect 0
grep -c 'runType: "vo2_interval"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/workoutEngine.ts  # expect 1
grep -c 'runType: "sprint_interval"' /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/workoutEngine.ts  # expect 1

# 클라 라벨
grep -n 'case "time_trial"\|case "threshold"\|case "vo2_interval"\|case "sprint_interval"' /Users/joord/Desktop/Joord/ohunjal-ai/src/utils/runningFormat.ts

# 빌드 검증
cd /Users/joord/Desktop/Joord/ohunjal-ai/functions && npm run build
cd /Users/joord/Desktop/Joord/ohunjal-ai && npx tsc --noEmit
```

---

## 4. Batch C — 64-Y Firestore 과거 데이터 소급 재태깅

### 4.1 목적
회의 64-Y Q1 = A: 기록일 기준으로 과거 `runningStats.runningType: "fartlek"` → `"vo2_interval"`, `"sprint"` → 세분화 (TT/단거리/VO2) 자동 마이그레이션.

### 4.2 재태깅 규칙 (서버 마이그 스크립트 내부)
`users/{uid}/workout_history/{id}` 각 문서의 `runningStats.runningType` + `sessionData.exercises[].runType` 둘 다 업데이트.

| Before | 판정 기준 (exercises[].name/count) | After |
|---|---|---|
| `"fartlek"` | 무조건 | `"vo2_interval"` |
| `"sprint"` | `name`에 "2km 전력" OR "5km 전력" OR "Time Trial" OR "All-out" OR "Dress Rehearsal" 포함 | `"time_trial"` |
| `"sprint"` | `name`에 "Norwegian" OR "4×4" OR "1000m" OR "1600m" OR "1마일" | `"vo2_interval"` |
| `"sprint"` | 그 외 (Strides, 400m, 800m, Pure Sprints, 변속주 Interval Sprints, 템포런 외 sprint 태깅 잔재) | `"sprint_interval"` |

### 4.3 구체 변경 — 신규 파일

**신규 파일: `functions/src/admin/migrateRunTypeV2.ts`**

```ts
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { verifyAdmin, db } from "../helpers";
import type { ExerciseStep } from "../types"; // 또는 내부 ExerciseStep

interface MigrationReport {
  scannedUsers: number;
  scannedDocs: number;
  updatedDocs: number;
  fartlekToVo2: number;
  sprintToTimeTrial: number;
  sprintToVo2: number;
  sprintToSprintInterval: number;
  errors: string[];
}

function reclassifySprint(exercises: ExerciseStep[]): "time_trial" | "vo2_interval" | "sprint_interval" {
  const blob = exercises.map(e => `${e.name} ${e.count}`).join(" ");
  if (/2km 전력|5km 전력|Time\s*Trial|All-out|Dress\s*Rehearsal/i.test(blob)) return "time_trial";
  if (/Norwegian|4\s*×\s*4|4x4|1000m|1600m|1마일|1\s*mile/i.test(blob)) return "vo2_interval";
  return "sprint_interval";
}

export const adminMigrateRunTypeV2 = onCall(async (request) => {
  await verifyAdmin(request);
  const dryRun = request.data?.dryRun === true;
  const report: MigrationReport = {
    scannedUsers: 0, scannedDocs: 0, updatedDocs: 0,
    fartlekToVo2: 0, sprintToTimeTrial: 0, sprintToVo2: 0, sprintToSprintInterval: 0,
    errors: [],
  };

  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    report.scannedUsers += 1;
    const historySnap = await userDoc.ref.collection("workout_history").get();
    for (const histDoc of historySnap.docs) {
      report.scannedDocs += 1;
      const data = histDoc.data();
      const rs = data.runningStats;
      const exercises: ExerciseStep[] = data.sessionData?.exercises ?? [];
      let newType: string | null = null;
      if (rs?.runningType === "fartlek") {
        newType = "vo2_interval";
        report.fartlekToVo2 += 1;
      } else if (rs?.runningType === "sprint") {
        newType = reclassifySprint(exercises);
        if (newType === "time_trial") report.sprintToTimeTrial += 1;
        else if (newType === "vo2_interval") report.sprintToVo2 += 1;
        else report.sprintToSprintInterval += 1;
      }
      if (!newType) continue;

      // exercises[].runType도 재태깅
      const updatedExercises = exercises.map(ex => {
        if (ex.runType === "fartlek") return { ...ex, runType: "vo2_interval" };
        if (ex.runType === "sprint") {
          // 개별 운동별로도 재분류
          const blob = `${ex.name} ${ex.count}`;
          if (/2km 전력|5km 전력|Time\s*Trial|All-out|Dress\s*Rehearsal/i.test(blob)) return { ...ex, runType: "time_trial" };
          if (/Norwegian|4\s*×\s*4|4x4|1000m|1600m|1마일|1\s*mile/i.test(blob)) return { ...ex, runType: "vo2_interval" };
          return { ...ex, runType: "sprint_interval" };
        }
        return ex;
      });

      if (dryRun) {
        report.updatedDocs += 1;
      } else {
        try {
          await histDoc.ref.update({
            "runningStats.runningType": newType,
            "sessionData.exercises": updatedExercises,
          });
          report.updatedDocs += 1;
        } catch (e) {
          report.errors.push(`${userDoc.id}/${histDoc.id}: ${(e as Error).message}`);
        }
      }
    }
  }

  return report;
});
```

**신규 export 추가: `functions/src/index.ts`**
```ts
export { adminMigrateRunTypeV2 } from "./admin/migrateRunTypeV2";
```

**`firebase.json` rewrite 추가 (또는 Cloud Function 직접 호출 — 관리자 전용이므로 rewrite 생략 가능):** 관리자 전용이므로 functions SDK 직접 호출로 충분. firebase.json rewrite **불필요**.

### 4.4 실행 절차 (대표가 수동 실행)
1. Dry run 먼저:
   ```
   firebase functions:shell
   > adminMigrateRunTypeV2({dryRun: true})
   ```
2. 보고서 확인 → `updatedDocs`, 각 카테고리 분포 검토
3. 실행:
   ```
   > adminMigrateRunTypeV2({dryRun: false})
   ```
4. 완료 후 Firestore 콘솔에서 랜덤 샘플 3건 확인

### 4.5 Acceptance Criteria (C)
- [ ] `functions/src/admin/migrateRunTypeV2.ts` 신규 파일 존재
- [ ] `adminMigrateRunTypeV2` export 존재
- [ ] `functions/src/index.ts`에 `export { adminMigrateRunTypeV2 }` 추가
- [ ] dryRun flag 분기 존재 (`request.data?.dryRun === true`)
- [ ] `cd functions && npm run build` 에러 0
- [ ] 관리자 인증 (`verifyAdmin`) 존재
- [ ] 재분류 함수 `reclassifySprint` 내부 regex 3종 (time_trial/vo2/default) 존재

### 4.6 평가자 검증 명령어 (C)
```bash
ls -la /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/admin/migrateRunTypeV2.ts
grep -n "adminMigrateRunTypeV2" /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/index.ts
grep -n "dryRun" /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/admin/migrateRunTypeV2.ts
grep -n "verifyAdmin" /Users/joord/Desktop/Joord/ohunjal-ai/functions/src/admin/migrateRunTypeV2.ts
cd /Users/joord/Desktop/Joord/ohunjal-ai/functions && npm run build
```

---

## 5. Batch D — 64-Y 리포트 카드 조건부 렌더 + TT v1

### 5.1 목적
리포트 카드 레이아웃이 8종 재분류에 따라 분기:

| runType | 카드 |
|---|---|
| walkrun / vo2_interval / sprint_interval | **인터벌 상세** (기존 `intervalRounds` 카드 유지, `runningStats.intervalRounds.length > 0`) |
| easy / long / tempo / threshold | **스플릿 상세** (기존 Km Splits 카드 유지) |
| time_trial | **신규 TT 카드** (PR 뱃지 + 목표 대비 차이 한 줄만, Q4 v1 스펙) |

회의 64-Y Q3: **Bakken 2x15 threshold 세션은 전체 평균만 표시 (2블록 분리 시각화 skip)** — 기존 스플릿 카드 그대로 렌더링하되 threshold 타입은 인터벌 브레이크다운 카드 **숨김**.

### 5.2 변경 파일
- `src/components/report/RunningReportBody.tsx` — 조건부 렌더
- `src/components/report/TTCard.tsx` — **신규 파일** (Time Trial v1 카드)
- `src/components/report/WorkoutReport.tsx` — 필요시 `runningType` 분기 prop 전달
- `src/locales/ko.json` + `en.json` — TT 카드 문구

### 5.3 구체 변경

#### Change D-1: 분기 헬퍼 추가 (`RunningReportBody.tsx` 최상단)
```ts
// 회의 64-Y (2026-04-19): 8종 runType → 3가지 카드 레이아웃 분기
type CardLayout = "interval" | "splits" | "time_trial";
function pickCardLayout(runningType: RunningType): CardLayout {
  switch (runningType) {
    case "walkrun":
    case "vo2_interval":
    case "sprint_interval":
    case "fartlek": // legacy
      return "interval";
    case "time_trial":
      return "time_trial";
    case "sprint": // legacy → 기본값 interval (소급 재태깅 없을 경우 안전망)
      return "interval";
    case "easy":
    case "long":
    case "tempo":
    case "threshold":
    default:
      return "splits";
  }
}
```

#### Change D-2: 본문 렌더 (line 50 `return` 직전)
```tsx
const cardLayout = pickCardLayout(runningStats.runningType);
```

#### Change D-3: 기존 "Interval Breakdown Card" (line 118-188) 조건부 렌더
**Before (line 118):**
```tsx
{/* ── Interval Breakdown Card ... ── */}
<div className="bg-white rounded-3xl ...">
```
**After:**
```tsx
{/* 회의 64-Y: interval 레이아웃에서만 렌더 */}
{cardLayout === "interval" && (
  <div className="bg-white rounded-3xl ...">
  ...  (기존 내용)
  </div>
)}
```
**line 188 `</div>` 뒤에 `)}` 닫기.**

#### Change D-4: Km Splits 카드 (line 191) 조건부 렌더
```tsx
{/* 회의 64-Y: splits 또는 time_trial 레이아웃에서 렌더 (time_trial은 단일 구간이어도 유용) */}
{(cardLayout === "splits" || cardLayout === "time_trial") && runningStats.splits && runningStats.splits.length > 0 && (() => {
  // ... 기존 로직 그대로
})()}
```

#### Change D-5: TT 카드 렌더 (Hero 카드 뒤에 삽입)
```tsx
{cardLayout === "time_trial" && (
  <TTCard runningStats={runningStats} recentHistory={recentHistory} />
)}
```

#### Change D-6: 신규 컴포넌트 `src/components/report/TTCard.tsx`
```tsx
"use client";

import React from "react";
import type { RunningStats, WorkoutHistory } from "@/constants/workout";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPace, formatRunDistanceKm, formatRunDuration } from "@/utils/runningFormat";

interface TTCardProps {
  runningStats: RunningStats;
  recentHistory: WorkoutHistory[];
}

/**
 * 회의 64-Y (2026-04-19) TT 카드 v1:
 * - PR 뱃지 (최근 4주 동일 거리 TT 대비 개인 최고 기록이면 표시)
 * - 목표 대비 차이 한 줄 (v1: 목표 = 해당 거리 사용자 기록 전무하면 최근 TT, 있으면 이전 best)
 * - v2는 추이 차트 (스펙 외)
 */
export const TTCard: React.FC<TTCardProps> = ({ runningStats, recentHistory }) => {
  const { t, locale } = useTranslation();
  const isKo = locale === "ko";

  const currentPace = runningStats.avgPace;
  const currentDistKm = runningStats.distance / 1000;

  // 같은 거리(±5%) TT 중 현재 세션 제외한 최고 페이스
  const similarTTs = recentHistory.filter(h => {
    if (!h.runningStats) return false;
    if (h.runningStats.runningType !== "time_trial" && h.runningStats.runningType !== "sprint") return false;
    const dKm = h.runningStats.distance / 1000;
    if (Math.abs(dKm - currentDistKm) / currentDistKm > 0.05) return false;
    return true;
  });
  const prevBest = similarTTs.reduce<number | null>((best, h) => {
    const p = h.runningStats?.avgPace;
    if (!p) return best;
    return best == null || p < best ? p : best;
  }, null);

  const isPR = prevBest == null || (currentPace != null && currentPace < prevBest);
  const diffSec = prevBest != null && currentPace != null ? Math.round(currentPace - prevBest) : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
          {t("running.tt.label")}
        </span>
        {isPR && (
          <span className="ml-auto px-2 py-0.5 bg-emerald-100 rounded-full">
            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-[0.15em]">
              {t("running.tt.pr")}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-black text-[#1B4332] tabular-nums">
          {formatRunDistanceKm(runningStats.distance)} km
        </span>
        <span className="text-2xl font-black text-[#1B4332] tabular-nums">
          {formatRunDuration(runningStats.duration)}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-500">
        {isKo ? "평균 페이스 " : "Avg pace "}
        <span className="font-black text-[#1B4332]">{formatPace(currentPace)}</span>
        {isKo ? " /km" : " /km"}
      </p>
      {diffSec != null && (
        <p className="text-xs font-bold mt-2 text-gray-500">
          {diffSec < 0
            ? t("running.tt.faster", { sec: String(Math.abs(diffSec)) })
            : diffSec === 0
              ? t("running.tt.same")
              : t("running.tt.slower", { sec: String(diffSec) })}
        </p>
      )}
      {diffSec == null && (
        <p className="text-xs font-bold mt-2 text-gray-400">
          {t("running.tt.firstRecord")}
        </p>
      )}
    </div>
  );
};
```

#### Change D-7: i18n 키 (ko.json + en.json, `"running.goalReached"` 다음)

**ko.json:**
```json
"running.tt.label": "기록 측정",
"running.tt.pr": "PR",
"running.tt.faster": "이전 기록보다 {sec}초 빨라졌어요",
"running.tt.slower": "이전 기록보다 {sec}초 느려요",
"running.tt.same": "이전 기록과 동일",
"running.tt.firstRecord": "첫 기록 — 다음 TT의 기준선이에요",
```

**en.json:**
```json
"running.tt.label": "Time Trial",
"running.tt.pr": "PR",
"running.tt.faster": "{sec}s faster than your best",
"running.tt.slower": "{sec}s slower than your best",
"running.tt.same": "Tied with your best",
"running.tt.firstRecord": "First record — baseline for next TT",
```

### 5.4 Acceptance Criteria (D)
- [ ] `src/components/report/TTCard.tsx` 신규 파일 존재
- [ ] `TTCard` export 1건
- [ ] `RunningReportBody.tsx`에 `pickCardLayout` 함수 존재 + 8개 case + 2개 legacy case
- [ ] `RunningReportBody.tsx`에서 Interval Breakdown 카드가 `cardLayout === "interval"` 조건부 렌더
- [ ] `RunningReportBody.tsx`에서 Km Splits 카드가 `cardLayout === "splits" \|\| cardLayout === "time_trial"` 조건부 렌더
- [ ] `RunningReportBody.tsx`에서 TTCard 렌더 조건 `cardLayout === "time_trial"` 존재
- [ ] i18n 키 `running.tt.label`, `running.tt.pr`, `running.tt.faster`, `running.tt.slower`, `running.tt.same`, `running.tt.firstRecord` ko + en 양쪽 존재 (총 12건)
- [ ] TTCard에서 `recentHistory` 중 `runningType === "time_trial"` 필터링 (+ legacy `"sprint"` 포함) 존재
- [ ] TTCard PR 판정: `prevBest == null \|\| currentPace < prevBest` 로직 존재
- [ ] `npx tsc --noEmit` 에러 0

### 5.5 평가자 검증 명령어 (D)
```bash
ls -la /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/TTCard.tsx
grep -n "pickCardLayout" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/RunningReportBody.tsx
grep -n "cardLayout ===" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/RunningReportBody.tsx  # expect 3+
grep -n '"running.tt\.' /Users/joord/Desktop/Joord/ohunjal-ai/src/locales/ko.json /Users/joord/Desktop/Joord/ohunjal-ai/src/locales/en.json  # expect 12
cd /Users/joord/Desktop/Joord/ohunjal-ai && npx tsc --noEmit
```

### 5.6 브라우저 테스트 시나리오 (D)
1. 러닝 플랜 생성 → Week 1 Day 1 (2K TT 자동 편성) 실행
2. 완료 → 리포트 화면
3. TT 카드 렌더 확인: "2.00 km / 10:30 / 평균 페이스 5:15 /km / 첫 기록 — 다음 TT의 기준선이에요"
4. 다음 주 2K TT 다시 실행 → 이전보다 10초 빠르게 기록
5. 리포트에서 "PR" 뱃지 + "이전 기록보다 10초 빨라졌어요" 표시 확인
6. easy run 세션 완료 시 TT 카드 렌더 안 됨 확인 (Km Splits만 뜸)
7. Norwegian 4×4 완료 시 Interval Breakdown 카드만 뜸 (Splits/TT 없음)

---

## 6. Batch E — 64-X 러닝 → 체력 축 연결 + 잠정/확정 상태

### 6.1 목적
러닝 1회부터 체력(cardio) 퍼센타일을 **잠정 상태**(회색 틴트 + 마이크로카피)로 표시. 3회 달성 OR 2주 경과 중 먼저 도달한 쪽에서 "확정"(진녹색)으로 전환.
- Q1 = A: 1회부터 잠정 퍼센타일 표시
- Q2 = D: 3회 OR 2주 경과
- Q3 = A: **1km 이상** 러닝부터 반영 (현 2km 기준 완화)
- Q4 = A: 인터벌(walkrun/vo2_interval/sprint_interval) 배제 유지
- Q5 = A: 러닝 단독일 때 피트니스 나이 "체력축만 계산" 경고

### 6.2 변경 파일
- `src/utils/fitnessPercentile.ts` — `getBestRunningPace` 기준 완화 + 러닝 수·기간 집계 함수 신설
- `src/components/report/tabs/StatusTab.tsx` — cardio 축 하드코딩 제거, 잠정/확정 상태 렌더
- `src/components/report/WorkoutReport.tsx` — StatusTab props 확장 (runningHistory 전달)
- `src/components/HexagonChart.tsx` — (확인 후) 회색 틴트 지원 필요 시만 확장 (선택)
- `src/locales/ko.json` + `en.json` — 마이크로카피

### 6.3 구체 변경

#### Change E-1: `src/utils/fitnessPercentile.ts`

**수정 1 — `getBestRunningPace` 완화 (line 511-533):**
**Before:**
```ts
// 최소 2km
if (rs.distance < 2000) continue;
```
**After:**
```ts
// 회의 64-X (2026-04-19): 최소 1km 로 완화
if (rs.distance < 1000) continue;
```

**수정 2 — easy/tempo/long 필터 유지 + threshold 포함 (line 523):**
**Before:**
```ts
if (!["easy", "tempo", "long"].includes(rs.runningType)) continue;
```
**After:**
```ts
// 회의 64-X: 인터벌(walkrun/vo2_interval/sprint_interval)은 cardio 축 배제. threshold/time_trial은 포함.
if (!["easy", "tempo", "long", "threshold", "time_trial"].includes(rs.runningType)) continue;
```

**수정 3 — 신규 함수 `getCardioConfidenceStatus` (`getBestRunningPace` 아래 신설):**
```ts
export interface CardioStatus {
  /** cardio 반영 러닝 개수 (1km 이상, 인터벌 제외, 최근 4주) */
  eligibleRunCount: number;
  /** 첫 cardio-eligible 러닝으로부터 경과 일수 */
  daysSinceFirstRun: number;
  /** 확정 상태: 3회 이상 OR 첫 러닝 이후 14일 이상 */
  isConfirmed: boolean;
}

/**
 * 회의 64-X (2026-04-19): cardio 퍼센타일 확정/잠정 판정.
 * - 1회부터 잠정 표시 (회색 틴트)
 * - 3회 OR 2주 경과 시 확정 (진녹색)
 */
export function getCardioConfidenceStatus(
  history: { date?: string; runningStats?: { runningType: string; distance: number; avgPace: number | null } }[],
  cutoffDays = 28,
): CardioStatus {
  const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
  const eligible = history.filter(h => {
    if (h.date && new Date(h.date).getTime() < cutoff) return false;
    const rs = h.runningStats;
    if (!rs) return false;
    if (!["easy", "tempo", "long", "threshold", "time_trial"].includes(rs.runningType)) return false;
    if (rs.distance < 1000) return false;
    if (!rs.avgPace || rs.avgPace <= 0) return false;
    return true;
  });
  if (eligible.length === 0) {
    return { eligibleRunCount: 0, daysSinceFirstRun: 0, isConfirmed: false };
  }
  const firstRun = eligible.reduce((earliest, h) => {
    const t = h.date ? new Date(h.date).getTime() : Date.now();
    return t < earliest ? t : earliest;
  }, Date.now());
  const daysSince = Math.floor((Date.now() - firstRun) / (24 * 60 * 60 * 1000));
  const isConfirmed = eligible.length >= 3 || daysSince >= 14;
  return { eligibleRunCount: eligible.length, daysSinceFirstRun: daysSince, isConfirmed };
}
```

#### Change E-2: `src/components/report/WorkoutReport.tsx`
StatusTab props에 `recentHistory` 전달 (현재 전달 안 됨). line 502-510:

**Before:**
```tsx
<StatusTab
  exercises={sessionData.exercises}
  logs={logs}
  bodyWeightKg={bodyWeightKg ?? 70}
  gender={gender ?? "male"}
  age={userAge}
  onHelpPress={() => setHelpCard("fitnessAge")}
  onRankHelpPress={() => setHelpCard("fitnessRank")}
/>
```
**After:**
```tsx
<StatusTab
  exercises={sessionData.exercises}
  logs={logs}
  bodyWeightKg={bodyWeightKg ?? 70}
  gender={gender ?? "male"}
  age={userAge}
  recentHistory={recentHistory}
  currentRunningStats={runningStats}
  onHelpPress={() => setHelpCard("fitnessAge")}
  onRankHelpPress={() => setHelpCard("fitnessRank")}
/>
```

**동일하게 line 668-677** (history 뷰):
```tsx
<StatusTab
  exercises={sessionData.exercises}
  logs={logs}
  bodyWeightKg={bodyWeightKg ?? 70}
  gender={gender ?? "male"}
  age={birthYear ? new Date().getFullYear() - birthYear : 30}
  recentHistory={recentHistory}
  currentRunningStats={runningStats}
  onHelpPress={() => setHelpCard("fitnessAge")}
  onRankHelpPress={() => setHelpCard("fitnessRank")}
/>
```

#### Change E-3: `src/components/report/tabs/StatusTab.tsx`

**Props 확장 (line 18-26):**
```tsx
export interface StatusTabProps {
  exercises: { name: string }[];
  logs: Record<number, { weightUsed?: string; repsCompleted: number }[]>;
  bodyWeightKg: number;
  gender: "male" | "female";
  age: number;
  recentHistory?: { date?: string; runningStats?: { runningType: string; distance: number; avgPace: number | null } }[];
  currentRunningStats?: { runningType: string; distance: number; avgPace: number | null } | null;
  onHelpPress?: () => void;
  onRankHelpPress?: () => void;
}
```

**Import 확장 (line 6-15):**
```tsx
import {
  type FitnessCategory,
  type CategoryPercentile,
  getCategoryBestBwRatio,
  bwRatioToPercentile,
  computeOverallPercentile,
  computeFitnessAge,
  percentileToRank,
  getAgeGroupLabel,
  getBestRunningPace,
  getCardioPacePercentile,
  getCardioConfidenceStatus,
} from "@/utils/fitnessPercentile";
```

**cardio 축 렌더 로직 수정 (line 62-68):**
```tsx
// 회의 64-X (2026-04-19): cardio 축 러닝 연결 + 잠정/확정 상태
// - 현재 세션 runningStats + recentHistory 합쳐서 반영
// - 1회부터 잠정 (isConfirmed=false), 3회 or 2주 경과 시 확정
const mergedHistory = [
  ...(recentHistory ?? []),
  ...(currentRunningStats ? [{ date: new Date().toISOString(), runningStats: currentRunningStats }] : []),
];
const cardioStatus = getCardioConfidenceStatus(mergedHistory);
const cardioBestPace = getBestRunningPace(mergedHistory);

const categoryPercentiles: CategoryPercentile[] = CATEGORIES.map((cat) => {
  if (cat === "cardio") {
    if (cardioStatus.eligibleRunCount === 0 || cardioBestPace == null) {
      return { category: cat, rank: 50, percentile: 50, bwRatio: 0, hasData: false };
    }
    const percentile = getCardioPacePercentile(cardioBestPace, gender, age);
    return {
      category: cat,
      rank: percentileToRank(percentile),
      percentile,
      bwRatio: 0,
      hasData: true,
    };
  }
  // ... 기존 로직
});
```

**육각형 축 데이터 회색 틴트 (line 96-102):**
```tsx
const hexAxes: HexagonAxis[] = categoryPercentiles.map((cp) => ({
  label: isKo ? CATEGORY_LABELS[cp.category].ko : CATEGORY_LABELS[cp.category].en,
  value: cp.hasData ? cp.percentile : 0,
  rankText: cp.hasData
    ? `${cp.rank}${isKo ? "등" : "th"}`
    : "-",
  // 회의 64-X: cardio 축 잠정 상태 시 회색 틴트 플래그 (HexagonChart에서 지원 필요)
  tentative: cp.category === "cardio" && cp.hasData && !cardioStatus.isConfirmed,
}));
```

> **HexagonChart.tsx 확장 필요:** `HexagonAxis` 타입에 `tentative?: boolean` 추가. 렌더 시 해당 축 색상을 회색으로 override. **이 변경도 스펙에 포함** (Batch E 내).

**잠정 마이크로카피 (hexAxes 하단에 추가, line 146 `<HexagonChart />` 다음):**
```tsx
{cardioStatus.eligibleRunCount > 0 && !cardioStatus.isConfirmed && (
  <p className="text-[10px] font-bold text-gray-400 text-center mt-2">
    {t("status.cardio.tentative", {
      count: String(cardioStatus.eligibleRunCount),
      needed: String(Math.max(0, 3 - cardioStatus.eligibleRunCount)),
    })}
  </p>
)}
```

**러닝 단독 피트니스 나이 경고 (line 110-132 fitnessAge 카드 내부):**
```tsx
{/* 회의 64-X Q5: 러닝 단독일 때 cardio 축만 계산됨을 알림 */}
{hasAnyData && categoryPercentiles.filter(c => c.hasData).length === 1 && categoryPercentiles.find(c => c.hasData)?.category === "cardio" && (
  <p className="text-[10px] font-bold text-amber-600 mt-1">
    {t("status.fitnessAge.cardioOnly")}
  </p>
)}
```

#### Change E-4: `src/components/HexagonChart.tsx` 확장

**`HexagonAxis` type에 `tentative?: boolean` 추가.** 각 축의 값 렌더 시 `tentative === true`이면 dot 색상을 `gray-400`으로. (실제 구현은 현재 HexagonChart의 구조에 따라 결정 — Grep으로 파일 구조 먼저 읽은 후 최소 수정.)

#### Change E-5: i18n 키

**ko.json (`running.goalReached` 근처에 추가):**
```json
"status.cardio.tentative": "러닝 {count}회 기록 중 — {needed}회 더 또는 2주 경과 시 체력 축 확정",
"status.fitnessAge.cardioOnly": "체력 축만 계산됨 — 다른 부위 운동 시 정확도 상승",
```

**en.json:**
```json
"status.cardio.tentative": "Cardio axis: {count} run(s) logged — {needed} more run(s) or 2 weeks to confirm",
"status.fitnessAge.cardioOnly": "Cardio-only estimate — add strength training for accuracy",
```

### 6.4 Acceptance Criteria (E)
- [ ] `fitnessPercentile.ts:523` (getBestRunningPace) 필터에 `"threshold"`, `"time_trial"` 포함 (array length 5)
- [ ] `fitnessPercentile.ts` 최소 거리 `rs.distance < 1000` (기존 2000 → 1000 완화)
- [ ] `fitnessPercentile.ts`에 `getCardioConfidenceStatus` export 신설
- [ ] `CardioStatus` interface에 `eligibleRunCount`, `daysSinceFirstRun`, `isConfirmed` 3개 필드
- [ ] 확정 로직: `eligible.length >= 3 \|\| daysSince >= 14`
- [ ] `StatusTab.tsx`에서 `cardio` 분기에 `hasData: false` 하드코딩 **제거** (대신 `cardioBestPace` 조건)
- [ ] `StatusTab.tsx`에 `recentHistory` + `currentRunningStats` props 존재
- [ ] `WorkoutReport.tsx`에서 StatusTab 호출 2곳 모두 `recentHistory` + `currentRunningStats` 전달
- [ ] `status.cardio.tentative`, `status.fitnessAge.cardioOnly` ko + en 양쪽 존재 (총 4건)
- [ ] `HexagonAxis` type에 `tentative?: boolean` 추가
- [ ] `npx tsc --noEmit` 에러 0

### 6.5 평가자 검증 명령어 (E)
```bash
grep -n "rs.distance < 1000" /Users/joord/Desktop/Joord/ohunjal-ai/src/utils/fitnessPercentile.ts
grep -n "getCardioConfidenceStatus" /Users/joord/Desktop/Joord/ohunjal-ai/src/utils/fitnessPercentile.ts
grep -n "isConfirmed" /Users/joord/Desktop/Joord/ohunjal-ai/src/utils/fitnessPercentile.ts
grep -n "cardioStatus" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/tabs/StatusTab.tsx
grep -n "recentHistory" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/tabs/StatusTab.tsx
grep -n "currentRunningStats" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/tabs/StatusTab.tsx  # expect 2+
grep -cn "currentRunningStats={runningStats}" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/report/WorkoutReport.tsx  # expect 2
grep -n '"status.cardio.tentative"\|"status.fitnessAge.cardioOnly"' /Users/joord/Desktop/Joord/ohunjal-ai/src/locales/ko.json /Users/joord/Desktop/Joord/ohunjal-ai/src/locales/en.json  # expect 4
grep -n "tentative" /Users/joord/Desktop/Joord/ohunjal-ai/src/components/HexagonChart.tsx
cd /Users/joord/Desktop/Joord/ohunjal-ai && npx tsc --noEmit
```

### 6.6 브라우저 테스트 시나리오 (E)
1. 신규 계정 로그인 → 과거 러닝 기록 0
2. 2km easy run 1회 완료 → 리포트 [나] 탭
3. 육각형 차트: "체력" 축이 회색으로 켜짐 + "러닝 1회 기록 중 — 2회 더 또는 2주 경과 시 체력 축 확정" 문구
4. 2~3일 내 2km easy run 2회 추가 (총 3회) → 리포트 [나] 탭에서 "체력" 축이 진녹색으로 전환 + 잠정 문구 사라짐
5. 러닝만 한 계정에서 피트니스 나이 카드: "체력 축만 계산됨" amber 경고 표시
6. 웨이트 운동 1회 추가 → 경고 사라짐
7. Norwegian 4×4 (vo2_interval) 1회 완료 → 체력 축 **배제 유지** (eligibleRunCount 증가 안 함)
8. 800m 짜리 짧은 러닝 (1km 미만) 완료 → 체력 축 배제

---

## 7. 공통 주의사항

### 7.1 프로젝트 규칙 준수 (CLAUDE.md + .claude/rules/)
- **i18n 동시성 (`feedback_i18n_always.md`)**: ko.json + en.json 동시 반영. Batch A, D, E에서 신규 키 추가 시 양쪽 JSON 같은 줄 번호대에 추가.
- **이모지 금지 (`feedback_no_emoji.md`, `feedback_no_decorative_svg.md`)**: 유니코드 이모지 전면 금지. SVG는 의미 연결된 것만 (본 스펙의 체크 아이콘, 완료 버튼 체크는 의미 있는 SVG).
- **Cloud Functions 빌드 (`feedback_cloud_functions_build.md`)**: Batch B, C에서 `functions/` 변경 시 배포 전 `cd functions && npm run build` 필수.
- **Git status 확인 (`feedback_git_status_check.md`)**: 커밋 전 `git status` 확인. 특히 Batch D의 신규 파일 `TTCard.tsx`, Batch C의 `migrateRunTypeV2.ts` untracked 누락 방지.
- **커밋 attribution (`feedback_commit_attribution.md`)**: Co-Authored-By Claude 트레일러 금지.
- **회의 로그 (`feedback_meeting_log.md`)**: 각 Batch 머지 시 `.planning/MEETING_LOG.md`에 회의 64-X/Y/Z 결정 + 구현 결과 기록 의무.
- **현재 상태 문서 (`feedback_current_state_doc.md`)**: 기능 변경 완료 후 `.planning/CURRENT_STATE.md` 갱신 (러닝 8종 재분류, 체력 축 러닝 연결).

### 7.2 스펙 외 변경 금지 원칙
평가자는 다음 파일 외 변경이 발견되면 **"스펙 외"** 로 반려:
- Batch A: `FitScreen.tsx`, `ko.json`, `en.json`
- Batch B: `src/constants/workout.ts`, `functions/src/runningProgram.ts`, `functions/src/workoutEngine.ts`, `src/utils/runningFormat.ts`
- Batch C: `functions/src/admin/migrateRunTypeV2.ts` (신규), `functions/src/index.ts`
- Batch D: `src/components/report/RunningReportBody.tsx`, `src/components/report/TTCard.tsx` (신규), `src/components/report/WorkoutReport.tsx`, `ko.json`, `en.json`
- Batch E: `src/utils/fitnessPercentile.ts`, `src/components/report/tabs/StatusTab.tsx`, `src/components/report/WorkoutReport.tsx`, `src/components/HexagonChart.tsx`, `ko.json`, `en.json`

예외: 외래 import 추가로 인해 import 섹션이 바뀌는 것은 허용.

### 7.3 배포 순서
1. Batch A, D, E (클라이언트) → `git push` → CI 자동 배포
2. Batch B 서버 부분 → `cd functions && npm run build && firebase deploy --only functions`
3. Batch C 마이그레이션 → 배포 후 **수동 dry run → 실행** (대표가 직접)
4. Batch C 완료 후 Batch D 실전 검증 (과거 Firestore 레코드가 `time_trial`로 카드 분기되는지)

---

## 8. 평가자 최종 검증 프로토콜

모든 Batch 구현 완료 주장 시 평가자가 순차 실행:

### 8.1 TypeScript / Lint 무결성
```bash
cd /Users/joord/Desktop/Joord/ohunjal-ai && npx tsc --noEmit
# 기대: 에러 0

cd /Users/joord/Desktop/Joord/ohunjal-ai && npm run lint
# 기대: 신규 에러 0 (기존 warning 무시)

cd /Users/joord/Desktop/Joord/ohunjal-ai/functions && npm run build
# 기대: 에러 0
```

### 8.2 각 Batch 검증 명령어 순차 실행
Batch A → B → D → E 순서로 **§2.6, §3.5, §4.6, §5.5, §6.5** 명령어 실행. 각 명령어의 기대값과 실제값 일치 확인.

### 8.3 Git status 최종 점검
```bash
cd /Users/joord/Desktop/Joord/ohunjal-ai && git status
```
기대 수정 파일 (최대):
```
modified:   src/components/workout/FitScreen.tsx
modified:   src/locales/ko.json
modified:   src/locales/en.json
modified:   src/constants/workout.ts
modified:   functions/src/runningProgram.ts
modified:   functions/src/workoutEngine.ts
modified:   src/utils/runningFormat.ts
modified:   functions/src/index.ts
modified:   src/components/report/RunningReportBody.tsx
modified:   src/components/report/WorkoutReport.tsx
modified:   src/utils/fitnessPercentile.ts
modified:   src/components/report/tabs/StatusTab.tsx
modified:   src/components/HexagonChart.tsx
?? .planning/SPEC-64-XYZ.md
?? src/components/report/TTCard.tsx
?? functions/src/admin/migrateRunTypeV2.ts
```

### 8.4 브라우저 UAT 시나리오
§2.7, §5.6, §6.6 각각 수행. 실패 시 Batch 반려.

### 8.5 회의 64 결정 9개 트레이스 체크
평가자는 아래 9개 결정이 각각 어느 Batch / 어느 파일에 반영됐는지 역추적 가능해야 함:

| 결정 | 반영 위치 |
|---|---|
| 64-X Q1: 1회부터 잠정 | Batch E / StatusTab.tsx `cardioStatus.eligibleRunCount > 0 && !isConfirmed` |
| 64-X Q2: 3회 OR 2주 | Batch E / fitnessPercentile.ts `eligible.length >= 3 \|\| daysSince >= 14` |
| 64-X Q3: 1km 완화 | Batch E / fitnessPercentile.ts `rs.distance < 1000` |
| 64-X Q4: 인터벌 배제 | Batch E / fitnessPercentile.ts filter `["easy","tempo","long","threshold","time_trial"]` |
| 64-X Q5: 러닝 단독 경고 | Batch E / StatusTab.tsx `cardioOnly` 경고 |
| 64-Y Q1: 과거 데이터 소급 | Batch C / migrateRunTypeV2.ts |
| 64-Y Q2: fartlek → vo2_interval | Batch B / runningProgram.ts:282, workoutEngine.ts:1170 |
| 64-Y Q3: threshold 2x15 전체 평균만 | Batch B (tag="threshold") + Batch D (splits 카드로 렌더) |
| 64-Y Q4: TT v1 PR + 한 줄 | Batch D / TTCard.tsx (PR 뱃지 + `running.tt.faster/slower/same/firstRecord`) |
| 64-Z B 변형 | Batch A / FitScreen.tsx 6가지 신호 (종소리/진동/뱃지/펄스/자동종료X/중복방지) |

---

## 9. 스펙 버전 히스토리

| 버전 | 날짜 | 작성자 | 변경 |
|---|---|---|---|
| v1.0 | 2026-04-19 | Planner Agent | 초기 스펙 (회의 64-X/Y/Z 통합, 5개 Batch) |

---

**평가자 유의:** 본 스펙은 구현 전 **코드 사전 조사**를 통해 작성되었다 (§0 참조). `getCardioPacePercentile` 존재 확인, `detectExerciseRunningType` 구조 확인, `StatusTab` hardcoded cardio `hasData:false` 위치 확인, `RunningReportBody` 카드 구조 확인, 서버 `runningProgram.ts`의 `runType:"sprint"` 9곳 / `"fartlek"` 1곳 / `workoutEngine.ts`의 2곳 전수 파악 완료. 구현 중 코드 구조가 이 조사와 다르게 발견되면 스펙 업데이트 후 재승인 필요.
