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
    pain: "痩せたいけど、何をすればいいか分からない...",
    title: "ダイエットに最適なワークアウトプラン",
    desc: "目標を選ぶだけで、有酸素と筋トレの\nバランスをAIが自動で組みます。\n毎日のコンディションに合わせて調整\n無理なく続けられます。",
    video: "/hero.mp4",
  },
  {
    pain: "パーソナルトレーナーは月8万円...",
    title: "月額¥690で毎日AIコーチング",
    desc: "10年の実績を持つ認定トレーナーが設計したAIが\n毎日あなただけのメニューを作ります。\nパーソナルトレーナー月8万円、\nohunjalはコーヒー1杯分。",
    video: "",
    priceCard: true,
  },
  {
    pain: "毎日メニューを考えるのが面倒",
    title: "AIが毎日のメニューを自動作成",
    desc: "昨日は上半身？今日は下半身。\n疲れている日は軽めに。\nAIが全て自動で調整します。\nメニューを考える時間はゼロ。",
    video: "/is-it-right.mp4",
  },
  {
    pain: "一人でやって、本当に合ってるのかな...",
    title: "トレーナーなしでも安心のAIコーチング",
    desc: "セットごとに自動記録。\n次の重量とレップ数はAIが提案。\nパーソナルトレーニングのように\n体系的にトレーニングできます。",
    video: "/easy-to-use.mp4",
  },
];

const COMPACT_FEATURES = [
  {
    title: "ゲーム感覚で運動習慣を作る",
    desc: "クエストをクリアして経験値を貯め、ティアを上げよう",
  },
  {
    title: "AIがあなたの成長を予測",
    desc: "トレーニングデータを分析し、体重や筋力の変化を予測します",
  },
];

const STEPS = [
  { num: "01", title: "体調を選ぶ", desc: "上半身が硬い？脚が重い？タップ1つで完了" },
  { num: "02", title: "目標を選ぶ", desc: "ダイエット？筋肉？体力？タップ1つでOK" },
  { num: "03", title: "AIがプランを作成", desc: "3秒であなただけのメニューが完成" },
  { num: "04", title: "トレーニング＆記録", desc: "ガイドに沿って運動、自動記録、結果をシェア" },
];

