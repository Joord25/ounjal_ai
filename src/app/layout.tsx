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
  title: "오운잘 AI - AI 운동 루틴 자동 생성 | 운동 기록 앱 | 헬스 루틴 생성 AI",
  description: "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성하는 운동 기록 앱. 헬린이도 쉽게! 웨이트, 맨몸운동, 러닝까지 맞춤 운동 추천. 운동 일지 자동 저장, AI 운동 코칭, 운동 분석 리포트 제공. 주간 퀘스트 달성하고 시즌 티어 올리는 게임형 운동 동기부여. 오운완 인증샷까지. PT 대체 서비스, 월 6,900원.",
  keywords: [
    "오운잘", "오운잘AI", "AI 운동", "AI 헬스", "AI 운동 추천", "AI 운동 플래너",
    "운동 루틴", "헬스 루틴", "운동 루틴 추천", "헬스 루틴 추천", "헬스 루틴 생성",
    "운동 루틴 자동 생성", "AI 운동 루틴", "오늘 운동 추천",
    "웨이트 트레이닝", "근력 운동", "헬스장 운동", "헬스장 개인 운동",
    "운동 기록", "운동 기록 앱", "헬스 기록", "운동 일지", "운동 트래커", "개인 운동 기록",
    "오운완", "오운완 인증", "오운완 인증샷", "운동 인증", "헬스장 인증",
    "운동 어플", "운동 앱 추천", "헬스 앱", "피트니스 앱",
    "헬린이", "헬스 초보", "운동 초보", "헬스 기구 사용법",
    "AI 운동 코칭", "AI 기반 운동 코칭", "PT 대체", "PT 대체 서비스",
    "AI PT", "AI 퍼스널 트레이너", "맞춤 운동", "개인화된 운동 계획",
    "벌크업", "다이어트 운동", "체지방 감량", "근비대",
    "홈트레이닝", "홈트", "맨몸운동", "덤벨 운동", "바벨 운동",
    "스쿼트", "벤치프레스", "데드리프트", "3대 운동", "분할 운동",
    "체중 기록", "인바디 기록", "운동 볼륨", "운동 분석", "운동 리포트",
    "운동 퀘스트", "운동 티어", "운동 레벨", "운동 동기부여", "운동 게이미피케이션",
    "운동 도전", "운동 미션", "운동 성장", "운동 시즌", "운동 랭크",
    "피트니스 플랫폼", "workout planner", "fitness app", "workout tracker",
  ],
  openGraph: {
    title: "오운잘 AI - AI가 만드는 오늘의 맞춤 운동",
    description: "컨디션 입력하면 AI가 최적의 운동 루틴을 생성. 세트·무게·횟수 자동 조절, 운동 분석 리포트, 주간 퀘스트와 시즌 티어까지.",
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
    description: "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성. 근력 운동 기록, 볼륨 추적, 체중 그래프, AI 분석 리포트. 주간 퀘스트와 시즌 티어로 운동 동기부여.",
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
              "description": "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성해주는 맞춤형 헬스 트래커. 근력 운동 기록, 볼륨 추적, 체중 변화 그래프, AI 운동 분석 리포트 제공. 주간 퀘스트와 시즌 티어로 게임처럼 운동 동기부여.",
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
