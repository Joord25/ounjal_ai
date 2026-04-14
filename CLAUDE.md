# CLAUDE.md

이 문서는 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.
세부 규칙은 `.claude/rules/`에 있으며 glob 패턴으로 자동 로드됩니다.

## 빌드 & 개발 명령어

```bash
npm run dev        # 개발 서버 실행 (Next.js + Turbopack)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint 검사
npm run test       # 테스트 실행 (Vitest)
npm run test:watch # 테스트 watch 모드
```

**Cloud Functions** (`functions/` 디렉토리의 별도 npm 프로젝트):
```bash
cd functions && npm run build        # TypeScript 컴파일
cd functions && npm run serve        # 빌드 + 에뮬레이터 (로컬 개발 필수)
firebase deploy --only functions     # Functions만 배포
```

**⚠ 로컬 개발 주의:** `npm run dev`만 실행하면 플랜 생성/코치 메시지가 동작하지 않습니다. 별도 터미널에서 `cd functions && npm run serve`로 Cloud Functions를 로컬 실행해야 합니다.

테스트는 **Vitest**를 사용하며 `@/` 경로 별칭 지원. 단일 테스트 파일 실행: `npx vitest run src/path/to/test.ts`.

Firebase Hosting에 배포 (프로젝트: `ohunjal`, 리전: `us-central1`). GitHub Actions가 main push 시 자동 배포합니다.

### 필수 환경 변수 (`.env.local`)

모두 `NEXT_PUBLIC_*` (클라이언트 접근 가능):
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` — Firebase 설정
- `NEXT_PUBLIC_GEMINI_API_KEY` — Gemini AI (클라이언트 호출용)
- `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` — PortOne 결제

Cloud Functions는 `GEMINI_API_KEY`(서버사이드, Firebase config로 설정)를 사용합니다.

## 아키텍처

**Next.js 16 + React 19 + TypeScript(strict) + TailwindCSS 4** 기반 SPA로, 폰 프레임 형태의 운동 트래커를 시뮬레이션합니다. AI 운동 플랜/분석/코치 메시지는 Gemini 2.5 Flash를 사용합니다.

### 핵심 데이터 흐름

`src/app/app/page.tsx`가 유일한 오케스트레이터로, 앱 상태를 모두 보유하고 props/callback을 하위로 전달합니다. 외부 상태 라이브러리 없음. 뷰 라우팅은 `ViewState` 타입으로 처리 (`login → condition_check → master_plan_preview → workout_session → workout_report → home`). 탭 내비게이션은 `TabId`와 함께 `BottomTabs`로 구현.

### 라우트 구조

- `/` — 한국어 랜딩 페이지 (`src/app/page.tsx` + `LandingContent.tsx`)
- `/en`, `/ja`, `/zh` — 다국어 랜딩 페이지
- `/app` — 메인 SPA (`src/app/app/page.tsx` — 단일 오케스트레이터)
- `/admin` — 관리자 패널
- `/privacy`, `/terms` — 약관/정책 페이지

### 하나의 저장소에 두 개의 코드베이스

1. **Next.js 프론트엔드** (루트 `src/`) — 메인 앱
2. **`functions/`** — Firebase Cloud Functions (Node 22, v6). 실제 운영 중인 코드베이스.

### 주요 디렉토리

- **`src/components/`** — 6개 도메인 디렉토리: `layout/`, `plan/`, `workout/`, `report/`, `dashboard/`, `profile/`
- **`src/constants/`** — 타입, 운동 풀, 테마, 운동 영상 매핑
- **`src/utils/`** — Gemini 클라이언트, 운동 이력/지표, 유저 프로필, 운동명, 러닝 통계
- **`src/hooks/`** — Safe area, i18n, GPS 트래킹, 알람 신디사이저
- **`src/locales/`** — ko.json, en.json (항상 함께 업데이트 필수)

### 인증

Firebase Auth + Google 로그인. `page.tsx`에서 `onAuthStateChanged` 감지. Cloud Functions는 `Authorization: Bearer <idToken>`을 검증합니다.

## 중요 패턴

- **i18n:** 모든 UI 텍스트는 ko.json과 en.json에 반드시 동시 반영
- **이모지 금지:** 유니코드 이모지/픽토그램 전면 금지. SVG 아이콘으로 대체. 한글 이모티콘(ㅎㅎ ㅠㅠ)은 허용하되 화면당 1회까지.
- **상태 변경 규칙:** React 상태를 수정할 때는 해당 상태를 읽는 모든 위치를 grep으로 확인
- **운동 흐름 보호:** `master_plan_preview`/`workout_session` 동안 탭 전환 차단
- **Cold start 대응:** `lazyGenerateWorkout`은 첫 실패 시 1.5초 후 1회 재시도
- **운동 영상:** 255개 이상의 운동이 `exerciseVideos.ts`에서 YouTube Shorts ID에 매핑됨
- **러닝 페이스:** 10초 롤링 평균, GPS 이상치(>12m/s) 제거, 10초 정지 시 자동 일시정지

## 배포 체크리스트

- **Hosting만 (클라이언트 변경):** `git push` → CI 자동 배포
- **Functions 변경:** `firebase deploy --only functions` (수동)
- **둘 다:** 먼저 push 후 `firebase deploy --only functions`
- 신규 Cloud Function은 `firebase.json` rewrite 추가와 functions 배포 모두 필요

## 스킬 라우팅

사용자 요청이 사용 가능한 스킬과 매칭되면 **반드시** 다른 도구보다 먼저 Skill 도구로 해당 스킬을 호출하세요. 직접 답변하거나 다른 도구를 먼저 쓰지 마세요. 스킬은 즉흥 답변보다 더 나은 결과를 내는 전용 워크플로를 가지고 있습니다.

주요 라우팅 규칙:
- 제품 아이디어, "만들 가치 있나", 브레인스토밍 → office-hours 호출
- 버그, 에러, "왜 안 되지", 500 에러 → investigate 호출
- Ship, 배포, push, PR 생성 → ship 호출
- QA, 사이트 테스트, 버그 찾기 → qa 호출
- 코드 리뷰, diff 확인 → review 호출
- 배포 후 문서 업데이트 → document-release 호출
- 주간 회고 → retro 호출
- 디자인 시스템, 브랜드 → design-consultation 호출
- 비주얼 감사, 디자인 폴리시 → design-review 호출
- 아키텍처 리뷰 → plan-eng-review 호출
