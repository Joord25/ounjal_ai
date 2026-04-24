# DESIGN-RUNNING-REPORT-KENKO — 러닝 리포트 3탭 Kenko 재디자인

**작성일**: 2026-04-19
**기획자**: Planner Agent
**회의**: 64-α (러닝 리포트 Kenko 통합 재디자인)
**대상**: 러닝 세션의 운동 리포트 (3탭: 오늘 폼 / 요약 / 다음)
**참고 디자인**: Vitaly Rubtsov — Kenko Workout tracker (Dribbble / Behance)

---

## 0. 코드 사전 조사 결과

### 0.1 파일 구조와 라인 범위
| 파일 | 역할 | 주요 라인 |
|---|---|---|
| `src/components/report/WorkoutReport.tsx` | 탭 오케스트레이터. 상단 탭 바 + 탭별 분기 | L480-494 탭 바 / L498-514 StatusTab / L559-620 NextTab / L692,872 RunningReportBody |
| `src/components/report/tabs/StatusTab.tsx` | "오늘 폼" — 피트니스 나이 + 육각형 레이더 | 전체 210줄 |
| `src/components/report/tabs/NextTab.tsx` | "다음" — 다음 세션 조언 + 이번 주 퀘스트 + 주간 기록 | 전체 436줄 |
| `src/components/report/RunningReportBody.tsx` | "요약" — Hero/Interval/TT/Splits/This Week 5카드 | 전체 325줄 |
| `src/components/report/TTCard.tsx` | 요약 탭의 TT v1 카드 (회의 64-Y) | 전체 90줄 |
| `src/components/report/HexagonChart.tsx` | 육각형 레이더 SVG | 전체 128줄 |
| `src/constants/workout.ts` | `RunningStats` 타입 (L138-151), `WorkoutHistory` (L153-) | — |
| `src/locales/ko.json` · `en.json` | i18n 키 | 704-1007 (러닝/리포트 구간) |

### 0.2 현재 구조 요약
**StatusTab**
- `space-y-4` 2카드 (`rounded-2xl border border-gray-100 p-5 shadow-sm`)
- 카드1: 피트니스 나이 (`text-3xl font-black`) + 나이 차 설명 + cardio-only 경고
- 카드2: "30대 남성 100명 중" 헤더 + `HexagonChart` + 종합 등수 (`text-lg font-black`)
- cardio 잠정 상태: `tentative=true` → 레이더 축 gray-400, 하단 마이크로카피
- helper 버튼: `absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-100`

**NextTab**
- `space-y-3 mb-4` 2카드 (`rounded-2xl border border-gray-100 p-5 shadow-sm`)
- 카드1: 다음 조언 — 인용구 메시지 + (추천 부위/강도/무게 목표) 리스트 + `h-px bg-gray-100` 구분선
- 카드2: 이번 주 퀘스트 — 고/중/저/총 4개 바 (`h-1.5 bg-gray-100 rounded-full`) + 이번 주 기록 리스트 (강도 뱃지 색상분리)

**RunningReportBody (요약)**
- `flex flex-col gap-3` 4~5 카드 (`rounded-3xl border border-gray-100 shadow-sm px-5 py-5/6`)
- Hero: `w-1 h-5 bg-[#2D6A4F] rounded-full` 사이드 바 + 9px uppercase 라벨 + 3분할 (`text-3xl font-black tabular-nums`) + `w-px h-14 bg-gray-100` 디바이더
- Interval Breakdown: 전력 평균/회복 평균 2-grid (`grid grid-cols-2`, `bg-gray-50 rounded-2xl p-3`) + 라운드 리스트
- TTCard: PR 뱃지 + 거리/시간 2열 (`text-2xl font-black`) + 평균 페이스 + diff 문구
- Km Splits: 한 줄당 label + bar(`h-5 bg-gray-100 rounded-full`) + pace. fastest=`#2D6A4F`, slowest=`amber-400`, 나머지 `#2D6A4F/40`
- This Week: 주간 도트 5개(`bg-[#2D6A4F]` vs `bg-gray-200`) + runs/total time/distance 수평 3분할

### 0.3 데이터 흐름
- `recentHistory: WorkoutHistory[]`와 `currentRunningStats` 둘 다 StatusTab로 주입 (`WorkoutReport.tsx:508-509`)
- `weekly` 계산 로직: `RunningReportBody.tsx:44-72` 내부 IIFE. 월~일 누적 + 오늘 세션 포함 여부 체크 후 `runs/totalDistance/totalDuration` 반환. **이번 재디자인에서 추출 대상**.
- NextTab의 `weekSummary`는 전체 운동(러닝 포함) 기반이라 러닝 리포트용 주간 데이터와는 별개다. NextTab 재디자인은 러닝 외 맥락도 처리해야 함.

### 0.4 보호해야 할 기존 기능
1. 회의 64-X: cardio 축 잠정/확정 상태 (`cardioStatus.isConfirmed`), "체력축만 계산됨" 경고(`cardioOnlyMode`)
2. 회의 64-Y: `pickCardLayout(runningType)` 분기 3종 (interval/splits/time_trial)
3. TTCard PR 로직 (같은 거리 ±5% 비교)
4. 인터벌 빈 상태 분기 (indoor/gps searching/denied)
5. Hero의 GPS 없음 → Rounds 대체 (`hasGpsData` 분기)
6. StatusTab 도움말 모달 버튼 2개 (`onHelpPress`, `onRankHelpPress`)
7. NextTab 퀘스트 진행률 계산 (`classifySessionIntensity` + `getWeeklyIntensityTarget`)

---

## 1. 디자인 시스템 토큰

### 1.1 Typography Scale
| 토큰 | Tailwind 클래스 | 용도 | 예시 |
|---|---|---|---|
| `type.hero` | `text-[56px] font-black leading-none tabular-nums` | 이번 주 거리 합계, Hero 대표 숫자 | `12.4` |
| `type.statLg` | `text-4xl font-black leading-none tabular-nums` | Hero 3분할 숫자, TT 거리/시간 | `5.02` |
| `type.statMd` | `text-2xl font-black leading-none tabular-nums` | 이번 주 보조 3분할 숫자, 종합 등수 | `3` |
| `type.statSm` | `text-lg font-black leading-none tabular-nums` | 인터벌 평균 숫자, 라운드 내 페이스 | `4:32` |
| `type.ageHero` | `text-[48px] font-black leading-none` | 피트니스 나이 | `27세` |
| `type.labelSm` | `text-[10px] font-black tracking-[0.18em] uppercase` | 카드 타이틀/스탯 라벨 (Kenko 표준) | `THIS WEEK` |
| `type.labelXs` | `text-[9px] font-black tracking-[0.15em] uppercase` | 단위 보조 (km, /km, total) | `/KM` |
| `type.body` | `text-sm font-medium leading-relaxed` | 코치 메시지, 조언 인용구 | `"오늘..."` |
| `type.caption` | `text-xs font-medium` | 설명/메타 | `평균 페이스 ...` |
| `type.micro` | `text-[10px] font-bold` | 뱃지, 주간 도트 라벨 | `M T W ...` |

- **컬러 페어링 원칙**: label 계열은 기본 `text-gray-400`, 스탯 값은 `text-[#1B4332]` (dark emerald)
- 기존 `tracking-[0.15em]`은 유지하되 타이틀급은 `tracking-[0.18em]`로 1단 강화
- `font-black`은 900

### 1.2 Spacing
| 토큰 | 값 | 용도 |
|---|---|---|
| `space.cardPadLg` | `px-6 py-7` | Kenko 표준 카드 패딩 (이번 주/Hero) |
| `space.cardPadMd` | `px-6 py-6` | 일반 카드 (TT, 인터벌, 스플릿) |
| `space.cardPadSm` | `px-5 py-5` | 좁은 섹션 카드 (피트니스 나이 단독) |
| `space.innerGap` | `gap-6` | 대형 섹션 간 간격 (이번 주 내 상단↔하단) |
| `space.rowGap` | `gap-3` | 스플릿 행 간 간격, 라운드 리스트 |
| `space.stackGap` | `gap-4` | 카드끼리(요약 탭) |
| `space.stackGapLg` | `gap-5` | 카드끼리(오늘 폼 탭 — 여백 강화) |
| `space.labelToValue` | `mb-2` | 라벨→값 기본 여백 |

