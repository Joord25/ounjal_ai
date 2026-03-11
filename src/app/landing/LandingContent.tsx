"use client";

import React, { useEffect, useRef } from "react";

// Override body overflow:hidden from globals.css
function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
}

const FEATURES = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 4L20 12L28 13.5L22 19.5L23.5 28L16 24L8.5 28L10 19.5L4 13.5L12 12L16 4Z" stroke="#2D6A4F" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
    ),
    title: "AI 맞춤 운동 플랜",
    desc: "컨디션, 목표, 체력에 맞춰 AI가 오늘의 운동을 자동으로 설계합니다.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke="#2D6A4F" strokeWidth="2"/>
        <path d="M4 12H28M10 6V3M22 6V3" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="16" cy="19" r="2" fill="#2D6A4F"/>
      </svg>
    ),
    title: "실시간 적응형 세션",
    desc: "세트마다 피드백을 반영해 다음 세트의 횟수와 무게를 자동 조절합니다.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 24L10 16L16 20L22 10L28 14" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="10" cy="16" r="2" fill="#2D6A4F"/>
        <circle cx="16" cy="20" r="2" fill="#2D6A4F"/>
        <circle cx="22" cy="10" r="2" fill="#2D6A4F"/>
      </svg>
    ),
    title: "AI 운동 분석 리포트",
    desc: "운동이 끝나면 AI가 세션 데이터를 분석해 한국어로 코칭해드립니다.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M8 28V18M16 28V8M24 28V14" stroke="#2D6A4F" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
    title: "운동 기록 & 체중 추적",
    desc: "모든 운동 히스토리와 체중 변화를 그래프로 한눈에 확인하세요.",
  },
];

const STEPS = [
  { num: "01", title: "오늘 컨디션 선택", desc: "상체 뻐근? 하체 무거움? 컨디션 좋음? 터치 한 번이면 끝." },
  { num: "02", title: "운동 목표 설정", desc: "근육증가, 다이어트, 기초체력향상 등 원하는 목표를 선택하세요." },
  { num: "03", title: "AI가 플랜 생성", desc: "한국체육대학 및 공인 건강운동전문가 및 SCI논문을 기반으로 학습한 Gemini AI가 맞춤형 운동 루틴을 즉시 만들어드립니다." },
  { num: "04", title: "운동 시작!", desc: "타이머와 세트 카운터로 운동하고, 디테일한 운동 검증 AI 분석까지 받으세요." },
];

