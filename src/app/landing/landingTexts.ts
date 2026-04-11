export type LandingLocale = "ko" | "en";

/**
 * Hero 부제 — 단순 문자열 또는 여러 줄 배열.
 * - string: 한 줄 부제 (한국어 등)
 * - string[]: 여러 줄 부제 (영어 multi-line)
 */
export type HeroSub = string | string[];

export interface LandingTexts {
  nav: { brand: string; cta: string };
  hero: {
    line1: string;
    line1b?: string;
    line2: string;
    line3: string;
    sub: HeroSub;
    stats: { prefix: string; suffix: string; label: string }[];
    statNote: string;
  };
  howItWorks: {
    title: string;
    steps: { title: string; desc: string }[];
  };
  trust: {
    heading: string;
    sub: string[];
  };
  reviews: { stars: number; title: string; review: string; name: string }[];
  pricing: {
    label: string;
    headingDim: string;
    headingBright: string;
    sub: string;
    free: {
      name: string;
      desc: string;
      price: string;
      unit: string;
      features: string[];
    };
    premium: {
      badge: string;
      name: string;
      desc: string;
      priceOld: string;
      price: string;
      unit: string;
      discount: string;
      features: string[];
    };
  };
  footer: {
    mission: string;
    company: string[];
    copyright: string;
    terms: string;
    termsHref: string;
    privacy: string;
    privacyHref: string;
  };
}

