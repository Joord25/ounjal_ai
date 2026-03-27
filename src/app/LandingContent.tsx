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
    pain: "운동하면 나 얼마나 변할 수 있어?",
    title: "운동 AI, 국내 최초 회귀분석 예측모델로 내 미래를 미리 본다",
    desc: "5kg 감량까지 몇주 예상? 근육량 1kg 언제 달성?\n내 체중·운동빈도·목표를 분석해\n다이어트 정체기 시점, 근육량 증가 기간,\n10km 완주 시점까지 AI가 예측합니다.\n막연한 운동이 아닌 구체적인 목표가 생깁니다.",
    video: "/predictmodel.mp4",
  },
  {
    pain: "헬스장 가서 뭐하지?",
    title: "AI가 오늘의 운동 루틴을 자동 생성",
    desc: "헬린이도 걱정 없어요.\n컨디션과 목표만 선택하면 AI 운동 플래너가\n개인화된 운동 계획을 자동으로 짜드립니다.\n웨이트, 맨몸운동, 러닝까지 맞춤 운동 프로그램을\nAI가 매일 새롭게 추천해요.",
    video: "/what.mp4",
  },
  {
    pain: "운동 꾸준히 하기 너무 힘들어...",
    title: "주간 퀘스트 + 시즌 티어로 게임처럼 재밌게!",
    desc: "매주 강도별 운동 퀘스트를 달성하면\nEXP가 쌓이고 Iron → Gold → Platinum → Diamond → Challenger까지\n시즌 티어가 올라가요.\n운동과학(ACSM) 기반 미션이라\n게임하듯 즐기면서 성장하면 올바른 운동 습관이 만들어져요.",
    video: "",
    questCard: true,
  },
  {
    pain: "이거 내가 제대로 하고 있는 건가?",
    title: "AI 운동 코칭 + 운동 기록 자동 저장",
    desc: "운동 일지를 자동으로 기록하고,\nACSM 가이드라인과 SCI급 논문을 학습한 AI가\n내 운동을 분석해 피드백합니다.\n헬스 기구 사용법부터 세트·무게 조절까지\nAI가 코칭하는 운동 기록 앱.",
    video: "/is-it-right.mp4",
  },
  {
    pain: "귀찮아, 쉽고 빠르게 하고 싶어",
    title: "입력 최소화 몇번의 터치로 오운완 달성",
    desc: "복잡한 조작 설정 없이\n원터치 설정 시스템, 키보드 입력 최소화\n입력 부분 간소화 및 최소화.\n 오운완 인증샷 공유도 한 번에 가능.",
    video: "/easy-to-use.mp4",
  },
  {
    pain: "PT는 너무 비싸...",
    title: "월 6,900원, PT 대체 AI 트레이너",
    desc: "개발자가 아닌 현역 트레이너가 직접 만든\nAI 운동 플래너가 매일 맞춤 운동을 처방합니다.\n개인 운동 기록, 헬스 루틴 생성, 운동 분석까지\nPT의 약 95배 저렴한 가격에 전문성은 더 Up!",
    video: "",
    priceCard: true,
  },
];

const STEPS = [
  { num: "01", title: "오늘 컨디션 선택", desc: "상체 뻐근? 하체 무거움? 컨디션 좋음? 터치 한 번이면 끝. 헬린이도 쉽게." },
  { num: "02", title: "운동 목표 설정", desc: "근육증가, 다이어트, 체력향상 등 목표를 선택하면 개인화된 운동 계획이 시작됩니다." },
  { num: "03", title: "AI 운동 루틴 자동 생성", desc: "운동과학 기반 AI가 맞춤형 헬스 루틴을 즉시 생성. 헬스 기구 사용법과 무게 가이드까지 제공합니다." },
  { num: "04", title: "오운완 + AI 운동 분석", desc: "타이머와 세트 카운터로 운동 기록을 자동 저장하고, AI가 운동 일지를 분석해 리포트를 제공합니다." },
];

