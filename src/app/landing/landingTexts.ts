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
    steps: { title: string; desc: string; premium?: boolean }[];
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
  faq: {
    title: string;
    items: { q: string; a: string }[];
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
      { title: "AI와 대화 시작", desc: "\"3개월 다이어트 플랜\" 한마디면 끝" },
      { title: "오늘 루틴 완성", desc: "고민 0초, 바로 운동 시작" },
      { title: "AI 코치 피드백", desc: "PT 없이도 뭘 잘했는지 알게 됨" },
      { title: "영양까지 한 번에", desc: "뭘 먹어야 하는지도 끝", premium: true },
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
    headingDim: "기존 운동앱 월 19,800원",
    headingBright: "오운잘은 월 6,900원",
    sub: "먼저 써보고, 결정은 그 다음에.",
    free: {
      name: "무료",
      desc: "부담 없이 시작",
      price: "0원",
      unit: "/월",
      features: ["비로그인 1회 체험", "무료 2회 AI 운동 플랜 + 채팅 3회", "운동 기록 저장"],
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
        "장기 프로그램 모드 저장",
      ],
    },
  },
  faq: {
    title: "자주 묻는 질문",
    items: [
      {
        q: "유튜브·인스타 루틴 따라 하는 거랑 뭐가 달라요?",
        a: "유튜브 루틴은 '누구에게나' 해당하지만, 오운잘은 '오늘의 당신'에게만 맞춥니다. 컨디션 안 좋은 날엔 강도를 낮추고, 시간 부족한 날엔 핵심만 압축해요. 수만 명이 보는 고정 영상이 아니라, 실시간 대화로 나에게 딱 맞는 루틴을 **3초 만에** 받습니다.",
      },
      {
        q: "AI가 짜준 루틴, 믿고 따라 해도 안전한가요?",
        a: "단순 텍스트 생성이 아닙니다. 국제 운동 가이드라인 **ACSM·NASM**과 **한체대** 운동과학 박사진 감수를 거친 알고리즘으로 설계됐어요. 부상·통증 부위를 말하면 해당 관절에 무리 가지 않는 대체 동작을 즉시 제안합니다.",
      },
      {
        q: "PT 받기엔 비싸고 혼자 하긴 막막한데, 도움이 될까요?",
        a: "바로 그런 분들을 위해 탄생했습니다. 회당 평균 **5~8만 원** 하는 PT가 부담스럽다면, 월 커피 한 잔 값으로 24시간 대기하는 AI 코치를 고용하세요. 뭘 할지 고민하는 시간은 0초로 줄이고, 이미 **10명 중 9명**의 유저가 루틴 완주에 성공 중입니다.",
      },
      {
        q: "운동 의지가 약해서 금방 포기할까 봐 걱정돼요.",
        a: "오운잘은 당신의 의지력에만 의존하지 않습니다. AI 코치가 매 세션 컨디션을 체크하고 \"어제보다 성장했네요\"라며 소통해요. 유저 **10명 중 9명**이 루틴을 끝까지 완수하는 비결은, 나를 지켜봐 주는 AI 코치가 함께하기 때문입니다.",
      },
      {
        q: "무료로 충분한가요? 프리미엄은 뭐가 좋아요?",
        a: "무료로도 AI 루틴의 강력함을 충분히 경험할 수 있어요 (무료 플랜 **2회** + AI 채팅 **3회** + 기록 저장). 더 빠른 성장을 원하면 프리미엄: 무제한 플랜, AI 분석 리포트, **AI 영양 코치** 무제한 채팅, 성장 예측 리포트 전부 포함. 월 **6,900원**.",
      },
      {
        q: "구독 취소 / 환불 / 데이터 보호는?",
        a: "프로필 탭에서 **1클릭 해지**. 결제 후 7일 이내 + 프리미엄 기능 미사용 시 환불 가능. 모든 운동·개인 데이터는 Google Cloud 암호화 저장, 제3자 공유 없음. 계정 삭제 시 모든 데이터 영구 삭제.",
      },
    ],
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
      { title: "Talk to AI", desc: "\"3-month diet plan\" — one line, done" },
      { title: "Today's Routine Ready", desc: "Zero thinking, start working out" },
      { title: "AI Coach Feedback", desc: "Know what you did right, no PT needed" },
      { title: "Nutrition Included", desc: "What to eat — done", premium: true },
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
  reviews: [],
  pricing: {
    label: "PRICING",
    headingDim: "Other fitness apps: $15.99/mo",
    headingBright: "Ohunjal: $4.99/mo",
    sub: "Try it first, decide later.",
    free: {
      name: "Free",
      desc: "No commitment",
      price: "$0",
      unit: "/mo",
      features: ["1 free trial without sign-up", "2 free AI workout plans + 3 AI chats", "Workout history saved"],
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
        "Save long-term programs",
      ],
    },
  },
  faq: {
    title: "Frequently Asked Questions",
    items: [
      {
        q: "How is this different from YouTube or Instagram routines?",
        a: "YouTube routines are for 'anyone'. Ohunjal is for 'you, today'. Low-energy day? We drop intensity. No time? We compress to the essentials. Not a static video for millions — a custom routine built for you in **3 seconds**.",
      },
      {
        q: "Is the AI-built routine safe to follow?",
        a: "It's not just text generation. The algorithm is built on **ACSM & NASM** international exercise guidelines and reviewed by KNSU exercise science PhDs. Mention an injury or pain and AI swaps in joint-safe alternatives on the spot.",
      },
      {
        q: "PT is too expensive and going solo feels lost — can this help?",
        a: "Built for exactly that. If PT at **50,000–80,000 KRW/session** feels heavy, hire a 24/7 AI coach for the price of a coffee a month. Zero time wasted figuring out what to do — and **9 out of 10** users complete their routines.",
      },
      {
        q: "I'm worried I'll lose motivation and quit.",
        a: "Ohunjal doesn't rely on your willpower alone. AI coach checks your condition every session and says \"You grew from yesterday\". The secret that **9 out of 10** users complete their routines: an AI coach that watches over you.",
      },
      {
        q: "Is free enough? What does Premium add?",
        a: "Free gives you the full AI routine experience (**2 free plans** + **3 AI chats** + workout logs). Want faster growth? Premium unlocks unlimited plans, AI analysis reports, **unlimited AI nutrition coach** chat, and growth prediction reports. Just **6,900 KRW/month**.",
      },
      {
        q: "Cancellation, refunds, data protection?",
        a: "**1-click cancel** in Profile. Refundable within 7 days if Premium features weren't used. All data encrypted on Google Cloud, never shared with third parties. Delete your account — all data permanently wiped.",
      },
    ],
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
