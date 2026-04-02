"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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

const FEATURES = [
  {
    pain: "I want to lose weight, but what exercises actually work?",
    title: "Weight Loss Workout Plans",
    desc: "Select your goal and AI builds a balanced routine\nwith the right mix of cardio and weights.\nAdapted to your daily condition\nso you stay consistent without burning out.",
    video: "/hero.mp4",
  },
  {
    pain: "A personal trainer costs $300 a month...",
    title: "$4.99/month for daily AI coaching",
    desc: "Designed by a certified trainer with 10 years experience.\nAI builds a fresh workout every day.\nA personal trainer costs $300/month.\nohunjal costs less than a cup of coffee.",
    video: "",
    priceCard: true,
  },
  {
    pain: "Stop deciding what to do every single day",
    title: "AI builds your daily workout automatically",
    desc: "Upper body yesterday? Lower body today.\nFeeling tired? A lighter session.\nAI balances everything for you.\nZero time spent planning.",
    video: "/is-it-right.mp4",
  },
  {
    pain: "Am I even doing this right on my own?",
    title: "AI coaching without a personal trainer",
    desc: "Every set is tracked automatically.\nAI recommends your next weight and reps.\nTrain as effectively as having a PT\nwithout the price tag.",
    video: "/easy-to-use.mp4",
  },
];

const COMPACT_FEATURES = [
  {
    title: "Build habits like a game",
    desc: "Complete quests, earn XP, and climb the tier ladder",
  },
  {
    title: "AI predicts your progress",
    desc: "See projected weight loss, strength gains, and body changes",
  },
];

const STEPS = [
  { num: "01", title: "Pick your condition", desc: "Upper body stiff? Legs heavy? One tap is all it takes" },
  { num: "02", title: "Choose your goal", desc: "Weight loss? Muscle? Endurance? One tap" },
  { num: "03", title: "AI builds your plan", desc: "Your personalized workout is ready in 3 seconds" },
  { num: "04", title: "Train and track", desc: "Follow the plan, auto-record every set, share your results" },
];

const FAQS = [
  { q: "Is it really free?", a: "Yes. Try one workout without signing up. Create an account for up to 4 free AI plans per day." },
  { q: "I'm a complete beginner. Is this for me?", a: "Absolutely. AI adjusts to your fitness level so you never have to figure out what to do on your own." },
  { q: "How is this different from other workout apps?", a: "Other apps make you pick exercises yourself. ohunjal just asks how you feel and builds everything automatically." },
  { q: "Can this help me lose weight?", a: "Yes. Select weight loss as your goal and AI builds a balanced cardio and strength routine adapted to your condition every day." },
  { q: "Does it work for home workouts?", a: "Yes. Home training mode builds bodyweight and dumbbell routines you can do without a gym." },
];

