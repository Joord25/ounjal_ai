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
    pain: "헬스장 가서 뭐하지?",
    title: "딸깍! 운동 전문가 AI가 오늘의 운동을 정해줍니다",
    desc: "컨디션과 원하는 목표만 선택하면\nAI가 그날에 딱 맞는 운동 루틴을 자동으로 짜드립니다.\n더 이상 고민할 필요 없어요.",
    video: "/feature-1.mp4",
  },
  {
    pain: "이거 내가 제대로 하고 있는 건가?",
    title: "운동과학이 검증한 AI 코칭",
    desc: "ACSM(미국스포츠의학회) 가이드라인과 \n최근 5년간 200건 이상의 SCI급 논문을 기반으로\n운동을 분석합니다. 감이 아닌 근거로 피드백하니까,\n내가 하는 운동에 확신을 가질 수 있어요.",
    video: "/is-it-right.mp4",
  },
  {
    pain: "귀찮아, 쉽고 빠르게 하고 싶어",
    title: "터치 3번, 15초면 바로 운동 시작",
    desc: "복잡한 설정 없이\n컨디션 → 목표 → 시작\n운동 끝나면 AI가 분석 리포트까지\n자동으로 만들어줍니다.",
    video: "/easy-to-use.mp4",
  },
  {
    pain: "PT는 너무 비싸...",
    title: "월 9,900원으로 매일 PT처럼",
    desc: "한국체육대학 석사 출신 전문가가 설계한 AI가\n매일 맞춤 운동을 처방합니다.\nPT의 약 70배 더 저렴한 가격에 전문성은 더 Up!",
    video: "",
    priceCard: true,
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
        <span className="text-base sm:text-xl font-bold text-[#1B4332] pr-4 sm:pr-6">{q}</span>
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
              <span className="font-bold text-[#10B981] text-lg">오운잘 AI</span>
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

        <div className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-24 pb-24 sm:pb-32 text-center">
          <RevealSection>
            <p className="text-lg sm:text-xl text-[#a7f3d0] font-medium mb-4 tracking-wide">
              운동 뭐할지 매번 고민이었다면,
            </p>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight">
              딸깍! <span className="text-[#34d399]">3번</span> 으로<br />끝내보세요.
            </h1>
            <p className="mt-8 text-base sm:text-lg text-gray-400 max-w-lg mx-auto leading-relaxed">
              그날의 <span className="text-white font-semibold">컨디션 선택</span> → <span className="text-white font-semibold">운동 목표</span> → <span className="text-white font-semibold">운동 시작</span><br />
              3번이면 끝!
            </p>
            <div className="mt-10">
              <a
                href="/"
                className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:shadow-[0_8px_40px_rgba(5,150,105,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                무료로 시작하기
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 text-xs sm:text-sm text-white/50">
              <div className="flex items-center gap-1.5">
                <span>Backed by</span>
                <img src="/google-cloud-logo.png" alt="Google Cloud" className="h-6 sm:h-8 inline-block" />
              </div>
              <span className="text-white/20">|</span>
              <div className="flex items-center gap-2">
                <span>Powered by</span>
                <img src="/gemini_logo.png" alt="Gemini" className="h-8 sm:h-9 inline-block" />
              </div>
            </div>
          </RevealSection>

          {/* Phone Mockup with glow */}
          <RevealSection className="mt-14 sm:mt-20">
            <div className="relative mx-auto w-[240px] sm:w-[320px]">
              {/* Glow behind phone */}
              <div
                className="absolute -inset-8 rounded-[56px] z-0"
                style={{ animation: "hero-glow 4s ease-in-out infinite" }}
              />
              <div className="relative z-10 rounded-[40px] border-[6px] border-white/20 bg-black shadow-2xl overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full"
                >
                  <source src="/main-video.mp4" type="video/mp4" />
                </video>
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white to-transparent pointer-events-none" />
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
                  className="flex items-center justify-center w-[180px] sm:w-[380px] h-14 sm:h-24 flex-shrink-0 mx-3 sm:mx-8"
                >
                  <img src={item.logo} alt={item.name} className="max-h-full max-w-full object-contain" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">
                이런 고민, 있지 않으셨나요?
              </h2>
            </div>
          </RevealSection>
          <div className="space-y-14 sm:space-y-20">
            {FEATURES.map((f, i) => (
              <RevealSection key={i}>
                <div className={`flex flex-col ${i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"} items-center gap-8 sm:gap-16`}>
                  {/* Video or Price Card */}
                  <div className={`${f.priceCard ? "w-full max-w-[320px] sm:w-[360px]" : "w-full max-w-[280px] sm:w-[320px]"} shrink-0`}>
                    {f.priceCard ? (
                      <div className="flex items-stretch gap-3 sm:gap-4">
                        {/* PT */}
                        <div className="flex-1 rounded-2xl bg-white border border-gray-200 p-3 sm:p-5 text-center shadow-lg flex flex-col items-center justify-center">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          </div>
                          <p className="text-xs text-gray-500 font-bold mb-1">PT 업계 월 평균</p>
                          <p className="text-2xl sm:text-3xl font-black text-gray-800">₩660,000</p>
                        </div>
                        {/* 오운잘 */}
                        <div className="flex-1 rounded-2xl bg-[#f0fdf4] p-3 sm:p-5 text-center shadow-lg border-2 border-[#059669] flex flex-col items-center justify-center">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d1fae5] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <p className="text-xs text-[#059669] font-bold mb-1">오운잘 AI (월)</p>
                          <p className="text-2xl sm:text-3xl font-black text-[#1B4332]">₩9,900</p>
                          <div className="mt-3 px-2 py-1 bg-[#059669] rounded-full inline-block">
                            <span className="text-xs font-bold text-white">약 70배 저렴</span>
                          </div>
                        </div>
                      </div>
                    ) : f.video ? (
                      <div className="rounded-[32px] border-[5px] border-gray-200 bg-black shadow-xl overflow-hidden">
                        <video autoPlay loop muted playsInline className="w-full">
                          <source src={f.video} type="video/mp4" />
                        </video>
                      </div>
                    ) : (
                      <div className="rounded-[32px] border-[5px] border-gray-200 bg-[#f0fdf4] shadow-xl overflow-hidden aspect-[9/16] flex items-center justify-center">
                        <p className="text-sm text-gray-400">영상 준비중</p>
                      </div>
                    )}
                  </div>
                  {/* Text */}
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-2xl sm:text-4xl font-black text-red-400 mb-4 sm:mb-5">&ldquo;{f.pain}&rdquo;</p>
                    <h3 className="text-xl sm:text-3xl font-black text-[#1B4332] mb-2 sm:mb-3">{f.title}</h3>
                    <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-md mx-auto sm:mx-0 whitespace-pre-line">{f.desc}</p>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
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
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">PRICING</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">
                커피한잔 가격으로 PT처럼!
              </h2>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <RevealSection>
              <div className="p-6 sm:p-8 rounded-2xl border border-gray-200 bg-white">
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">무료</h3>
                <p className="text-sm text-gray-400 mb-6">부담 없이 시작하세요</p>
                <p className="text-3xl sm:text-4xl font-black text-[#1B4332] mb-8">
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
              <div className="p-6 sm:p-8 rounded-2xl border-2 border-[#059669] bg-[#f0fdf4] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#059669] text-white text-xs font-bold rounded-full">
                  초기 특가
                </div>
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">프리미엄</h3>
                <p className="text-sm text-gray-400 mb-6">모든 기능을 무제한으로</p>
                <div className="mb-8">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-lg text-gray-400 line-through">₩9,900</span>
                    <span className="text-3xl sm:text-4xl font-black text-[#1B4332]">₩6,900</span>
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

      {/* Comparison Table */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-8 sm:mb-12">
              <p className="text-sm font-bold text-[#059669] mb-2">WHY 오운잘?</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">
                딸깍 한 번이면 끝
              </h2>
              <p className="text-sm sm:text-base text-gray-500 mt-3">복잡한 설정 없이, 빠르고 쉽게</p>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white min-w-[480px] sm:min-w-0">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#1B4332] text-white">
                      <th className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold w-1/5">항목</th>
                      <th className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold w-2/5">기존 피트니스 앱</th>
                      <th className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold w-2/5 text-[#34d399]">오운잘 AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 font-bold text-[#1B4332] text-center">월 비용</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center text-gray-500">₩15,000~30,000</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold text-[#059669]">₩9,900</td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="py-3 sm:py-4 px-2 sm:px-4 font-bold text-[#1B4332] text-center">플랜 생성</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center text-gray-500">직접 운동 골라서 조합</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold text-[#059669]">10초 컨디션 체크 → 자동 생성</td>
                    </tr>
                    <tr>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 font-bold text-[#1B4332] text-center">난이도 조절</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center text-gray-500">정해진 프로그램 그대로 수행</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold text-[#059669]">매 세트 &ldquo;쉬움/적당/힘듦&rdquo; → 자동 조절</td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="py-3 sm:py-4 px-2 sm:px-4 font-bold text-[#1B4332] text-center">운동 분석</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center text-gray-500">기록만 저장</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold text-[#059669]">AI가 분석하고 다음 운동까지 코칭</td>
                    </tr>
                    <tr>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 font-bold text-[#1B4332] text-center">사용 난이도</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center text-gray-500">설정 복잡, 입력내용 많음</td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-center font-bold text-[#059669]">쉬운 버튼 조작, 터치 한번에 끝</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="pt-16 sm:pt-32 pb-6 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-5xl font-black text-[#1B4332]">
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

      {/* PWA Install Guide */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#059669] mb-2">INSTALL</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">
                앱처럼 설치하세요
              </h2>
              <p className="text-base text-gray-500 mt-3">앱스토어 없이, 홈 화면에 추가하면 앱처럼 사용할 수 있습니다</p>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 gap-6">
            <RevealSection>
              <div className="p-6 rounded-2xl bg-white border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d1fae5] rounded-xl flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17.6 11.8L16.2 10.4L13 13.6V4H11V13.6L7.8 10.4L6.4 11.8L12 17.4L17.6 11.8Z" fill="#2D6A4F"/><path d="M19 19H5V15H3V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V15H19V19Z" fill="#2D6A4F"/></svg>
                  </div>
                  <h3 className="text-base font-bold text-[#1B4332]">Android (Chrome)</h3>
                </div>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">1.</span>크롬에서 오운잘 AI 접속</li>
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">2.</span>우측 상단 <span className="font-bold text-[#1B4332]">⋮</span> 메뉴 탭</li>
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">3.</span><span className="font-bold text-[#1B4332]">&apos;홈 화면에 추가&apos;</span> 선택</li>
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">4.</span><span className="font-bold text-[#1B4332]">&apos;추가&apos;</span> 확인</li>
                </ol>
              </div>
            </RevealSection>
            <RevealSection>
              <div className="p-6 rounded-2xl bg-white border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#d1fae5] rounded-xl flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.57 8.08 7.13 7.16 8.82 7.14C10.1 7.12 11.32 8.02 12.11 8.02C12.91 8.02 14.37 6.93 15.91 7.11C16.54 7.14 18.33 7.37 19.47 9.04C19.37 9.1 17.2 10.35 17.23 12.95C17.26 16.1 20 17.12 20.03 17.13C20 17.2 19.56 18.65 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" fill="#2D6A4F"/></svg>
                  </div>
                  <h3 className="text-base font-bold text-[#1B4332]">iPhone (Safari)</h3>
                </div>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">1.</span>Safari에서 오운잘 AI 접속</li>
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">2.</span>하단 <span className="font-bold text-[#1B4332]">공유 버튼(□↑)</span> 탭</li>
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">3.</span><span className="font-bold text-[#1B4332]">&apos;홈 화면에 추가&apos;</span> 선택</li>
                  <li className="flex items-start gap-2"><span className="text-[#059669] font-bold shrink-0">4.</span><span className="font-bold text-[#1B4332]">&apos;추가&apos;</span> 확인</li>
                </ol>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 bg-white">
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
            <span className="font-bold text-[#10B981] text-lg">오운잘 AI</span>
          </div>

          {/* 사업자 정보 */}
          <div className="text-sm leading-loose space-y-1 text-gray-400 mb-8">
            <p>주드(Joord) · 대표 임주용</p>
            <p>사업자등록번호 | 623-36-01460</p>
            <p>서울특별시 관악구 은천로35길 40-6, 404호</p>
            <p>Tel 010-4042-2820 | ounjal.ai.app@gmail.com</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm mb-8">
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
