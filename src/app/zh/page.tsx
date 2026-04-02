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
    pain: "想减肥，但不知道该做什么运动...",
    title: "减脂专属训练计划",
    desc: "选择你的目标，AI自动搭配有氧和力量训练。\n每天根据身体状态自动调整，\n不勉强，不过度，\n轻松坚持下去。",
    video: "/hero.mp4",
  },
  {
    pain: "私教一个月要2000多块...",
    title: "每月¥35，每天AI教练指导",
    desc: "由10年经验的认证教练设计的AI\n每天为你定制专属训练。\n私教每月2000+，\nohunjal只需一杯咖啡的价格。",
    video: "",
    priceCard: true,
  },
  {
    pain: "每天想练什么太费脑了",
    title: "AI每天自动生成训练计划",
    desc: "昨天练了上半身？今天练下半身。\n状态不好？安排轻松训练。\nAI全自动平衡调整，\n不用花一秒钟想计划。",
    video: "/is-it-right.mp4",
  },
  {
    pain: "自己练，真的练对了吗...",
    title: "没有私教也能科学训练",
    desc: "每组自动记录，\nAI推荐下一组重量和次数。\n像有私教一样系统训练，\n但不用付私教的钱。",
    video: "/easy-to-use.mp4",
  },
];

const COMPACT_FEATURES = [
  {
    title: "像打游戏一样养成运动习惯",
    desc: "完成任务获得经验值，提升等级",
  },
  {
    title: "AI预测你的身体变化",
    desc: "分析训练数据，预测体重、力量的变化趋势",
  },
];

const STEPS = [
  { num: "01", title: "选择身体状态", desc: "上半身僵硬？腿很沉？点一下就行" },
  { num: "02", title: "选择目标", desc: "减脂？增肌？体能？点一下搞定" },
  { num: "03", title: "AI生成计划", desc: "3秒钟，你的专属训练就出来了" },
  { num: "04", title: "训练并记录", desc: "跟着练，自动记录每一组，分享成果" },
];

