# PROOF Tab Redesign -- Pre-Analysis Document

**Prepared:** 2026-04-08
**Purpose:** 다음 세션에서 PROOF 탭 리디자인 회의 즉시 시작을 위한 사전 분석

---

## A. Current State Analysis

### A1. ProofTab 현재 구성 (763줄)

**대시보드 뷰 (기본):**
1. 월 네비게이터 — "2026년 4월 7회 운동"
2. 캘린더/퀘스트 토글
   - 캘린더: GitHub 잔디 스타일, 운동 시간 기반 4단계 색상
   - 퀘스트: ACSM 주간 강도 분배 퀘스트 + EXP
3. 체중 추이 차트 → WeightDetailView 연결
4. 성장 예측 버튼 → FitnessReading 연결
5. 시즌 티어 카드 (Iron~Diamond) + EXP 로그
6. 총 운동 횟수 버튼 → 리스트 뷰 연결
7. 접힘 "운동과학 데이터" (트레이닝 등급, 4주 로드 차트, 월간 볼륨 차트)

**리스트 뷰:** 월별 세션 목록, 편집 모드 멀티 삭제, 스와이프 삭제
**리포트 뷰:** 세션 상세 WorkoutReport
**체중 상세:** 체중 기록 관리

### A2. 사용 가능하지만 미노출 데이터

| 데이터 | 현재 노출 | 비고 |
|---|---|---|
| stats.totalReps | X | 세션별 총 렙수 |
| stats.bestE1RM | X | 세션 최고 E1RM |
| stats.bwRatio | X | 체중 대비 비율 |
| stats.successRate | X | 완료 품질 |
| stats.loadScore | X | 로드 스코어 |
| exerciseTimings[] | X | 운동별 시간 분배 |
| coachMessages[] | X | AI 코치 3버블 |
| runningStats (전체) | X | 러닝 데이터 구분 없음 |
| reportTabs.status | X | 퍼센타일 변화 |
| sessionData.intendedIntensity | X | 고/중/저 강도 |

### A3. 현재 문제점

**시각/디자인:**
- 대시보드가 세로로 너무 길어 스크롤 과다
- 캘린더 잔디가 운동 시간만 반영 (볼륨/강도 무시)
- 러닝 vs 웨이트 세션 구분 안 됨
- 시즌 티어 카드가 공간 많이 차지하나 유틸리티 낮음
- "운동과학 데이터"가 접혀있어 대부분 유저가 못 봄

**UX:**
- 히스토리 접근 경로 2개 (캘린더 탭 vs 총 운동 버튼) — 혼란
- 대시보드에 인사이트 없음 — 원시 숫자만 표시 ("그래서 뭐?" 테스트 실패)
- 리스트 뷰 볼륨 해석 없음
- 주간/월간 비교 불가
- 러닝 세션이 웨이트와 동일하게 표시

---

## B. 경쟁 앱 참고

| 앱 | 핵심 패턴 |
|---|---|
| Strong | 근육 그룹별 색상 점 캘린더, 주간 볼륨 차트 상시 노출 |
| Hevy | 세션 카드 색상 코딩, PR 타임라인, 운동별 진행 그래프 |
| Apple Fitness | 활동 링, 트렌드 화살표, 월간 요약 |
| Strava | 캘린더 + 피드, 상대 노력 점수, 주간 막대 차트 |

**효과적 패턴:**
1. 주간 요약 한눈에 ("이번 주: 3/4일, 12,400kg, 2h 15m")
2. 세션 타입별 색상 구분 (push/pull/leg/run/rest)
3. 트렌드 지표 (화살표/스파크라인)
4. PR 하이라이트
5. 스마트 인사이트 ("벤치 볼륨 이번 달 15% 증가")
6. 러닝/웨이트 카드 분리

---

## C. 회의 참석자 추천

### 필수
| 역할 | 이유 |
|---|---|
| CEO (임주용) | 최종 결정, 제품 비전 |
| 기획자 | 요구사항, 스펙, 진행 |
| 프론트엔드 개발자 | 구현 가능성 |
| 평가자 | 편향 체크, 렌더 경로 검증 |

### 권장
| 역할 | 이유 |
|---|---|
| UX/UI 디자이너 | 레이아웃, 인터랙션 패턴 |
| 콘텐츠 MD | 인사이트 멘트 톤, "so what?" 테스트 |
| 그로스 마케터 | 리텐션 — PROOF은 재참여 루프 |

### 선택
| 역할 | 조건 |
|---|---|
| 현지화 전문가 | i18n 키 추가 시 |
| 백엔드 개발자 | 집계 API 필요 시 |
| 운동생리학자 | ACSM 해석 텍스트 |

---

## D. 기술 범위

### 확정 변경 파일
- `src/components/dashboard/ProofTab.tsx` (763줄) — 메인 리디자인
- `src/components/dashboard/WorkoutHistory.tsx` (~250줄) — 리스트 뷰
- `src/locales/ko.json` + `en.json` — proof.* 키 (현재 ~133개)

### 가능 변경 파일
- WeightTrendChart.tsx, LoadTimelineChart.tsx, VolumeTrendChart.tsx — 재배치/스타일
- HelpCardModal.tsx — 새 도움말 카드
- WeightDetailView.tsx — 운동 데이터 연관

### 신규 파일 후보
- WeeklySummaryCard.tsx — 주간 요약 카드
- SessionCard.tsx — 세션 리스트 카드
- InsightCard.tsx — 트렌드 인사이트 카드

### 제약 사항 (CLAUDE.md)
- i18n 필수 (ko+en 동시)
- 이모지 금지 (SVG 아이콘)
- 모든 숫자에 "so what?" 해석 필요
- 카드 radius: outer rounded-3xl, inner rounded-2xl
- 최종 설계 컨펌 후 구현

---

## E. CEO 사전 질문

1. 현재 PROOF 탭에서 구체적으로 어떤 부분이 문제?
2. 비전: 단순 히스토리 vs 리치 분석 대시보드?
3. PROOF은 "동기부여" 탭인지 "분석" 탭인지?
4. 러닝 세션 카드를 웨이트와 시각적으로 구분할지?
5. cardio 퍼센타일/피트니스 나이 트렌드를 여기서 보여줄지?
6. "스마트 인사이트" 카드를 추가할지? (예: "벤치 e1RM 이번 달 8% 증가")
7. 시즌 티어 카드 — 현재 ~120px 차지, 가치 있는지?
8. PROOF의 주 목적: (a)과거 리뷰 (b)동기부여 (c)훈련 갭 발견 (d)체중 추적?
9. 763줄 메가 컴포넌트 분해할 시점인지?
10. 타임라인: 빠른 폴리시(1-2일) vs 전면 리디자인(1-2주)?

---

## 컴포넌트 의존성 맵

```
ProofTab.tsx
├── WorkoutHistory.tsx (리스트 뷰)
│   └── SwipeToDelete
├── WorkoutReport (리포트 뷰)
├── WeightDetailView.tsx
├── WeightTrendChart.tsx
├── LoadTimelineChart.tsx
├── VolumeTrendChart.tsx
├── HelpCardModal.tsx
└── Utils:
    ├── workoutHistory.ts
    ├── workoutMetrics.ts
    └── questSystem.ts
```
