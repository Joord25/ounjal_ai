import type { Metadata } from "next";
import LandingContent from "./LandingContent";

export const metadata: Metadata = {
  title: "오운잘 AI - AI 운동 루틴 자동 생성 | 운동 기록 앱 | PT 대체 서비스",
  description:
    "AI가 오늘 컨디션에 맞춰 운동 루틴을 자동 생성하는 운동 기록 앱. 헬린이도 쉽게! 웨이트, 맨몸운동, 러닝까지 맞춤 운동 추천. 주간 퀘스트 달성하고 시즌 티어 올리는 게임형 동기부여. 운동 일지 자동 저장, AI 운동 코칭, 오운완 인증샷까지. 월 6,900원으로 PT 대체.",
  openGraph: {
    title: "오운잘 AI - AI 운동 루틴 자동 생성 | 헬스 루틴 생성 AI",
    description:
      "컨디션만 선택하면 AI가 맞춤 운동 루틴을 자동 생성. 운동 기록, AI 운동 코칭, 분석 리포트, 주간 퀘스트와 시즌 티어까지 올인원 운동 어플.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
    url: "https://ohunjal.com/landing",
  },
};

export default function LandingPage() {
  return <LandingContent />;
}
