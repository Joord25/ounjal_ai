"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANDING_TEXTS, type LandingLocale } from "./landingTexts";
import { LanguageSelector } from "@/components/layout/LanguageSelector";

// ─── Hooks ───────────────────────────────────────────────────────
function useAtTop(threshold = 80) {
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => { setAtTop(window.scrollY < threshold); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return atTop;
}

function useAuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem("auth_logged_in") === "1") {
      router.replace("/app");
    }
  }, [router]);
}

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

function useCountUp(target: number, suffix: string, duration = 1200) {
  const [display, setDisplay] = useState(`0${suffix}`);
  const ref = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            setDisplay(`${current}${suffix}`);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, suffix, duration]);
  return { ref, display };
}

function RevealOnScroll({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={className} style={{ opacity: 0, transform: "translateY(24px)", transition: "opacity 0.7s ease-out, transform 0.7s ease-out" }}>
      {children}
    </div>
  );
}

// ─── Shared data ─────────────────────────────────────────────────
const STAT_VALUES = [3.2, 94, 28] as const;

const LOGOS = [
  { name: "KNSU", logo: "/korea natinal sports univ..png" },
  { name: "Inha Univ.", logo: "/inha univ.jpeg" },
  { name: "KISED", logo: "/chanjinwon.svg" },
  { name: "MSS", logo: "/jungichung.png" },
  { name: "NASM · KFTA", logo: "/thumb-97a4bf8abd6404c4b538afc07e14f0f4_1659674757_41_800x246.jpg" },
  { name: "ACSM", logo: "/ACSM-removebg-preview.png" },
  { name: "NSCA Korea", logo: "/NSCA.png" },
];

const CheckSvg = ({ stroke = "#34d399" }: { stroke?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <path d="M3 8L6.5 11.5L13 5" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StarSvg = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? "#1B4332" : "#E5E7EB"}>
    <path d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.94l-3.71 1.95L5 8.76 2 5.84l4.15-.6L8 1.5z"/>
  </svg>
);

