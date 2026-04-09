"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LanguageSelector } from "@/components/layout/LanguageSelector";

// localStorage 캐시 기반 리다이렉트
function useAuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem("auth_logged_in") === "1") {
      router.replace("/app");
    }
  }, [router]);
}

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
    pain: "살은 빼고 싶은데, 뭘 해야 빠지는 건지...",
    title: "체중감량 맞춤 운동 루틴",
    desc: "다이어트 목표를 고르면\n유산소와 웨이트 균형까지 AI가 짜줘요.\n매일 컨디션에 맞춰 조절되니까\n무리 없이 꾸준히 빠져요.",
    video: "/weight-loss.mp4",
  },
  {
    pain: "PT 한 달이면 40만원인데...",
    title: "월 6,900원, 매일 AI 코칭 받기",
    desc: "현역 트레이너가 설계한 AI가\n매일 맞춤 운동을 짜드려요.\nPT 한 달이면 40만원,\n오운잘은 한 달에 커피 한 잔 값.",
    video: "",
    priceCard: true,
  },
  {
    pain: "오늘 뭐 할지 매일 고민하지 마세요",
    title: "매일 달라지는 AI 맞춤 운동 루틴",
    desc: "어제 상체 했으면 오늘은 하체,\n컨디션 안 좋으면 가벼운 운동.\nAI가 알아서 균형 잡아줘요.\n뭐 할지 고민하는 시간, 이제 0초.",
    video: "/hero.mp4",
  },
  {
    pain: "혼자 해도 제대로 하고 있는 건지...",
    title: "PT 없이도 체계적으로, AI가 알아서 코칭",
    desc: "운동 기록은 자동 저장,\n다음 세트 무게와 횟수는 AI가 추천.\n혼자 해도 PT 받는 것처럼 체계적으로.",
    video: "/is-it-right.mp4",
  },
];

const COMPACT_FEATURES = [
  {
    title: "게임처럼 운동 습관 만들기",
    desc: "퀘스트 클리어하면 경험치가 쌓이고 티어가 올라가요",
    questCard: true,
  },
  {
    title: "AI가 내 몸의 변화를 미리 예측",
    desc: "운동 데이터를 분석해 체중, 근력 변화를 알려줘요",
    video: "/predictmodel.mp4",
  },
];

const STEPS = [
  { num: "01", title: "몸 상태 고르기", desc: "상체 뻐근? 하체 무거움? 터치 한 번이면 끝" },
  { num: "02", title: "목표 고르기", desc: "다이어트? 근육? 체력? 탭 한 번이면 OK" },
  { num: "03", title: "AI가 루틴 생성", desc: "3초 만에 오늘 운동이 완성돼요" },
  { num: "04", title: "운동하고 인증", desc: "운동하면 자동 기록, 끝나면 오운완 인증샷까지" },
];

const FAQS = [
  { q: "무료로 쓸 수 있나요?", a: "네, 회원가입 없이 바로 1회 체험 가능해요. 가입하면 하루 4회까지 무료예요." },
  { q: "운동 초보(헬린이)인데 괜찮을까요?", a: "오히려 초보일수록 좋아요. AI가 체력에 맞춰 운동을 짜주니까 뭘 해야 할지 고민할 필요 없어요." },
  { q: "다른 운동 루틴 추천 앱이랑 뭐가 달라요?", a: "다른 앱은 운동을 직접 골라야 해요. 오운잘은 컨디션만 고르면 AI가 알아서 짜줘요." },
  { q: "앱 설치해야 하나요?", a: "아니요, 웹에서 바로 써요. 홈화면에 추가하면 앱처럼 쓸 수 있어요." },
  { q: "구독 해지 어렵지 않나요?", a: "프로필에서 터치 한 번이면 바로 해지돼요. 해지해도 결제 기간까지 이용 가능해요." },
];

