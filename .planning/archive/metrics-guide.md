# 오훈잘 운동 리포트 지표 가이드

> 이 문서는 앱 내 운동 리포트에서 사용하는 모든 추정치와 지표의 근거 및 계산 방식을 정리한 것입니다.
> 앱 내 도움말(? 아이콘) 텍스트의 원본이기도 합니다.
>
> **최종 업데이트: 2026-03-10**

---

## 1. 오늘의 Lift (BW Ratio)

### 정의
오늘 세션에서 가장 높은 추정 1회 최대 중량(e1RM)을 체중으로 나눈 값

### 계산식
```
BW Ratio = e1RM / 체중(kg)
```

### e1RM (추정 1회 최대 중량, Estimated 1-Rep Max)

- **공식**: Epley Formula — `e1RM = 무게(kg) × (1 + 반복횟수 / 30)`
- **출처**: Epley, B. (1985). *Poundage Chart*. Boyd Epley Workout. / NSCA Essentials of Strength Training and Conditioning (4th ed.)
- **유효 범위**: 반복횟수 1~30회, 무게 > 0kg
- **1회 수행 시**: e1RM = 사용 중량 그대로

### 대상 종목 (복합 관절 운동만)
스쿼트, 벤치프레스, 데드리프트, 오버헤드프레스, 바벨로우, 프론트스쿼트, 루마니안 데드리프트, 레그프레스, 힙쓰러스트, 인클라인/디클라인 벤치, 클린, 스내치, 저크 등

> 단관절 운동(바이셉 컬, 트라이셉스 푸쉬다운 등)은 e1RM 추정에서 제외합니다.
> 이유: 단관절 운동은 1RM 추정의 정확도가 낮고, 체중 대비 비율로서 의미가 적습니다.

### BW Ratio 해석 기준 (남성, NSCA/Rippetoe 기반)

| 등급 | 스쿼트 | 벤치프레스 | 데드리프트 |
|------|--------|-----------|-----------|
| 초급 (Untrained) | < 0.75x | < 0.50x | < 0.75x |
| 중급 (Intermediate) | 0.75~1.25x | 0.50~1.00x | 0.75~1.50x |
| 상급 (Advanced) | 1.25x+ | 1.00x+ | 1.50x+ |

> 여성은 위 기준의 약 0.6배 적용 (NSCA 성별 보정 계수)

### 앱 내 도움말 텍스트
> 오늘 운동에서 **가장 무거운 무게를 들어올린 기록**을 내 체중과 비교한 숫자예요.
> 예: 1.18x = 내 몸무게의 1.18배를 들 수 있는 힘
>
> **e1RM**은 "추정 1회 최대 중량"이에요. 한 번에 최대로 들 수 있는 무게를 오늘 기록으로 추정한 값이에요. (Epley 공식)

---

## 2. 부하 상태 (Load Status) — 옵션 C 하이브리드

### 정의
오늘 세션의 부하를 **ACSM 연령/레벨별 절대 기준**과 비교하여 판정. Israetel의 Volume Landmarks(MV/MEV/MAV/MRV) 개념 적용.

### 계산식
```
Load Score = 총 볼륨(kg) / 체중(kg)                      ← 밴드 판정 + 비율 표시 기준
부하 비율 = 오늘 Load Score / 히스토리 평균 Load Score    ← 카드 표시값
```

> **변경 이력 (2026-03-10)**: 기존에는 `부하 비율 = 총 볼륨 / 4주 평균 볼륨`이었으나,
> band ratio(ACSM 기준)와 단위 불일치 문제로 Load Score 기준으로 통일.
> 또한 avgGraphLoad 계산 시 오늘 세션을 제외하여 자기참조 편향을 방지.

### 총 볼륨 (Volume Load)
- **공식**: `총 볼륨 = Σ (무게 × 반복횟수)` (모든 strength 세트)
- **출처**: NSCA — Volume Load는 저항 훈련 부하를 정량화하는 표준 방법 (Essentials of S&C, 4th ed.)

### Israetel Volume Landmarks