- 카드 간 기본: `flex flex-col gap-5` (기존 `gap-3` 대비 증가 → Kenko 공기감)
- 카드 **내부** 섹션 구분: `border-t border-gray-100` + `pt-5 mt-5` (얇은 선 + 여백)

### 1.3 Color
기존 팔레트 유지, 용도 명시만 엄격화.
| 토큰 | Hex | 용도 | Tailwind |
|---|---|---|---|
| `color.primary` | `#1B4332` | 스탯 숫자, 타이틀 강조 | `text-[#1B4332]` / `bg-[#1B4332]` |
| `color.primaryAlt` | `#2D6A4F` | 액센트 링/바/디바이더, 뱃지 | `text-[#2D6A4F]` / `bg-[#2D6A4F]` |
| `color.ringTrack` | `#F3F4F6` | Activity Ring 배경 트랙 | `gray-100` |
| `color.bgSoft` | `#FAFFF7` | 이번 주 카드 안쪽 하이라이트(선택) | `bg-[#FAFFF7]` |
| `color.warning` | `#F59E0B` | 경고 전용 (미확정/주의) | `amber-500`, `amber-400` |
| `color.neutralText` | `#9CA3AF` | 라벨 텍스트 | `text-gray-400` |
| `color.metaText` | `#6B7280` | 보조 텍스트 | `text-gray-500` |
| `color.divider` | `#F3F4F6` | 구분선 | `border-gray-100` |
| `color.card` | `#FFFFFF` | 카드 배경 | `bg-white` |

**amber 사용 규칙 (Kenko 톤 정리)**:
- 허용: 경고용 (cardio-only 경고, auto-pause, GPS 미사용, 퀘스트 미완 고강도)
- **제외**: 일반 데이터 시각화. 기존 Km Splits의 slowest=amber는 `gray-300`으로 중성화.

### 1.4 Shape
| 토큰 | 값 | 용도 |
|---|---|---|
| `radius.cardOuter` | `rounded-3xl` (24px) | 모든 주요 카드 외곽 (요약/오늘 폼/다음 전부 통일) |
| `radius.cardInner` | `rounded-2xl` (16px) | 카드 안쪽 박스 (서브 셀) |
| `radius.chip` | `rounded-xl` (12px) | 미니 뱃지/스탯 셀 |
| `radius.pill` | `rounded-full` | 바/도트/뱃지 |
| `border.card` | `border border-gray-100` | 카드 테두리 |
| `shadow.card` | `shadow-sm` | 기본 그림자 (변경 없음) |

**통일 원칙**: 기존에 `rounded-2xl` 사용하던 StatusTab/NextTab 카드도 전부 `rounded-3xl`로 격상.

### 1.5 Motion
| 토큰 | 값 | 용도 |
|---|---|---|
| `motion.ringDraw` | `transition-[stroke-dashoffset] duration-700 ease-out` | Activity Ring 진행률 채워짐 |
| `motion.bar` | `transition-[width] duration-500 ease-out` | Km 스플릿 바/퀘스트 바 |
| `motion.fade` | `transition-opacity duration-300` | 라벨/설명 전환 |
| `motion.delayStagger` | 카드 등장 시 50ms씩 지연 (선택적) | 신규 구현하지 않음 |

---

## 2. 재사용 컴포넌트 (Phase 0 — 필수 선행)

### 2.1 `ActivityRing` — 신규 컴포넌트

**파일**: `src/components/report/ActivityRing.tsx` (신규)

**Props**:
```ts
export interface ActivityRingProps {
  /** 0~100 진행률 */
  value: number;
  /** 외곽 지름 px (기본 120) */
  size?: number;
  /** stroke 두께 px (기본 12) */
  strokeWidth?: number;
  /** 진행 stroke 색 (기본 #2D6A4F) */
  color?: string;
  /** 배경 trail stroke 색 (기본 #F3F4F6) */
  trackColor?: string;
  /** 링 중앙에 렌더할 내용 (숫자/아이콘) */
  children?: React.ReactNode;
  /** 값 변화 시 애니메이션 on (기본 true) */
  animate?: boolean;
  /** 라벨 (접근성 aria-label) */
  ariaLabel?: string;
}
```

**SVG 구조**:
```tsx
<div className="relative" style={{ width: size, height: size }}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
    {/* track */}
    <circle cx={size/2} cy={size/2} r={r} fill="none"
      stroke={trackColor} strokeWidth={strokeWidth} />
    {/* progress */}
    <circle cx={size/2} cy={size/2} r={r} fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference * (1 - clamp01(value)/100)}
      className={animate ? "transition-[stroke-dashoffset] duration-700 ease-out" : ""}
    />
  </svg>
  <div className="absolute inset-0 flex items-center justify-center">
    {children}
  </div>
</div>
```
- `r = (size - strokeWidth) / 2`
- `circumference = 2πr`
- 100% 초과 입력 시 100%로 clamp (주간 목표 초과 시각적 완주)

**Acceptance**:
- `value=0` → 배경 트랙만, progress는 `strokeDashoffset === circumference`
- `value=100` → progress 완전 채움(`strokeDashoffset === 0`)
- `value=50` → 정확히 절반
- `size` 기본 120, `strokeWidth` 기본 12
- `children` 중앙 정렬 (flex center)

**Grep 검증**:
```bash
rg -n "export const ActivityRing" src/components/report/ActivityRing.tsx
rg -n "strokeDasharray|strokeDashoffset" src/components/report/ActivityRing.tsx
rg -c "rotate-\[-90deg\]" src/components/report/ActivityRing.tsx   # 1 이상
```

### 2.2 `useWeeklyRunningStats` 헬퍼 — 신규 유틸

**파일**: `src/utils/weeklyRunning.ts` (신규)

**시그니처**:
```ts
export interface WeeklyRunningStats {
  runs: number;
  totalDistance: number;        // meters
  totalDuration: number;        // seconds
  avgPace: number | null;       // sec/km, distance>0일 때만
  daysRun: boolean[];           // length 7, [월..일]
  weeklyGoalKm: number;         // 기본 20 (추후 profile 확장 가능)
}

export function computeWeeklyRunningStats(
  recentHistory: WorkoutHistory[],
  currentRunningStats: RunningStats | null,
): WeeklyRunningStats;
```

**로직**:
- 기준: 이번 주 월요일 00:00 (`(now.getDay() + 6) % 7` 오프셋)
- `recentHistory` 순회 → `runningStats` 있고 월요일 이후면 집계
- 오늘 세션이 히스토리에 없으면 `currentRunningStats`를 +1 런으로 추가
- `daysRun`: 요일 인덱스(월=0, 일=6)에 boolean 마크. 오늘 포함.
- `avgPace = totalDistance > 0 ? (totalDuration / (totalDistance / 1000)) : null`
- `weeklyGoalKm`: 기본 20. 추후 `ohunjal_fitness_profile.weeklyGoalKm`에서 override 가능하지만 **v1에서는 상수 20 고정** (GOAL 카드에 "주간 20km" 라벨 명시)

**Acceptance**:
- 이번 주 월~일 범위 외 기록은 카운트 제외
- 오늘이 월요일이면 `daysRun[0] = true` (세션 있을 때)
- 거리 0 (실내) 기록만 있으면 `avgPace === null` & `totalDistance === 0`이지만 `runs >= 1`
- `RunningReportBody.tsx`의 기존 `weekly` IIFE는 삭제하고 이 훅 호출로 대체

**Grep 검증**:
```bash
rg -n "export function computeWeeklyRunningStats" src/utils/weeklyRunning.ts
rg -n "daysRun|weeklyGoalKm" src/utils/weeklyRunning.ts
# RunningReportBody에서 IIFE 제거 후:
rg -n "const weekly = \(\(\) =>" src/components/report/RunningReportBody.tsx   # 0 (제거됨)
rg -n "computeWeeklyRunningStats" src/components/report/RunningReportBody.tsx  # 1
```

---

## 3. Phase 1 — 요약 탭 (4~5카드)

파일: `src/components/report/RunningReportBody.tsx`

### 3.1 Hero Card (3.1)