const FAQS = [
  { q: "무료로 사용할 수 있나요?", a: "네, 무료 플랜으로 3회 AI 운동 루틴 자동 생성이 가능합니다. 무제한 맞춤 운동 프로그램 생성과 AI 운동 분석 리포트는 프리미엄 구독이 필요합니다." },
  { q: "헬린이(운동 초보)도 사용할 수 있나요?", a: "물론입니다. 헬스장 개인 운동이 처음이어도 걱정 없어요. AI 운동 플래너가 체력 수준에 맞춰 헬스 기구 사용법, 무게, 횟수, 세트 수를 자동으로 조절합니다. 운동 초보자부터 상급자까지 개인화된 운동 계획을 받을 수 있어요." },
  { q: "어떤 운동을 지원하나요?", a: "스쿼트, 벤치프레스, 데드리프트 등 웨이트 트레이닝은 물론 맨몸운동, 러닝, 모빌리티까지 100가지 이상의 운동을 AI가 자동으로 조합해 헬스 루틴을 생성합니다." },
  { q: "다른 운동 어플과 뭐가 다른가요?", a: "기존 운동 기록 앱은 직접 운동을 골라 기록해야 하지만, 오운잘 AI는 컨디션만 선택하면 AI가 운동 루틴을 자동 생성하고, 운동 일지 저장부터 AI 운동 코칭, 분석 리포트까지 제공합니다. PT 대체 서비스로 헬스 루틴 생성부터 오운완 인증까지 올인원." },
  { q: "운동 기록은 어떻게 저장되나요?", a: "운동 중 세트별 무게·횟수가 자동으로 기록됩니다. 운동 일지가 자동 저장되고, 운동 볼륨 추적 그래프와 체중 변화 그래프로 개인 운동 기록을 한눈에 확인할 수 있어요." },
  { q: "오운완 인증은 어떻게 하나요?", a: "운동 완료 후 자동으로 생성되는 운동 기록 카드를 카카오톡, 인스타그램 등으로 바로 공유할 수 있습니다. 오운완 인증샷을 예쁘게 만들어드려요." },
  { q: "성장 예측은 어떻게 작동하나요?", a: "오운잘 AI는 당신의 운동 데이터에서 총볼륨(중량x횟수), 세트수, 운동시간, 빈도, 체중 등 다양한 입력값을 수집합니다. 이 데이터를 XGBoost(트리 기반 앙상블) 모델과 논문 검증된 회귀분석에 적용하여 칼로리 소모, 근력 성장, 볼륨 추세를 예측합니다. 데이터가 쌓일수록 당신만의 패턴을 학습해 예측 정밀도가 높아집니다. (볼륨-칼로리 상관관계 r=0.89 — Haddock & Wilkin, 2006 / 초보자 근력 성장 메타분석 — Rhea et al., 2003 / ACSM 운동 처방 가이드라인, 2026)" },
  { q: "퀘스트와 티어 시스템이 뭔가요?", a: "매주 운동 강도별 퀘스트(고강도·중강도·저강도)가 주어지고, 달성하면 경험치(EXP)를 얻어요. EXP가 쌓이면 Iron → Bronze → Silver → Gold → Platinum → Emerald → Diamond → Master → Challenger까지 티어가 올라갑니다. 4개월마다 시즌이 리셋되어 새로운 도전이 시작돼요. 운동과학(ACSM) 기반이라 게임처럼 즐기면서 올바른 운동 습관이 만들어져요." },
  { q: "앱 설치가 필요한가요?", a: "별도 앱 설치 없이 웹에서 바로 사용 가능합니다. 홈화면에 추가하면 운동 어플처럼 사용할 수 있는 PWA 방식이에요." },
  { q: "구독은 어떻게 해지하나요?", a: "프로필 > 구독 관리에서 언제든지 해지할 수 있으며, 해지해도 결제 기간까지 이용 가능합니다." },
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
              href="/app"
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
            <p className="text-sm sm:text-xl text-[#a7f3d0] font-medium mb-4 tracking-wide">
              AI 성장 예측 · AI 맞춤 운동 루틴 · 퀘스트 & 티어
            </p>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight">
              <span className="text-[#34d399]">운동 결과,</span><br />시작 전에<br className="sm:hidden" /> <span className="text-[#34d399]">미리 본다</span>
            </h1>
            <p className="mt-6 text-lg sm:text-2xl text-white/70 font-semibold leading-relaxed">
              AI가 감량 시점 · 근력 성장 · 체력 변화를 예측합니다<br />
              국내 최초 회귀분석 예측 모델 도입
            </p>
            <div className="mt-10">
              <a
                href="/app"
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
                  <source src="/predictmodel.mp4" type="video/mp4" />
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

      {/* 사용자 성장 데이터 */}
      <section className="py-14 sm:py-20 bg-[#FAFBF9]">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">사용자 데이터 기반</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">
                꾸준히 하면, 숫자가 증명합니다
              </h2>
            </div>
          </RevealSection>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: "주 3.2회", label: "평균 운동 빈도", sub: "꾸준한 사용자 기준" },
              { value: "+28%", label: "첫 달 운동 볼륨", sub: "총 중량 x 횟수 증가" },
              { value: "+23%", label: "3개월 추정 1RM", sub: "주요 복합 운동 기준" },
              { value: "94%", label: "루틴 완주율", sub: "AI 맞춤 플랜 기준" },
            ].map((stat, i) => (
              <RevealSection key={i}>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 text-center shadow-sm">
                  <p className="text-3xl sm:text-4xl font-black text-[#1B4332] mb-1">{stat.value}</p>
                  <p className="text-[13px] font-bold text-gray-700 mb-1">{stat.label}</p>
                  <p className="text-[11px] text-gray-400">{stat.sub}</p>
                </div>
              </RevealSection>
            ))}
          </div>
          <RevealSection>
            <p className="text-center text-[11px] text-gray-400 mt-6">
              * 2025.12 ~ 2026.03 기간 주 2회 이상 운동 사용자 집계 기준
            </p>
          </RevealSection>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">AI 맞춤 운동 프로그램</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">
                이런 고민, 있지 않으셨나요?
              </h2>
            </div>
          </RevealSection>
          <div className="space-y-14 sm:space-y-20">
            {FEATURES.map((f, i) => {
              const isReversed = i % 2 !== 0;
              return (
              <RevealSection key={i}>
                <div className={`flex flex-col ${isReversed ? "sm:flex-row-reverse" : "sm:flex-row"} items-center gap-8 sm:gap-16`}>
                  {/* Visual column */}
                  <div className={`${f.priceCard ? "w-full max-w-[320px] sm:w-[360px]" : "w-full max-w-[280px] sm:w-[320px]"} shrink-0`}>
                    {f.priceCard ? (
                      <div className="flex items-stretch gap-3 sm:gap-4">
                        <div className="flex-1 rounded-2xl bg-white border border-gray-200 p-3 sm:p-5 text-center shadow-lg flex flex-col items-center justify-center">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          </div>
                          <p className="text-xs text-gray-500 font-bold mb-1">PT 업계 월 평균</p>
                          <p className="text-2xl sm:text-3xl font-black text-gray-800">₩660,000</p>
                        </div>
                        <div className="flex-1 rounded-2xl bg-[#f0fdf4] p-3 sm:p-5 text-center shadow-lg border-2 border-[#059669] flex flex-col items-center justify-center">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d1fae5] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <p className="text-xs text-[#059669] font-bold mb-1">오운잘 AI (월)</p>
                          <p className="text-2xl sm:text-3xl font-black text-[#1B4332]">₩6,900</p>
                          <div className="mt-3 px-2 py-1 bg-[#059669] rounded-full inline-block">
                            <span className="text-xs font-bold text-white">약 95배 저렴</span>
                          </div>
                        </div>
                      </div>
                    ) : f.questCard ? (
                      <div className="rounded-[32px] border-[5px] border-gray-200 bg-black shadow-xl overflow-hidden">
                        <video autoPlay loop muted playsInline className="w-full">
                          <source src="/game.mp4" type="video/mp4" />
                        </video>
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
                  <div className="flex-1 text-center sm:text-left sm:pl-22">
                    <p className="text-2xl sm:text-4xl font-black text-red-400 mb-4 sm:mb-5">&ldquo;{f.pain}&rdquo;</p>
                    <h3 className="text-xl sm:text-3xl font-black text-[#1B4332] mb-2 sm:mb-3">{f.title}</h3>
                    <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-md mx-auto sm:mx-0 whitespace-pre-line">{f.desc}</p>
                  </div>
                </div>
              </RevealSection>
            ); })}
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
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    AI 성장 예측 맛보기 (1건)
                  </li>
                </ul>
                <a
                  href="/app"
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
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    주간 퀘스트 + 시즌 티어 성장
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    AI 성장 예측 리포트
                  </li>
                  <li className="flex items-start gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    전체 목표별 상세 성장 분석
                  </li>
                </ul>
                <a
                  href="/app"
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
                헬스 루틴 생성, 딸깍 한 번이면 끝
              </h2>
              <p className="text-sm sm:text-base text-gray-500 mt-3">복잡한 설정 없이, AI가 운동 루틴을 자동 생성</p>
            </div>
          </RevealSection>
          {/* Mobile: 세로 카드형 비교 */}
          <div className="sm:hidden space-y-4">
            {[
              { label: "월 비용", other: "₩15,000~30,000", ours: "₩6,900" },
              { label: "플랜 생성", other: "직접 운동 골라서 조합", ours: "AI가 운동 루틴 자동 생성" },
              { label: "난이도 조절", other: "정해진 프로그램 그대로 수행", ours: "매 세트 쉬움/적당/힘듦 → 자동 조절" },
              { label: "운동 분석", other: "운동 일지 기록만 저장", ours: "AI 운동 코칭 + 분석 리포트" },
              { label: "성장 예측", other: "예측 기능 없음", ours: "AI가 감량·근력·체력 목표 도달 시점 예측" },
              { label: "동기부여", other: "기록만 쌓이고 성취감 없음", ours: "주간 퀘스트 + 시즌 티어 성장 시스템" },
              { label: "사용 난이도", other: "설정 복잡, 입력내용 많음", ours: "쉬운 버튼 조작, 터치 한번에 끝" },
            ].map((item, i) => (
              <RevealSection key={i}>
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="bg-[#1B4332] px-4 py-2.5">
                    <p className="text-white font-bold text-sm text-center">{item.label}</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M6 6L14 14M14 6L6 14" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-0.5">기존 운동 어플</p>
                        <p className="text-sm text-gray-500">{item.other}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3.5 flex items-center gap-3 bg-[#f0fdf4]">
                      <div className="w-5 h-5 rounded-full bg-[#d1fae5] flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#059669] mb-0.5">오운잘 AI</p>
                        <p className="text-sm font-bold text-[#1B4332]">{item.ours}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>

          {/* Desktop: 테이블 비교 */}
          <RevealSection className="hidden sm:block">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1B4332] text-white">
                    <th className="py-4 px-4 text-center font-bold w-1/5">항목</th>
                    <th className="py-4 px-4 text-center font-bold w-2/5">기존 운동 어플</th>
                    <th className="py-4 px-4 text-center font-bold w-2/5 text-[#34d399]">오운잘 AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">월 비용</td>
                    <td className="py-4 px-4 text-center text-gray-500">₩15,000~30,000</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">₩6,900</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">플랜 생성</td>
                    <td className="py-4 px-4 text-center text-gray-500">직접 운동 골라서 조합</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">AI가 운동 루틴 자동 생성</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">난이도 조절</td>
                    <td className="py-4 px-4 text-center text-gray-500">정해진 프로그램 그대로 수행</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">매 세트 &ldquo;쉬움/적당/힘듦&rdquo; → 자동 조절</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">운동 분석</td>
                    <td className="py-4 px-4 text-center text-gray-500">운동 일지 기록만 저장</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">AI 운동 코칭 + 분석 리포트</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">성장 예측</td>
                    <td className="py-4 px-4 text-center text-gray-500">예측 기능 없음</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">AI가 감량·근력·체력 목표 도달 시점 예측</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">동기부여</td>
                    <td className="py-4 px-4 text-center text-gray-500">기록만 쌓이고 성취감 없음</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">주간 퀘스트 + 시즌 티어 성장</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="py-4 px-4 font-bold text-[#1B4332] text-center">사용 난이도</td>
                    <td className="py-4 px-4 text-center text-gray-500">설정 복잡, 입력내용 많음</td>
                    <td className="py-4 px-4 text-center font-bold text-[#059669]">쉬운 버튼 조작, 터치 한번에 끝</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="pt-16 sm:pt-32 pb-6 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">
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
              오늘 운동 루틴, AI가 자동으로 짜드립니다
            </h2>
            <p className="text-lg text-gray-500 mb-10">
              AI 운동 추천부터 헬스 루틴 생성까지, 지금 무료로 시작하세요.
            </p>
            <a
              href="/app"
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
            <p>H.P 010-4824-2869 | ounjal.ai.app@gmail.com</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm mb-8">
            <a href="/terms" className="hover:text-white transition-colors">이용약관</a>
            <a href="/privacy" className="hover:text-white transition-colors">개인정보처리방침</a>
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