const FAQS_MORE = [
  { q: "어떤 운동을 지원하나요?", a: "웨이트, 맨몸운동, 러닝, 스트레칭까지 100가지 이상을 AI가 자동 조합해요." },
  { q: "운동 기록은 어떻게 저장되나요?", a: "운동 중 세트별 무게와 횟수가 자동 기록돼요. 볼륨 그래프로 한눈에 확인 가능해요." },
  { q: "오운완 인증은 어떻게 하나요?", a: "운동 끝나면 기록 카드가 자동 생성돼요. 카카오톡, 인스타에 바로 공유 가능해요." },
  { q: "성장 예측은 어떻게 작동하나요?", a: "운동 데이터를 AI가 분석해서 체중 변화, 근력 성장을 예측해줘요. 데이터가 쌓일수록 정확해져요." },
  { q: "퀘스트와 티어 시스템이 뭔가요?", a: "매주 운동 미션을 클리어하면 경험치가 쌓이고 티어가 올라가요. 게임처럼 운동 습관을 만들어줘요." },
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
  useAuthRedirect();
  return (
    <div className="min-h-screen bg-[#FAFBF9] overflow-x-hidden" style={{ overflow: "auto" }}>
      {/* Hero (nav included inside for seamless background) */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(to bottom, #0a1a14 0%, #0f2a1f 30%, #143728 60%, #1B4332 85%, #FAFBF9 100%)" }}>
        {/* Nav */}
        <nav className="sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <img src="/favicon.png" alt="오운잘 AI" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg" />
              <span className="font-bold text-[#10B981] text-base sm:text-lg">오운잘 AI</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector current="/" />
              <a
                href="/app?lang=ko"
                className="px-3 sm:px-5 py-2 sm:py-2.5 bg-[#059669] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors whitespace-nowrap"
              >
                시작하기
              </a>
            </div>
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
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-8 text-xs sm:text-sm text-white/50">
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
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0s_forwards]">살은 빼고 싶고,</span><br />
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.3s_forwards]">PT는 비싸고,</span><br />
              <span className="text-[#34d399] text-xl sm:text-5xl lg:text-6xl opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.6s_forwards]">혼자 하자니 뭘 해야 할지 모르겠고.</span>
            </h1>
            <div className="mt-10">
              <a
                href="/app?lang=ko"
                className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:shadow-[0_8px_40px_rgba(5,150,105,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                3초 만에 오늘 운동 받기
              </a>
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
                  <source src="/hero.mp4" type="video/mp4" />
                </video>
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* 이런 분들이 쓰고 있어요 */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">어떤 운동이든, 어디서든</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">이런 분들이 쓰고 있어요</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="space-y-4">
              {[
                "살 빼려고 운동 시작한 다이어터",
                "PT 비용이 부담되는 자기주도 운동러",
                "집에서 혼자 루틴 짜기 귀찮은 홈트족",
                "체계적으로 달리고 싶은 러너",
                "헬스장에서 뭘 해야 할지 모르는 헬린이",
              ].map((text, i) => (
                <div key={i} className="px-5 py-4 rounded-2xl bg-[#f0fdf4] border border-[#d1fae5] text-center">
                  <span className="text-base sm:text-lg font-bold text-[#1B4332]">{text}</span>
                </div>
              ))}
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
              <p className="text-sm font-bold text-[#059669] mb-2">AI와 함께 성장한 결과</p>
              <h2 className="text-xl sm:text-4xl font-black text-[#1B4332]" style={{ wordBreak: "keep-all" }}>
                수동적 의존이 아닌, 자발적 성장의 증거
              </h2>
            </div>
          </RevealSection>
          {/* 히어로 숫자 */}
          <RevealSection>
            <div className="text-center mb-8">
              <p className="text-5xl sm:text-7xl font-black text-[#059669]">+28%</p>
              <p className="text-base sm:text-lg font-bold text-[#1B4332] mt-2">첫 달 만에 운동량이 올랐어요</p>
              <p className="text-xs text-gray-400 mt-1">총 중량 x 횟수 기준</p>
            </div>
          </RevealSection>
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {[
              { value: "주 3.2회", label: "평균 운동 빈도", sub: "꾸준한 사용자 기준" },
              { value: "+23%", label: "3개월 추정 1RM", sub: "주요 복합 운동 기준" },
              { value: "94%", label: "루틴 완주율", sub: "AI 맞춤 플랜 기준" },
            ].map((stat, i) => (
              <RevealSection key={i}>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-6 text-center shadow-sm" style={{ wordBreak: "keep-all" }}>
                  <p className="text-lg sm:text-3xl font-black text-[#1B4332] mb-1 whitespace-nowrap">{stat.value}</p>
                  <p className="text-[11px] sm:text-[13px] font-bold text-gray-700 mb-1">{stat.label}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-400">{stat.sub}</p>
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
              <h2 className="text-xl sm:text-4xl font-black text-[#1B4332]" style={{ wordBreak: "keep-all" }}>
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
                          <p className="text-xs text-gray-500 font-bold mb-1">PT 1회</p>
                          <p className="text-2xl sm:text-3xl font-black text-gray-800">₩50,000</p>
                          <p className="text-[10px] text-gray-400 mt-1">월 8회면 40만원</p>
                        </div>
                        <div className="flex-1 rounded-2xl bg-[#f0fdf4] p-3 sm:p-5 text-center shadow-lg border-2 border-[#059669] flex flex-col items-center justify-center">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d1fae5] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <p className="text-xs text-[#059669] font-bold mb-1">오운잘 AI (월)</p>
                          <p className="text-2xl sm:text-3xl font-black text-[#1B4332]">₩6,900</p>
                          <div className="mt-3 px-2 py-1 bg-[#059669] rounded-full inline-block">
                            <span className="text-xs font-bold text-white">커피 한 잔 값</span>
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
                  <div className="flex-1 text-center sm:text-left sm:pl-22">
                    <p className="text-lg sm:text-4xl font-black text-red-400 mb-4 sm:mb-5 whitespace-nowrap">&ldquo;{f.pain}&rdquo;</p>
                    <h3 className="text-xl sm:text-3xl font-black text-[#1B4332] mb-2 sm:mb-3">{f.title}</h3>
                    <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-md mx-auto sm:mx-0 whitespace-pre-line">{f.desc}</p>
                  </div>
                </div>
              </RevealSection>
            ); })}
            {/* 컴팩트 2열 — 리텐션 + LTV */}
            <RevealSection>
              <div className="grid grid-cols-2 gap-4 mt-12 sm:mt-16">
                {COMPACT_FEATURES.map((cf, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 text-center">
                    <h3 className="text-base sm:text-lg font-black text-[#1B4332] mb-2">{cf.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{cf.desc}</p>
                  </div>
                ))}
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* WHO MADE THIS — 트레이너 프로필 */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">WHO MADE THIS</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">개발자가 아니라, 트레이너가 만들었습니다</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-8 sm:p-10 text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/30 mx-auto mb-4 shadow-lg">
                  <img src="/CEO.jpeg" alt="임주용 트레이너" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-1">임주용</h3>
                <p className="text-sm sm:text-base text-white/70 font-medium">트레이너 10년차 · 개발자</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {["NASM-CPT", "ACSM-CPT", "NSCA-FLC"].map((cert) => (
                    <span key={cert} className="px-3 py-1.5 bg-[#f0fdf4] text-[#059669] text-xs sm:text-sm font-bold rounded-full border border-[#d1fae5]">
                      {cert}
                    </span>
                  ))}
                </div>
                <p className="text-center text-sm sm:text-base text-gray-500 mb-6 leading-relaxed">
                  한국체육대학교 대학원 건강운동관리 석사<br />
                  생활체육지도자 2급 · 체력코치(KCA)
                </p>
                <div className="bg-[#FAFBF9] rounded-2xl p-5 sm:p-6">
                  <p className="text-sm sm:text-base text-[#1B4332] font-medium leading-relaxed text-center italic">
                    &ldquo;트레이너가 직접 만든 운동 앱은 많지 않아요.
                    10년간 헬스장에서 들은 &lsquo;뭘 해야 할지 모르겠어요&rsquo;를 풀기 위해 직접 만들었습니다.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </RevealSection>
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
                    비로그인 1회 체험 · 하루 4회 AI 운동 플랜
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
                  href="/app?lang=ko"
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
                  href="/app?lang=ko"
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
              {(() => {
                const [showMore, setShowMore] = React.useState(false);
                return (
                  <>
                    {showMore && FAQS_MORE.map((faq, i) => (
                      <FAQItem key={`more-${i}`} q={faq.q} a={faq.a} />
                    ))}
                    <button
                      onClick={() => setShowMore(!showMore)}
                      className="w-full py-4 text-sm font-bold text-[#2D6A4F] text-center active:opacity-60 transition-opacity"
                    >
                      {showMore ? "접기" : "더보기"}
                    </button>
                  </>
                );
              })()}
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
              href="/app?lang=ko"
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
            <p>통신판매 | 2026-서울관악-0647</p>
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
            <p className="text-xs text-gray-500 mb-4">&copy; 2026 오운잘 AI. All rights reserved.</p>
            <p className="text-[10px] text-gray-600 leading-relaxed max-w-lg mx-auto">
              본 서비스는 의료 행위가 아니며, 전문 의료 상담을 대체하지 않습니다.
              운동 시 부상 위험이 있으며, 기저 질환이 있는 경우 의사와 상담 후 이용하시기 바랍니다.
              AI 추천은 참고용이며, 결과는 개인차가 있습니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
