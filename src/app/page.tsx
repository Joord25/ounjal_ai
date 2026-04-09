import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import LandingContent from "./landing/LandingContent";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "운동 루틴 추천 오운잘 AI - 헬스 루틴부터 홈트 러닝까지 한 번에",
  description:
    "헬린이도 PT 없이, 오운잘 AI가 컨디션에 맞춰 헬스 홈트 러닝 루틴을 짜드려요.",
  openGraph: {
    title: "운동 루틴 추천 오운잘 AI - 헬스 루틴부터 홈트 러닝까지 한 번에",
    description:
      "컨디션만 고르면 오운잘 AI가 3초 만에 헬스 홈트 러닝 루틴을 짜드려요.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
    url: "https://ohunjal.com",
  },
};

export default function LandingPage() {
  return (
    <div className={instrumentSans.variable}>
      <LandingContent locale="ko" />
    </div>
  );
}
