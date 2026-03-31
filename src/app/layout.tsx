import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
// Pretendard loaded via CDN in <head> for cross-platform reliability
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
  title: "운동 루틴 추천 오운잘 AI — 헬린이도 3초면 오늘 운동 완성",
  description: "헬스장 처음이라 뭐해야 할지 모르겠다면, AI가 맞춤 운동 루틴을 추천해드려요. 컨디션만 선택하면 헬스 루틴이 자동 생성됩니다. 헬린이부터 상급자까지 AI 운동 플래너가 매일 새로운 운동을 짜드려요.",
  keywords: [
    "헬스 앱", "운동 앱", "헬스 AI", "운동 AI", "운동 루틴", "헬스 루틴 추천",
    "헬린이", "헬스 초보", "운동 초보", "자동 운동 추천",
    "운동 기록", "운동일지", "맞춤 운동", "AI 운동 플래너", "AI PT",
    "홈트", "러닝", "다이어트 운동", "웨이트 트레이닝", "맨몸운동",
    "벌크업", "분할 운동", "헬스장 운동", "운동 분석", "AI 코칭",
    "오운완", "오운잘", "오운잘AI", "피트니스 앱",
    "workout planner", "fitness app", "workout tracker",
  ],
  openGraph: {
    title: "운동 루틴 추천 오운잘 AI — 헬린이도 3초면 오늘 운동 완성",
    description: "헬스장 처음이라 뭐해야 할지 모르겠다면, AI가 맞춤 운동 루틴을 추천해드려요. 컨디션만 선택하면 헬스 루틴이 자동 생성됩니다.",
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
    title: "운동 루틴 추천 오운잘 AI — 헬린이도 3초면 오늘 운동 완성",
    description: "헬스장 처음이라 뭐해야 할지 모르겠다면, AI가 맞춤 운동 루틴을 추천해드려요. 컨디션만 선택하면 헬스 루틴이 자동 생성됩니다.",
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
              "description": "나에게 딱 맞는 운동 루틴 추천이 필요할 때. 오운잘 AI는 헬스, 홈트, 러닝 등 모든 운동을 데이터 기반으로 설계합니다. 매일 변하는 컨디션에 맞춘 루틴으로 나만의 운동 일지를 완성하세요.",
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
      </head>
      <body
        className={`${cormorant.variable} antialiased`}
      >
        {children}
        <noscript>
          <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
            <h1>운동 루틴 추천 오운잘 AI</h1>
            <p>나에게 딱 맞는 운동 루틴 추천이 필요할 때. 오운잘 AI는 헬스, 홈트, 러닝 등 모든 운동을 데이터 기반으로 설계합니다.</p>
            <h2>주요 기능</h2>
            <ul>
              <li>AI 맞춤 운동 루틴 자동 생성 - 컨디션, 목표, 체력에 맞춘 웨이트 트레이닝 프로그램</li>
              <li>세트별 무게·횟수 기록 및 적응형 조절 - 실시간 피드백으로 다음 세트 자동 조정</li>
              <li>운동 볼륨 추적 그래프 - 세션별 총 볼륨 변화를 한눈에</li>
              <li>체중 변화 그래프 - 매일 체중 기록으로 다이어트·벌크업 진행 상황 확인</li>
              <li>AI 운동 분석 리포트 - Gemini AI가 세션 데이터를 분석해 한국어 코칭 제공</li>
              <li>푸시/풀/레그/러닝/모빌리티 분할 운동 프로그램</li>
              <li>주간 퀘스트 시스템 - 강도별 운동 미션을 완료하고 EXP를 획득해 시즌 티어를 올리는 게임형 동기부여</li>
            </ul>
            <h2>이런 분에게 추천합니다</h2>
            <ul>
              <li>헬스장에서 무슨 운동을 할지 모르는 헬린이</li>
              <li>매번 같은 루틴에 지친 중급자</li>
              <li>PT 없이 체계적으로 운동하고 싶은 분</li>
              <li>벌크업, 다이어트, 체지방 감량 목표가 있는 분</li>
              <li>홈트레이닝, 맨몸운동, 덤벨·바벨 운동을 하는 분</li>
            </ul>
            <h2>운동 종류</h2>
            <p>스쿼트, 벤치프레스, 데드리프트, 오버헤드프레스, 바벨로우, 풀업, 딥스, 런지, 레그프레스, 케이블 운동 등 100가지 이상의 운동을 지원합니다.</p>
            <h2>요금</h2>
            <p>무료 플랜: 하루 3회 AI 플랜 생성 / 프리미엄: 월 6,900원 (초기 특가)</p>
            <p>사업자: 주드(Joord) | 대표: 임주용 | 사업자등록번호: 623-36-01460</p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