const FAQS = [
  { q: "무료로 사용할 수 있나요?", a: "네, 무료 플랜으로 하루 3회 AI 운동 플랜을 생성할 수 있습니다. 무제한 사용은 프리미엄 구독이 필요합니다." },
  { q: "어떤 운동을 지원하나요?", a: "스쿼트, 벤치프레스, 데드리프트 등 웨이트 트레이닝과 맨몸운동, 러닝, 모빌리티까지 100가지 이상 지원합니다." },
  { q: "운동 초보자도 사용할 수 있나요?", a: "물론입니다. AI가 체력 수준에 맞춰 무게와 횟수를 자동으로 조절해줍니다." },
  { q: "앱 설치가 필요한가요?", a: "별도 앱 설치 없이 웹에서 바로 사용 가능하며, 홈화면에 추가하면 앱처럼 사용할 수 있습니다." },
  { q: "구독은 어떻게 해지하나요?", a: "설정 > 구독 관리에서 언제든지 해지할 수 있으며, 해지해도 결제 기간까지 이용 가능합니다." },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("opacity-100", "translate-y-0");
          el.classList.remove("opacity-0", "translate-y-8");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function RevealSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}>
      {children}
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-7 sm:py-8 text-left"
      >
        <span className="text-lg sm:text-xl font-bold text-[#1B4332] pr-6">{q}</span>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9L12 15L18 9" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-7" : "max-h-0"}`}>
        <p className="text-base text-gray-500 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function LandingContent() {
  useBodyScroll();
  return (
    <div className="min-h-screen bg-[#FAFBF9] overflow-x-hidden" style={{ overflow: "auto" }}>
      {/* Hero (nav included inside for seamless background) */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(to bottom, #0a1a14 0%, #0f2a1f 30%, #143728 60%, #1B4332 85%, #FAFBF9 100%)" }}>
        {/* Nav */}
        <nav className="sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="오운잘 AI" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-white text-lg">오운잘 AI</span>
            </div>
            <a
              href="/"
              className="px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors"
            >
              시작하기
            </a>
          </div>
        </nav>

        {/* Animated orbs */}
        <div
          className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]"
          style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)", animation: "hero-orb-1 12s ease-in-out infinite" }}
        />
        <div
          className="absolute top-[30%] right-[-15%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)", animation: "hero-orb-2 15s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full opacity-25 blur-[80px]"
          style={{ background: "radial-gradient(circle, #2D6A4F 0%, transparent 70%)", animation: "hero-orb-3 10s ease-in-out infinite" }}
        />

        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Gradient fade to bottom - smoother transition */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9]/60 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
          <RevealSection>
            <div className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm text-[#6ee7b7] text-xs font-bold rounded-full mb-6 border border-white/10">
              AI 퍼스널 트레이너
            </div>
            <p className="text-base sm:text-lg text-[#a7f3d0]/80 font-medium mb-4 tracking-wide">
              컨디션 맞춤 운동, 더 빠르고 정확하게
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight">
              <span className="text-[#34d399] text-5xl sm:text-6xl lg:text-7xl">오</span>늘의 <span className="text-[#34d399] text-5xl sm:text-6xl lg:text-7xl">운</span>동 <span className="text-[#34d399] text-5xl sm:text-6xl lg:text-7xl">잘</span>하자!<br />
              <span className="text-gray-300 text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 inline-block">이젠 <span className="text-[#34d399]">AI</span>가 도와드립니다</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-md mx-auto leading-relaxed">
              운동하겠단 마음만 가지고 나오세요<br />
              AI가 당신에게 딱 맞는 운동 루틴을 만들어드립니다
            </p>
            <div className="mt-10">
              <a
                href="/"
                className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:shadow-[0_8px_40px_rgba(5,150,105,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                무료로 시작하기
              </a>
            </div>
          </RevealSection>

          {/* Phone Mockup with glow */}
          <RevealSection className="mt-20">
            <div className="relative mx-auto w-[280px] sm:w-[320px]">
              {/* Glow behind phone */}
              <div
                className="absolute -inset-8 rounded-[56px] z-0"
                style={{ animation: "hero-glow 4s ease-in-out infinite" }}
              />
              <div className="relative z-10 rounded-[40px] border-[6px] border-white/20 bg-white shadow-2xl overflow-hidden">
                <div className="px-4 pt-6 pb-4">
                  <div className="text-left mb-4">
                    <p className="text-[10px] text-gray-400 font-medium">AI 분석 · 단계 1</p>
                    <h3 className="text-lg font-black text-[#1B4332] mt-1 leading-tight">오늘 몸 상태는<br />어떠신가요?</h3>
                  </div>
                  <div className="space-y-2.5">
                    {["상체가 굳어있음", "하체가 무거움", "전반적 피로감", "컨디션 좋음"].map((label, i) => (
                      <div
                        key={label}
                        className={`px-4 py-3 rounded-xl border text-left transition-all ${
                          i === 3
                            ? "border-[#059669] bg-[#f0fdf4]"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <p className={`text-sm font-bold ${i === 3 ? "text-[#059669]" : "text-[#1B4332]"}`}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Partners Scroll */}
      <section className="py-12 sm:py-16 bg-white overflow-hidden">
        <div
          className="flex items-center w-max"
          style={{ animation: "scroll-left 30s linear infinite" }}
        >
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex items-center shrink-0">
              {[
                { name: "한국체육대학교", logo: "/korea natinal sports univ..png" },
                { name: "인하대학교", logo: "/inha univ.jpeg" },
                { name: "창업진흥원", logo: "/chanjinwon.svg" },
                { name: "중소벤처기업부", logo: "/jungichung.png" },
                { name: "NASM · KFTA", logo: "/thumb-97a4bf8abd6404c4b538afc07e14f0f4_1659674757_41_800x246.jpg" },
                { name: "ACSM", logo: "/ACSM-removebg-preview.png" },
                { name: "NSCA Korea", logo: "/NSCA.png" },
              ].map((item) => (
                <div
                  key={`${setIdx}-${item.name}`}
                  className="flex items-center justify-center w-[300px] sm:w-[380px] h-20 sm:h-24 flex-shrink-0 mx-12 sm:mx-16"
                >
                  <img src={item.logo} alt={item.name} className="max-h-full max-w-full object-contain" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">FEATURES</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">
                AI가 알아서 해드립니다
              </h2>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <RevealSection key={i}>
                <div className="p-6 rounded-2xl bg-[#FAFBF9] border border-gray-100 hover:border-[#d1fae5] hover:shadow-lg transition-all duration-300">
                  <div className="w-14 h-14 bg-[#d1fae5] rounded-2xl flex items-center justify-center mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-[#1B4332] mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-[#FAFBF9]">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">HOW IT WORKS</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">
                4단계로 시작하세요
              </h2>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <RevealSection key={i}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#1B4332] text-white rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-4">
                    {s.num}
                  </div>
                  <h3 className="text-base font-bold text-[#1B4332] mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">PRICING</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">
                커피한잔 가격으로 PT처럼!
              </h2>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <RevealSection>
              <div className="p-8 rounded-2xl border border-gray-200 bg-white">
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">무료</h3>
                <p className="text-sm text-gray-400 mb-6">부담 없이 시작하세요</p>
                <p className="text-4xl font-black text-[#1B4332] mb-8">
                  ₩0<span className="text-base font-medium text-gray-400">/월</span>
                </p>
                <ul className="space-y-3 text-sm text-gray-600 mb-8">
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    최초 접속 시 3회 AI 운동 플랜
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    체중 변화 그래프 추적
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    운동 기록 저장
                  </li>
                </ul>
                <a
                  href="/"
                  className="block text-center w-full py-3 rounded-xl border border-gray-200 text-[#1B4332] font-bold text-sm hover:bg-gray-50 transition-colors"
                >
                  무료로 시작
                </a>
              </div>
            </RevealSection>
            <RevealSection>
              <div className="p-8 rounded-2xl border-2 border-[#059669] bg-[#f0fdf4] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#059669] text-white text-xs font-bold rounded-full">
                  초기 특가
                </div>
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">프리미엄</h3>
                <p className="text-sm text-gray-400 mb-6">모든 기능을 무제한으로</p>
                <div className="mb-8">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-lg text-gray-400 line-through">₩9,900</span>
                    <span className="text-4xl font-black text-[#1B4332]">₩6,900</span>
                    <span className="text-base font-medium text-gray-400">/월</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">30% 할인</span>
                    <span className="text-xs text-[#059669] font-semibold">초기 특가</span>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-gray-600 mb-8">
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    AI 운동 플랜 무제한
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    세션별 AI 분석 리포트
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    체중 변화 그래프 추적
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    운동 히스토리 무제한 저장
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    적응형 운동 세션
                  </li>
                </ul>
                <a
                  href="/"
                  className="block text-center w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm hover:bg-[#143728] transition-colors"
                >
                  프리미엄 시작
                </a>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pt-24 sm:pt-32 pb-6 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-[#1B4332]">
                자주 묻는 질문
              </h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div>
              {FAQS.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <RevealSection>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332] mb-4">
              오늘 운동, AI에게 맡기세요
            </h2>
            <p className="text-lg text-gray-500 mb-10">
              지금 바로 무료로 시작하세요.
            </p>
            <a
              href="/"
              className="inline-block px-10 py-4 bg-[#1B4332] text-white font-bold text-base rounded-2xl shadow-[0_4px_16px_rgba(27,67,50,0.35)] hover:shadow-[0_8px_28px_rgba(27,67,50,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              무료로 시작하기
            </a>
          </RevealSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-gray-400" style={{ background: "linear-gradient(to bottom, #ffffff 0%, #1B4332 10%, #143728 40%, #0f2a1f 75%, #0a1a14 100%)" }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* 로고 */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src="/favicon.png" alt="오운잘 AI" className="w-8 h-8 rounded-md" />
            <span className="font-bold text-white text-lg">오운잘 AI</span>
          </div>

          {/* 사업자 정보 */}
          <div className="text-sm leading-loose space-y-1 text-gray-400 mb-8">
            <p>대표 | 임주용</p>
            <p>이메일 | ounjal.ai.app@gmail.com</p>
            <p>사업자등록번호 | 623-36-01460</p>
          </div>

          {/* 링크 */}
          <div className="flex items-center justify-center gap-8 text-sm mb-8">
            <a href="/" className="hover:text-white transition-colors">서비스 바로가기</a>
            <a href="/privacy" className="hover:text-white transition-colors">개인정보처리방침</a>
            <a href="/terms" className="hover:text-white transition-colors">이용약관</a>
          </div>

          {/* 카피라이트 */}
          <div className="border-t border-white/10 pt-8">
            <p className="text-xs text-gray-500">&copy; 2026 오운잘 AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
