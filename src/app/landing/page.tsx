import type { Metadata } from "next";
import LandingContent from "./LandingContent";

export const metadata: Metadata = {
  title: "운동 루틴 추천 오운잘 AI - 헬스 루틴부터 홈트 러닝까지 한 번에",
  description:
    "운동 루틴 추천부터 자동 기록까지 한 번에. 헬스, 홈트, 러닝 루틴을 내 컨디션에 맞춰 자동 추천합니다. 맞춤형 루틴과 체계적인 기록으로 운동의 질을 높이세요.",
  openGraph: {
    title: "운동 루틴 추천 오운잘 AI - 헬스 루틴부터 홈트 러닝까지 한 번에",
    description:
      "나에게 딱 맞는 운동 루틴 추천이 필요할 때. 오운잘 AI는 헬스, 홈트, 러닝 등 모든 운동을 데이터 기반으로 설계합니다. 매일 변하는 컨디션에 맞춘 루틴으로 나만의 운동 일지를 완성하세요.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
    url: "https://ohunjal.com/landing",
  },
};

export default function LandingPage() {
  return <LandingContent />;
}