const FAQS = [
  { q: "真的免费吗？", a: "是的。不用注册就能体验1次。创建账号后每天可免费使用4次AI训练计划。" },
  { q: "健身小白也能用吗？", a: "当然可以。AI会根据你的体能水平定制计划，完全不用自己想该练什么。" },
  { q: "和其他健身App有什么不同？", a: "其他App需要自己选动作。ohunjal只需选择身体状态，AI全自动搭配。" },
  { q: "能帮助减肥吗？", a: "可以。选择减脂目标后，AI每天搭配有氧和力量训练的平衡计划。" },
  { q: "可以在家练吗？", a: "可以。居家训练模式包含徒手和哑铃动作，不需要去健身房。" },
  { q: "需要安装App吗？", a: "不需要。浏览器直接用。添加到主屏幕就像原生App一样。" },
  { q: "有跑步训练吗？", a: "有。支持间歇跑、长距离(LSD)、轻松跑和坡道训练。" },
  { q: "取消订阅方便吗？", a: "在个人页面一键取消。取消后仍可使用到当期结束。" },
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

export default function ZhLandingPage() {
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
                onChange={(e) => { if (e.target.value !== "/zh") window.location.href = e.target.value; }}
                defaultValue="/zh"
                className="bg-transparent text-white/70 text-sm font-medium border border-white/20 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="/" className="text-gray-800">🇰🇷 한국어</option>
                <option value="/en" className="text-gray-800">🇺🇸 English</option>
                <option value="/ja" className="text-gray-800">🇯🇵 日本語</option>
                <option value="/zh" className="text-gray-800">🇨🇳 中文</option>
              </select>
              <a href="/app" className="px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors">开始使用</a>
            </div>
          </div>
        </nav>

        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]" style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)", animation: "hero-orb-1 12s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9]/60 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-24 pb-24 sm:pb-32 text-center">
          <RevealSection>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0s_forwards]">想减肥，</span><br />
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.3s_forwards]">私教太贵，</span><br />
              <span className="text-[#34d399] text-xl sm:text-5xl lg:text-6xl opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.6s_forwards]">自己练又不知道该做什么。</span>
            </h1>
            <p className="mt-6 text-sm sm:text-lg text-white font-medium tracking-wide opacity-0 animate-[fadeSlideUp_0.5s_ease-out_1.2s_forwards]">
              选择你的状态，AI 3秒生成今天的训练计划。
            </p>
            <div className="mt-10">
              <a href="/app" className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                免费获取今日训练
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 text-xs sm:text-sm text-white/50">
              <div className="flex items-center gap-1.5"><span>Backed by</span><img src="/google-cloud-logo.png" alt="Google Cloud" className="h-6 sm:h-8 inline-block" /></div>
              <span className="text-white/20">|</span>
              <div className="flex items-center gap-2"><span>Powered by</span><img src="/gemini_logo.png" alt="Gemini" className="h-8 sm:h-9 inline-block" /></div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">适合所有人</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">谁在使用 ohunjal AI？</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="space-y-4">
              {[
                "想通过运动减肥的人",
                "觉得私教太贵的自律健身者",
                "在家不想费心安排训练的人",
                "想系统化训练的跑者",
                "走进健身房不知所措的小白",
              ].map((text, i) => (
                <div key={i} className="px-5 py-4 rounded-2xl bg-[#f0fdf4] border border-[#d1fae5] text-center">
                  <span className="text-base sm:text-lg font-bold text-[#1B4332]">{text}</span>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">AI 智能健身</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">这些烦恼，你有吗？</h2>
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
                            <p className="text-xs text-gray-500 font-bold mb-1">私教 (每月)</p>
                            <p className="text-2xl sm:text-3xl font-black text-gray-800">¥2000+</p>
                            <p className="text-[10px] text-gray-400 mt-1">按次收费更贵</p>
                          </div>
                          <div className="flex-1 rounded-2xl bg-[#f0fdf4] p-3 sm:p-5 text-center shadow-lg border-2 border-[#059669] flex flex-col items-center justify-center">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d1fae5] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                              <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <p className="text-xs text-[#059669] font-bold mb-1">ohunjal AI</p>
                            <p className="text-2xl sm:text-3xl font-black text-[#1B4332]">¥35</p>
                            <div className="mt-3 px-2 py-1 bg-[#059669] rounded-full inline-block">
                              <span className="text-xs font-bold text-white">一杯咖啡的价格</span>
                            </div>
                          </div>
                        </div>
                      ) : f.video ? (
                        <div className="rounded-[32px] border-[5px] border-gray-200 bg-black shadow-xl overflow-hidden">
                          <video autoPlay loop muted playsInline className="w-full"><source src={f.video} type="video/mp4" /></video>
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
          </div>
        </div>
      </section>

      {/* Trainer */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">关于创始人</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">不是程序员做的，是教练自己写的代码</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-8 sm:p-10 text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/30 mx-auto mb-4 shadow-lg">
                  <img src="/CEO.jpeg" alt="Jooyong Lim" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-1">Jooyong Lim</h3>
                <p className="text-sm sm:text-base text-white/70 font-medium">认证教练 (10年) &middot; 开发者</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {["NASM-CPT", "ACSM-CPT", "NSCA-FLC"].map((cert) => (
                    <span key={cert} className="px-3 py-1.5 bg-[#f0fdf4] text-[#059669] text-xs sm:text-sm font-bold rounded-full border border-[#d1fae5]">{cert}</span>
                  ))}
                </div>
                <p className="text-center text-sm sm:text-base text-gray-500 mb-6 leading-relaxed">
                  韩国体育大学研究生院 健康运动管理学 硕士
                </p>
                <div className="bg-[#FAFBF9] rounded-2xl p-5 sm:p-6">
                  <p className="text-sm sm:text-base text-[#1B4332] font-medium leading-relaxed text-center italic">
                    &ldquo;大多数健身App是程序员做的。ohunjal是一个有10年实战经验的教练，自己一行一行写代码做出来的。&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-[#059669] mb-2">使用方法</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">4步开始</h2>
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

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-12">
              <p className="text-sm font-bold text-[#059669] mb-2">常见问题</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">FAQ</h2>
            </div>
          </RevealSection>
          <div>{FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}</div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <RevealSection>
            <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332] mb-4">别再纠结了</h2>
            <p className="text-base sm:text-lg text-gray-500 mb-8">第一次训练免费，无需注册。</p>
            <a href="/app" className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
              免费获取今日训练
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
          <div className="space-y-1">
            <p className="text-xs text-gray-500">&copy; 2026 ohunjal AI. All rights reserved.</p>
            <p className="text-[10px] text-gray-600 leading-relaxed max-w-lg mx-auto">
              本服务不属于医疗行为，不能替代专业医疗咨询。
              运动存在受伤风险，有基础疾病请先咨询医生。
              AI建议仅供参考，效果因人而异。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