const FAQS = [
  { q: "無料で使えますか？", a: "はい。登録なしで1回体験できます。アカウント作成で1日4回まで無料です。" },
  { q: "ジム初心者でも大丈夫ですか？", a: "もちろんです。AIがあなたの体力に合わせてメニューを組むので、何をすればいいか悩む必要はありません。" },
  { q: "他のワークアウトアプリと何が違いますか？", a: "他のアプリは自分でエクササイズを選ぶ必要があります。ohunjalはコンディションを選ぶだけでAIが全て自動で組みます。" },
  { q: "ダイエットに効果がありますか？", a: "はい。ダイエット目標を選ぶと、有酸素と筋トレのバランスを取ったルーティンをAIが毎日作成します。" },
  { q: "自宅トレーニングもできますか？", a: "はい。自重トレーニングやダンベルメニューなど、ジムなしでできるプランをAIが作ります。" },
  { q: "アプリのインストールは必要ですか？", a: "いいえ。ブラウザでそのまま使えます。ホーム画面に追加すればアプリのように使えます。" },
  { q: "ランニングプログラムもありますか？", a: "はい。インターバル、LSD、イージーラン、坂道トレーニングに対応しています。" },
  { q: "解約は簡単ですか？", a: "プロフィールからワンタップで解約できます。解約後も請求期間の終わりまでご利用いただけます。" },
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

export default function JaLandingPage() {
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
                onChange={(e) => { if (e.target.value !== "/ja") window.location.href = e.target.value; }}
                defaultValue="/ja"
                className="bg-transparent text-white/70 text-sm font-medium border border-white/20 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value="/" className="text-gray-800">🇰🇷 한국어</option>
                <option value="/en" className="text-gray-800">🇺🇸 English</option>
                <option value="/ja" className="text-gray-800">🇯🇵 日本語</option>
                <option value="/zh" className="text-gray-800">🇨🇳 中文</option>
              </select>
              <a href="/app" className="px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors">始める</a>
            </div>
          </div>
        </nav>

        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]" style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)", animation: "hero-orb-1 12s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#FAFBF9] via-[#FAFBF9]/60 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-24 pb-24 sm:pb-32 text-center">
          <RevealSection>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0s_forwards]">痩せたいけど、</span><br />
              <span className="text-white opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.3s_forwards]">トレーナーは高いし、</span><br />
              <span className="text-[#34d399] text-xl sm:text-5xl lg:text-6xl opacity-0 animate-[fadeSlideUp_0.5s_ease-out_0.6s_forwards]">一人だと何をすればいいか分からない。</span>
            </h1>
            <p className="mt-6 text-sm sm:text-lg text-white font-medium tracking-wide opacity-0 animate-[fadeSlideUp_0.5s_ease-out_1.2s_forwards]">
              コンディションを選ぶだけ。AIが3秒で今日のメニューを作ります。
            </p>
            <div className="mt-10">
              <a href="/app" className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                今日のメニューを無料で受け取る
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
              <p className="text-sm font-bold text-[#059669] mb-2">こんな方におすすめ</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">ohunjal AIを使っている方々</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="space-y-4">
              {[
                "ダイエットのために運動を始めた方",
                "パーソナルトレーナーの費用が負担な方",
                "自宅で一人でメニューを組むのが面倒な方",
                "計画的に走りたいランナー",
                "ジムで何をすればいいか分からない初心者",
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
              <p className="text-sm font-bold text-[#059669] mb-2">AI パーソナルフィットネス</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">こんな悩み、ありませんか？</h2>
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
                            <p className="text-xs text-gray-500 font-bold mb-1">パーソナル (1回)</p>
                            <p className="text-2xl sm:text-3xl font-black text-gray-800">¥8,000</p>
                            <p className="text-[10px] text-gray-400 mt-1">月8回で6.4万円</p>
                          </div>
                          <div className="flex-1 rounded-2xl bg-[#f0fdf4] p-3 sm:p-5 text-center shadow-lg border-2 border-[#059669] flex flex-col items-center justify-center">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d1fae5] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                              <svg width="24" height="24" viewBox="0 0 20 20" fill="none"><path d="M4 10L8.5 14.5L16 6" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                            <p className="text-xs text-[#059669] font-bold mb-1">ohunjal AI (月額)</p>
                            <p className="text-2xl sm:text-3xl font-black text-[#1B4332]">¥690</p>
                            <div className="mt-3 px-2 py-1 bg-[#059669] rounded-full inline-block">
                              <span className="text-xs font-bold text-white">コーヒー1杯分</span>
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

      {/* Trainer Profile */}
      <section className="py-16 sm:py-24 bg-[#FAFBF9]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-[#059669] mb-2">開発者について</p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332]">開発者ではなく、トレーナーが作りました</h2>
            </div>
          </RevealSection>
          <RevealSection>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-8 sm:p-10 text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/30 mx-auto mb-4 shadow-lg">
                  <img src="/CEO.jpeg" alt="Jooyong Lim" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-1">Jooyong Lim</h3>
                <p className="text-sm sm:text-base text-white/70 font-medium">認定トレーナー (10年) &middot; 開発者</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {["NASM-CPT", "ACSM-CPT", "NSCA-FLC"].map((cert) => (
                    <span key={cert} className="px-3 py-1.5 bg-[#f0fdf4] text-[#059669] text-xs sm:text-sm font-bold rounded-full border border-[#d1fae5]">{cert}</span>
                  ))}
                </div>
                <p className="text-center text-sm sm:text-base text-gray-500 mb-6 leading-relaxed">
                  韓国体育大学大学院 健康運動管理学 修士
                </p>
                <div className="bg-[#FAFBF9] rounded-2xl p-5 sm:p-6">
                  <p className="text-sm sm:text-base text-[#1B4332] font-medium leading-relaxed text-center italic">
                    &ldquo;多くのフィットネスアプリはエンジニアが作ります。ohunjalは10年の指導経験を持つトレーナーが、一行一行自分でコードを書いて作りました。&rdquo;
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
              <p className="text-sm font-bold text-[#059669] mb-2">使い方</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1B4332]">4ステップで始めよう</h2>
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
              <p className="text-sm font-bold text-[#059669] mb-2">よくある質問</p>
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
            <h2 className="text-2xl sm:text-4xl font-black text-[#1B4332] mb-4">もう迷わなくていい</h2>
            <p className="text-base sm:text-lg text-gray-500 mb-8">最初のワークアウトは無料。登録不要です。</p>
            <a href="/app" className="inline-block px-10 py-4 bg-[#059669] text-white font-bold text-base rounded-2xl shadow-[0_4px_24px_rgba(5,150,105,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
              今日のメニューを無料で受け取る
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
              本サービスは医療行為ではなく、専門的な医療相談に代わるものではありません。
              運動には怪我のリスクがあります。持病がある場合は医師にご相談ください。
              AIの推奨は参考情報であり、結果には個人差があります。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