// ─── Main Component ──────────────────────────────────────────────
export default function LandingContent({ locale = "ko" }: { locale?: LandingLocale }) {
  const t = LANDING_TEXTS[locale];
  useBodyScroll();
  useAuthRedirect();

  const navVisible = useAtTop();
  const demoSectionRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [demoInView, setDemoInView] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const bottomCtaVisible = !demoInView && !footerInView;

  useEffect(() => {
    const demo = demoSectionRef.current;
    const footer = footerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === demo) setDemoInView(entry.isIntersecting);
          if (entry.target === footer) setFooterInView(entry.isIntersecting);
        }
      },
      { threshold: 0.01 }
    );
    if (demo) observer.observe(demo);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // 회의 58 후속: 모바일은 각 스텝이 자기 폰 프레임을 가지는 순차 레이아웃.
  // activeDemo는 데스크톱 auto-cycle + 클릭 전용.
  const [activeDemo, setActiveDemo] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDemo((prev) => (prev + 1) % t.howItWorks.steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [t.howItWorks.steps.length]);

  const stat0 = useCountUp(STAT_VALUES[0] * 10, "", 1000);
  const stat1 = useCountUp(STAT_VALUES[1], t.hero.stats[1].suffix, 1200);
  const stat2 = useCountUp(STAT_VALUES[2], t.hero.stats[2].suffix, 1000);

  const ctaHref = `/app?lang=${locale}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-clip font-[var(--font-instrument),_var(--font-sans)]">
      {/* ═══ Top Nav ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300"
        style={{ transform: navVisible ? "translateY(0)" : "translateY(-100%)" }}
      >
        <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="ohunjal" className="w-7 h-7 rounded-lg" />
              <span className="font-bold text-[#34d399] text-base tracking-tight">{t.nav.brand}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector current={locale === "ko" ? "/" : "/en"} />
              <a href={ctaHref} className="px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] active:scale-95 transition-all">
                {t.nav.cta}
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ Bottom Sticky CTA ═══ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-6 sm:pb-8 pointer-events-none transition-all duration-500"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))", transform: bottomCtaVisible ? "translateY(0)" : "translateY(120%)", opacity: bottomCtaVisible ? 1 : 0 }}
      >
        <a href={ctaHref} className="pointer-events-auto px-10 sm:px-14 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_0_40px_rgba(5,150,105,0.3)] hover:shadow-[0_0_60px_rgba(5,150,105,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
          {t.nav.cta}
        </a>
      </div>

      {/* ═══ Section 1: Hero ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-16" style={{ background: "linear-gradient(to bottom, #0a1a14 0%, #0f2a1f 30%, #143728 60%, #1B4332 85%, #111111 100%)" }}>
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <RevealOnScroll>
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 text-[10px] sm:text-xs text-white/40">
              <div className="flex items-center gap-1">
                <span>Backed by</span>
                <img src="/google-cloud-logo.png" alt="Google Cloud" className="h-4 sm:h-5 inline-block" />
              </div>
              <span className="text-white/15">|</span>
              <div className="flex items-center gap-1">
                <span>Powered by</span>
                <img src="/gemini_logo.png" alt="Gemini" className="h-4 sm:h-6 inline-block" />
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={200}>
            <h1 className={`${locale === "ko" ? "text-[7vw]" : "text-[10vw]"} sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-4 sm:mb-6`} style={{ wordBreak: "keep-all" }}>
              <span className="text-white">{t.hero.line1}</span><br />
              {t.hero.line1b && <><span className="text-white">{t.hero.line1b}</span><br /></>}
              {t.hero.line2 && <><span className="text-white">{t.hero.line2}</span><br /></>}
              <span className={`text-[#34d399] ${locale !== "ko" ? "text-[12vw] sm:text-5xl lg:text-6xl" : ""}`}>{t.hero.line3}</span>
            </h1>
          </RevealOnScroll>

          <RevealOnScroll delay={400}>
            <p className="text-sm sm:text-lg text-white/50 leading-relaxed mb-8 sm:mb-10 max-w-md mx-auto">
              {typeof t.hero.sub === "string" ? (
                t.hero.sub
              ) : (
                t.hero.sub.map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < (t.hero.sub as string[]).length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
            </p>
          </RevealOnScroll>

          <RevealOnScroll delay={600} className="mt-10 sm:mt-20">
            <div className="grid grid-cols-3 gap-3 sm:gap-8 max-w-lg mx-auto">
              <div className="text-center" ref={stat0.ref}>
                <p className="text-xl sm:text-4xl font-black text-white tabular-nums">
                  {t.hero.stats[0].prefix}{(Number(stat0.display) / 10).toFixed(1)}{t.hero.stats[0].suffix}
                </p>
                <p className="text-[10px] sm:text-sm text-white/40 mt-1">{t.hero.stats[0].label}</p>
              </div>
              <div className="text-center" ref={stat1.ref}>
                <p className="text-xl sm:text-4xl font-black text-white tabular-nums">{stat1.display}</p>
                <p className="text-[10px] sm:text-sm text-white/40 mt-1">{t.hero.stats[1].label}</p>
              </div>
              <div className="text-center" ref={stat2.ref}>
                <p className="text-xl sm:text-4xl font-black text-[#34d399] tabular-nums">{t.hero.stats[2].prefix}{stat2.display}</p>
                <p className="text-[10px] sm:text-sm text-white/40 mt-1">{t.hero.stats[2].label}</p>
              </div>
            </div>
            <p className="text-[11px] text-white/20 mt-4">{t.hero.statNote}</p>
          </RevealOnScroll>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/20">
            <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* ═══ Section 2: HOW IT WORKS ═══ */}
      <section ref={demoSectionRef} className="py-20 sm:py-28 px-6 bg-[#111111]">
        <div className="max-w-4xl mx-auto">
          <RevealOnScroll>
            <h2 className="text-2xl sm:text-4xl font-black text-center text-white mb-12 sm:mb-16">{t.howItWorks.title}</h2>
          </RevealOnScroll>

          {/* 데스크톱 (sm+): 기존 좌우 분할 레이아웃 */}
          <div className="hidden sm:flex flex-row items-center gap-16">
            <RevealOnScroll className="w-full max-w-[320px] shrink-0">
              <div className="relative">
                <div className="rounded-[36px] border-[4px] border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden aspect-[9/19.5]">
                  <div className="w-full h-full transition-all duration-500">
                    {[0, 1, 2, 3].map((idx) => (
                      activeDemo === idx && (
                        <img key={idx} src={locale === "ko" ? `/how it works ${idx + 1}.png` : `/how it works${idx + 1}_en.png`} alt={t.howItWorks.steps[idx]?.title} className="w-full h-full object-cover animate-[fadeSlideUp_0.5s_ease-out_forwards]" />
                      )
                    ))}
                  </div>
                </div>
                <div className="absolute -inset-4 rounded-[44px] -z-10 opacity-40 blur-2xl bg-[#059669]/20" />
              </div>
            </RevealOnScroll>

            <div className="flex-1 space-y-8">
              {t.howItWorks.steps.map((step, i) => (
                <RevealOnScroll key={i} delay={i * 150}>
                  <button
                    type="button"
                    onClick={() => setActiveDemo(i)}
                    className={`w-full text-left flex items-start gap-5 p-5 rounded-2xl transition-all duration-300 ${
                      activeDemo === i ? "bg-white/5 border border-white/10" : "bg-transparent border border-transparent hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm transition-colors duration-300 ${
                      activeDemo === i ? "bg-[#059669] text-white" : "bg-white/5 text-white/30"
                    }`}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold transition-colors duration-300 ${activeDemo === i ? "text-white" : "text-white/40"}`}>{step.title}</h3>
                      <p className={`text-sm mt-1 transition-colors duration-300 ${activeDemo === i ? "text-white/60" : "text-white/20"}`}>{step.desc}</p>
                    </div>
                  </button>
                </RevealOnScroll>
              ))}
            </div>
          </div>

          {/* 모바일 (sm 미만): 회의 58 후속 — 각 스텝 독립 유닛 순차 배치 */}
          <div className="sm:hidden space-y-16">
            {t.howItWorks.steps.map((step, i) => (
              <RevealOnScroll key={i}>
                <div>
                  {/* 폰 프레임 — 해당 스텝 이미지 */}
                  <div className="mx-auto w-[80%] max-w-[320px] mb-6">
                    <div className="relative">
                      <div className="rounded-[30px] border-[3px] border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden aspect-[9/19.5]">
                        <img
                          src={locale === "ko" ? `/how it works ${i + 1}.png` : `/how it works${i + 1}_en.png`}
                          alt={step.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute -inset-4 rounded-[38px] -z-10 opacity-40 blur-2xl bg-[#059669]/20" />
                    </div>
                  </div>

                  {/* 텍스트 — 해당 스텝 설명 */}
                  <div className="flex items-start gap-4 px-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm bg-[#059669] text-white">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{step.title}</h3>
                      <p className="text-sm mt-1 text-white/60">{step.desc}</p>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Section 3: Trust (white) ═══ */}
      <section className="py-24 sm:py-32 bg-white min-h-screen flex flex-col justify-center">
        <div className="max-w-5xl mx-auto px-6 mb-10 sm:mb-14">
          <RevealOnScroll>
            <h2 className="text-3xl sm:text-6xl lg:text-7xl font-medium text-[#1B4332] leading-[1.1] tracking-tight whitespace-pre-line">{t.trust.heading}</h2>
          </RevealOnScroll>
          <RevealOnScroll delay={100}>
            <p className="text-base sm:text-lg text-gray-500 mt-4 sm:mt-6 max-w-3xl leading-relaxed">
              {t.trust.sub.map((line, i) => (
                <React.Fragment key={i}>{line}{i < t.trust.sub.length - 1 && line && <br />}</React.Fragment>
              ))}
            </p>
          </RevealOnScroll>
        </div>

        {/* Infinite scroll logos (모바일/데스크톱 공통 자동 스크롤) */}
        <div className="overflow-hidden mb-12 sm:mb-16">
          <div className="flex items-center w-max" style={{ animation: "scroll-left 35s linear infinite" }}>
            {[...Array(2)].map((_, setIdx) => (
              <div key={setIdx} className="flex items-center shrink-0">
                {LOGOS.map((item) => (
                  <div key={`${setIdx}-${item.name}`} className="flex items-center justify-center w-[180px] sm:w-[380px] h-14 sm:h-24 flex-shrink-0 mx-3 sm:mx-8">
                    <img src={item.logo} alt={item.name} className="max-h-full max-w-full object-contain" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* User reviews — 모바일: 터치 스와이프 / 데스크톱: 자동 무한 스크롤 */}
        {t.reviews.length > 0 ? (
          <>
            {/* Mobile: swipeable with snap */}
            <div className="sm:hidden mt-12 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
              <div className="flex items-stretch w-max gap-4 px-6">
                {t.reviews.map((r, i) => (
                  <div
                    key={i}
                    className="snap-center w-[280px] shrink-0 bg-white rounded-2xl border border-gray-100 p-5 flex flex-col"
                  >
                    <div className="flex items-center gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, s) => <StarSvg key={s} filled={s < r.stars} />)}
                    </div>
                    <p className="font-bold text-[#1B4332] text-sm mb-1.5">{r.title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed flex-1">{r.review}</p>
                    <p className="text-xs text-gray-400 mt-3">{r.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: infinite auto scroll (기존 유지) */}
            <div className="hidden sm:block overflow-hidden mt-16">
              <div className="flex items-stretch w-max gap-6 px-6" style={{ animation: "scroll-right 35s linear infinite" }}>
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex items-stretch shrink-0 gap-6">
                    {t.reviews.map((r, i) => (
                      <div key={`${setIdx}-${i}`} className="w-[320px] shrink-0 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col">
                        <div className="flex items-center gap-0.5 mb-2">
                          {Array.from({ length: 5 }).map((_, s) => <StarSvg key={s} filled={s < r.stars} />)}
                        </div>
                        <p className="font-bold text-[#1B4332] text-sm mb-1.5">{r.title}</p>
                        <p className="text-sm text-gray-500 leading-relaxed flex-1">{r.review}</p>
                        <p className="text-xs text-gray-400 mt-3">{r.name}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-12 sm:mt-16 max-w-md mx-auto px-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <p className="text-xs text-[#34d399] font-bold tracking-[0.15em] uppercase mb-2">
                {locale === "ko" ? "후기 준비 중" : "Reviews coming soon"}
              </p>
              <p className="text-sm text-white/60 leading-relaxed">
                {locale === "ko"
                  ? <>사용자 후기를 모으고 있어요.<br />추후 업데이트 예정입니다.</>
                  : <>We&apos;re gathering user reviews.<br />Coming in a future update.</>}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ═══ Section 4: Pricing ═══ */}
      <section className="py-20 sm:py-28 px-6 bg-[#111111]">
        <div className="max-w-2xl mx-auto text-center">
          <RevealOnScroll>
            <p className="text-sm text-[#34d399] font-bold tracking-wide mb-3">{t.pricing.label}</p>
            <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
              <span className="block text-white/40">{t.pricing.headingDim}</span>
              <span className="block text-white mt-3 sm:mt-4">{t.pricing.headingBright}</span>
            </h2>
            <p className="text-base text-white/40 mb-12">{t.pricing.sub}</p>
          </RevealOnScroll>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-12">
            <RevealOnScroll delay={100} className="hidden sm:block">
              <div className="p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-left">
                <p className="text-lg font-bold text-white mb-1">{t.pricing.free.name}</p>
                <p className="text-sm text-white/30 mb-6">{t.pricing.free.desc}</p>
                <p className="text-3xl sm:text-4xl font-black text-white mb-6">
                  {t.pricing.free.price}<span className="text-base font-medium text-white/30">{t.pricing.free.unit}</span>
                </p>
                <ul className="space-y-3 text-sm text-white/50">
                  {t.pricing.free.features.map((item) => (
                    <li key={item} className="flex items-center gap-2"><CheckSvg />{item}</li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={200}>
              <div className="p-6 sm:p-8 rounded-2xl border-2 border-[#059669] bg-white text-left relative shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#059669] text-white text-xs font-bold rounded-full">{t.pricing.premium.badge}</div>
                <p className="text-lg font-bold text-[#1B4332] mb-1">{t.pricing.premium.name}</p>
                <p className="text-sm text-gray-400 mb-4">{t.pricing.premium.desc}</p>
                <div className="mb-3 flex items-end justify-center relative h-[200px] sm:h-[130px]">
                  <img src={locale === "ko" ? "/price.png" : "/price_en1.png"} alt="Premium 1" className="absolute left-1/2 -translate-x-[75%] bottom-0 w-[55%] sm:w-[45%] rounded-xl shadow-lg z-10" />
                  <img src={locale === "ko" ? "/price2.png" : "/price_en2.png"} alt="Premium 2" className="absolute left-1/2 -translate-x-[25%] bottom-0 w-[55%] sm:w-[45%] rounded-xl shadow-lg z-20" />
                </div>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg text-gray-300 line-through">{t.pricing.premium.priceOld}</span>
                    <span className="text-3xl sm:text-4xl font-black text-[#1B4332]">{t.pricing.premium.price}</span>
                    <span className="text-base font-medium text-gray-400">{t.pricing.premium.unit}</span>
                  </div>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-red-500/10 text-red-500 text-xs font-bold rounded-full">{t.pricing.premium.discount}</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-500">
                  {t.pricing.premium.features.map((item) => (
                    <li key={item} className="flex items-center gap-2"><CheckSvg stroke="#059669" />{item}</li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* Gradient bridge */}
      <div className="h-24 sm:h-32" style={{ background: "linear-gradient(to bottom, #111111, #0a0a0a)" }} />

      {/* ═══ Footer ═══ */}
      <footer ref={footerRef} className="pt-16 sm:pt-20 pb-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-10 sm:gap-8 mb-16 sm:mb-20">
            <div className="text-center sm:text-left">
              <img src="/login-logo-Eng.png" alt="ohunjal" className="h-16 sm:h-24 mb-4 mx-auto sm:mx-0 brightness-[1.5] saturate-[1.2] hue-rotate-[15deg]" />
              <p className="text-sm text-white/40">{t.footer.mission}</p>
            </div>
            <div className="text-sm leading-relaxed space-y-1 text-white/30 text-center sm:text-right">
              {t.footer.company.map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </div>
          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/5 pt-6">
            <p className="text-xs text-white/20">{t.footer.copyright}</p>
            <div className="flex items-center gap-6 text-xs text-white/30">
              <a href={t.footer.termsHref} className="hover:text-white/60 transition-colors">{t.footer.terms}</a>
              <a href={t.footer.privacyHref} className="hover:text-white/60 transition-colors">{t.footer.privacy}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