**Before (L83-146)**:
```
┌─────────────────────────────────────────────┐
│ │ SPRINT INTERVAL                           │  ← 9px uppercase + 1px 세로바
│                                             │
│  DISTANCE    SPRINT PACE    TIME            │  ← 9px
│   5.02         4:21         22:04           │  ← text-3xl font-black
│    km          /km          total           │  ← 10px
└─────────────────────────────────────────────┘
```
- `rounded-3xl px-5 py-6`
- 3분할 `w-px h-14 bg-gray-100` 디바이더

**After**:
```
┌─────────────────────────────────────────────┐
│ SPRINT INTERVAL                  ·INDOOR    │  ← 세로바 제거, 10px/0.18em
│                                             │
│ DISTANCE                                    │
│ 5.02                                        │  ← 56px font-black (type.hero)
│ km                                          │  ← 10px
│                                             │
│ ─────────────────────────────── (옵션)       │
│                                             │
│  SPRINT PACE           TIME                 │  ← 10px
│   4:21                 22:04                │  ← 36px font-black (type.statLg)
│   /km                  total                │  ← 9px
└─────────────────────────────────────────────┘
```

**변경 상세**:
- 카드 패딩: `px-5 py-6` → `px-6 py-7` (`space.cardPadLg`)
- 상단 타이틀 바: `w-1 h-5 bg-[#2D6A4F]` **제거** (장식 느낌) → 단순 라벨 텍스트만 `text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]`
- **레이아웃 2단 분리**:
  - 상단 블록: 대표 스탯 1개 (hasGpsData이면 DISTANCE, 아니면 ROUNDS)를 `type.hero` (56px)로 좌측 정렬
  - 하단 블록: 나머지 2개 스탯(Pace, Time)을 `grid grid-cols-2 gap-6`로 배치, 각 `type.statLg` (36px)
  - 둘 사이: `border-t border-gray-100 pt-5 mt-5`
- `tabular-nums` 전부 유지
- `flex-col items-start`로 변경 (중앙정렬 대신 좌측)
- `w-px h-14 bg-gray-100` 수직 디바이더 **제거** (grid로 공간 나눔)

**ASCII Mockup (실측)**:
```
┌───────────────────────────────────┐
│ SPRINT INTERVAL      · INDOOR     │
│                                   │
│ DISTANCE                          │
│                                   │
│ 5.02                              │
│ km                                │
│                                   │
│ ─────────────────────────────     │
│                                   │
│ SPRINT PACE    TIME               │
│ 4:21           22:04              │
│ /km            total              │
└───────────────────────────────────┘
```

**핵심 Tailwind diff**:
- 제거: `<div className="w-1 h-5 bg-[#2D6A4F] rounded-full" />` (L85)
- 제거: `<div className="w-px h-14 bg-gray-100 mt-3" />` (L120, 133)
- 제거: `flex items-start justify-around gap-2` 3분할 컨테이너 (L96)
- 교체: `text-3xl font-black` (Distance 블록만) → `text-[56px] font-black leading-none tabular-nums`
- 교체: `text-3xl font-black` (Pace/Time) → `text-4xl font-black leading-none tabular-nums`

**Acceptance**:
- 카드 outer `rounded-3xl`, padding `px-6 py-7`
- 장식용 세로바 div (`w-1 h-5 bg-[#2D6A4F]`) 0개
- 수직 디바이더 div (`w-px h-14 bg-gray-100`) 0개
- 대표 숫자 하나가 `text-[56px]`로 존재
- Pace/Time 2개가 `grid grid-cols-2`에 있음
- hasGpsData=false일 때: 대표 자리에 Rounds(`type.hero`) 노출
- `tabular-nums` 클래스가 모든 숫자에 존재

**Grep 검증**:
```bash
# 장식 바 제거 확인
rg -n 'w-1 h-5 bg-\[#2D6A4F\]' src/components/report/RunningReportBody.tsx
# 결과: 다른 카드에서만 남거나 전부 제거. Hero 블록(L83-146) 내 0개.
rg -n 'w-px h-14' src/components/report/RunningReportBody.tsx   # 0
rg -n 'text-\[56px\].*font-black' src/components/report/RunningReportBody.tsx   # 1 이상
rg -n 'grid grid-cols-2 gap-6' src/components/report/RunningReportBody.tsx       # 1 이상 (Hero 하단)
```

### 3.2 Interval Breakdown Card

**Before (L157-225)**: 전력/회복 2-grid + 라운드 리스트(flex between)

**After**:
- 카드 패딩 `px-5 py-5` → `px-6 py-7`
- 타이틀 `w-1 h-5` 세로바 **제거**, 단독 라벨 `text-[10px] font-black tracking-[0.18em] uppercase text-gray-400`
- 전력 평균/회복 평균 서브 셀: `bg-gray-50 rounded-2xl p-3` → `rounded-2xl p-4` (좌/우 넓힘) + 숫자 `text-lg` → `text-2xl` (`type.statMd`)
- 라운드 리스트 행 재구성:
  - 왼쪽: `ROUND 1` (10px uppercase tracking)
  - 중앙: **수평 미니 바** 2개 (전력/회복) `h-1.5 rounded-full bg-gray-100` + 내부 `bg-[#2D6A4F]` (전력) / `bg-[#2D6A4F]/50` (회복). 각 바의 길이는 해당 라운드 페이스를 전체 라운드 최고/최저 기준 정규화
  - 오른쪽: 전력 페이스 + 회복 페이스 (tabular-nums, 12px font-black)
- 구분선 `border-b border-gray-50` → 유지하되 첫 행에도 `border-t` 추가로 상단 구분
- 빈 상태: 기존 유지 (indoor/searching/denied 분기)

**ASCII Mockup**:
```
┌───────────────────────────────────┐
│ INTERVAL BREAKDOWN                │
│                                   │
│ SPRINT AVG       RECOVERY AVG     │
│ 4:21             6:05             │
│                                   │
│ ROUND 1   ███░░░░░  ██░░░░░░   4:18·6:12
│ ROUND 2   ████░░░░  ████░░░░   4:25·5:58
│ ROUND 3   ██████░░  ███░░░░░   4:19·6:04
└───────────────────────────────────┘
```

**Acceptance**:
- 2-grid 요약 숫자가 `text-2xl font-black`
- 각 라운드 행에 2개의 미니 바(`h-1.5 rounded-full`) 존재
- 라운드 리스트는 `intervalRounds.length > 0`일 때만 노출 (빈 상태 분기 유지)

**Grep 검증**:
```bash
rg -n 'INTERVAL BREAKDOWN|running\.report\.breakdown' src/components/report/RunningReportBody.tsx
rg -n 'h-1\.5 rounded-full' src/components/report/RunningReportBody.tsx   # 라운드별 미니 바용 2개 이상
rg -n '"running.indoor.desc"|"running.gps.searching"|"running.gps.denied"' src/components/report/RunningReportBody.tsx  # 빈 상태 3종 유지
```

### 3.3 TT Card (time_trial 전용)

**파일**: `src/components/report/TTCard.tsx`

**Before**: PR 뱃지 + 거리/시간 2열 + 평균페이스 한 줄 + diff/첫기록 문구

