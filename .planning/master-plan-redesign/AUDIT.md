# MasterPlanPreview 감사 (Phase 0)

**파일**: [src/components/plan/MasterPlanPreview.tsx](../../src/components/plan/MasterPlanPreview.tsx) · 918줄
**작성**: 2026-04-14 · 기획/개발/평가 합동
**스코프**: Kenko 구조 리디자인 착수 전 기존 코드 정리

---

## 1. 🐛 발견된 버그/데드 코드

| # | 위치 | 현상 | 조치 |
|---|------|------|------|
| B1 | L177, L615, L626-747 | `expandedCard` state — 클릭은 `setSelectedIdx`로 가는데 expanded 블록은 `expandedCard` 기준. **리스트 뷰의 확장 액션(swap/move/delete)이 절대 안 보임**. | **제거** |
| B2 | L197, L847-914 | `guideExercise` state + 바텀시트. `setGuideExercise`가 한 번도 호출 안 됨. **70줄 데드 코드**. | **제거** |
| B3 | L383, L399 | `handleMoveExercise`/`handleDeleteExercise`에서 `setExpandedCard` 호출 — B1 제거 시 같이 삭제. | **제거** |
| B4 | L172-174 | `useEffect` deps에 `locale` 누락. 언어 전환 시 `count` 문자열 stale. | **수정** `[sessionData, t, locale]` |
| B5 | L169 | `useEffect(() => trackEvent, [])` deps 빈 배열 — 의도는 마운트 1회, 주석 추가로 해결. | **주석만** |
| B6 | L459 | phase fallback `type==="cardio" && !name.includes("추가")` — legacy 분기, `phase` 태그 보편화된 지금은 불필요. | **단순화** (phase 태그 단일 소스) |
| B7 | L166, L317 | `ex.count` 문자열이 `sets/reps`와 이중 소스. 방금 즉흥 패치도 `ex.sets` 기반으로 우회. | **설계 변경**: Selected pane에서는 `sets/reps/weight`만 읽고 `count`는 cardio/warmup에만 사용 |

---

## 2. ♻️ 살릴 것 (LIBRARY pane으로 승격)

| 요소 | 위치 | 이유 |
|---|---|---|
| 헤더 바 (뒤로/타이틀/세팅) | L477-496 | Shell로 승격 |
| `PlanHero` | L500-511 | 그대로 재사용 |
| Phase 헤더 (WARM-UP/MAIN/CORE/CARDIO) | L602-608 | 대표님 지시로 유지 |
| 운동 카드 row (이름 · 부위 칩 · ±세트) | L618-694 | 이미 Kenko스러움, 톤 유지 |
| "+ Add Exercise" 버튼 + `PlanBottomSheets` 추가 플로우 | L752-761, L801-820 | LIBRARY 내부 인터랙션으로 흡수 |
| `PlanTutorialOverlays` | L822-833 | 좌표만 재조정, 로직 유지 |
| Bottom CTA (공유/시작) | L772-798 | Shell 레벨로 승격 |
| `PlanShareCard` | L839-845 | 유지 |

## 3. 🆕 신규 (SELECTED pane)

| 요소 | 출처 | 비고 |
|---|---|---|
| Kenko Add Sets 카드 포맷 (SET N · `8 reps × 80 kg`) | 신규 | 톤은 `#1B4332` 유지, 구조만 Kenko |
| REMOVE / ADD SET 하단 분할 버튼 | 기존 `PlanExerciseDetail` 재배치 | emerald 톤 |
| ≡ 드래그 핸들 | 신규 | 기존 move up/down 버튼 대체 |
| pill 하이라이트 (편집 중 숫자) | 신규 | Rubik 숫자 폰트 |
| 좌측 해부학 아이콘 자리 | `MuscleIcon` placeholder | SVG 구매 후 drop-in |

## 4. 🗑️ 완전 삭제

- `expandedCard` state + 리스트 뷰 확장 액션 블록 (L626-747) — B1
- `guideExercise` state + 바텀시트 (L847-914) — B2
- `setExpandedCard` 호출 4곳 — B3

**총 감축 예상**: 918줄 → 약 720줄 (리디자인 전에도 -200줄 정리)

## 5. 🔧 리팩터 (Phase 1에서 훅/컴포넌트 분리)

- `useSetEditor` 훅 ← `handleUpdateSetDetail` · `handleAddSet` · `handleRemoveSet` · `adjustSets`
- `usePhaseFiltering` 훅 ← L458-468 phase 필터링 로직
- `useRunningVariant` 훅 ← L218-231 러닝 감지/스왑
- `PlanLibraryPane` ← 현재 리스트 뷰 전체 이동
- `PlanSelectedPane` ← 신규 (Kenko Add Sets 카드)
- `PlanSplitShell` ← 8:2 ↔ 2:8 토글 컨테이너
- `MuscleIcon` ← placeholder (muscleColor 점) → SVG 교체 대비

## 6. ⚠️ Phase 7 시뮬 필수 엣지케이스 (15회)

1. 러닝 세션 진입 (Hero 드롭다운 + Selected pane 동시 상호작용)
2. MAIN phase 운동 1개만 남은 상태에서 삭제 시도 → 차단 확인
3. 빈 phase 발생 시 헤더 숨김 확인
4. 언어 ko→en 스위치 직후 count 문자열 재생성 확인 (B4 검증)
5. 8:2 → 운동 탭 → 2:8 슬라이드 애니메이션 (짧은 연타 race)
6. 2:8 상태에서 LIBRARY peek 탭 → 복귀
7. Selected pane에서 ADD SET 연타 (max 10 클램프)
8. 1세트 남은 상태에서 REMOVE 탭 → 차단 확인
9. Library에서 운동 추가 → Selected에 즉시 반영
10. Swap 수행 후 Selected pane 상태 유지 확인
11. 강도 변경 → `localExercises` 재동기화
12. 튜토리얼 오버레이 3종 좌표 재측정 (레이아웃 변경 후)
13. Share card 모달과 Shell의 z-index 충돌
14. CTA sentinel (스크롤 끝 감지)가 2분할에서도 동작
15. iOS safe-area inset에서 Shell 높이 계산

## 7. 🚫 커밋/푸시 차단 확인

- Hook 설치됨: `.claude/hooks/block-commit-push.js`
- 해제 플래그: `.claude/hooks/ALLOW_COMMIT` (대표님 승인 시만 생성)
- 시뮬 15회 + 대표님 최종 확인 전까지 commit/push 일체 금지

---

## 즉흥 패치 3건 (Phase 0에 포함)
이미 적용됨:
- kg 표기 제거 (L661-663 삭제)
- −/+ 버튼 회색 배경 제거 (replace_all)
- 횟수 제거 → strength/core는 "N세트"만 표시 (L674-681)

→ Phase 1~7 커밋에 함께 포함 예정.

---

## 기획자 승인란
- [ ] 데드코드 제거 범위 OK
- [ ] 살릴 것/새로 만들 것 분류 OK
- [ ] 엣지케이스 15개 충분
