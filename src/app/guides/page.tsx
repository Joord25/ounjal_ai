import { Metadata } from "next";
import { GUIDES } from "@/constants/guides";
import Link from "next/link";

export const metadata: Metadata = {
  title: "운동 가이드 — 오운잘 AI",
  description: "PT 없이 운동하는 법, 체중감량 루틴, 헬린이 가이드 등 전문 트레이너가 작성한 운동 가이드 모음.",
  openGraph: {
    title: "운동 가이드 — 오운잘 AI",
    description: "PT 없이 운동하는 법, 체중감량 루틴, 헬린이 가이드 등 전문 트레이너가 작성한 운동 가이드 모음.",
    type: "website",
    locale: "ko_KR",
    siteName: "오운잘 AI",
  },
  alternates: {
    canonical: "https://ohunjal.com/guides",
  },
};

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/favicon.png" alt="오운잘 AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#1B4332] text-lg">오운잘 AI</span>
          </Link>
          <a
            href="/app"
            className="px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors"
          >
            시작하기
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-black text-[#1B4332] mb-2">운동 가이드</h1>
        <p className="text-base text-gray-500 mb-10">10년차 트레이너가 직접 작성한 운동 가이드</p>

        <div className="space-y-4">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="block bg-white rounded-2xl border border-gray-100 p-6 hover:border-[#059669] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-[#f0fdf4] text-[#059669] text-xs font-bold rounded-full">{guide.keyword}</span>
                <span className="text-xs text-gray-300">{guide.publishedAt}</span>
              </div>
              <h2 className="text-lg font-black text-[#1B4332] mb-1">{guide.title}</h2>
              <p className="text-sm text-gray-500">{guide.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
