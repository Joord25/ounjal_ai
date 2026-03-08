# 마스터 플랜 데이터 생성 조합 가이드

## 현재 입력 변수

### 1. 신체 컨디션 (bodyPart) - 4가지
| 값 | 의미 |
|---|---|
| `good` | 컨디션 좋음 |
| `upper_stiff` | 상체 뻣뻣함 |
| `lower_heavy` | 하체 무거움 |
| `full_fatigue` | 전신 피로 |

### 2. 에너지 레벨 (energyLevel) - 3단계로 그룹화
| 그룹 | 값 | 의미 |
|---|---|---|
| LOW | 1~2 | 에너지 낮음 |
| MID | 3 | 보통 |
| HIGH | 4~5 | 에너지 높음 |

> 1~5를 전부 나누면 조합이 과도해지므로 3단계로 그룹화

### 3. 운동 목적 (goal) - 4가지
| 값 | 의미 | 렙 범위 |
|---|---|---|
| `fat_loss` | 체지방 감량 | 15-20 Reps |
| `muscle_gain` | 근비대 | 8-12 Reps |
| `strength` | 근력 향상 | 3-5 Reps |
| `general_fitness` | 전반적 체력 | 10-15 Reps |

### 4. 운동 종류 (sessionType) - 6가지
| 값 | 의미 |
|---|---|
| `push` | 밀기 (가슴/어깨/삼두) |
| `pull` | 당기기 (등/이두) |
| `legs` | 하체 (스쿼트/런지/데드) |
| `run` | 달리기/유산소 |
| `mobility` | 모빌리티/회복 |
| `full_body` | 전신 |

### 5. 가용 시간 (availableTime) - 3가지
| 값 | 의미 |
|---|---|
| `30` | 30분 |
| `50` | 50분 |
| `90` | 90분 |

### 6. 성별 (gender) - 2가지
| 값 | 의미 |
|---|---|
| `male` | 남성 |
| `female` | 여성 |

### 7. 나이대 (ageGroup) - 출생연도 기반 3그룹
| 그룹 | 출생연도 범위 | 의미 |
|---|---|---|
| `young` | 1997~2007 (18~28세) | 젊은 층 |
| `mid` | 1986~1996 (29~39세) | 중간 층 |
| `senior` | 1966~1985 (40~59세) | 시니어 층 |

---

## 전체 조합 수

```
컨디션(4) x 에너지(3) x 목적(4) x 운동종류(6) x 시간(3) x 성별(2) x 나이대(3)
= 4 x 3 x 4 x 6 x 3 x 2 x 3
= 5,184 조합
```

### 축소 방안: 불필요한 조합 제거

**제거 가능한 조합들:**
- `full_fatigue` + `strength` (전신 피로 상태에서 고중량은 부상 위험)
- `full_fatigue` + `90min` (피로 상태에서 90분은 비현실적)
- `upper_stiff` + `push` (상체 뻣뻣한데 밀기는 부적절 -> mobility 유도)
- `lower_heavy` + `legs` (하체 무거운데 하체 운동은 부적절 -> 상체 유도)
- 에너지 LOW + 90min (에너지 없는데 90분은 비현실적)

**제거 후 예상: ~3,000~3,500 조합**

### 추가 축소: 성별/나이대 영향 제한

성별과 나이대는 **운동 종목 자체보다 세트/렙/무게 조정**에 영향을 주므로:
- 플랜 템플릿은 `컨디션 x 에너지 x 목적 x 운동종류 x 시간` 기준으로 생성
- 성별/나이대는 세트/렙 수치만 후처리로 조정

```
핵심 조합: 4 x 3 x 4 x 6 x 3 = 864 템플릿
성별/나이 후처리: 렙수 +/- 조정, 무게 가이드 변경
```

**각 조합당 2~3개 변형 = 약 1,700~2,600개 플랜**

---

## 출력 데이터 형식 (WorkoutSessionData)

각 플랜은 현재 앱에서 사용하는 형식과 동일:

```json
{
  "title": "Push Day - Hypertrophy",
  "description": "가슴/어깨/삼두 근비대 훈련",
  "exercises": [
    {
      "name": "Barbell Bench Press",
      "nameKo": "바벨 벤치 프레스",
      "type": "Strength",
      "sets": 4,
      "reps": "8-12 Reps",
      "rest": 90,
      "guide": "가슴을 펴고 바를 천천히 내려 가슴에 터치 후 폭발적으로 밀어올림",
      "targetMuscle": "Chest",
      "isWarmup": false,
      "isCardio": false,
      "duration": 0,
      "recommendedWeightKg": 60
    }
  ],
  "_meta": {
    "condition": "good",
    "energy": "HIGH",
    "goal": "muscle_gain",
    "sessionType": "push",
    "time": 50,
    "variant": 1
  }
}
```

---

## 생성 우선순위 (권장)

1단계 (MVP - 가장 많이 사용될 조합):
- 컨디션: `good` only
- 에너지: `MID`, `HIGH`
- 목적: `muscle_gain`, `fat_loss`
- 운동종류: `push`, `pull`, `legs`, `full_body`
- 시간: `50`
- **= 1 x 2 x 2 x 4 x 1 = 16 조합 x 3 변형 = 48개**

2단계 (확장):
- 나머지 컨디션, 에너지, 시간 추가
- `run`, `mobility` 추가
- **= ~300개**

3단계 (전체):
- 성별/나이대별 세트/렙 조정 로직 적용
- 전체 864 템플릿 완성
