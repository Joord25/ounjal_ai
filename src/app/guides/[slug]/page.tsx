import { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES } from "@/constants/guides";
import Link from "next/link";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = GUIDES.find((g) => g.slug === params.slug);
  if (!guide) return {};
  return {
    title: `${guide.title} — 오운잘 AI 가이드`,
    description: guide.description,
    openGraph: {
      title: `${guide.title} — 오운잘 AI 가이드`,
      description: guide.description,
      type: "article",
      locale: "ko_KR",
      siteName: "오운잘 AI",
      url: `https://ohunjal.com/guides/${guide.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${guide.title} — 오운잘 AI 가이드`,
      description: guide.description,
    },
    alternates: {
      canonical: `https://ohunjal.com/guides/${guide.slug}`,
    },
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = GUIDES.find((g) => g.slug === params.slug);
  if (!guide) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": guide.title,
    "description": guide.description,
    "author": {
      "@type": "Person",
      "@id": "https://ohunjal.com/#founder",
      "name": "임주용",
    },
    "publisher": {
      "@type": "Organization",
      "@id": "https://ohunjal.com/#organization",
      "name": "주드(Joord)",
    },
    "datePublished": guide.publishedAt,
    "dateModified": guide.updatedAt,
    "mainEntityOfPage": `https://ohunjal.com/guides/${guide.slug}`,
    "inLanguage": "ko",
  };

  const faqSchema = guide.faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": guide.faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  } : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "오운잘 AI", "item": "https://ohunjal.com" },
      { "@type": "ListItem", "position": 2, "name": "가이드", "item": "https://ohunjal.com/guides" },
      { "@type": "ListItem", "position": 3, "name": guide.title, "item": `https://ohunjal.com/guides/${guide.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Nav */}
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

      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-[#059669] transition-colors">홈</Link>
          <span>/</span>
          <Link href="/guides" className="hover:text-[#059669] transition-colors">가이드</Link>
          <span>/</span>
          <span className="text-gray-600 truncate">{guide.title}</span>
        </div>
      </div>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 pb-20">
        <h1 className="text-2xl sm:text-4xl font-black text-[#1B4332] leading-tight mb-4">
          {guide.title}
        </h1>

        {/* Author */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-200">
          <img src="/CEO.jpeg" alt="임주용" className="w-10 h-10 rounded-full object-cover" />
          <div>
            <p className="text-sm font-bold text-[#1B4332]">임주용</p>
            <p className="text-xs text-gray-400">한국체대 석사 · NASM-CPT · ACSM-CPT · NSCA-FLC</p>
          </div>
          <span className="text-xs text-gray-300 ml-auto">{guide.publishedAt}</span>
        </div>

        {/* Content */}
        <div dangerouslySetInnerHTML={{ __html: guide.content }} />

        {/* CTA */}
        <div className="mt-10 p-6 bg-[#f0fdf4] rounded-2xl border border-[#d1fae5] text-center">
          <p className="text-lg font-black text-[#1B4332] mb-2">오운잘로 바로 시작하기</p>
          <p className="text-sm text-gray-500 mb-4">컨디션만 고르면 3초 만에 오늘 운동이 나와요</p>
          <a
            href="/app"
            className="inline-block px-8 py-3 bg-[#059669] text-white font-bold text-sm rounded-xl hover:bg-[#047857] transition-colors"
          >
            무료로 시작하기
          </a>
        </div>

        {/* FAQ */}
        {guide.faqs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-black text-[#1B4332] mb-6">자주 묻는 질문</h2>
            <div className="space-y-4">
              {guide.faqs.map((faq, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="font-bold text-[#1B4332] mb-2">Q. {faq.q}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Author footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            작성: 임주용 — 한국체육대학교 대학원 건강운동관리 석사, NASM-CPT, ACSM-CPT, NSCA-FLC
          </p>
          <p className="text-xs text-gray-400 mt-1">
            참고: ACSM&apos;s Guidelines for Exercise Testing and Prescription, 11th Edition
          </p>
        </div>
      </article>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs text-gray-400">&copy; 2026 오운잘 AI. All rights reserved.</p>
          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed max-w-lg mx-auto">
            본 서비스는 의료 행위가 아니며, 전문 의료 상담을 대체하지 않습니다.
            운동 시 부상 위험이 있으며, 기저 질환이 있는 경우 의사와 상담 후 이용하시기 바랍니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