| 용어 | 의미 |
|------|------|
| MEV (Minimum Effective Volume) | 성장이 시작되는 최소 볼륨 |
| MAV (Maximum Adaptive Volume) | 최대 적응 효과를 내는 볼륨 상한 |
| MRV (Maximum Recoverable Volume) | 회복 가능한 최대 볼륨 (초과 시 과훈련) |

### 레벨별 세션 Load Score 기준 (볼륨/체중)

| 레벨 | MEV (low) | MAV (high) | MRV (overload) |
|------|-----------|------------|----------------|
| 초급 | 15 | 55 | 70 |
| 중급 | 40 | 110 | 140 |
| 상급 | 70 | 180 | 220 |

### 밴드 판정 (하이브리드)

- **히스토리 4세션 미만**: 순수 ACSM 절대 기준 적용
- **히스토리 4세션 이상**: ACSM 기준(60~70%) + 개인 히스토리(30~40%) 블렌딩
  - 개인 비중 = min(0.4, sessionCount × 0.04)
  - 히스토리가 쌓일수록 개인 데이터 반영 비율 증가

### 부하 비율 계산 방식 (WorkoutReport)

```
히스토리 평균 Load Score = 오늘 세션 제외한 4주 히스토리의 Load Score 평균
부하 비율(loadRatio) = 오늘 Load Score / 히스토리 평균 Load Score
밴드 비율 = loadBand.X / 히스토리 평균 Load Score (X = low, high, overload)
```

> **중요**: 오늘 세션은 avgGraphLoad 계산에서 **제외**하여 자기참조 편향을 방지합니다.
> 이전 로직에서는 오늘 세션이 포함되어, 오늘 볼륨이 높으면 평균이 올라가고 bandOverloadRatio가 낮아져 과부하 판정이 과도하게 엄격해지는 버그가 있었습니다.

### 부하 상태 해석 기준

| 범위 | 상태 | 의미 |
|------|------|------|
| loadRatio < bandLowRatio | 볼륨 부족 (파란색) | 성장에 필요한 최소 자극 부족 |
| bandLowRatio ≤ loadRatio ≤ bandHighRatio | 성장 구간 (초록색) | 근성장에 최적인 볼륨 |
| bandHighRatio < loadRatio ≤ bandOverloadRatio | 고부하 (주황색) | 회복 가능하지만 주의 필요 |
| loadRatio > bandOverloadRatio | 과부하 (빨간색) | 회복 불가, 과훈련 위험 |

### 근거
- **ACSM Position Stand (2009)**: 점진적 과부하(progressive overload)는 주간 볼륨 증가 2~10%가 권장됨
- **Israetel, M. (RP Strength)**: MEV/MAV/MRV Volume Landmarks — 세션 볼륨이 MRV를 초과하면 회복 불가
- **Schoenfeld et al. (2017)**: 볼륨과 근비대는 양의 상관관계이나, 체계적 감량 없이 계속 증가시키면 역효과

### 연령 보정 (ACSM 2011 / 고령자 메타분석 2024)
MEV(하한)에 연령 보정 계수 적용:
- 18-39세: x1.0 (보정 없음)
- 40-49세: x0.9
- 50-59세: x0.8
- 60-69세: x0.7
- 70+: x0.6

### 앱 내 도움말 텍스트
> 오늘 운동량이 **ACSM 권장 기준과 비교해서 어디에 위치하는지** 보여줘요.
> 현재 레벨과 연령에 맞는 절대 기준(Israetel MEV/MAV/MRV)으로 판정해요.
>
> **성장 구간(MEV~MAV)**을 유지하면 근성장에 가장 효과적이에요. 히스토리가 쌓이면 개인 데이터도 반영돼요.

---

## 3. 타깃 적중률 (Target Rate / Success Rate)

### 정의
AI가 설정한 목표 렙수를 실제로 달성하거나 초과한 세트의 비율

### 계산식
```
타깃 적중률(%) = (feedback ≠ "fail"인 세트 수 / 전체 세트 수) × 100
```

### 피드백 분류
- **target**: 목표 렙수를 정확히 달성
- **easy / too_easy**: 목표 렙수를 초과 달성 (쉬웠음)
- **fail**: 목표 렙수 미달

### 해석 기준