const FAQS_MORE = [
  { q: "Do I need to install an app?", a: "No. It works in your browser. Add it to your home screen and it works like a native app." },
  { q: "What exercises does it support?", a: "Weights, bodyweight, running, stretching — over 100 exercises combined by AI automatically." },
  { q: "Does it have running programs?", a: "Yes. Interval runs, long distance (LSD), easy runs, and uphill training are all supported." },
  { q: "How do I cancel my subscription?", a: "One tap in your profile. You keep access until the end of your billing period." },
  { q: "How does growth prediction work?", a: "AI analyzes your workout data to predict weight changes, strength gains, and fitness milestones. The more data, the more accurate." },
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
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-7 sm:py-8 text-left">
        <span className="text-base sm:text-xl font-bold text-[#1B4332] pr-4 sm:pr-6">{q}</span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="M6 9L12 15L18 9" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-7" : "max-h-0"}`}>
        <p className="text-base text-gray-500 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function EnLandingPage() {
  useBodyScroll();
  useAuthRedirect();

  return (
    <div className="min-h-screen bg-[#FAFBF9] overflow-x-hidden" style={{ overflow: "auto" }}>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(to bottom, #0a1a14 0%, #0f2a1f 30%, #143728 60%, #1B4332 85%, #FAFBF9 100%)" }}>
        <nav className="sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="ohunjal AI" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-[#10B981] text-lg">ohunjal AI</span>
            </div>
            <div className="flex items-center gap-3">
              <select
                onChange={(e) => { if (e.target.value !== "/en") window.location.href = e.target.value; }}
                defaultValue="/en"
                className="bg-transparent text-white/70 text-sm font-medium border border-white/20 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="/" className="text-gray-800">🇰🇷 한국어</option>
                <option value="/en" className="text-gray-800">🇺🇸 English</option>
                <option value="/ja" className="text-gray-800">🇯🇵 日本語</option>
                <option value="/zh" className="text-gray-800">🇨🇳 中文</option>
              </select>
              <a href="/app" className="px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors">Get Started</a>
            </div>
          </div>
        </nav>

        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]" style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)", animation: "hero-orb-1 12s ease-in-out infinite" }} />
        <div className="absolute top-[30%] right-[-15%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)", animation: "hero-orb-2 15s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9]/60 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-24 pb-24 sm:pb-32 text-center">
          <RevealSection>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0s_forwards]">Want to get fit,</span><br />
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.3s_forwards]">but trainers are expensive,</span><br />
              <span className="text-[#34d399] text-xl sm:text-5xl lg:text-6xl opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.6s_forwards]">and you have no idea what to do at the gym?</span>
            </h1>
            <p className="mt-6 text-sm sm:text-lg text-white font-medium tracking-wide opacity-0 animate-[fadeSlideUp_0.5s_ease-out_1.2s_forwards]">
              Pick your condition. Get today&apos;s workout in 3 seconds.
            </p>
            <div className="mt-10">
              <a href="/app" className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:shadow-[0_8px_40px_rgba(5,150,105,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                Get today&apos;s workout free
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

          <RevealSection className="mt-14 sm:mt-20">
            <div className="relative mx-auto w-[240px] sm:w-[320px]">
              <div className="relative z-10 rounded-[40px] border-[6px] border-white/20 bg-black shadow-2xl overflow-hidden">
                <video autoPlay loop muted playsInline className="w-full">
                  <source src="/hero.mp4" type="video/mp4" />
                </video>
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">FOR EVERY TYPE OF ATHLETE</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">Who uses ohunjal AI?</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="space-y-4">
              {[
                "Starting to work out to lose weight",
                "Can\u2019t afford a personal trainer",
                "Tired of planning home workouts alone",
                "Runners who want structured training",
                "Gym beginners who feel lost",
              ].map((text, i) => (
                <div key={i} className="px-5 py-4 rounded-2xl bg-[#f0fdf4] border border-[#d1fae5] text-center">
                  <span className="text-base sm:text-lg font-bold text-[#1B4332]">{text}</span>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Partners */}
      <section className="py-12 sm:py-16 bg-white overflow-hidden">
        <div className="flex items-center w-max" style={{ animation: "scroll-left 30s linear infinite" }}>
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex items-center shrink-0">
              {[
                { name: "Korea National Sport University", logo: "/korea natinal sports univ..png" },
                { name: "Inha University", logo: "/inha univ.jpeg" },
                { name: "NASM · KFTA", logo: "/thumb-97a4bf8abd6404c4b538afc07e14f0f4_1659674757_41_800x246.jpg" },
                { name: "ACSM", logo: "/ACSM-removebg-preview.png" },
                { name: "NSCA Korea", logo: "/NSCA.png" },
              ].map((item) => (
                <div key={`${setIdx}-${item.name}`} className="flex items-center justify-center w-[180px] sm:w-[380px] h-14 sm:h-24 flex-shrink-0 mx-3 sm:mx-8">
                  <img src={item.logo} alt={item.name} className="max-h-full max-w-full object-contain" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Growth Stats */}
      <section className="py-14 sm:py-20 bg-[#FAFBF9]">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">REAL RESULTS FROM REAL USERS</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">Growth you can measure</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="text-center mb-8">
              <p className="text-5xl sm:text-7xl font-black text-[#059669]">+28%</p>
              <p className="text-base sm:text-lg font-bold text-[#1B4332] mt-2">Training volume increase in the first month</p>
              <p className="text-xs text-gray-400 mt-1">Total weight × reps</p>
            </div>
          </RevealSection>
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {[
              { value: "3.2x", label: "Avg. weekly frequency", sub: "Active users" },
              { value: "+23%", label: "Est. 1RM in 3 months", sub: "Compound lifts" },
              { value: "94%", label: "Completion rate", sub: "AI-planned routines" },
            ].map((stat, i) => (
              <RevealSection key={i}>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 text-center shadow-sm">
                  <p className="text-xl sm:text-3xl font-black text-[#1B4332] mb-1 whitespace-nowrap">{stat.value}</p>
                  <p className="text-[13px] font-bold text-gray-700 mb-1">{stat.label}</p>
                  <p className="text-[11px] text-gray-400">{stat.sub}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">AI-POWERED FITNESS</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">Sound familiar?</h2>
            </div>
          </RevealSection>
          <div className="space-y-14 sm:space-y-20">
            {FEATURES.map((f, i) => {
              const isReversed = i % 2 !== 0;
              return (
                <RevealSection key={i}>
                  <div className={`flex flex-col ${isReversed ? "sm:flex-row-reverse" : "sm:flex-row"} items-center gap-8 sm:gap-16`}>
                    <div className={`${f.priceCard ? "w-full max-w-[320px] sm:w-[360px]" : "w-full max-w-[280px] sm:w-[320px]"} shrink-0`}>
                      {f.priceCard ? (
                        <div className="flex items-stretch gap-3 sm:gap-4">
                          <div className="flex-1 rounded-2xl bg-white border border-gray-200 p-3 sm:p-5 text-center shadow-lg flex flex-col items-center justify-center">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                              <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/></svg>
                            </div>
                            <p className="text-xs text-gray-500 font-bold mb-1">Personal Trainer</p>
                            <p className="text-2xl sm:text-3xl font-black text-gray-800">$300</p>
                            <p className="text-[10px] text-gray-400 mt-1">per month</p>
                          </div>
                          <div className="flex-1 rounded-2xl bg-[#f0fdf4] p-3 sm:p-5 text-center shadow-lg border-2 border-[#059669] flex flex-col items-center justify-center">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d1fae5] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                              <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <p className="text-xs text-[#059669] font-bold mb-1">ohunjal AI</p>
                            <p className="text-2xl sm:text-3xl font-black text-[#1B4332]">$4.99</p>
                            <div className="mt-3 px-2 py-1 bg-[#059669] rounded-full inline-block">
                              <span className="text-xs font-bold text-white">Less than a coffee</span>
                            </div>
                          </div>
                        </div>
                      ) : f.video ? (
                        <div className="rounded-[32px] border-[5px] border-gray-200 bg-black shadow-xl overflow-hidden">
                          <video autoPlay loop muted playsInline className="w-full">
                            <source src={f.video} type="video/mp4" />
                          </video>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex-1 text-center sm:text-left sm:pl-22">
                      <p className="text-lg sm:text-4xl font-black text-red-400 mb-4 sm:mb-5 whitespace-nowrap">&ldquo;{f.pain}&rdquo;</p>
                      <h3 className="text-xl sm:text-3xl font-black text-[#1B4332] mb-2 sm:mb-3">{f.title}</h3>
                      <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-md mx-auto sm:mx-0 whitespace-pre-line">{f.desc}</p>
                    </div>
                  </div>
                </RevealSection>
              );
            })}
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

      {/* Trainer Profile */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">WHO MADE THIS</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">Built by a certified trainer who codes</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-8 sm:p-10 text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/30 mx-auto mb-4 shadow-lg">
                  <img src="/CEO.jpeg" alt="Jooyong Lim" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-1">Jooyong Lim</h3>
                <p className="text-sm sm:text-base text-white/70 font-medium">Certified Trainer (10 yrs) &middot; Developer</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {["NASM-CPT", "ACSM-CPT", "NSCA-FLC"].map((cert) => (
                    <span key={cert} className="px-3 py-1.5 bg-[#f0fdf4] text-[#059669] text-xs sm:text-sm font-bold rounded-full border border-[#d1fae5]">{cert}</span>
                  ))}
                </div>
                <p className="text-center text-sm sm:text-base text-gray-500 mb-6 leading-relaxed">
                  M.S. in Health &amp; Exercise Management<br />Korea National Sport University
                </p>
                <div className="bg-[#FAFBF9] rounded-2xl p-5 sm:p-6">
                  <p className="text-sm sm:text-base text-[#1B4332] font-medium leading-relaxed text-center italic">
                    &ldquo;Most fitness apps are built by engineers who read about exercise.
                    I built ohunjal from 10 years of real coaching experience,
                    writing every line of code myself.&rdquo;
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
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">4 steps to start</h2>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <RevealSection key={i}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#1B4332] text-white rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-4">{s.num}</div>
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
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">Less than a coffee for PT-level coaching</h2>
            </div>
          </RevealSection>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <RevealSection>
              <div className="p-6 sm:p-8 rounded-2xl border border-gray-200 bg-white">
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">Free</h3>
                <p className="text-sm text-gray-400 mb-6">Start with zero commitment</p>
                <p className="text-3xl sm:text-4xl font-black text-[#1B4332] mb-8">$0<span className="text-base font-medium text-gray-400">/mo</span></p>
                <ul className="space-y-3 text-sm text-gray-600 mb-8">
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>4 AI workout plans per day</li>
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Weight tracking</li>
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Workout history</li>
                </ul>
                <a href="/app" className="block text-center w-full py-3 rounded-xl border border-gray-200 text-[#1B4332] font-bold text-sm hover:bg-gray-50 transition-colors">Start Free</a>
              </div>
            </RevealSection>
            <RevealSection>
              <div className="p-6 sm:p-8 rounded-2xl border-2 border-[#059669] bg-[#f0fdf4] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#059669] text-white text-xs font-bold rounded-full">Early Bird</div>
                <h3 className="text-lg font-bold text-[#1B4332] mb-1">Premium</h3>
                <p className="text-sm text-gray-400 mb-6">Everything, unlimited</p>
                <div className="mb-8">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-lg text-gray-400 line-through">$9.99</span>
                    <span className="text-3xl sm:text-4xl font-black text-[#1B4332]">$4.99</span>
                    <span className="text-base font-medium text-gray-400">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-gray-600 mb-8">
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Unlimited AI workout plans</li>
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>AI session analysis reports</li>
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Growth predictions</li>
                  <li className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0"><path d="M4 9L7.5 12.5L14 6" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Weekly quests &amp; tier system</li>
                </ul>
                <a href="/app" className="block text-center w-full py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm hover:bg-[#143728] transition-colors">Start Premium</a>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#059669] mb-2">FAQ</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">Frequently asked questions</h2>
            </div>
          </RevealSection>
          <div>
            {FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
            {FAQS_MORE.map((f, i) => <FAQItem key={`m-${i}`} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <RevealSection>
            <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332] mb-4">Ready to stop guessing?</h2>
            <p className="text-base sm:text-lg text-gray-500 mb-8">Your first workout is free. No sign-up required.</p>
            <a href="/app" className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:shadow-[0_8px_40px_rgba(5,150,105,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
              Get today&apos;s workout free
            </a>
          </RevealSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-gray-400" style={{ background: "linear-gradient(to bottom, #ffffff 0%, #1B4332 10%, #143728 40%, #0f2a1f 75%, #0a1a14 100%)" }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src="/favicon.png" alt="ohunjal AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#10B981] text-lg">ohunjal AI</span>
          </div>
          <div className="flex items-center justify-center gap-4 mb-6 text-sm">
            <a href="/terms" className="text-gray-400 hover:text-gray-300 transition-colors underline underline-offset-2">Terms</a>
            <span className="text-gray-600">|</span>
            <a href="/privacy" className="text-gray-400 hover:text-gray-300 transition-colors underline underline-offset-2">Privacy</a>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">&copy; 2026 ohunjal AI. All rights reserved.</p>
            <p className="text-[10px] text-gray-600 leading-relaxed max-w-lg mx-auto">
              This service is not medical advice and does not replace professional medical consultation.
              Exercise carries risk of injury. Consult a doctor if you have underlying health conditions.
              AI recommendations are for reference only. Results may vary.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