const ko: LandingTexts = {
  nav: { brand: "오운잘 AI", cta: "바로 시작" },
  hero: {
    line1: "체중감량, 벌크업, 러닝",
    line2: "어떻게 할지,",
    line3: "AI가 3초 만에 끝내줌.",
    sub: "10명 중 9명이 끝까지 함. PT 없이, 매일 내 컨디션에 맞게.",
    stats: [
      { prefix: "주 ", suffix: "회", label: "평균 운동 빈도" },
      { prefix: "", suffix: "%", label: "루틴 완주율" },
      { prefix: "+", suffix: "%", label: "첫 달 운동량 증가" },
    ],
    statNote: "* 2025.12 ~ 2026.03 주 2회 이상 사용자 기준",
  },
  howItWorks: {
    title: "HOW IT WORKS",
    steps: [
      { title: "컨디션 체크", desc: "터치 한 번, 오늘 내 상태 끝" },
      { title: "오늘 루틴 완성", desc: "고민 0초, 바로 운동 시작" },
      { title: "AI 코치 피드백", desc: "PT 없이도 뭘 잘했는지 알게 됨" },
      { title: "영양까지 한 번에", desc: "뭘 먹어야 하는지도 끝" },
    ],
  },
  trust: {
    heading: "Backed by\n한체대 · ACSM · NASM",
    sub: [
      "현역 트레이너가 직접 설계한 AI,",
      "한체대 운동과학 교수 및 박사의 검수와, 최신 ACSM · NASM · NSCA 국제 운동 정보가",
      "알고리즘에 녹아 있습니다.",
    ],
  },
  reviews: [
    { stars: 5, title: "헬스 초보인데 진짜 좋음ㅠㅠ", review: "운동에 ㅇ자도 모르는 초초초보예요. 뭘 해야 할지 몰라서 맨날 러닝머신만 탔는데, 이거 쓰고 나서 진짜 루틴이 생김", name: "sa****" },
    { stars: 5, title: "오! PT 받는 느낌이 나네여...", review: "저렴하게 이용하면서도 PT 받는 느낌이 날 것 같아 좋다는 작은 의견을 드립니다. 구독했어유. 정말 빛같은 앱이에요~~ 최고최고", name: "nn****" },
    { stars: 5, title: "루틴 좀 괜ㅊ낳은듯! 굿", review: "그때그때 상황에 맞게 맞춤운동을 알려줘서 너무 좋네요. AI가 알아서 짜줘서 딴 생각 안하고 바로 시작할 수 있어요!", name: "kt****" },
    { stars: 4, title: "생각보다 괜찮은 앱임 잘써봄!", review: "루틴 추천 기능 자체가 너무 좋고, 운동이 바로 보여서 좋아요. 상황별 루틴추천이 특히 좋음", name: "ej****" },
    { stars: 5, title: "홈트도 있네? 러닝도 있고?", review: "처음 헬스 시작해서 본인만의 루트가 없고, 집에서 홈트하는 초보에게 좋은듯! 처음 가는 헬스장에서 어떤 기구를 다뤄야 하는지, 어떤 자세로 해야하는지 등 운동의 처음부터 끝까지 다 알려주거 같네여. 헬스장을 못 가는 날엔 그만큼 땀흘리고 적당히 힘든 홈트 루틴을 만들어줘서 정말 편해요", name: "dy****" },
    { stars: 5, title: "진짜 매일 다른 루틴 나옴", review: "어제 상체 했으면 오늘은 하체, 컨디션 안 좋다고 하면 가볍게 나옴. 이게 진짜 AI인가 싶음", name: "mw****" },
    { stars: 5, title: "운동 끝나고 분석이 대박임", review: "세트별로 뭘 잘했는지 알려주고 다음에 뭘 바꾸라고 코칭해주네요?. PT 트레이너 없어도 혼자 성장하는 느낌. 필기한걸 토대로 문제 만들어준다는 릴스 보고 깔아봤는데 악필인 내글씨에도 불구하고 핵심내용 정확하게 파악해주고 문제 만들어주는거...", name: "jy****" },
    { stars: 4, title: "오 트레이너가 만든거 맞는듯 퀄리티 굿", review: "프리미엄 쓰면 분석이랑 영양까지 나와서 놀람. 정확한거 맞죠? ㅋㅋㅋ", name: "sh****" },
    { stars: 5, title: "개조음 ㅋㅋㅋㅋ", review: "완전 좋고 깔끔하고 누구든 쉽게 쓸 수 있을 것 같네여 강추!!", name: "hk****" },
  ],
  pricing: {
    label: "PRICING",
    headingDim: "PT 월 660,000원",
    headingBright: "오운잘은 월 6,900원",
    sub: "먼저 써보고, 결정은 그 다음에.",
    free: {
      name: "무료",
      desc: "부담 없이 시작",
      price: "0원",
      unit: "/월",
      features: ["비로그인 1회 체험", "하루 4회 AI 운동 플랜", "운동 기록 저장"],
    },
    premium: {
      badge: "초기 특가",
      name: "프리미엄",
      desc: "모든 기능 무제한",
      priceOld: "9,900원",
      price: "6,900원",
      unit: "/월",
      discount: "30% 할인",
      features: [
        "AI 운동 플랜 무제한",
        "세션별 AI 분석 리포트",
        "AI 코치 피드백",
        "AI 영양 코칭",
        "성장 예측 리포트",
        "주간 퀘스트 + 시즌 티어",
      ],
    },
  },
  footer: {
    mission: "당신의 시간을 아끼고, 성장의 즐거움과 건강을 드립니다.",
    company: [
      "주드(Joord) · 대표 임주용",
      "사업자등록번호 | 623-36-01460",
      "통신판매 | 2026-서울관악-0647",
      "서울특별시 관악구 은천로35길 40-6, 404호",
      "H.P 010-4824-2869 | ounjal.ai.app@gmail.com",
    ],
    copyright: "© 2026 Ohunjal AI. All rights reserved.",
    terms: "이용약관",
    termsHref: "/terms",
    privacy: "개인정보처리방침",
    privacyHref: "/privacy",
  },
};