| 범위 | 해석 | 조치 |
|------|------|------|
| 85%+ | 잘 수행함 | 다음 세션에서 무게를 올려볼 시기 |
| 70~85% | 보통 | 현재 무게 유지하며 적응 |
| < 70% | 무리했음 | 무게를 낮추는 것을 권장 |

### 근거
- **NSCA**: RPE(주관적 운동 강도) 8~9에서 목표 렙수 달성이 이상적. 매 세트 실패(failure)까지 가는 것은 비효율적 (Helms et al., 2018)
- **ACSM**: 초급자는 실패 없이 8-12RM을 달성하는 것이 권장됨

### 앱 내 도움말 텍스트
> AI가 정해준 목표 횟수를 **실제로 얼마나 잘 채웠는지** 보여주는 거예요.
> 84% = 전체 세트 중 84%를 목표대로 성공
>
> 85% 이상이면 무게를 올릴 타이밍이고, 70% 이하면 무게를 좀 낮추는 게 좋아요.

---

## 4. 피로 신호 (Fatigue Drop)

### 정의
각 운동별로 전반부 세트와 후반부 세트의 평균 렙수 차이를 백분율로 측정한 후, 전체 운동의 평균

### 계산식
```
운동별 드롭(%) = ((후반부 평균 렙수 - 전반부 평균 렙수) / 전반부 평균 렙수) × 100
피로 신호 = 전체 운동의 드롭 평균 (반올림)
```

> 운동마다 개별 계산 후 평균하는 이유: 벤치프레스 8렙과 크런치 20렙을 직접 비교하면 왜곡되기 때문

### 대상
- **strength 운동만** 계산 (timer 운동인 warmup/mobility/cardio 제외)
- 운동별 최소 2세트 이상 수행한 경우만 포함

### 해석 기준

| 범위 | 상태 | 권장 회복 시간 |
|------|------|-------------|
| > -10% | 안정 (초록) | 24시간 |
| -10% ~ -20% | 안정 (초록) | 36시간 |
| -20% ~ -30% | 주의 (주황) | 48시간 |
| < -30% | 위험 (빨강) | 72시간 |

> **변경 이력 (2026-03-10)**: 코드 기준으로 임계값 재정리.
> 코드에서는 `-15%` 기준으로 안정/주의, `-25%` 기준으로 주의/위험을 구분합니다.
> 회복 시간: `-10%` 이상 24h, `-20%` 이상 36h, `-30%` 이상 48h, 그 이하 72h.

### 근거
- **Morán-Navarro et al. (2017)**: 세트 간 렙수 감소율은 신경근 피로의 신뢰 가능한 지표
- **González-Badillo et al. (2017)**: Velocity Loss(속도 감소)로 피로를 측정하는 연구에서, 렙수 감소가 속도 감소와 상관관계가 높음
- **NSCA**: 세트 간 25% 이상의 렙수 감소는 과도한 피로를 의미하며, 세트 수 감소 또는 휴식 시간 증가를 권장

### 회복 시간 추정 근거
- **ACSM (2009)**: 같은 근육군 훈련 간 최소 48시간 간격 권장
- **Schoenfeld et al. (2016)**: 주 2회 빈도가 주 1회보다 근비대에 유리 → 48시간 회복이 적절
- 피로 드롭이 적을수록 회복 부담이 적으므로, 안정 시 24시간, 위험 시 72시간으로 차등

### 앱 내 도움말 텍스트
> 운동 **전반부와 후반부의 반복 횟수 차이**를 비교한 거예요.
> -12% = 후반에 반복 횟수가 12% 줄어든 것. 약간의 피로는 자연스러워요.
>
> 피로가 크면 다음 세션에서 볼륨을 줄이거나 휴식을 더 가져야 해요.

---

## 5. 부하 점수 (Load Score)

### 정의
세션 간 비교가 가능한 정규화된 부하 지표

### 계산식
```
체중 있음: Load Score = 총 볼륨(kg) / 체중(kg) (소수점 1자리)
체중 없음: Load Score = 총 볼륨(kg) 그대로
```

