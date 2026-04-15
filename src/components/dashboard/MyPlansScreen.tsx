"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { SavedPlan, deletePlan, getSavedPlans, remoteDeletePlan, syncSavedPlansFromServer } from "@/utils/savedPlans";

interface MyPlansScreenProps {
  onBack: () => void;
  onSelectPlan: (plan: SavedPlan) => void;
}

export const MyPlansScreen: React.FC<MyPlansScreenProps> = ({ onBack, onSelectPlan }) => {
  const { t, locale } = useTranslation();
  const [plans, setPlans] = useState<SavedPlan[]>(() => getSavedPlans());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 마운트 시 서버 SSOT 동기화 (로그인 유저만 효과)
  useEffect(() => {
    let cancelled = false;
    syncSavedPlansFromServer().then((fresh) => {
      if (!cancelled) setPlans(fresh);
    });
    return () => { cancelled = true; };
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return locale === "ko"
      ? `${d.getMonth() + 1}월 ${d.getDate()}일`
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDelete = async (id: string) => {
    await remoteDeletePlan(id);
    deletePlan(id);
    setPlans(getSavedPlans());
    setConfirmDeleteId(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFBF9]">
      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 bg-[#FAFBF9] border-b border-gray-200"
        style={{ paddingTop: "calc(var(--safe-area-top, 0px) + 12px)" }}
      >
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 active:text-gray-900">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">
          {t("my_plans.title")}
        </span>
        <div className="w-8" />
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 scrollbar-hide">
        {plans.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <p className="text-sm font-black text-gray-700 mb-1">{t("my_plans.empty")}</p>
            <p className="text-xs text-gray-500">{t("my_plans.empty_desc")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-8">
            {plans.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-2xl border-2 border-gray-200 bg-white p-4 active:scale-[0.99] transition-transform"
              >
                <button onClick={() => onSelectPlan(p)} className="w-full text-left">
                  <h3 className="text-base font-black text-[#1B4332] mb-1 truncate pr-8">{p.name}</h3>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-1">{p.sessionData.description}</p>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-gray-500">
                    <span>{p.sessionData.exercises.filter(e => e.type !== "warmup").length} 운동</span>
                    <span className="w-px h-3 bg-gray-300" />
                    <span>
                      {p.useCount > 0
                        ? t("my_plans.use_count", { n: String(p.useCount) })
                        : t("my_plans.never_used")}
                    </span>
                    <span className="w-px h-3 bg-gray-300" />
                    <span>{formatDate(p.createdAt)}</span>
                  </div>
                </button>
                <button
                  onClick={() => setConfirmDeleteId(p.id)}
                  className="absolute top-3 right-3 p-1.5 text-gray-300 active:text-red-500"
                  aria-label={t("my_plans.delete")}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V3a1 1 0 011-1h4a1 1 0 011 1v4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 삭제 확인 */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-8" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-black text-[#1B4332] mb-4 text-center">
              {plans.find(p => p.id === confirmDeleteId)?.name}
            </p>
            <p className="text-xs text-gray-500 text-center mb-5">정말 삭제할까요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-black text-sm"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white font-black text-sm"
              >
                {t("my_plans.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