**After — "기준선 세움" 축하 배너 모드 (첫 기록일 때)**:
```
┌───────────────────────────────────┐
│ TIME TRIAL         · BASELINE SET │  ← emerald 소프트 배너
│                                   │
│  5.00                             │  ← type.statLg 36px
│  km                               │
│                                   │
│ ─────────────────────────────     │
│                                   │
│  TIME          AVG PACE           │
│  22:04         4:24               │  ← type.statLg
│  total         /km                │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ NEXT TARGET                 │  │
│  │ 다음엔 4:19/km 도전해봐요     │  │  ← 5초 단축 투사
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

**After — 2회차 이상 (이전 기록 대비)**:
```
┌───────────────────────────────────┐
│ TIME TRIAL              [PR]      │  ← PR 뱃지 유지
│                                   │
│  5.00                             │
│  km                               │
│                                   │
│ ─────────────────────────────     │
│                                   │
│  TIME          AVG PACE           │
│  22:04         4:21               │
│  total         /km                │
│                                   │
│  ↓ 12초 빨라졌어요                 │  ← 방향 아이콘 + 문구
└───────────────────────────────────┘
```

**변경 상세**:
- 카드 패딩 `px-5 py-5` → `px-6 py-7`
- 세로바 `w-1 h-5` 제거
- 거리 → `type.statLg`로 단독 상단 배치 (hero 느낌 유지하되 56px은 주간 카드 독점)
- Time/AvgPace → `grid grid-cols-2 gap-6`
- 첫 기록(`diffSec == null`): 상단 라벨 옆 `BASELINE SET` 미니 뱃지 (`bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.15em]`) + 하단 "NEXT TARGET" 박스 (`rounded-2xl bg-[#FAFFF7] border border-emerald-100 px-4 py-3`). 다음 타겟 페이스 = 현재 `avgPace - 5`초 (초 단위, 분:초로 포맷)
- 2회차 이상: 기존 PR 뱃지 유지 + 하단 diff 문구에 **방향 아이콘** (빨라짐 = `↓` 화살, 느려짐 = `↑`, 동일 = `=` — SVG 인라인, 아이콘 데이터 의미 있음 → `[feedback_no_decorative_svg.md]` 통과). `text-xs font-bold` 유지하되 아이콘 14x14 인라인

**신규 i18n 키**:
- `running.tt.baselineBadge`: ko `"기준선"` / en `"BASELINE"`
- `running.tt.nextTargetLabel`: ko `"NEXT TARGET"` / en `"NEXT TARGET"` (영문 통일)
- `running.tt.nextTargetBody`: ko `"다음엔 {pace}/km 도전해봐요"` / en `"Try {pace}/km next time"`
- `running.tt.fasterShort`: ko `"{sec}초 빨라짐"` / en `"{sec}s faster"` (기존 `running.tt.faster`와 별개, 짧은 버전)

**신규 아이콘 컴포넌트 (inline, 별도 파일 불필요)**:
- `↓` 빨라짐: `<svg viewBox="0 0 16 16"><path d="M8 2v10m-4-4l4 4 4-4" stroke="#2D6A4F" strokeWidth="2" fill="none"/></svg>` — 의미: "페이스 수치 감소 = 빨라짐"
- `↑` 느려짐: 반대 + `stroke="#F59E0B"`
- `=` 동일: 2개 수평선

**Acceptance**:
- 첫 기록 시: `BASELINE SET` 뱃지 노출 + NEXT TARGET 박스 노출
- 2회차 시: `PR` 뱃지(기존) + 방향 아이콘 + 초 단축/증가 문구
- Time, AvgPace는 `grid grid-cols-2`로 배치
- 기존 `similarTTs` 필터 로직 유지 (±5% 거리, `time_trial` + legacy `sprint`)

**Grep 검증**:
```bash
rg -n 'BASELINE|running\.tt\.baselineBadge' src/components/report/TTCard.tsx
rg -n 'NEXT TARGET|running\.tt\.nextTargetLabel' src/components/report/TTCard.tsx
rg -n 'running\.tt\.pr' src/components/report/TTCard.tsx   # 기존 PR 뱃지 유지 확인
rg -n 'grid grid-cols-2' src/components/report/TTCard.tsx   # 1 이상
rg -n 'w-1 h-5 bg-\[#2D6A4F\]' src/components/report/TTCard.tsx   # 0 (장식 바 제거)
# i18n 동시 업데이트:
rg -n '"running\.tt\.baselineBadge"' src/locales/ko.json src/locales/en.json   # 각 1
rg -n '"running\.tt\.nextTargetLabel"' src/locales/ko.json src/locales/en.json  # 각 1
rg -n '"running\.tt\.nextTargetBody"' src/locales/ko.json src/locales/en.json   # 각 1
```

### 3.4 Km Splits Card

**Before (L230-268)**: fastest=`#2D6A4F`, slowest=`amber-400`, 나머지 `#2D6A4F/40`

**After**:
- 카드 패딩 `px-5 py-5` → `px-6 py-7`
- 세로바 제거
- 컬러 규칙 변경:
  - fastest: `bg-[#2D6A4F]` (유지)
  - 나머지 (중간/느림 포함): **단일 tone** `bg-[#2D6A4F]/35` (기존 0.4에서 0.35로 대비 소폭 축소)
  - slowest `bg-amber-400` **제거** → `bg-gray-300`
- 페이스 텍스트 색:
  - fastest: `text-[#2D6A4F]`
  - 나머지: `text-gray-500`
  - slowest amber → `text-gray-500` (중성화)
- 바 높이 `h-5` → `h-2.5` (Kenko 미니멀), `rounded-full`
- 좌측 라벨 `text-[11px] font-bold text-gray-400 w-8` → `text-[10px] font-black tracking-[0.15em] uppercase text-gray-400 w-10` (Kenko 일관)
- splits가 1개뿐이면 기존대로 `barPct = 80` 폴백 유지

**ASCII Mockup**:
```
┌───────────────────────────────────┐
│ KM SPLITS                         │
│                                   │
│ 1KM  ████████████████░░░░  4:21  │  ← fastest (emerald)
│ 2KM  ██████████░░░░░░░░░░  4:35  │
│ 3KM  ████░░░░░░░░░░░░░░░░  4:48  │
│ 4KM  ████████░░░░░░░░░░░░  4:32  │
│ 5KM  ██████████████░░░░░░  4:25  │
└───────────────────────────────────┘
```

**Acceptance**:
- `bg-amber-400` 0개
- `text-amber-500` 0개
- fastest 1개만 `bg-[#2D6A4F]` (투명도 없음), 나머지 `bg-[#2D6A4F]/35` 또는 `bg-gray-300` (slowest)
- 바 높이 `h-2.5`

**Grep 검증**:
```bash
# 카드 범위 내 amber 사라짐
rg -n 'bg-amber-|text-amber-' src/components/report/RunningReportBody.tsx   # 0
rg -n 'h-2\.5' src/components/report/RunningReportBody.tsx                  # 1 이상 (Km Splits 바)
rg -n '"running.report.kmSplits"' src/components/report/RunningReportBody.tsx  # 1 유지
```

### 3.5 이번 주 Card — Variant A Activity Ring (핵심)

**Before (L271-322)**: 5개 도트 + runs/total time/distance 3분할

**After**:
```
┌───────────────────────────────────────┐
│ THIS WEEK                             │
│                                       │
│      ╭─────────╮                      │
│     │           │     12.4            │ ← type.hero 56px
│     │   ●●●     │     km              │
│     │ ◗       ◗ │     ─────────       │
│     │   ●●●     │     WEEKLY          │
│     │           │     GOAL 20 km      │
│      ╰─────────╯                      │
│       (ActivityRing 128px)             │
│        중앙: 62%                       │ ← type.statSm 18px
│                                       │
│ ─────────────────────────────         │
│                                       │
│ RUNS      TOTAL TIME     AVG PACE     │
│ 3         1:28:42        4:51         │ ← type.statMd 24px
│ this week total         /km           │
│                                       │
│ ─────────────────────────────         │
│                                       │
│ M   T   W   T   F   S   S             │ ← 10px uppercase
│ ●   ·   ·   ●   ·   ●   ·             │ ← 10px 도트 (런=emerald 8px, 휴=gray-200 3px)
└───────────────────────────────────────┘
```

**상세 스펙**:
- 카드: `rounded-3xl border border-gray-100 shadow-sm bg-white px-6 py-7`
- 타이틀: `text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]` + `mb-6`
- **상단 블록** (Ring + 대표 숫자):
  - `flex items-center gap-6`
  - 좌: `<ActivityRing size={128} strokeWidth={12} value={percent} color="#2D6A4F" trackColor="#F3F4F6">` 중앙에 `<span className="text-lg font-black text-[#1B4332] tabular-nums">{Math.round(percent)}%</span>`
  - 우: `<p>12.4<span ml-2 text-xl text-gray-400>km</span></p>` (`type.hero`) + 아래 라벨 `WEEKLY GOAL · 20 km` (`type.labelXs text-gray-400`)
  - `percent = Math.min(100, (totalDistanceKm / weeklyGoalKm) * 100)`
  - 만약 `totalDistance === 0` (실내 전용): Ring은 runs 기반 (`Math.min(100, runs/5 * 100)`) + 대표 숫자는 `runs` + 라벨 `RUNS THIS WEEK`
- `border-t border-gray-100 pt-5 mt-6` 구분선
- **중단 3분할**:
  - `grid grid-cols-3 gap-4`
  - 각 셀: 위 라벨 `type.labelXs`, 가운데 값 `type.statMd`, 아래 단위 `type.labelXs`
  - RUNS: `{runs}` / `this week`
  - TOTAL TIME: `{formatRunDuration(totalDuration)}` / `total`
  - AVG PACE: `{formatPace(avgPace)}` / `/km` (실내면 `—`)
- `border-t border-gray-100 pt-5 mt-5` 구분선
- **하단 요일 도트 7개**:
  - `flex items-center justify-between` (화면 폭 꽉 채움)
  - 각 요일: 작은 세로 스택 `flex flex-col items-center gap-1`
    - 상단: `text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]` (M/T/W/T/F/S/S 다국어는 ko.json에 `running.weekly.mon` ~ `running.weekly.sun` 신규 키 추가)
    - 하단: 런 있으면 `w-2 h-2 rounded-full bg-[#2D6A4F]`, 없으면 `w-1 h-1 rounded-full bg-gray-200`
  - 오늘 요일은 `ring-2 ring-[#2D6A4F]/20` 추가 (subtle, 현재 요일 강조)

**신규 i18n 키**:
- `running.weekly.goalLabel`: ko `"주간 목표"` / en `"WEEKLY GOAL"`
- `running.weekly.runsUnit`: ko `"회"` / en `"runs"`
- `running.weekly.avgPace`: ko `"평균 페이스"` / en `"AVG PACE"`
- `running.weekly.totalTime`: ko `"총 시간"` / en `"TOTAL TIME"`
- `running.weekly.runsLabel`: ko `"이번 주"` / en `"this week"`
- `running.weekly.mon` ~ `running.weekly.sun`: 요일 1글자 ko `"월"~"일"` / en `"M","T","W","T","F","S","S"`

**기존 i18n 키 재활용**: 없음 (기존 `running.report.thisWeek`, `running.report.runs`는 라벨 변경으로 새로 쓰므로 둘 다 유지 가능)

**Acceptance**:
- `<ActivityRing` 컴포넌트가 1회 렌더됨 (size=128)
- 대표 숫자가 `text-[56px]`
- 3분할 스탯 `grid grid-cols-3` 존재
- 요일 도트 정확히 7개 (아니면 실패)
- 주간 거리 0일 때 Ring이 run count 기반 fallback
- 기존 `weekly` IIFE 제거, `computeWeeklyRunningStats` 호출로 대체

**Grep 검증**:
```bash
rg -n '<ActivityRing' src/components/report/RunningReportBody.tsx        # >= 1
rg -n 'grid grid-cols-3' src/components/report/RunningReportBody.tsx     # >= 1 (이번 주 3분할)
rg -n 'running\.weekly\.mon' src/locales/ko.json src/locales/en.json     # 각 1
rg -n 'running\.weekly\.goalLabel' src/locales/ko.json src/locales/en.json  # 각 1
rg -n 'computeWeeklyRunningStats' src/components/report/RunningReportBody.tsx  # 1
rg -n 'const weekly = \(\(\) =>' src/components/report/RunningReportBody.tsx   # 0 (기존 IIFE 제거)
```

**엣지 케이스 & 가드**:
- `weeklyGoalKm = 20` (상수, v1 고정)
- `totalDistance == 0 && runs >= 1` (실내 전용): Ring은 runs/5 * 100 (5회 = 100%, 완주감 제공)
- `runs == 0` (오늘 세션 포함 시 발생 안 함, 히스토리 탐색 모드에서만 가능): Ring `value=0`, 도트 전부 gray
- 오늘 요일 강조 링: `Date.now()` 기반 — 히스토리 탐색(`sessionDate`) 시에도 "현재" 요일로 표시 (heatmap 의미라서 OK)

---

## 4. Phase 2 — 오늘 폼 탭 (하이브리드)

파일: `src/components/report/tabs/StatusTab.tsx`

### 4.1 피트니스 나이 Card

**Before (L143-171)**: `rounded-2xl px-5 py-5` + `text-3xl` 나이

**After**:
- `rounded-2xl` → `rounded-3xl` (토큰 통일)
- 패딩 `p-5` → `px-6 py-7`
- 레이아웃 재구성:
  ```
  ┌───────────────────────────────────┐
  │ FITNESS AGE              [ ? ]    │  ← 라벨 + 도움말 버튼
  │                                   │
  │ 27세                              │  ← type.ageHero 48px, 좌측정렬
  │                                   │
  │ 실제 나이보다 3살 젊은 몸이에요     │  ← type.body
  │                                   │
  │ ⚠ 체력축만 계산됨 (cardio-only)    │  ← amber 경고 유지
  └───────────────────────────────────┘
  ```
- 기존 `text-center`/`items-center` → 좌측정렬 (`text-left`)
- 나이 수치: `text-3xl` → `text-[48px] font-black`
- 나이 차 설명: `text-xs` → `text-sm font-medium text-gray-500` (Kenko 표준)
- cardio-only 경고: `text-[10px] font-bold text-amber-600` → 유지하되 `mt-3`으로 여백 증가
- 도움말 버튼 위치: 유지 (`absolute top-4 right-4`)하되 `top-5 right-5`로 여백 증가

**Acceptance**:
- `text-[48px] font-black` 1회 (피트니스 나이 값)
- 카드 `rounded-3xl px-6 py-7`
- cardio-only 경고 분기 유지 (`cardioOnlyMode` 조건)

**Grep 검증**:
```bash
rg -n 'text-\[48px\] font-black' src/components/report/tabs/StatusTab.tsx   # 1
rg -n 'rounded-3xl' src/components/report/tabs/StatusTab.tsx               # 2 이상
rg -n 'status\.fitnessAge\.cardioOnly' src/components/report/tabs/StatusTab.tsx   # 1 유지
```

### 4.2 육각형 레이더 + Top 3 강점 하이브리드

**Before (L174-207)**: 헤더 + HexagonChart + 종합 등수 + 잠정 마이크로카피

**After** (단일 카드 내부 2 섹션):
```
┌───────────────────────────────────────┐
│ AMONG 100 MEN IN THEIR 30s     [ ? ]  │
│                                       │
│         (육각형 레이더)                 │
│                                       │
│                                       │
│         OVERALL RANK                  │
│         24 th                         │  ← type.ageHero 48px (강조)
│                                       │
│  ⚠ cardio 잠정 표시 (회의 64-X 유지)   │
│                                       │
│ ────────────────────────────────      │
│                                       │
│ TOP 3 STRENGTHS                       │  ← 신규 섹션
│                                       │
│ ╭──────╮    ╭──────╮    ╭──────╮      │
│ │ 92%  │    │ 78%  │    │ 65%  │      │  ← ActivityRing 80px, value=percentile
│ │ Cardio│    │Legs  │    │Core  │      │  ← 라벨
│ ╰──────╯    ╰──────╯    ╰──────╯      │
│ 체력 12등   하체 24등   코어 31등       │  ← type.statMd 20px 등수
└───────────────────────────────────────┘
```

**상세**:
- 카드 `rounded-2xl` → `rounded-3xl`, `p-5` → `px-6 py-7`
- 헤더: `text-sm font-black` → `text-[10px] font-black tracking-[0.18em] uppercase text-gray-400` (일관성)
- HexagonChart 유지
- 종합 등수: `text-lg font-black` → `text-[48px] font-black` (피트니스 나이와 동일 위계, 옆 라벨 `OVERALL RANK` 별도 `type.labelSm`)
- cardio 잠정 마이크로카피 유지 (`cardioStatus.eligibleRunCount > 0 && !cardioStatus.isConfirmed`)
- `border-t border-gray-100 pt-6 mt-6` 구분선
- **신규 Top 3 Strengths 섹션**:
  - `categoryPercentiles.filter(c => c.hasData).sort((a, b) => b.percentile - a.percentile).slice(0, 3)` 상위 3개 선택
  - `hasData`가 3개 미만이면: 해당 개수만큼 렌더, 부족하면 "3개 데이터가 필요해요" 폴백 미니카피
  - 3열 그리드: `grid grid-cols-3 gap-3`
  - 각 셀: 세로 스택 `flex flex-col items-center gap-2`
    - `<ActivityRing size={80} strokeWidth={8} value={percentile} color="#2D6A4F">` 중앙에 `text-xs font-black text-[#1B4332]`로 `{rank}{isKo ? "등" : "th"}`
    - 하단: 카테고리 라벨 `text-[10px] font-black tracking-[0.15em] uppercase text-gray-400`
  - cardio 잠정 상태 카테고리는 Ring `color="#9CA3AF"` (회색 틴트 — HexagonChart tentative와 동일 규칙)

**신규 i18n 키**:
- `status.topStrengths.title`: ko `"TOP 3 강점"` / en `"TOP 3 STRENGTHS"`
- `status.overallRank.label`: ko `"종합 순위"` / en `"OVERALL RANK"`
- `status.topStrengths.notEnough`: ko `"강점 분석에는 3가지 이상 데이터가 필요해요"` / en `"Need data in 3+ categories for strength analysis"`

**Acceptance**:
- HexagonChart 렌더 유지 (기존 동작 보호)
- 종합 등수 `text-[48px] font-black` 1회
- `<ActivityRing size={80}` 최대 3개 (hasData 개수만큼)
- cardio 잠정 → 해당 Ring `color="#9CA3AF"`
- hasData < 3이면 fallback 문구 노출

**Grep 검증**:
```bash
rg -n '<HexagonChart' src/components/report/tabs/StatusTab.tsx          # 1 유지
rg -n '<ActivityRing size={80}' src/components/report/tabs/StatusTab.tsx   # 1~3 (cond)
rg -n 'TOP 3|status\.topStrengths\.title' src/components/report/tabs/StatusTab.tsx
rg -n 'cardioStatus\.isConfirmed' src/components/report/tabs/StatusTab.tsx   # 1 이상 (보호)
```

---

## 5. Phase 3 — 다음 탭 (NextTab)

파일: `src/components/report/tabs/NextTab.tsx`

### 5.0 현재 구조 (읽고 확인 완료)
NextTab은 2개 카드로 구성:
1. 메인 조언 카드 (L349-377): 인용구 메시지 + 추천 부위/강도/무게 목표 리스트
2. 이번 주 퀘스트 카드 (L380-433): 고/중/저/총 진행 바 + 이번 주 기록 리스트

NextTab은 러닝 세션뿐 아니라 모든 세션의 "다음" 조언을 담당. 재디자인도 러닝/근력 양쪽 호환해야 함.

### 5.1 다음 세션 추천 Card (기존 메인 조언 리디자인)

**Before (L349-377)**: 인용구 + 리스트 3행 + 구분선

**After**:
```
┌───────────────────────────────────────┐
│ NEXT SESSION                          │
│                                       │
│ "오늘 하체 열심히 했으니까              │
│  다음엔 가슴·어깨 해주면 딱이에요"       │  ← type.body 14px, leading-relaxed
│                                       │
│ ─────────────────────────────         │
│                                       │
│  RECOMMENDED      INTENSITY           │
│  가슴·어깨         중강도               │  ← type.statSm 18px
│                                       │
│  WEIGHT GOAL                          │
│  벤치프레스 72.5kg                     │  ← type.statSm + emerald
└───────────────────────────────────────┘
```
- 카드 `rounded-2xl` → `rounded-3xl`, `p-5` → `px-6 py-7`
- 라벨 `text-[10px] font-black tracking-[0.18em] uppercase text-gray-400`
- 인용구 `text-sm` 유지 but `mb-6`으로 여백 증가
- 추천 부위/강도: **수평 flex → 2-grid 수직 구조**. `grid grid-cols-2 gap-4`, 각 셀은 라벨(위) + 값(아래).
- 무게 목표: 있으면 전체 폭 (`col-span-2` 또는 별도 섹션 + `border-t pt-4 mt-4`). 값은 `text-[#2D6A4F]` 유지.
- 구분선: 인용구 ↔ 스탯 그룹 1개만, 그 외 모두 제거 (`h-px bg-gray-100`)

**Acceptance**:
- `rounded-3xl px-6 py-7`
- 추천 부위/강도 `grid grid-cols-2` 배치
- 무게 목표 유무 분기 보존 (`weightGoal` 조건)
- 인용구 기존 메시지 로직(`generateNextAdvice`) 그대로 호출

**Grep 검증**:
```bash
rg -n 'generateNextAdvice|advice\.message' src/components/report/tabs/NextTab.tsx   # 기존 로직 보존
rg -n 'grid grid-cols-2' src/components/report/tabs/NextTab.tsx                    # 1 이상
rg -n 'weightGoal' src/components/report/tabs/NextTab.tsx                          # 기존 조건 유지
```

### 5.2 이번 주 퀘스트 Card (Activity Ring 결합)

**Before (L380-433)**: 진행률 메시지 + 4개 바 + 이번 주 기록 리스트

**After**:
```
┌───────────────────────────────────────┐
│ WEEKLY QUEST                          │
│                                       │
│     ╭──────────╮                      │
│    │            │    3 / 5            │  ← type.statLg
│    │   ●●●●●●   │    운동              │
│    │  ● 63%  ●  │    ─────            │
│    │   ●●●●●●   │    이번 주 빡세게!    │  ← questBasedIntensity.message
│     ╰──────────╯                      │
│                                       │
│ ─────────────────────────────         │
│                                       │
│  HIGH       MODERATE        LOW       │
│  2/2        1/3             0/1       │  ← type.statMd
│  ███████    ████░░░         ░░░░░░    │  ← h-2 rounded-full
│                                       │
│ ─────────────────────────────         │
│                                       │
│ THIS WEEK                             │
│ 월  하체·중강도                        │
│ 수  가슴·어깨·고강도                    │
│ 금  러닝·저강도                         │
└───────────────────────────────────────┘
```

**상세**:
- 카드 `rounded-3xl px-6 py-7`
- **상단 링 블록**:
  - `<ActivityRing size={120} strokeWidth={12} value={(questProgress.total.done / questProgress.total.target) * 100}>` 중앙에 `text-xs font-black text-[#1B4332]` 퍼센트
  - 우측: `{done} / {target}` (`type.statLg`) + `type.caption` (`"운동"` / `"sessions"`) + 구분선 + `questBasedIntensity.message` (기존 로직)
- **중단 3열 미니 바** (기존 4개 바 → 3개, 총합은 Ring이 담당하므로 제외):
  - `grid grid-cols-3 gap-3`
  - 각 셀: 라벨 + 진행/목표 텍스트(`type.statMd`) + 바(`h-2 rounded-full bg-gray-100` + `h-full bg-*` 계열)
  - 색상 규칙 수정:
    - 고강도: `bg-amber-400` (경고/하이라이트 용도, Kenko 팔레트 내에서 warning color로 재정의)
    - 중강도: `bg-[#2D6A4F]`
    - 저강도: `bg-[#2D6A4F]/50`
  - 기존의 `bg-red-400`/`bg-blue-400`는 **제거** (Kenko 팔레트 외 색상 방지)
- **하단 이번 주 기록**: 기존 리스트 유지, but 라벨/뱃지 스타일 조정
  - 요일 라벨 `text-[10px] font-black tracking-[0.15em] uppercase` + 고정 너비 `w-8`
  - 세션 텍스트 `text-sm font-medium text-gray-500`
  - 강도 뱃지 색상 역시 emerald 팔레트로 통합:
    - High: `bg-amber-50 text-amber-600` (경고 톤)
    - Mod: `bg-emerald-50 text-emerald-700`
    - Low: `bg-gray-100 text-gray-500`

**Acceptance**:
- `<ActivityRing size={120}` 1개 (총 진행률)
- 3열 미니 바 (`grid grid-cols-3`) — High/Mod/Low만 (총 총합 제거)
- `bg-red-400`, `bg-blue-400` **0개** (팔레트 통일)
- 기존 `classifySessionIntensity` + `getWeeklyIntensityTarget` + `questBasedIntensity` 로직 유지

**Grep 검증**:
```bash
rg -n '<ActivityRing size={120}' src/components/report/tabs/NextTab.tsx   # 1
rg -n 'bg-red-400|bg-blue-400' src/components/report/tabs/NextTab.tsx      # 0
rg -n 'questBasedIntensity' src/components/report/tabs/NextTab.tsx         # 유지
rg -n 'classifySessionIntensity|getWeeklyIntensityTarget' src/components/report/tabs/NextTab.tsx  # 유지
```

### 5.3 AI 코치 한 줄 Card (러닝 전용 옵션)

**현재 상태**: 러닝 리포트는 `WorkoutReport.tsx`에서 `RunningReportBody` 아래에 기존 `RpgResultCard` (AI 코치 3버블)가 따로 렌더됨. NextTab 내부에 추가 코치 카드는 신규 범위.

**결정**: v1 범위에서는 **별도 코치 카드 신규 추가 안 함**. 기존 `RpgResultCard` 코치 시스템이 이미 리포트 상단/하단에서 충분히 존재하며, NextTab에 중복 추가 시 정보 과잉 우려. Phase 3는 카드 2개(5.1, 5.2)로 확정.

**대신**: 향후 v2 확장 포인트로 문서화:
- "NextTab 하단에 러닝 전용 '다음 러닝' 미니 카드 (추천 거리 + 페이스 목표)" — 추후 회의
- v1에서는 구현 **제외**

---

## 6. Batch 커밋 계획

각 카드 = 1 atomic commit. Phase 0 선행 필수.

| # | Batch | 파일 | 커밋 메시지 (예시) |
|---|---|---|---|
| 0.1 | ActivityRing 신규 | `src/components/report/ActivityRing.tsx` | `feat: ActivityRing 재사용 컴포넌트 (Kenko Phase 0)` |
| 0.2 | weeklyRunning 헬퍼 | `src/utils/weeklyRunning.ts` | `feat: computeWeeklyRunningStats 헬퍼 분리 (Phase 0)` |
| 1.1 | Hero Card | `RunningReportBody.tsx` | `refactor: 러닝 리포트 Hero Card Kenko 스케일업 (Phase 1-1)` |
| 1.2 | Interval Breakdown | `RunningReportBody.tsx` | `refactor: Interval Breakdown 라운드별 미니 바 (Phase 1-2)` |
| 1.3 | TT Card | `TTCard.tsx` + ko/en.json | `feat: TT Card BASELINE/NEXT TARGET 모드 (Phase 1-3)` |
| 1.4 | Km Splits | `RunningReportBody.tsx` | `refactor: Km Splits amber 제거·단일 톤 (Phase 1-4)` |
| 1.5 | This Week Ring | `RunningReportBody.tsx` + ko/en.json | `feat: This Week Card Activity Ring 도입 (Phase 1-5)` |
| 2.1 | 피트니스 나이 | `StatusTab.tsx` | `refactor: 피트니스 나이 Kenko 타이포 (Phase 2-1)` |
| 2.2 | Top 3 Strengths | `StatusTab.tsx` + ko/en.json | `feat: TOP 3 강점 하이브리드 Ring (Phase 2-2)` |
| 3.1 | Next Session | `NextTab.tsx` | `refactor: 다음 세션 카드 2-grid 재배치 (Phase 3-1)` |
| 3.2 | Weekly Quest Ring | `NextTab.tsx` | `feat: 이번 주 퀘스트 Activity Ring + 팔레트 통일 (Phase 3-2)` |

**총 11커밋**. Phase 0 두 개는 **반드시 Phase 1/2/3 시작 전**에 머지.

---

## 7. 공통 주의사항

### 7.1 i18n 동시성 (feedback_i18n_always.md)
모든 신규 키는 `src/locales/ko.json`과 `src/locales/en.json`에 **같은 커밋에서** 동시 추가. 누락 시 ShipFail 조건.
신규 키 전체 목록:
- `running.tt.baselineBadge`
- `running.tt.nextTargetLabel`
- `running.tt.nextTargetBody` (placeholder `{pace}`)
- `running.tt.fasterShort` (optional, v1 스킵 가능 — 기존 `running.tt.faster` 재활용도 OK)
- `running.weekly.goalLabel`
- `running.weekly.runsLabel`
- `running.weekly.runsUnit`
- `running.weekly.totalTime`
- `running.weekly.avgPace`
- `running.weekly.mon`, `running.weekly.tue`, `running.weekly.wed`, `running.weekly.thu`, `running.weekly.fri`, `running.weekly.sat`, `running.weekly.sun`
- `status.topStrengths.title`
- `status.topStrengths.notEnough`
- `status.overallRank.label`

### 7.2 이모지 금지 (feedback_no_emoji.md)
- 유니코드 이모지/픽토그램 전면 금지
- `↓ ↑ =` 아이콘은 **SVG 인라인 path**로 구현 (의미 전달용, 장식 아님)
- "기준선 세움" 축하 이펙트에 이모지 사용 금지. 문구 + 색(emerald) + 뱃지 형태만

### 7.3 [feedback_no_decorative_svg.md] 준수
- ActivityRing: 데이터 시각화 → OK
- 방향 아이콘: 페이스 변화 의미 전달 → OK
- 기존 `w-1 h-5 bg-[#2D6A4F]` 세로 바: 순수 장식 → **제거**
- 기존 `w-px h-14 bg-gray-100` 수직 디바이더: 분할 시각 보조 → 유지하고 싶으나 Kenko 스타일상 제거하고 grid로 자연 분할

### 7.4 기존 기능 보호 체크리스트
- [x] 회의 64-X: cardio 잠정 상태(`cardioStatus.isConfirmed`, HexagonChart tentative prop)
- [x] 회의 64-X: cardioOnlyMode 경고 문구
- [x] 회의 64-Y: `pickCardLayout` 3종 분기 (interval/splits/time_trial)
- [x] TTCard `similarTTs` ±5% 필터 + legacy sprint 호환
- [x] 인터벌 빈 상태 indoor/searching/denied 3분기
- [x] Hero GPS 없음 → Rounds 대체
- [x] StatusTab helper 버튼 2개 (`onHelpPress`, `onRankHelpPress`)
- [x] NextTab `generateNextAdvice`, `getWeightGoal`, `classifySessionIntensity`, `getWeeklyIntensityTarget`, `questBasedIntensity` 로직

### 7.5 Phase 간 의존성
- Phase 1.5 (이번 주 Card) → Phase 0.1 (ActivityRing) + Phase 0.2 (weeklyRunning) 필요
- Phase 2.2 (Top 3 Strengths) → Phase 0.1 (ActivityRing) 필요
- Phase 3.2 (Weekly Quest Ring) → Phase 0.1 (ActivityRing) 필요
- Phase 0 미완 상태에서 Phase 1~3 머지 시 빌드 실패

### 7.6 회의 로그 (feedback_meeting_log.md)
본 문서 완료 후 `.planning/MEETING_LOG.md`에 "회의 64-α: 러닝 리포트 Kenko 통합 재디자인 스펙 확정" 항목 추가 예정 (본 스펙 승인 단계에서).

### 7.7 기존 구조 복구 리스크
- `RunningReportBody.tsx` Hero에서 `w-1 h-5 bg-[#2D6A4F]` 세로 바는 **인터벌 Breakdown/KM Splits/This Week/TTCard** 전 카드에 동일 장식 있음. Phase 1 진행 시 5개 카드 전부에서 제거. 로컬 프로덕션 스크린샷 UAT 필수.
- StatusTab `text-center` 기본 정렬이 `text-left`로 바뀌면 기존 스크린샷 regression → QA 시 인지

---

## 8. 평가자 최종 검증 프로토콜

각 Batch 머지 후 **반드시** 실행 (PR/커밋 checklist에 포함).

### 8.1 Phase 0 검증
```bash
# 0.1 ActivityRing
rg -n "export const ActivityRing" src/components/report/ActivityRing.tsx
rg -n "strokeDashoffset" src/components/report/ActivityRing.tsx
# 0.2 weeklyRunning
rg -n "export function computeWeeklyRunningStats" src/utils/weeklyRunning.ts
rg -n "daysRun|weeklyGoalKm" src/utils/weeklyRunning.ts
# 공통
npx tsc --noEmit
npm run lint
```

### 8.2 Phase 1 검증 (요약 탭)
```bash
# 장식 세로 바 완전 제거
rg -n 'w-1 h-5 bg-\[#2D6A4F\]' src/components/report/RunningReportBody.tsx src/components/report/TTCard.tsx
# → 0개 (전 카드에서 제거)

# 수직 디바이더 제거 (Hero)
rg -n 'w-px h-14' src/components/report/RunningReportBody.tsx
# → 0개

# Hero 56px
rg -n 'text-\[56px\] font-black' src/components/report/RunningReportBody.tsx
# → 1 이상

# KM Splits amber 제거
rg -n 'bg-amber-|text-amber-' src/components/report/RunningReportBody.tsx
# → 0

# ActivityRing 사용
rg -n '<ActivityRing' src/components/report/RunningReportBody.tsx
# → 1 이상 (이번 주)

# 신규 i18n
rg -n 'running\.tt\.baselineBadge|running\.weekly\.goalLabel' src/locales/ko.json src/locales/en.json
# → ko 2개, en 2개 (합 4)

# 기존 로직 보호
rg -n 'pickCardLayout|similarTTs|cardLayout' src/components/report/RunningReportBody.tsx src/components/report/TTCard.tsx
# → 유지 확인

npx tsc --noEmit && npm run lint
```

### 8.3 Phase 2 검증 (오늘 폼 탭)
```bash
# 피트니스 나이 48px
rg -n 'text-\[48px\] font-black' src/components/report/tabs/StatusTab.tsx
# → 2 이상 (피트니스 나이 + 종합 등수)

# 카드 radius 통일
rg -n 'rounded-2xl' src/components/report/tabs/StatusTab.tsx
# → 0 (모두 rounded-3xl로 격상)
rg -n 'rounded-3xl' src/components/report/tabs/StatusTab.tsx
# → 2 이상

# HexagonChart 유지
rg -n '<HexagonChart' src/components/report/tabs/StatusTab.tsx
# → 1

# Top 3 Strengths
rg -n '<ActivityRing size={80}' src/components/report/tabs/StatusTab.tsx
# → 1~3 (hasData 의존)
rg -n 'status\.topStrengths\.title' src/components/report/tabs/StatusTab.tsx src/locales/ko.json src/locales/en.json
# → 각 1

# 기존 보호
rg -n 'cardioStatus\.isConfirmed|cardioOnlyMode' src/components/report/tabs/StatusTab.tsx
# → 유지

npx tsc --noEmit && npm run lint
```

### 8.4 Phase 3 검증 (다음 탭)
```bash
# radius 통일
rg -n 'rounded-2xl' src/components/report/tabs/NextTab.tsx
# → 0 또는 inner 전용 (외곽 카드는 rounded-3xl)
rg -n 'rounded-3xl' src/components/report/tabs/NextTab.tsx
# → 2 이상

# Weekly Quest Ring
rg -n '<ActivityRing size={120}' src/components/report/tabs/NextTab.tsx
# → 1

# 팔레트 외 색상 제거
rg -n 'bg-red-400|bg-blue-400' src/components/report/tabs/NextTab.tsx
# → 0

# 기존 로직 보호
rg -n 'generateNextAdvice|questBasedIntensity|classifySessionIntensity' src/components/report/tabs/NextTab.tsx
# → 유지

npx tsc --noEmit && npm run lint
```

### 8.5 브라우저 UAT 시나리오 (각 Phase 완료 후)
1. **실외 TT 세션** (time_trial, 5km, GPS on)
   - Hero에 56px 거리 숫자, TTCard에 `BASELINE`(첫 기록) 또는 `PR`(2회차), Km Splits 단일 톤, This Week에 Ring + 요일 도트 7개, StatusTab에 cardio Ring(tentative or confirmed), NextTab에 Weekly Quest Ring
2. **실내 러닝** (indoor, easy, GPS off)
   - Hero는 DURATION 또는 Rounds로 대체 (기존 hasGpsData 분기), Km Splits 카드 미노출, This Week Ring은 runs 기반 fallback
3. **인터벌 3라운드** (sprint_interval)
   - Interval Breakdown에 라운드별 미니 바 3개, 전력/회복 평균 상단
4. **첫 TT** (history 없음)
   - TTCard `BASELINE SET` 뱃지 + NEXT TARGET 박스 노출
5. **cardio-only** (러닝만 있고 근력 없음)
   - StatusTab 피트니스 나이 하단 경고 유지, HexagonChart cardio 축만 점 찍힘, Top 3 Strengths는 `notEnough` 문구
6. **주간 20km 초과** (총 22km)
   - This Week Ring 100%로 clamp, 중앙 퍼센트 100%
7. **다국어 전환** (ko ↔ en)
   - 모든 신규 라벨 번역 노출 확인, 요일 라벨 `월/화.../M/T/W...`

### 8.6 스펙 외 변경 감지
평가자는 본 문서에 명시되지 **않은** 파일 변경이 있으면 Ship 거부:
- 허용 파일: `ActivityRing.tsx`, `weeklyRunning.ts`, `RunningReportBody.tsx`, `TTCard.tsx`, `StatusTab.tsx`, `NextTab.tsx`, `ko.json`, `en.json`, `MEETING_LOG.md`
- 그 외 변경 = 스펙 외 = 거부
- `WorkoutReport.tsx`는 props 시그니처 바뀌면 변경 필요하나 본 스펙에서는 시그니처 변경 **없음**. 변경 시 스펙 외.

---

## 9. 예상 총 작업 시간

| Phase | Batch 수 | 예상 시간 | 주요 리스크 |
|---|---|---|---|
| Phase 0 | 2 | 1.5h | ActivityRing SVG 애니메이션 + 테스트 1h, weeklyRunning 0.5h |
| Phase 1 | 5 | 4h | Hero/This Week 대형 변경 각 1h, TT Card 로직 신규 1h, Breakdown/Splits 각 0.5h |
| Phase 2 | 2 | 2h | Top 3 Strengths 데이터 가공 1h, 피트니스 나이 카드 0.5h, i18n 0.5h |
| Phase 3 | 2 | 2h | Weekly Quest Ring 데이터 총합 계산 1h, Next Session 2-grid 0.5h, 팔레트 정리 0.5h |
| QA/UAT | — | 1.5h | 7가지 시나리오 × 2 locale |
| **합계** | **11** | **11h** | 약 1.5 집중 세션 |

---

## 부록 A. ActivityRing 수치 치트시트

| size | strokeWidth | r | circumference |
|---|---|---|---|
| 80 | 8 | 36 | 226.19 |
| 120 | 12 | 54 | 339.29 |
| 128 | 12 | 58 | 364.42 |

- `strokeDashoffset = circumference * (1 - value/100)`
- 예: size=128, value=62 → offset = 364.42 × (1 - 0.62) = 138.48

## 부록 B. Kenko 디자인 DNA 체크리스트 (카드별)

| 항목 | Hero | Interval | TT | Splits | This Week | Fitness Age | Hex+Top3 | Next Sess | Weekly Quest |
|---|---|---|---|---|---|---|---|---|---|
| 대형 디스플레이 타이포 | 56px | 24px | 36px | — | 56px | 48px | 48px(rank) | — | 36px |
| Uppercase 라벨 0.18em | O | O | O | O | O | O | O | O | O |
| Generous whitespace (`px-6 py-7`) | O | O | O | O | O | O | O | O | O |
| Activity Ring 사용 | — | — | — | — | O (128) | — | O (80×3) | — | O (120) |
| 수평 바 차트 단색 톤 | — | O (미니) | — | O | — | — | — | — | O (미니) |
| 장식 세로 바 제거 | O | O | O | O | O | O | O | O | O |
| 의미 SVG 아이콘만 | — | — | 방향 | — | — | — | — | — | — |

**모든 카드가 위 체크리스트 7~8개 이상 충족 시 "Kenko화 완료" 판정.**

---

## 부록 C. 파일 영향 요약

| 파일 | 수정 유형 | 예상 라인 변경 |
|---|---|---|
| `src/components/report/ActivityRing.tsx` | 신규 | +60 |
| `src/utils/weeklyRunning.ts` | 신규 | +55 |
| `src/components/report/RunningReportBody.tsx` | 대폭 수정 | ~+80, ~-60 |
| `src/components/report/TTCard.tsx` | 중간 수정 | ~+40, ~-25 |
| `src/components/report/tabs/StatusTab.tsx` | 대폭 수정 | ~+70, ~-20 |
| `src/components/report/tabs/NextTab.tsx` | 중간 수정 | ~+50, ~-30 |
| `src/locales/ko.json` | 키 추가 | +16 |
| `src/locales/en.json` | 키 추가 | +16 |

순 코드 증분: 약 +300 / -135 = +165 lines. 파일 수 신규 2개, 수정 6개, 총 8개.

---

## 승인 이후 즉시 실행 가능 여부

- 본 문서만으로 구현 가능: **O**
- 외부 자산 필요: **X** (SVG 전부 인라인, 폰트 추가 없음)
- Cloud Functions 변경: **X** (프론트 전용)
- 배포 절차: `git push` → CI Hosting 자동 배포 (functions 불변)

**END OF SPEC**
