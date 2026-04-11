# DA 리팩토링 설계서

**작성일:** 2026-04-11
**참석 전문가:** 이화식(엔코아), 박서진(Toss FE Head), 황보현우(데이터 분석), 프엔 개발자, 백엔드 개발자, 평가자, 기획자
**대표:** 임주용
**상태:** 대표 컨펌 대기

---

## 0. 작업 배경

### 0.1 현재 상황
- 론칭 1일차, 유저 315명, 활성 ~50명, 유료 0명
- `users/{uid}/workout_history/{id}` 단일 Firestore 문서에 **4개의 서로 다른 엔티티**가 혼재
- 실제 샘플 데이터에서 **`totalDurationSec: 79초` / `totalReps: 303`** 등 물리적으로 불가능한 데이터 발견
- GA4 이벤트 일부 누락 (abandon/reject 이벤트 없음)
- GA4 ↔ Firebase uid 매핑 없음 (user_id 설정 안 됨)

### 0.2 작업 목표
1. **이벤트 보강** — 이탈 지점 정확한 파악
2. **접근 통일** — 19곳의 직접 localStorage 접근을 중앙 유틸 경유로
3. **스키마 분리** — 4개 엔티티를 독립 컬렉션으로 분리, dual-source로 안전 롤아웃

### 0.3 중요 제약
- **기존 유저 경험 절대 깨트리지 않음**
- **각 Phase 후 반드시 체크포인트 + 버그 확인**
- 문제없다 판단되면 다음 Phase로 연결 OK
- 백엔드 Cloud Functions는 이번 범위에서 **건드리지 않음** (workout_history 접근 안 함)

---

## 1. 작업 범위 (3개 트랙)

### 트랙 A — 이벤트 보강 (황보현우 주도)
**목표:** `condition_check_abandon`, `plan_preview_reject`, `setAnalyticsUserId` 3개 추가
**리스크:** 🟢 극저
**소요 커밋:** 3~4개 atomic
**의존성:** 없음 (독립 수행 가능)

### 트랙 B — 접근 통일 (박서진 + 프엔 개발자 주도)
**목표:** 직접 localStorage 접근 19지점을 유틸 경유로 전환 + ESLint 규칙으로 재발 방지
**리스크:** 🟡 낮음
**소요 커밋:** 파일당 1개 atomic (약 7개)
**의존성:** 트랙 C의 선행 조건

### 트랙 C — 스키마 리팩토링 (이화식 + 박서진 주도)
**목표:** Strangler Fig 5단계로 `workout_history` → `sessions` + `daily_snapshots` + `next_recommendations` 분리
**리스크:** 🟡 중간
**소요 커밋:** 단계별 다수
**의존성:** 트랙 B 완료 후 시작

### 장기 숙제 (백엔드 개발자, 범위 밖)
- 서버사이드 stats 재계산으로 `79초/303회` 같은 조작 데이터 차단
- **본 리팩토링 완료 후 별도 Phase**로 진행

---

## 2. 현재 상태 Fact Sheet (평가자 전수조사 결과)

### 2.1 코드 touchpoint 매트릭스

| 파일 | 읽기 지점 | 쓰기 지점 | 위험도 |
|---|---|---|---|
| [src/utils/workoutHistory.ts](../src/utils/workoutHistory.ts) | — (중앙 유틸) | — | 🟢 기준점 |
| [src/app/app/page.tsx](../src/app/app/page.tsx) | 7 | 1 | 🟡 |
| [src/components/report/WorkoutReport.tsx](../src/components/report/WorkoutReport.tsx) | 3 | 3 | 🟡 |
| [src/components/dashboard/ProofTab.tsx](../src/components/dashboard/ProofTab.tsx) | 0 | 2 | 🟡 |
| [src/components/dashboard/HomeScreen.tsx](../src/components/dashboard/HomeScreen.tsx) | 1 | 0 | 🟢 |
| [src/components/workout/WorkoutSession.tsx](../src/components/workout/WorkoutSession.tsx) | 1 | 0 | 🟢 |
| [src/components/plan/ConditionCheck.tsx](../src/components/plan/ConditionCheck.tsx) | 1 | 0 | 🟢 |
| **Cloud Functions** | **0** | **0** | 🟢 |

### 2.2 인프라 Fact

