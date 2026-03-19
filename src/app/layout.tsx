import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

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
  title: "오운잘 AI - AI 맞춤 운동 플래너 | 헬스 루틴 자동 생성",
  description: "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성해주는 헬스 트래커. 근력 운동, 벌크업, 다이어트, 체지방 감량, 홈트레이닝까지. 세트별 무게·횟수 기록, 볼륨 추적, 체중 변화 그래프, AI 운동 분석 리포트 제공. 초보자부터 상급자까지 맞춤형 웨이트 트레이닝 프로그램.",
  keywords: [
    "오운잘", "오운잘AI", "AI 운동", "AI 헬스", "AI 운동 추천", "AI 운동 플래너",
    "운동 루틴", "헬스 루틴", "운동 루틴 추천", "헬스 루틴 추천", "오늘 운동 추천",
    "웨이트 트레이닝", "근력 운동", "헬스장 운동", "gym workout", "workout planner",
    "운동 기록", "헬스 기록", "운동 일지", "운동 트래커", "workout tracker",
    "벌크업", "다이어트 운동", "체지방 감량", "근비대", "muscle gain", "fat loss",
    "홈트레이닝", "홈트", "맨몸운동", "덤벨 운동", "바벨 운동",
    "스쿼트", "벤치프레스", "데드리프트", "3대 운동", "분할 운동",
    "푸시풀레그", "push pull legs", "운동 분할", "주간 운동 계획",
    "운동 초보", "헬스 초보", "헬린이", "운동 프로그램", "개인 트레이닝",
    "PT 대체", "AI PT", "AI 퍼스널 트레이너", "맞춤 운동",
    "체중 기록", "체중 변화", "운동 볼륨", "운동 분석", "운동 리포트",
    "카카오페이 결제", "운동 앱", "헬스 앱", "fitness app", "workout app",
  ],
  openGraph: {
    title: "오운잘 AI - AI가 만드는 오늘의 맞춤 운동",
    description: "컨디션 입력하면 AI가 최적의 운동 루틴을 생성. 세트·무게·횟수 자동 조절, 운동 분석 리포트까지.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
    images: [
      {
        url: "https://ohunjal.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "오운잘 AI - AI 맞춤 운동 플래너",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "오운잘 AI - AI 맞춤 운동 플래너",
    description: "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성. 근력 운동 기록, 볼륨 추적, 체중 그래프, AI 분석 리포트.",
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
              "description": "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성해주는 맞춤형 헬스 트래커. 근력 운동 기록, 볼륨 추적, 체중 변화 그래프, AI 운동 분석 리포트 제공.",
              "offers": {
                "@type": "Offer",
                "price": "9900",
                "priceCurrency": "KRW",
                "description": "프리미엄 월간 구독"
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
        className={`${inter.variable} ${cormorant.variable} antialiased`}
      >
        {children}
        <noscript>
          <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
            <h1>오운잘 AI - AI 맞춤 운동 플래너</h1>
            <p>AI가 오늘 컨디션에 맞춰 최적의 운동 루틴을 자동 생성해주는 헬스 트래커입니다.</p>
            <h2>주요 기능</h2>
            <ul>
              <li>AI 맞춤 운동 루틴 자동 생성 - 컨디션, 목표, 체력에 맞춘 웨이트 트레이닝 프로그램</li>
              <li>세트별 무게·횟수 기록 및 적응형 조절 - 실시간 피드백으로 다음 세트 자동 조정</li>
              <li>운동 볼륨 추적 그래프 - 세션별 총 볼륨 변화를 한눈에</li>
              <li>체중 변화 그래프 - 매일 체중 기록으로 다이어트·벌크업 진행 상황 확인</li>
              <li>AI 운동 분석 리포트 - Gemini AI가 세션 데이터를 분석해 한국어 코칭 제공</li>
              <li>푸시/풀/레그/러닝/모빌리티 분할 운동 프로그램</li>
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
            <p>무료 플랜: 하루 3회 AI 플랜 생성 / 프리미엄: 월 9,900원 (초기 특가, 카카오페이 결제)</p>
            <p>사업자: 주드(Joord) | 대표: 임주용 | 사업자등록번호: 623-36-01460</p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