const en: LandingTexts = {
  nav: { brand: "Ohunjal AI", cta: "Get Started" },
  hero: {
    line1: "Lose Weight",
    line1b: "Build Muscle",
    line2: "Run Further",
    line3: "No PT needed",
    sub: "Your daily workout, built by AI in 3 seconds",
    stats: [
      { prefix: "", suffix: "x", label: "Avg. weekly sessions" },
      { prefix: "", suffix: "%", label: "Completion rate" },
      { prefix: "+", suffix: "%", label: "Volume increase (1st mo)" },
    ],
    statNote: "* Based on users working out 2+ times/week, Dec 2025 - Mar 2026",
  },
  howItWorks: {
    title: "HOW IT WORKS",
    steps: [
      { title: "Condition Check", desc: "One tap, your status is set" },
      { title: "Today's Routine Ready", desc: "Zero thinking, start working out" },
      { title: "AI Coach Feedback", desc: "Know what you did right, no PT needed" },
      { title: "Nutrition Included", desc: "What to eat — done" },
    ],
  },
  trust: {
    heading: "Backed by\nKNSU · ACSM · NASM",
    sub: [
      "Built by a 10-year certified trainer.",
      "Reviewed by KNSU exercise science PhDs, powered by the latest ACSM · NASM · NSCA international standards.",
      "",
    ],
  },
  reviews: [
    { stars: 5, title: "ok this is actually insane", review: "i literally just did treadmill for months bc idk what else to do. now i have actual routines and i'm even doing legs lol", name: "sa****" },
    { stars: 5, title: "better than paying for a PT tbh", review: "ngl it honestly feels like someone planned my whole session. if they add meal plans and workout feedback to premium it would literally replace my PT. genuinely one of the best fitness apps i've used. like actually worth paying for when the paid version drops", name: "nn****" },
    { stars: 5, title: "the routine thing is so good", review: "you just pick how you're feeling and it builds everything. open app, tap start, go. zero thinking", name: "kt****" },
    { stars: 4, title: "actually really solid", review: "the condition-based routines are my fav part. exercise instructions are super clear too. excited to see where this goes", name: "ej****" },
    { stars: 5, title: "home workout people NEED this", review: "if you're new to the gym and have no clue what to do, or you work out at home — you need this. it tells you what equipment to use, what form to do, everything from start to finish. on days i can't go to the gym it gives me a home routine that's still solid. genuinely so convenient", name: "dy****" },
    { stars: 5, title: "different routine every day??", review: "did upper body yesterday, today it gave me lower. told it i'm tired and it went light. actual AI fr", name: "mw****" },
    { stars: 5, title: "the post-workout analysis tho", review: "it tells you what you did well per set and what to change next time. saw a reel about it and tried it — even with my messy input it understood everything and gave solid feedback. growing without a trainer is actually possible now", name: "jy****" },
    { stars: 4, title: "wait a trainer actually made this?", review: "free version is already solid but premium gives you full analysis + nutrition. less than a coffee. how", name: "sh****" },
    { stars: 5, title: "SO good lmaooo", review: "clean af and super easy to use. literally anyone can figure this out. highly recommend!!", name: "hk****" },
  ],
  pricing: {
    label: "PRICING",
    headingDim: "Personal training: $500/mo",
    headingBright: "Ohunjal: $4.99/mo",
    sub: "Try it first, decide later.",
    free: {
      name: "Free",
      desc: "No commitment",
      price: "$0",
      unit: "/mo",
      features: ["1 free trial without sign-up", "4 AI workout plans per day", "Workout history saved"],
    },
    premium: {
      badge: "Early Bird",
      name: "Premium",
      desc: "Everything, unlimited",
      priceOld: "$7.99",
      price: "$4.99",
      unit: "/mo",
      discount: "30% off",
      features: [
        "Unlimited AI workout plans",
        "AI analysis report per session",
        "AI coach feedback",
        "AI nutrition coaching",
        "Growth prediction report",
        "Weekly quests + season tiers",
      ],
    },
  },
  footer: {
    mission: "Save your time, enjoy growth and health.",
    company: [
      "Joord Inc. · CEO Juyong Lim",
      "Business Reg. | 623-36-01460",
      "Seoul, South Korea",
      "ounjal.ai.app@gmail.com",
    ],
    copyright: "© 2026 Ohunjal AI. All rights reserved.",
    terms: "Terms of Service",
    termsHref: "/en/terms",
    privacy: "Privacy Policy",
    privacyHref: "/en/privacy",
  },
};

export const LANDING_TEXTS: Record<LandingLocale, LandingTexts> = { ko, en };