- **배포:** Firebase Hosting + Next.js SSR (`frameworksBackend`)
- **PWA:** Service Worker 존재 ([public/sw.js](../public/sw.js)), Network-first with cache fallback
- **SW 캐시 정책:** HTML/manifest만 precache, JS/CSS는 네트워크 우선 → **구버전 JS 캐시 위험 낮음**
- **Firestore 구조:** `users/{uid}/workout_history/{historyId}` subcollection
- **Firestore rules:** 본인만 read/write ([firestore.rules:15-17](../firestore.rules#L15-L17))
- **Dual-source 아키텍처 이미 존재:** Firestore authoritative + localStorage cache
- **마이그레이션 유틸 이미 존재:** 로그인 첫 시점에 localStorage → Firestore (`migrateToFirestore` in [workoutHistory.ts](../src/utils/workoutHistory.ts))
- **`stripUndefined` 유틸 이미 존재** (Firestore undefined 거부 문제 해결)
- **총 유저 수:** ~315 (Firebase Console 기준)
- **총 workout_history 문서:** ~500~800건 추정 (`planCount: 2` 샘플 기반)

### 2.3 MasterPlanPreview 마운트/언마운트 경로
**진입 3곳:**
- `handleConditionComplete` 끝 ([page.tsx:588](../src/app/app/page.tsx#L588))
- `WorkoutSession.onBack` ([page.tsx:773](../src/app/app/page.tsx#L773))
- Pending session polling 완료 ([page.tsx:947](../src/app/app/page.tsx#L947))

**이탈 2곳만:**
- `onStart` → workout_session ([page.tsx:715](../src/app/app/page.tsx#L715))
- `onBack` → condition_check ([page.tsx:716](../src/app/app/page.tsx#L716))

**중요:** `handleIntensityChange`, `handleRegenerate`는 **view를 바꾸지 않음**. props만 갱신. → MasterPlanPreview 리마운트 안 됨. → **unmount 기반 abandon 탐지는 부적절**, 명시적 exit path 발화로 가야 함.

### 2.4 `WorkoutHistory` 타입의 구조적 결함 (이화식 분석)

```typescript
// ⚠️ 4개의 서로 다른 엔티티가 혼재
interface WorkoutHistory {
  id, date, sessionData, logs, stats, exerciseTimings   // 세션 엔티티
  analysis?, coachMessages?, runningStats?              // 세션 엔티티 (optional)
  reportTabs?: {
    status: {...}      // 유저 상태 엔티티 — 세션마다 중복
    nutrition: {...}   // 유저 상태 엔티티 — 세션마다 중복
    today: {...}       // 날짜 집계 엔티티
    next: {...}        // ephemeral 추천 — 저장 필요성 의문
  }
}
```

**핵심 결함:**
- `logs: Record<number, ExerciseLog[]>` ← Firestore 안티패턴 (Array여야 함)
- `exerciseTimings[i].exerciseIndex` ← `sessionData.exercises[i]`와 **암시적 인덱스 조인**
- `reportTabs.nutrition` / `reportTabs.status` ← 세션마다 복제 (스토리지 낭비 + 일관성 위험)
- 문자열/숫자 타입 혼재: `count: "5세트 / 8회"` vs `reps: 8` vs `weight: "10회가 힘든 무게"` vs `weightUsed: "10"` (숫자인데 문자열)

---

## 3. 트랙 A — 이벤트 보강 (상세 설계)

### 3.1 변경 파일
1. [src/utils/analytics.ts](../src/utils/analytics.ts)
2. [src/components/plan/ConditionCheck.tsx](../src/components/plan/ConditionCheck.tsx)
3. [src/app/app/page.tsx](../src/app/app/page.tsx)

### 3.2 변경 상세

#### A-1. `analytics.ts` — 타입 추가 + 헬퍼 함수

**변경:**
```typescript
// 기존 FunnelEvent union에 2개 추가
| "condition_check_abandon"
| "plan_preview_reject"

// 파일 끝에 헬퍼 함수 추가
/**
 * GA4 user_id 설정 — 로그인 시 Firebase uid 전달
 * BigQuery에서 GA 이벤트 ↔ Firestore 문서 조인 가능해짐
 * null 전달 시 user_id 해제 (로그아웃)
 */
export function setAnalyticsUserId(userId: string | null) {
  try {
    window.gtag?.("set", { user_id: userId });
  } catch {
    // 실패해도 앱 동작 영향 없음
  }
}
```

**리스크:** 🟢 극저. 새 타입은 union 확장, 새 함수는 dead code until used.

**검증:**
- `npm run lint` 통과
- `npm run build` 통과 (tsc strict)

#### A-2. `ConditionCheck.tsx` — abandon 이벤트 발화

**원리:** `handleBack()`에서 **첫 스텝에서 뒤로가기 + 아직 complete 안 했으면** abandon 발화.
내부 step back(goTo)은 건드리지 않음. 오직 root exit에서만.

**변경 위치:** [ConditionCheck.tsx:135-142](../src/components/plan/ConditionCheck.tsx#L135-L142) `handleBack`

**변경 내용:**
```typescript
// 추가: mount 시 ref 초기화
const completedRef = useRef(false);

// 기존 condition_check_complete 발화 지점에 추가:
// line 178
trackEvent("condition_check_complete", { goal: selectedGoal });
completedRef.current = true;  // ← 추가

// 기존 handleBack 수정
const handleBack = () => {
  const idx = stepOrder.indexOf(step);
  if (idx > 0) {
    goTo(stepOrder[idx - 1]);
  } else if (onBack) {
    // ← 추가: 루트 스텝에서 뒤로가기 = abandon
    if (!completedRef.current) {
      trackEvent("condition_check_abandon", { last_step: step });
    }
    onBack();
  }
};
```

**리스크:** 🟢 극저. 기존 동작 변화 0, 이벤트만 추가.

**주의사항:**
- useRef 훅 import 이미 있음 ([ConditionCheck.tsx:3](../src/components/plan/ConditionCheck.tsx#L3))
- `completedRef` 선언은 containerRef 근처 ([line 72](../src/components/plan/ConditionCheck.tsx#L72))

**검증:**
- Firebase DebugView에서 Chrome DevTools → condition_check 진입 → 뒤로가기 → `condition_check_abandon` 이벤트 1회만 찍히는지 확인
- 정상 완료 플로우 → `condition_check_complete`만 찍히고 abandon은 안 찍혀야 함

#### A-3. `page.tsx` — plan_preview_reject + setAnalyticsUserId

**변경 3곳:**

**(a) [page.tsx:716](../src/app/app/page.tsx#L716) — onBack wrapper:**
```typescript
// 기존
onBack={() => setView("condition_check")}

// 신규
onBack={() => {
  trackEvent("plan_preview_reject", {
    exercise_count: currentWorkoutSession?.exercises.length ?? 0
  });
  setView("condition_check");
}}
```

**(b) [page.tsx:310](../src/app/app/page.tsx#L310) — 로그인 시 setAnalyticsUserId:**
```typescript
// 기존
if (firebaseUser) {
  setIsLoggedIn(true);
  localStorage.setItem("auth_logged_in", "1");
  // ...
}

// 신규
if (firebaseUser) {
  setIsLoggedIn(true);
  localStorage.setItem("auth_logged_in", "1");
  setAnalyticsUserId(firebaseUser.uid);  // ← 추가
  // ...
}
```

**(c) [page.tsx:645](../src/app/app/page.tsx#L645) — 로그아웃 시 setAnalyticsUserId(null):**
```typescript
// 기존
setIsLoggedIn(false);
setUser(null);

// 신규
setIsLoggedIn(false);
setUser(null);
setAnalyticsUserId(null);  // ← 추가
```

**import 추가:** [page.tsx:27](../src/app/app/page.tsx#L27)
```typescript
import { trackEvent, setAnalyticsUserId } from "@/utils/analytics";
```

**리스크:** 🟢 극저. 이벤트/set 호출만 추가.

**주의사항:**
- setAnalyticsUserId는 익명 로그인 블록 (line 300-307)에서는 **호출하지 않음** (익명 uid는 매번 바뀜, GA 유저 식별 의미 없음)
- 정상 Google 로그인 블록에서만 호출

**검증:**
- Chrome DevTools → Network → gtag 요청에 `user_id=<firebase_uid>` 포함되는지 확인
- 24시간 후 GA4 → 탐색 → user_id 기준 리포트 가능한지 확인

### 3.3 트랙 A 롤아웃 순서

```
커밋 1: analytics.ts 수정
커밋 2: ConditionCheck.tsx 수정
커밋 3: page.tsx 수정 (plan_preview_reject + setAnalyticsUserId)
[배포]
[수동 테스트: DebugView에서 3개 이벤트 확인]
[버그 없으면 → 트랙 B 진입]
```

**각 커밋 후 체크:**
- [ ] tsc 통과
- [ ] `npm run lint` 통과
- [ ] `npm run dev`로 로컬 확인 (크롬 DevTools Network → gtag 요청)

### 3.4 트랙 A 롤백 시나리오
각 커밋은 atomic이라 `git revert <hash>`로 즉시 롤백 가능. 배포된 상태에서도 Firebase Hosting은 이전 빌드로 원클릭 롤백.

---

## 4. 트랙 B — 접근 통일 (상세 설계)

### 4.1 목표
19지점의 직접 localStorage 접근을 유틸 경유로 전환. 데이터 구조는 **손대지 않음**. 경로만 추상화.

### 4.2 신규 유틸 함수 (workoutHistory.ts에 추가)

```typescript
/**
 * 동기 캐시 조회 — 이미 localStorage에 저장된 데이터만 즉시 반환.
 * Firestore fetch 없음. 로그인 직후 등 캐시 미비 시점에는 빈 배열.
 * 기존 localStorage.getItem + JSON.parse 패턴을 대체.
 */
export function getCachedWorkoutHistory(): WorkoutHistory[] {
  try {
    const raw = localStorage.getItem("ohunjal_workout_history");
    return raw ? JSON.parse(raw) as WorkoutHistory[] : [];
  } catch {
    return [];
  }
}

/**
 * 캐시 전체 교체 — ProofTab에서 삭제/편집 후 재저장용.
 * localStorage + Firestore 둘 다 동기화.
 */
export async function replaceCachedWorkoutHistory(history: WorkoutHistory[]): Promise<void> {
  try {
    localStorage.setItem("ohunjal_workout_history", JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save cached history", e);
  }
  // Firestore는 개별 문서 단위이므로 이 함수는 localStorage만 업데이트
  // (기존 UX상 삭제는 deleteWorkoutHistory()를 쓰도록 가이드)
}
```

### 4.3 치환 매트릭스

| # | 파일:line | 기존 | 신규 |
|---|---|---|---|
| 1 | page.tsx:537 | `localStorage.getItem(...)` + JSON.parse | `getCachedWorkoutHistory()` |
| 2 | page.tsx:618 | 키 참조 | `"ohunjal_workout_history"` 상수 그대로 (삭제용) |
| 3 | page.tsx:693 | 직접 읽기 | `getCachedWorkoutHistory().length` |
| 4 | page.tsx:694 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 5 | page.tsx:764 | 직접 읽기 (post-save) | `getCachedWorkoutHistory()` |
| 6 | page.tsx:793 | 직접 읽기/쓰기 | `getCachedWorkoutHistory()` + 기존 `updateReportTabs` |
| 7 | page.tsx:812 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 8 | page.tsx:862 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 9 | page.tsx:877 | 직접 읽기 (key prop) | `getCachedWorkoutHistory().length` |
| 10 | WorkoutReport.tsx:146 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 11 | WorkoutReport.tsx:270,274 | 직접 읽기+쓰기 | `getCachedWorkoutHistory()` + 유틸 쓰기 |
| 12 | WorkoutReport.tsx:554,558 | 직접 읽기+쓰기 | 동일 |
| 13 | WorkoutReport.tsx:762 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 14 | HomeScreen.tsx:106 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 15 | WorkoutSession.tsx:70 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 16 | ConditionCheck.tsx:79 | 직접 읽기 | `getCachedWorkoutHistory()` |
| 17 | ProofTab.tsx:201 | 직접 쓰기 | `replaceCachedWorkoutHistory(updated)` |
| 18 | ProofTab.tsx:215 | 직접 쓰기 | `replaceCachedWorkoutHistory(updatedHistory)` |

### 4.4 ESLint 규칙 (재발 방지)

**파일:** `.eslintrc.json` 또는 `eslint.config.mjs`

**규칙:**
```javascript
{
  "no-restricted-syntax": [
    "error",
    {
      "selector": "CallExpression[callee.object.name='localStorage'][arguments.0.value='ohunjal_workout_history']",
      "message": "Use getCachedWorkoutHistory() or replaceCachedWorkoutHistory() from @/utils/workoutHistory instead of direct localStorage access."
    }
  ]
}
```

**예외 처리:** `src/utils/workoutHistory.ts` 파일 내부는 ESLint disable 주석으로 허용.

### 4.5 트랙 B 롤아웃 순서

```
커밋 B-0: analytics.ts 타입, 유틸 함수 추가 (getCachedWorkoutHistory, replaceCachedWorkoutHistory)
커밋 B-1: ConditionCheck.tsx 치환 (1지점)
커밋 B-2: HomeScreen.tsx 치환 (1지점)
커밋 B-3: WorkoutSession.tsx 치환 (1지점)
커밋 B-4: ProofTab.tsx 치환 (2지점)
커밋 B-5: WorkoutReport.tsx 치환 (6지점)
커밋 B-6: page.tsx 치환 (8지점) ← 가장 큰 커밋
커밋 B-7: ESLint 규칙 추가
[배포]
[수동 테스트]
```

**각 커밋 후 체크:**
- [ ] tsc 통과
- [ ] lint 통과
- [ ] 해당 파일이 렌더하는 화면 **실제로 열어서 workout_history 데이터 정상 표시 확인**
- [ ] 평가자 체크: tsc 통과 ≠ 동작 정상, 렌더 경로 추적 필수

### 4.6 트랙 B 롤백 시나리오
- 커밋 B-7 롤백: ESLint 끄기 → 개발 속도 회복
- 커밋 B-1~B-6 개별 롤백 가능 (atomic)
- 전체 롤백: `git revert` 체인 (커밋 7개)

### 4.7 트랙 B 완료 조건
- [ ] Grep `localStorage.*ohunjal_workout_history` 결과가 `src/utils/workoutHistory.ts` 한 파일만 남아야 함
- [ ] 모든 화면에서 기존 동작 확인 (플랜 미리보기 → 운동 → 리포트 → 프루프 탭 → 홈)

---

## 5. 트랙 C — 스키마 리팩토링 (상세 설계)

### 5.1 신규 스키마 설계 (이화식 제안)

#### 5.1.1 `users/{uid}/sessions/{sessionId}` — 세션 엔티티
```typescript
interface WorkoutSession {
  id: string;
  createdAt: Timestamp;
  date: string;  // ISO
  
  meta: {
    title: string;
    description: string;
    intendedIntensity?: "high" | "moderate" | "low";
    goal?: WorkoutGoal;
    durationSec: number;
  };
  
  exercises: ExerciseSnapshot[];   // 명시적 order, 배열
  executions: ExecutionLog[];       // 평면 배열, exerciseOrder FK
  stats: WorkoutStats;              // 기존과 동일 구조 유지
  
  runningStats?: RunningStats;
  coachMessages?: string[];
  
  dataQuality: {
    isValid: boolean;
    reasons?: string[];  // e.g. ["duration_too_short"]
  };
}

interface ExerciseSnapshot {
  order: number;              // 명시적 순서 (0-indexed)
  name: string;
  phase: ExercisePhase;
  type: ExerciseType;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;      // 숫자로 통일 (null 가능)
  targetWeightLabel?: string; // "10회가 힘든 무게" 같은 문자열은 여기로
  tempoGuide?: string;
  durationSec: number;        // 기존 exerciseTimings를 여기 흡수
}

interface ExecutionLog {
  exerciseOrder: number;      // FK to ExerciseSnapshot.order
  setNumber: number;
  repsCompleted: number;
  weightUsed?: number;        // 숫자로 통일
  weightUsedLabel?: string;   // 문자열은 여기
  feedback: "fail" | "target" | "easy" | "too_easy";
  completedAt?: number;       // ms epoch
}
```

#### 5.1.2 `users/{uid}/daily_snapshots/{yyyy-mm-dd}` — 일일 유저 상태
```typescript
interface DailySnapshot {
  date: string;               // doc ID와 동일
  updatedAt: Timestamp;
  
  fitness: {
    percentiles: Percentile[];
    overallRank: number;
    fitnessAge: number;
    ageGroupLabel: string;
    genderLabel: string;
  };
  
  nutrition: {
    dailyCalorie: number;
    goalBasis: string;
    macros: { protein: number; carb: number; fat: number };
    meals: { time: string; menu: string }[];
    keyTip: string;
    chatHistory?: { role: "user" | "assistant"; content: string }[];
  } | null;
  
  today: {
    volumeChangePercent: number | null;
    caloriesBurned: number;
    foodAnalogy: string;
    recoveryHours: string;
    stimulusMessage: string;
  };
}
```

#### 5.1.3 `users/{uid}/next_recommendations/current` — 최신 추천 (단일 문서)
```typescript
interface NextRecommendation {
  updatedAt: Timestamp;
  message: string;
  recommendedPart: string;
  recommendedIntensity: string;
  weightGoal?: { exerciseName: string; targetWeight: number };
  questProgress?: {...};
  weekSessions?: {...}[];
}
```

### 5.2 Phase 0 — 선행 조건
트랙 B 완료가 선행 조건. 트랙 B 없이 트랙 C 진입 금지.

### 5.3 Phase 1 — Dual Write 가동

**변경:** `saveWorkoutHistory`, `updateReportTabs`, `updateCoachMessages`, `updateWorkoutAnalysis`가 신규 컬렉션에도 함께 쓰기.

**구현 전략:**
```typescript
export async function saveWorkoutHistory(entry: WorkoutHistory): Promise<void> {
  // (기존) localStorage + workout_history 저장
  // ...
  
  // (신규) sessions 컬렉션에도 병행 저장
  try {
    const newEntry = transformToNewSchema(entry);
    await setDoc(doc(collection(db, "users", uid, "sessions"), entry.id), newEntry);
  } catch (e) {
    console.error("Failed to save to new sessions schema (non-blocking)", e);
    // 실패해도 기존 플로우 정상 — fire-and-forget
  }
}
```

**Firestore security rules 추가:**
```
match /users/{userId}/sessions/{sessionId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
match /users/{userId}/daily_snapshots/{date} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
match /users/{userId}/next_recommendations/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**리스크:** 🟢 낮음. 신규 write 실패는 try-catch로 swallow. 기존 동작 0 영향.

**검증 방법:**
- Phase 1 배포 후 대표님이 운동 1회 완료 → Firestore 콘솔에서 `users/{uid}/workout_history/{id}` + `users/{uid}/sessions/{id}` 둘 다 생성되었는지 확인
- 두 문서의 `stats`, `exercises` 등 핵심 필드 일치 확인

### 5.4 Phase 2 — 검증 (최소 1주일 이상)

**활동:**
- 매일 BigQuery 쿼리로 `workout_history` vs `sessions` diff 확인
- 불일치 발생 시 `transformToNewSchema()` 버그 → 수정 → 재배포

**검증 SQL 예시:**
```sql
-- 두 컬렉션에서 같은 날 저장된 세션 수 비교
WITH wh AS (
  SELECT DATE(created_at) as day, COUNT(*) as wh_count
  FROM `workout_history_changelog`
  WHERE operation IN ('CREATE', 'IMPORT')
  GROUP BY day
),
s AS (
  SELECT DATE(created_at) as day, COUNT(*) as s_count
  FROM `sessions_changelog`
  WHERE operation IN ('CREATE', 'IMPORT')
  GROUP BY day
)
SELECT wh.day, wh.wh_count, s.s_count, (wh.wh_count - s.s_count) as diff
FROM wh LEFT JOIN s USING(day)
ORDER BY day DESC;
```

**종료 조건:** 7일 연속 diff = 0.

### 5.5 Phase 3 — 읽기 스위치 (Feature Flag)

**Feature flag 설계:**
- 저장 위치: `users/{uid}/flags/da_schema_version: "v1" | "v2"`
- 기본값: `"v1"` (기존 스키마 읽기)
- 전환: 관리자 수동 업데이트 또는 유저별 롤아웃 로직

**클라이언트 구현:**
```typescript
async function loadWorkoutHistoryV2(): Promise<WorkoutHistory[]> {
  const flag = await getUserFlag("da_schema_version") ?? "v1";
  
  if (flag === "v2") {
    // 신규 읽기
    const sessions = await loadFromSessions();
    const snapshots = await loadDailySnapshots();
    return mergeToLegacyShape(sessions, snapshots);  // 기존 UI 호환용
  }
  
  // 기존 읽기
  return loadWorkoutHistory();
}
```

**롤아웃 단계:**
1. 대표님 계정 1명 (self-test, 최소 3일)
2. 내부 테스트 5명
3. 활성 유저 5%
4. 활성 유저 25%
5. 전체 100%

**각 단계 체크포인트:**
- [ ] 프루프 탭에서 과거 히스토리 정상 표시
- [ ] 홈 화면 "이전 운동" 정상 표시
- [ ] 운동 리포트 재진입 시 reportTabs 정상 표시
- [ ] 인텐시티 추천 계산 정상 동작
- [ ] WorkoutReport에서 운동 분석 정상 동작

**롤백 시나리오:** Feature flag를 `"v1"`로 되돌리면 1초 내 복구.

### 5.6 Phase 4 — 기존 데이터 마이그레이션

**전략 선택지:**
- **(A) 1회성 배치 마이그레이션** — Cloud Function 스크립트로 모든 유저의 기존 workout_history를 sessions + daily_snapshots로 변환
  - 장점: 깔끔, 빠름
  - 단점: 실패 시 롤백 어려움, Cloud Function 작업 필요

- **(B) Lazy migration** — 유저가 로그인하거나 ProofTab 열 때 해당 유저의 데이터를 변환
  - 장점: 실패해도 해당 유저만 영향, Cloud Function 불필요 (클라이언트 작업)
  - 단점: 장기간 dual-state 유지, 구현 복잡

**추천:** (B) Lazy migration. 현재 300명 규모라 병렬 마이그레이션 충돌 없음. 클라이언트 작업이라 백엔드 무관.

**마이그레이션 완료 플래그:**
- `users/{uid}/flags/migrated_v2: true` 저장
- 플래그가 true면 해당 유저는 sessions 컬렉션이 authoritative

### 5.7 Phase 5 — 기존 write 중단 + deprecate

**조건:**
- 모든 유저가 `migrated_v2: true`
- Phase 3 feature flag 100% 완료
- 최소 2주 안정 운영

**변경:**
- `saveWorkoutHistory`가 **sessions만 쓰고 workout_history는 쓰지 않음**
- 기존 `workout_history` 컬렉션은 **read-only로 6개월 이상 보존** (백업 역할)

### 5.8 트랙 C 롤백 시나리오

| Phase | 롤백 방법 | 소요 시간 |
|---|---|---|
| Phase 1 (dual write) | transformToNewSchema 에러 → try-catch swallow, 기존 플로우 정상 | 즉시 |
| Phase 2 (검증) | 문제 발견 시 트랙 C 중단, 트랙 B 완료 상태로 복귀 | 즉시 |
| Phase 3 (읽기 스위치) | Feature flag `"v2"` → `"v1"` | 1초 |
| Phase 4 (마이그레이션) | `migrated_v2: false` 롤백 | 유저별 즉시 |
| Phase 5 (deprecate) | git revert, 구버전 재배포 | 5분 |

---

## 6. 작업 순서 확정

**대표님 방침 반영:** "하나하나 끊어서 버그 없는지 확인, 문제없으면 연결"

```
[1] 트랙 A — 이벤트 보강 (3개 커밋)
    └─ 체크포인트: Firebase DebugView에서 새 이벤트 3종 수동 확인
    └─ 문제없으면 → [2]
    
[2] 트랙 B — 접근 통일 (7개 커밋)
    └─ 체크포인트: 각 커밋 후 해당 화면 실제 렌더 확인
    └─ 문제없으면 → [3]

[3] 트랙 C Phase 0 — 준비
    └─ 신규 스키마 타입 정의 (src/constants/workout-v2.ts)
    └─ transformToNewSchema 유틸 작성 + 단위 테스트

[4] 트랙 C Phase 1 — Dual Write
    └─ 체크포인트: 대표님 수동 운동 1회 → Firestore 두 컬렉션 수동 대조

[5] 트랙 C Phase 2 — 검증 (1주일 대기)
    └─ 매일 BigQuery diff 확인

[6] 트랙 C Phase 3 — 읽기 스위치 롤아웃
    └─ 대표님 → 5% → 25% → 100%

[7] 트랙 C Phase 4 — 마이그레이션
    └─ Lazy migration으로 점진 전환

[8] 트랙 C Phase 5 — Deprecate
    └─ 기존 write 중단

[9] 장기 숙제 — 서버사이드 stats 재계산
    └─ 별도 Phase로 백엔드 개발자 주도
```

**각 단계 체크포인트에서 대표님이 승인해야 다음 단계로 진행.**

---

## 7. 체크리스트 교차검증 매트릭스

### 7.1 각 전문가가 담당하는 체크 항목

| 항목 | 이화식 | 박서진 | 황보현우 | 프엔 | 백엔 | 평가자 |
|---|---|---|---|---|---|---|
| 신규 스키마 타입 정의 | ✅ 주도 | 리뷰 | — | 구현 | — | 렌더 경로 검증 |
| Strangler Fig 5단계 | ✅ 주도 | ✅ 주도 | — | 구현 | — | Phase 체크포인트 감사 |
| ESLint 규칙 | — | ✅ 주도 | — | 구현 | — | 우회 방지 확인 |
| 이벤트 발화 로직 | — | — | ✅ 주도 | 구현 | — | DebugView 수동 확인 |
| Dual write transformToNewSchema | ✅ 주도 | 리뷰 | — | 구현 | — | diff 쿼리 검증 |
| Feature flag 롤아웃 | — | ✅ 주도 | — | 구현 | — | 단계별 체크포인트 |
| Firestore rules 업데이트 | 리뷰 | — | — | — | ✅ 주도 | 권한 테스트 |
| 마이그레이션 로직 | ✅ 주도 | 리뷰 | — | 구현 | — | 변환 정확성 검증 |
| 롤백 시나리오 | — | ✅ 주도 | — | — | — | 각 단계 롤백 리허설 |
| 데이터 품질 플래그 (dataQuality) | — | — | ✅ 주도 | 구현 | 장기 계승 | 샘플 분류 검증 |

### 7.2 충돌 체크 (전문가 간 교차검증)

| 가능한 충돌 | 체크 전문가 | 방지책 |
|---|---|---|
| 이벤트 발화가 기존 렌더 경로 방해 | 평가자 + 프엔 | unmount 아닌 **명시적 exit path**에서만 발화 |
| 신규 스키마가 기존 필드 삭제 | 이화식 + 박서진 | **"필드 추가만, 삭제 금지"** 원칙 |
| Dual write 실패가 기존 플로우 차단 | 박서진 + 평가자 | **try-catch fire-and-forget** |
| Feature flag 전환 중 mixed state | 박서진 + 프엔 | flag 읽고 **단일 소스로 결정** |
| 마이그레이션 중 동시 write | 이화식 + 백엔 | 각 유저 단위 lazy migration으로 충돌 회피 |
| ESLint 규칙이 기존 코드 블록 | 박서진 + 프엔 | `workoutHistory.ts` 파일 내부 disable |
| 신규 컬렉션 security rule 누락 | 백엔 + 평가자 | Phase 1 배포 **전**에 rules 먼저 배포 |

### 7.3 평가자 전역 체크 항목 (모든 Phase 공통)
- [ ] 각 커밋 후 `git diff` 확인
- [ ] tsc 통과 ≠ 동작 정상 → **실제 화면 렌더 확인**
- [ ] 관련 화면 수동 테스트 (최소 플랜 프리뷰, 운동, 리포트, 프루프, 홈)
- [ ] 롤백 가능 여부 검증
- [ ] MEETING_LOG 업데이트
- [ ] 각 Phase 이정표에서 대표님 승인 받기

---

## 8. 장기 숙제 (본 리팩토링 이후)

### 8.1 서버사이드 stats 재계산 (백엔드 개발자 주도)
- **문제:** 클라이언트가 `stats.totalDurationSec`, `stats.totalVolume` 등을 계산 → 조작/오류 가능
- **해결:** `workout_complete` 시 클라이언트가 raw logs + timings만 전송 → Cloud Function이 stats 재계산 → Firestore 저장
- **필요 작업:**
  - 신규 Cloud Function `completeWorkout` 추가
  - `buildWorkoutMetrics()` 로직을 functions로 복제
  - 클라이언트는 raw만 전송, stats 표시는 서버 응답 받아서
- **소요:** 2~3주
- **선행 조건:** 본 리팩토링 (트랙 C) 완료

### 8.2 사용자 피드백 루프 (Davenport 제안)
- **문제:** 룰베이스 운동 생성이 유저 만족도와 매칭되는지 측정 불가
- **해결:** 운동 완료 후 👍👎 1탭 피드백 → 주간 집계 → 룰 파라미터 튜닝
- **소요:** 1주

### 8.3 코치 멘트 프롬프트 버전 실험 (Davenport 제안)
- **문제:** Gemini 프롬프트 v1~v5 개선이 실제 유저 반응으로 검증 안 됨
- **해결:** 프롬프트 버전을 workout_history에 저장 + 유저 반응 피드백 + BigQuery로 버전별 만족도 집계
- **소요:** 1주

---

## 9. 작성 상태 및 다음 단계

**작성 완료:** 트랙 A/B/C 전체 설계
**대표님 승인 필요 항목:**
1. 본 설계서 전체
2. 트랙 A 즉시 착수 허가
3. 트랙 B 진입 조건 (트랙 A 완료 + 버그 없음 확인)
4. 트랙 C 진입 조건 (트랙 B 완료 + 버그 없음 확인)

**대표님 컨펌 후 작업 흐름:**
1. 기획자가 MEETING_LOG에 회의 52번 기록
2. 프엔 개발자가 트랙 A 첫 커밋부터 시작
3. 매 커밋 후 체크포인트 — 버그 없음 확인 후 다음 커밋
4. 트랙 A 완료 후 대표님 확인 → 트랙 B 진입 승인