### 용도
- 4주 부하 타임라인 그래프의 Y축 값
- 세션 간 부하 비교 (체중이 다른 시점에서도 공정한 비교)
- **부하 비율(loadRatio) 계산의 기준 단위** (2026-03-10 변경)

### 앱 내 도움말 텍스트 (4주 부하 타임라인)
> 최근 4주간의 **운동 부하(볼륨)를 그래프로** 보여줘요. 점 하나가 운동 한 번이에요.
>
> **초록색 영역 = 성장 구간** (ACSM/Israetel MEV~MAV, 레벨+연령 보정)
> **점 = 세션별 부하** (총 볼륨 ÷ 체중. 높을수록 강하게 운동한 것)
>
> 점이 초록 영역 안에 꾸준히 찍히면 잘 관리되고 있는 거예요. 갑자기 위로 튀면 과훈련 위험이 있어요.

---

## 6. 레벨 자동추정 (Training Level Estimation)

### 정의
사용자의 운동 기록에서 3대 운동 성과를 분석하여 자동으로 훈련 레벨을 판정

### 판정 기준 (e1RM / 체중 비율)

**남성:**

| 운동 | 초급 | 중급 | 상급 |
|------|------|------|------|
| 스쿼트 | < 0.75x | 0.75~1.25x | > 1.25x |
| 벤치프레스 | < 0.50x | 0.50~1.00x | > 1.00x |
| 데드리프트 | < 0.75x | 0.75~1.50x | > 1.50x |

**여성** (x0.6 보정):

| 운동 | 초급 | 중급 | 상급 |
|------|------|------|------|
| 스쿼트 | < 0.45x | 0.45~0.75x | > 0.75x |
| 벤치프레스 | < 0.30x | 0.30~0.60x | > 0.60x |
| 데드리프트 | < 0.45x | 0.45~0.90x | > 0.90x |

### 판정 우선순위
1. **3대 운동 기록** → e1RM/체중 비율로 판정
2. **맨몸 운동만** → 푸쉬업/풀업 렙수로 판정

> ⚠️ 3, 4순위(러닝/가동성)는 현재 코드에 미구현. 해당 세션만 있으면 기본값 "초급" 적용.

### 맨몸 운동 레벨 기준 (남성 기준, 여성 상체 x0.5)

| 운동 | 초급 | 중급 | 상급 |
|------|------|------|------|
| 푸쉬업 | < 10회 | 10~25회 | > 25회 |
| 풀업/턱걸이 | 0회 | 1~8회 | > 8회 |

> ⚠️ 플랭크는 현재 코드에서 레벨 판정 대상에 포함되지 않습니다.

### 4주 미활동 시 레벨 하향 (Decay)

> **추가 (2026-03-10)**: 코드에 구현되어 있으나 이전 문서에 기재되지 않았던 로직.

- 역대 기록으로 판정한 레벨이 중급 이상인 경우
- 최근 4주 내 해당 수준의 기록이 없으면 **한 단계 하향** 적용
- 예: 역대 "상급" → 최근 4주 기록 없음 → "중급"으로 조정
- `decayed: true` 플래그로 표시

### 근거
- **Rippetoe, M. & Kilgore, L. (2006)**: *Practical Programming for Strength Training* — 체중 대비 1RM 기준표
- **ExRx.net Strength Standards**: 성별/체중별/운동별 표준 기준 (Kilgore et al.)
- **NSCA**: 훈련 경력에 따른 프로그램 설계 분류 (Novice/Intermediate/Advanced)
- **Mujika & Padilla (2000)**: 탈훈련(detraining) 시 4주 내 근력 5~10% 감소 — decay 로직의 근거

---

## 7. 연령 보정 계수 (Age Adjustment)

### 정의
연령에 따라 부하 판정 기준을 조정하는 계수

### 보정표

| 연령대 | 보정 계수 | 근거 |
|--------|----------|------|
| 18-39세 | 1.0 | ACSM 기준 성인 표준 |
| 40-49세 | 0.9 | 근력 감소 시작 (sarcopenia onset) |
| 50-59세 | 0.8 | ACSM 2011: 중강도 권장 |
| 60-69세 | 0.7 | ACSM 2011: 10-15RM 권장 |
| 70세+ | 0.6 | 고령자 메타분석 (2024): 저~중강도 효과적 |

