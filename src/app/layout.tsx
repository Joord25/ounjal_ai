import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Questrial, Manrope, Rubik } from "next/font/google";
// Pretendard loaded via CDN in <head> for cross-platform reliability
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// 회의 64-α 후속: 공유 카드 숫자용 (대표 지시 2026-04-19)
const questrial = Questrial({
  variable: "--font-questrial",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// 회의 64-α 후속 2 (대표 지시 2026-04-19): Strava 유사 geometric sans (Maison Neue 무료 대체)
// 공유 카드 숫자에 적용. 500/600/700/800 weight 로 스펙트럼 확보.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// 회의 64-α 후속 3 (대표 지시 2026-04-19): Rubik — 약간 둥근 geometric sans
// Manrope보다 친근한 러닝앱 톤. 공유 카드 숫자에 적용.
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  title: "오운잘 AI — 체중감량부터 러닝까지 맞춤 운동 루틴",
  description: "헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요.",
  keywords: [
    "체중감량", "살빼는 운동", "PT 없이 운동", "혼자 헬스", "홈트", "홈트레이닝",
    "러닝", "러닝 루틴", "유산소 운동", "운동 루틴", "운동 루틴 추천", "헬스 루틴",
    "헬린이", "헬스 초보", "분할 운동", "맞춤 운동", "운동 앱",
    "다이어트 운동", "맨몸운동", "웨이트 트레이닝", "운동 기록", "운동일지",
    "오운잘", "오운잘AI", "오운완", "피트니스 앱",
  ],
  openGraph: {
    title: "오운잘 AI — 체중감량부터 러닝까지 맞춤 운동 루틴",
    description: "헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
    images: [
      {
        url: "https://ohunjal.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "운동 루틴 추천 오운잘 AI — 헬린이 맞춤 운동 플래너",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "오운잘 AI — 체중감량부터 러닝까지 맞춤 운동 루틴",
    description: "헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요.",
    images: ["https://ohunjal.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "https://ohunjal.com",
    languages: {
      "ko": "https://ohunjal.com",
      "en": "https://ohunjal.com/en",
    },
  },
  verification: {
    google: "pT2HHHagN-fpWgy6salyFyDgjf679FnLU5hb2btFn6s",
    other: {
      "naver-site-verification": "9bc259b41159d10272b13f4ef877dd2753993c74",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-BVD88DPW9E" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-BVD88DPW9E');`,
          }}
        />
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kfonts/neodgm@0.5.0/index.css" />
        <meta name="theme-color" content="#1B4332" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="google-site-verification" content="pT2HHHagN-fpWgy6salyFyDgjf679FnLU5hb2btFn6s" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js")})}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "오운잘 AI",
              "applicationCategory": "HealthApplication",
              "operatingSystem": "Web",
              "description": "헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요.",
              "featureList": "체중감량 루틴, 홈트레이닝, 러닝 프로그램, 분할운동, AI 맞춤 추천, 운동 기록, 성장 분석",
              "offers": {
                "@type": "Offer",
                "price": "6900",
                "priceCurrency": "KRW",
                "description": "프리미엄 월간 구독 (초기 특가)"
              },
              "author": {
                "@type": "Organization",
                "name": "주드(Joord)",
                "url": "https://ohunjal.com"
              },
              "inLanguage": "ko"
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://ohunjal.com/#organization",
              "name": "주드(Joord)",
              "url": "https://ohunjal.com",
              "logo": "https://ohunjal.com/favicon.png",
              "description": "AI 맞춤 운동 루틴 서비스 오운잘 AI를 만드는 팀",
              "foundingDate": "2025",
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+82-10-4824-2869",
                "email": "ounjal.ai.app@gmail.com",
                "contactType": "customer service",
                "availableLanguage": "Korean"
              },
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "서울특별시 관악구",
                "addressCountry": "KR"
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                { "@type": "Question", "name": "무료로 쓸 수 있나요?", "acceptedAnswer": { "@type": "Answer", "text": "네, 회원가입 없이 1회 체험 가능해요. 가입하면 무료 플랜 2회 + AI 채팅 3회까지 사용할 수 있어요." }},
                { "@type": "Question", "name": "운동 초보(헬린이)인데 괜찮을까요?", "acceptedAnswer": { "@type": "Answer", "text": "오히려 초보일수록 좋아요. AI가 체력에 맞춰 운동을 짜주니까 뭘 해야 할지 고민할 필요 없어요." }},
                { "@type": "Question", "name": "다른 운동 루틴 추천 앱이랑 뭐가 달라요?", "acceptedAnswer": { "@type": "Answer", "text": "다른 앱은 운동을 직접 골라야 해요. 오운잘은 컨디션만 고르면 AI가 알아서 짜줘요." }},
                { "@type": "Question", "name": "PT 없이 혼자 운동해도 효과가 있나요?", "acceptedAnswer": { "@type": "Answer", "text": "네, AI가 매 세트마다 무게와 횟수를 조절해주고, 운동 후 분석 리포트까지 제공해요. PT 없이도 체계적으로 운동할 수 있어요." }},
                { "@type": "Question", "name": "체중감량에 도움이 되나요?", "acceptedAnswer": { "@type": "Answer", "text": "네, 체중감량 목표를 선택하면 유산소와 웨이트의 균형을 맞춘 루틴을 짜줘요. 매일 컨디션에 따라 조절되니까 무리 없이 꾸준히 할 수 있어요." }},
                { "@type": "Question", "name": "홈트레이닝도 되나요?", "acceptedAnswer": { "@type": "Answer", "text": "네, 홈트레이닝 모드가 있어요. 맨몸운동, 덤벨 운동 등 집에서 할 수 있는 루틴을 AI가 짜줘요." }},
                { "@type": "Question", "name": "러닝 프로그램도 있나요?", "acceptedAnswer": { "@type": "Answer", "text": "네, 인터벌 러닝, 장거리(LSD), 이지런 등 다양한 러닝 프로그램을 지원해요." }},
                { "@type": "Question", "name": "앱 설치해야 하나요?", "acceptedAnswer": { "@type": "Answer", "text": "아니요, 웹에서 바로 써요. 홈화면에 추가하면 앱처럼 쓸 수 있어요." }},
                { "@type": "Question", "name": "어떤 운동을 지원하나요?", "acceptedAnswer": { "@type": "Answer", "text": "웨이트, 맨몸운동, 러닝, 스트레칭까지 100가지 이상을 AI가 자동 조합해요." }},
                { "@type": "Question", "name": "구독 해지 어렵지 않나요?", "acceptedAnswer": { "@type": "Answer", "text": "프로필에서 터치 한 번이면 바로 해지돼요. 해지해도 결제 기간까지 이용 가능해요." }}
              ]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              "name": "오운잘 AI로 맞춤 운동 루틴 받는 법",
              "description": "컨디션만 고르면 AI가 3초 만에 오늘 운동을 짜드려요",
              "step": [
                { "@type": "HowToStep", "position": 1, "name": "몸 상태 고르기", "text": "상체 뻐근, 하체 무거움 등 오늘 몸 상태를 터치 한 번으로 선택합니다." },
                { "@type": "HowToStep", "position": 2, "name": "목표 고르기", "text": "체중감량, 근육 증가, 체력 향상 중 오늘의 운동 목표를 선택합니다." },
                { "@type": "HowToStep", "position": 3, "name": "AI가 루틴 생성", "text": "3초 만에 컨디션과 목표에 맞는 맞춤 운동 루틴이 자동 생성됩니다." },
                { "@type": "HowToStep", "position": 4, "name": "운동하고 기록", "text": "가이드에 따라 운동하면 세트별 기록이 자동 저장되고, AI가 성장을 분석해줍니다." }
              ]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              "@id": "https://ohunjal.com/#founder",
              "name": "임주용",
              "jobTitle": "트레이너 겸 개발자",
              "description": "한국체육대학교 대학원 건강운동관리 석사. 10년차 트레이너이자 오운잘 AI의 운동 알고리즘을 직접 설계한 개발자.",
              "alumniOf": {
                "@type": "CollegeOrUniversity",
                "name": "한국체육대학교 대학원"
              },
              "hasCredential": [
                "NASM-CPT (미국스포츠의학회)",
                "ACSM-CPT (미국스포츠의학회)",
                "NSCA-FLC (프리웨이트 리프팅코치)",
                "IFBB 국제보디빌딩 마스터",
                "생활체육지도자 2급 - 보디빌딩",
                "한국체력코치협회(KCA) 체력코치"
              ],
              "knowsAbout": ["운동 프로그래밍", "체중감량", "근력 트레이닝", "재활 운동", "체형 교정"],
              "worksFor": { "@type": "Organization", "@id": "https://ohunjal.com/#organization" }
            })
          }}
        />
      </head>
      <body
        className={`${cormorant.variable} ${questrial.variable} ${manrope.variable} ${rubik.variable} antialiased`}
      >
        {children}
        <noscript>
          <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
            <h2>운동 루틴 추천 오운잘 AI</h2>
            <p>헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요.</p>
            <h3>주요 기능</h3>
            <ul>
              <li>AI 맞춤 운동 루틴 자동 생성 - 컨디션, 목표, 체력에 맞춘 웨이트 트레이닝 프로그램</li>
              <li>세트별 무게·횟수 기록 및 적응형 조절 - 실시간 피드백으로 다음 세트 자동 조정</li>
              <li>운동 볼륨 추적 그래프 - 세션별 총 볼륨 변화를 한눈에</li>
              <li>체중 변화 그래프 - 매일 체중 기록으로 다이어트·벌크업 진행 상황 확인</li>
              <li>AI 운동 분석 리포트 - Gemini AI가 세션 데이터를 분석해 한국어 코칭 제공</li>
              <li>푸시/풀/레그/러닝/모빌리티 분할 운동 프로그램</li>
              <li>주간 퀘스트 시스템 - 강도별 운동 미션을 완료하고 EXP를 획득해 시즌 티어를 올리는 게임형 동기부여</li>
            </ul>
            <h3>이런 분에게 추천합니다</h3>
            <ul>
              <li>헬스장에서 무슨 운동을 할지 모르는 헬린이</li>
              <li>매번 같은 루틴에 지친 중급자</li>
              <li>PT 없이 체계적으로 운동하고 싶은 분</li>
              <li>벌크업, 다이어트, 체지방 감량 목표가 있는 분</li>
              <li>홈트레이닝, 맨몸운동, 덤벨·바벨 운동을 하는 분</li>
            </ul>
            <h3>운동 종류</h3>
            <p>스쿼트, 벤치프레스, 데드리프트, 오버헤드프레스, 바벨로우, 풀업, 딥스, 런지, 레그프레스, 케이블 운동 등 100가지 이상의 운동을 지원합니다.</p>
            <h3>요금</h3>
            <p>무료 플랜: 하루 3회 AI 플랜 생성 / 프리미엄: 월 6,900원 (초기 특가)</p>
            <p>사업자: 주드(Joord) | 대표: 임주용 | 사업자등록번호: 623-36-01460</p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
