"use client";

/**
 * 디버그 프리뷰 — 중도 종료 UI 3종 한 화면 미리보기 (회의 64-M3).
 * URL: /debug/abandon-preview
 * 실제 운동 없이 팝업·배지·아이콘 확인용. 프로덕션 노출 OK (인증 불필요).
 */

import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

const QUOTE_IDS = ["ali", "goggins", "kipchoge"] as const;

export default function AbandonPreviewPage() {
  const { t, locale, setLocale } = useTranslation();
  const [done, setDone] = useState(3);
  const [remaining, setRemaining] = useState(5);
  const [quoteIdx, setQuoteIdx] = useState(new Date().getDate() % 3);
  const quoteId = QUOTE_IDS[quoteIdx];

  const quoteText =
    locale === "ko"
      ? t("fit.abandon.quote", { remaining: String(remaining) })
      : t(`fit.abandon.quote.${quoteId}`);
  const quoteAuthor =
    locale === "ko"
      ? t("fit.abandon.quoteAuthor")
      : t(`fit.abandon.quote.${quoteId}Author`);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-black text-[#1B4332]">중도 종료 UI 프리뷰</h1>
        <p className="text-xs text-gray-500 mt-1">회의 64-M3 · 실제 운동 없이 확인용 · /debug/abandon-preview</p>
      </header>

      {/* 컨트롤 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 w-16">언어</span>
          <button onClick={() => setLocale("ko")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${locale === "ko" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"}`}>KO</button>
          <button onClick={() => setLocale("en")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${locale === "en" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"}`}>EN</button>
        </div>

        {locale === "en" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 w-16">인용</span>
            {QUOTE_IDS.map((q, i) => (
              <button key={q} onClick={() => setQuoteIdx(i)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${quoteIdx === i ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"}`}>{q}</button>
            ))}
            <span className="text-[10px] text-gray-400 ml-2">오늘 자동 선택: {QUOTE_IDS[new Date().getDate() % 3]}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 w-16">완료</span>
          <input type="number" value={done} onChange={(e) => setDone(parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-xs" />
          <span className="text-xs text-gray-400">세트</span>
          <span className="text-xs font-bold text-gray-500 ml-4">남은</span>
          <input type="number" value={remaining} onChange={(e) => setRemaining(parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-xs" />
          <span className="text-xs text-gray-400">운동</span>
        </div>
      </section>

      {/* 1. 팝업 */}
      <section>
        <h2 className="text-sm font-black text-gray-700 mb-3 uppercase tracking-widest">1. 중도 종료 팝업</h2>
        <div className="bg-black/50 rounded-3xl p-6 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#1B4332] mb-4 text-center">{t("fit.abandon.title")}</h3>
            <div className="bg-[#F0F4F1] rounded-2xl p-4 mb-4">
              <p className="text-[15px] font-bold text-[#1B4332] whitespace-pre-line text-center leading-relaxed">{quoteText}</p>
              <p className="text-xs text-gray-500 text-center mt-2">{quoteAuthor}</p>
            </div>
            <p className="text-sm text-gray-700 text-center mb-1">{t("fit.abandon.progress", { done: String(done), remaining: String(remaining) })}</p>
            <p className="text-xs text-gray-400 text-center mb-5">{t("fit.abandon.warning")}</p>
            <div className="flex gap-2">
              <button className="flex-1 py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm">{t("fit.abandon.continue")}</button>
              <button className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm">{t("fit.abandon.endNow")}</button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Report 배지 */}
      <section>
        <h2 className="text-sm font-black text-gray-700 mb-3 uppercase tracking-widest">2. WorkoutReport 상단 배지</h2>
        <div className="bg-[#FAFAFA] rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-amber-50 border border-amber-200 w-fit mx-auto">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
            </svg>
            <span className="text-[11px] font-bold text-amber-700 tracking-wide">{t("report.abandonedBadge")}</span>
          </div>
          <p className="text-center text-xs text-gray-400">(실제 리포트 최상단에 이 배지가 추가됩니다)</p>
        </div>
      </section>

      {/* 3. MyPlans 아이콘 */}
      <section>
        <h2 className="text-sm font-black text-gray-700 mb-3 uppercase tracking-widest">3. MyPlansScreen 세션 아이콘</h2>
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
          {[
            { label: "완료", icon: "check", bg: "bg-[#2D6A4F] text-white", note: "정상 완주 (기존)", desc: "#1 Week 1 · Base Day" },
            { label: "중도 종료", icon: "caution", bg: "bg-amber-100 text-amber-700 border border-amber-300", note: "신규 (abandoned=true)", desc: "#3 Week 1 · Base Day" },
            { label: "다음 세션", icon: "number", bg: "border-2 border-[#2D6A4F] text-[#2D6A4F]", note: "다음 진행할 것", desc: "#5 Week 2 · Tempo", value: "5" },
            { label: "미완료", icon: "number", bg: "bg-gray-100 text-gray-400", note: "미래 세션", desc: "#7 Week 2 · Easy", value: "7" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${r.bg}`}>
                {r.icon === "check" && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {r.icon === "caution" && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                  </svg>
                )}
                {r.icon === "number" && r.value}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-[#1B4332]">{r.desc}</p>
                <p className="text-[10px] text-gray-400">{r.note}</p>
              </div>
              <span className="text-[10px] font-bold text-gray-500">{r.label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-[10px] text-gray-400 text-center pt-4">
        회의 64-M3 Phase 1 미리보기 · 실제 운동에서 테스트는 /app 에서
      </footer>
    </div>
  );
}
