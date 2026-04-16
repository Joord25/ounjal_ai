# GA4 이벤트 스키마 v2 (chat-first 퍼널 기준)

작성일: 2026-04-16
상태: 제안 (팀 리뷰 필요)
대상 측정 ID: G-BVD88DPW9E (gtag.js)

---

## 배경

- 기존 v1 스키마는 `condition_check` ViewState, `Onboarding` 메인 플로우 전제로 설계됨.
- Phase 4에서 해당 화면 제거 → **login → home_chat(ChatHome) → master_plan_preview → workout_session → workout_report** chat-first 플로우로 전환.
- 결과: v1 이벤트 4종이 죽은 코드로 남아있고, 핵심 전환점(채팅 제출, 매출)은 추적 안 됨.
- ja/zh 로케일은 랜딩 제거됨. sitemap/lang-check만 잔재.

## 실제 현재 플로우

```
[랜딩 ko|en]
   │ (CTA 클릭 — 추적 없음)
   ▼
login  ──▶ handleLogin/onTryFree
   │
   ▼
home_chat (ChatHome)
   │ 유저가 채팅 제출 (추적 없음)
   │ planSession 호출
   ▼
master_plan_preview (강도 조절/운동 스왑)
   │
   ▼
workout_session
   │
   ▼
workout_report
   │
   ▼
[재시작 / 페이월 / 홈]

영양 탭 최초 진입 시: Onboarding 컴포넌트 (독립 서브플로우)
```

---

## v2 이벤트 세트

### 🔹 유입 (신규)
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `landing_cta_click` | `locale` (ko/en), `target` (signup/try_free), `section` | LandingContent CTA 클릭 |

### 🔹 인증
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `login` | `method` (google/guest) | handleLogin, onTryFree |
| `login_modal_view` | `trigger` | 로그인 모달 노출 시 |
| `guest_trial_exhausted` | `limit`, `trigger` | 게스트 체험 한도 도달 |
| `guest_to_login` | `trial_count` | 게스트→로그인 전환 |

### 🔹 채팅 플랜 생성 (신규 — 핵심 전환점)
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `chat_submit` | `intent`, `has_body_part` (bool), `char_length` | ChatHome 제출 직후 |
| `chat_plan_generated` | `exercise_count`, `latency_ms`, `goal` | planSession 성공 |
| `chat_plan_failed` | `reason` (timeout/trial_limit/server_error), `latency_ms` | planSession 실패 |

### 🔹 플랜 미리보기 / 조정
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `plan_preview_view` | `exercise_count` | MasterPlanPreview 진입 |
| `intensity_change` | `from`, `to` (high/moderate/low) | 강도 슬라이더 변경 (신규) |
| `plan_regenerate` | `trigger` (intensity/reject/manual) | 재생성 (신규) |
| `plan_preview_start` | — | 운동 시작 |
| `plan_preview_reject` | `exercise_count` | 뒤로 나가기 |

### 🔹 운동 세션
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `workout_start` | `exercise_count` | WorkoutSession 진입 |
| `workout_abandon` | — | 중간 이탈 |
| `workout_complete` | `session_number`, `duration_min` | 완료 |
| `report_view` | `has_pr` (bool), `total_volume` | WorkoutReport 진입 (파라미터 확장) |

### 🔹 결제 퍼널 (매출 보강)
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `paywall_view` | `trigger`, `session_number` | 페이월 노출 |
| `paywall_tap_subscribe` | `plan` (monthly), `value`, `currency` | 결제 버튼 탭 (파라미터 확장) |
| `paywall_dismiss` | `trigger` | 닫기 |
| `purchase` | `value`, `currency`, `transaction_id`, `plan`, `payment_method` (kakaopay) | **결제 성공 (GA4 표준 ecommerce)** — `subscription_complete` 대체 |

### 🔹 영양 서브플로우 (격리)
| 이벤트 | 파라미터 | 발화 지점 |
|---|---|---|
| `nutrition_onboarding_start` | — | Onboarding 컴포넌트 마운트 |
| `nutrition_onboarding_profile` | — | 프로필 입력 완료 |
| `nutrition_onboarding_goal` | `goal` | 목표 선택 |
| `nutrition_onboarding_complete` | — | 온보딩 완료 |

---

## 삭제 (v1 유령)

- ~~`condition_check_start / step / complete / abandon`~~ — 화면 자체가 없음 → **삭제 완료**
- ~~`onboarding_start / profile / goal / complete`~~ → `nutrition_onboarding_*`로 재명명 (메인 퍼널 오염 방지) + `login` 분리 → **완료**
- ~~`subscription_complete`~~ → `purchase` (GA4 ecommerce 표준)로 교체 **예정**

## 이번 청소 작업 완료분

- [x] `sitemap.ts`에서 `/ja`, `/zh` 제거
- [x] `app/app/page.tsx:198` lang 체크에서 ja/zh 제거
- [x] `analytics.ts`에서 `condition_check_*` 4종 삭제
- [x] `condition_check` 유령 주석 3곳 수정
- [x] 로그인 이벤트 `onboarding_start` → `login` 분리
- [x] 영양 온보딩 `onboarding_*` → `nutrition_onboarding_*` 재명명

## 다음 단계 (구현 티켓)

1. **landing_cta_click**: LandingContent.tsx CTA onClick에 trackEvent 추가 (ko/en)
2. **chat_submit / chat_plan_generated / chat_plan_failed**: ChatHome 제출 핸들러 + page.tsx:646 finally 블록에 trackEvent 배선
3. **intensity_change / plan_regenerate**: MasterPlanPreview 슬라이더 핸들러
4. **purchase 이벤트**: SubscriptionScreen.tsx `subscription_complete` 위치 교체 — `value: 6900`, `currency: "KRW"`, `transaction_id: <portone_tx_id>`, `plan: "monthly"`, `payment_method: "kakaopay"`
5. **report_view 파라미터 확장**: has_pr, total_volume 추가
6. **GA4 관리자 세팅**: `purchase`를 전환 목표로 설정, `chat_submit` → `purchase` 퍼널 구성, 랜딩 채널별 UTM 파라미터 표준화

## 설계 원칙

- **퍼널 단계당 1개 핵심 이벤트** — 과다 발화 금지 (guest_trial_exhausted 7개 트리거는 `trigger` 파라미터로 통합하면서 유지)
- **GA4 표준 이벤트 우선** — `purchase`, `login` 등 예약어 사용 시 자동 대시보드 혜택
- **파라미터로 구분, 이벤트명으로 남발 금지** — `trigger`, `method`, `reason` 등 dimension으로 처리
- **서브플로우 prefix** — `nutrition_*`처럼 메인 퍼널과 격리