### 적용 범위
- **MEV (하한)에만** 연령 보정 적용
- MAV, MRV는 연령 보정 없음 (reference 모드)
- 하이브리드 모드에서 low값에만 ageMult 적용

### 근거
- **ACSM (2011, Garber et al.)**: 고령자(65+)는 10-15RM, 주 2-3회
- **Network meta-analysis (2024, 151 RCTs)**: 고령자도 70-85% 1RM에서 근력 최적화 가능하나, 총 볼륨은 줄여야 함
- **Sarcopenia 연구**: 40대부터 연간 약 1-2% 근량 감소 시작 (Cruz-Jentoft et al., 2019)

---

## 8. 데이터 안전장치

> **추가 (2026-03-10)**: AI 생성 데이터의 타입 안전성 문제 해결

### repsCompleted 타입 가드
- Gemini AI가 `reps` 필드를 문자열("30초 유지", "8-10회" 등)로 반환할 수 있음
- `buildWorkoutMetrics`와 `calcFatigueDrop`에서 `repsCompleted`를 항상 숫자로 강제 변환
- `WorkoutSession.handleSetComplete`에서도 입력값을 숫자로 보장
- `WorkoutSession.targetReps`도 AI 데이터에서 문자열이 올 수 있어 parseInt 가드 적용

```typescript
const safeReps = typeof log.repsCompleted === "number"
  ? log.repsCompleted
  : (parseInt(String(log.repsCompleted)) || 0);
```

---

## 참고 문헌 목록

1. **ACSM (2009)** — Ratamess, N.A. et al. "Progression Models in Resistance Training for Healthy Adults." *Med Sci Sports Exerc.* 41(3):687-708. [PubMed: 19204579]
2. **ACSM (2011)** — Garber, C.E. et al. "Quantity and Quality of Exercise." *Med Sci Sports Exerc.* 43(7):1334-1359. [PubMed: 21694556]
3. **Epley, B. (1985)** — *Poundage Chart.* Boyd Epley Workout.
4. **Schoenfeld, B.J. et al. (2017)** — "Dose-response relationship between weekly resistance training volume and increases in muscle mass." *J Sports Sci.* 35(11):1073-1082. [PubMed: 27433992]
5. **Schoenfeld, B.J. et al. (2016)** — "Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy." *Sports Med.* 46(11):1689-1697.
6. **Pelland, J.C., Schoenfeld, B.J., Krieger, J. et al. (2025)** — "Effects of Resistance Training Volume and Frequency on Hypertrophy and Strength." *Sports Med.* [PubMed: 41343037]
7. **Helms, E.R. et al. (2018)** — "RPE and Velocity Just as Reliable as %1RM for Monitoring Resistance Exercises." *J Strength Cond Res.*
8. **Morán-Navarro, R. et al. (2017)** — "Time Course of Recovery Following Resistance Training Leading or Not to Failure." *Eur J Appl Physiol.*
9. **González-Badillo, J.J. et al. (2017)** — "Maximal Intended Velocity Training Induces Greater Gains Than Deliberately Slower Half-Velocity Training." *Eur J Sport Sci.*
10. **Rippetoe, M. & Kilgore, L. (2006)** — *Practical Programming for Strength Training.*
11. **Cruz-Jentoft, A.J. et al. (2019)** — "Sarcopenia: revised European consensus on definition and diagnosis." *Age and Ageing.*
12. **NSCA (2016)** — *Essentials of Strength Training and Conditioning.* 4th Edition. Human Kinetics.
13. **Israetel, M. (RP Strength)** — Training Volume Landmarks for Muscle Growth. rpstrength.com
14. **고령자 저항 훈련 메타분석 (2024)** — 151 RCTs, *Br J Sports Med.* [PubMed: 39405023]
15. **국민체력100** — 국민체육진흥공단. nfa.kspo.or.kr
16. **Mujika, I. & Padilla, S. (2000)** — "Detraining: Loss of Training-Induced Physiological and Performance Adaptations." *Sports Med.* 30(3):145-167.
