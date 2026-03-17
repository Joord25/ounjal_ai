import type { Metadata } from "next";
import LandingContent from "./LandingContent";

export const metadata: Metadata = {
  title: "오운잘 AI - AI가 만드는 오늘의 맞춤 운동",
  description:
    "오늘 컨디션만 알려주세요. AI가 당신에게 딱 맞는 운동 루틴을 만들어드립니다. 세트별 무게·횟수 자동 조절, AI 운동 분석 리포트까지.",
  openGraph: {
    title: "오운잘 AI - AI가 만드는 오늘의 맞춤 운동",
    description:
      "컨디션 입력하면 AI가 최적의 운동 루틴을 생성. 세트별 무게·횟수 자동 조절, 운동 분석 리포트까지.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
    url: "https://ohunjal.com/landing",
  },
};

export default function LandingPage() {
  return <LandingContent />;
}
