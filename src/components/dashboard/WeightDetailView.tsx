"use client";

import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb, lbToKg } from "@/utils/units";
import { UnitToggle } from "../UnitToggle";
import { updateWeightLog } from "@/utils/userProfile";

interface WeightDetailViewProps {
  weightLog: { date: string; weight: number }[];
  onWeightLogChange: (updated: { date: string; weight: number }[]) => void;
  onBack: () => void;
}

export const WeightDetailView: React.FC<WeightDetailViewProps> = ({
  weightLog,
  onWeightLogChange,
  onBack,
}) => {
  const { t, locale } = useTranslation();
  const { system: unitSystem } = useUnits();
  const isImperial = unitSystem === "imperial";

  // All weight-detail-specific state lives here (moved from ProofTab)
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeightDate, setNewWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newWeightValue, setNewWeightValue] = useState("");
  const [weightSelectMode, setWeightSelectMode] = useState(false);
  const [selectedWeightIdxs, setSelectedWeightIdxs] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const sortedLog = [...weightLog].sort((a, b) => b.date.localeCompare(a.date));

  const toggleWeightSelect = (idx: number) => {
    setSelectedWeightIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedWeightIdxs.size === sortedLog.length) {
      setSelectedWeightIdxs(new Set());
    } else {
      setSelectedWeightIdxs(new Set(sortedLog.map((_, i) => i)));
    }
  };

  const handleBulkDelete = () => {
    const updated = sortedLog.filter((_, i) => !selectedWeightIdxs.has(i));
    onWeightLogChange(updated);
    updateWeightLog(updated);
    setSelectedWeightIdxs(new Set());
    setWeightSelectMode(false);
    setShowBulkDeleteConfirm(false);
  };

  const exitSelectMode = () => {
    setWeightSelectMode(false);
    setSelectedWeightIdxs(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const handleAddWeight = () => {
    const parsedRaw = parseFloat(newWeightValue);
    if (isNaN(parsedRaw) || parsedRaw <= 0 || !newWeightDate) return;
    // 단위 토글 (회의 2026-04-28-γ): 저장은 항상 kg. lb 입력 시 환산.
    const parsed = isImperial ? Math.round(lbToKg(parsedRaw) * 10) / 10 : parsedRaw;
    const existing = weightLog.findIndex(e => e.date === newWeightDate);
    let updated: { date: string; weight: number }[];
    if (existing >= 0) {
      updated = weightLog.map((e, i) => i === existing ? { ...e, weight: parsed } : e);
    } else {
      updated = [...weightLog, { date: newWeightDate, weight: parsed }];
    }
    onWeightLogChange(updated);
    updateWeightLog(updated);
    setShowAddWeight(false);
    setNewWeightValue("");
    setNewWeightDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
      {/* Header */}
      <div className="pt-[max(3rem,env(safe-area-inset-top))] pb-3 sm:pb-4 px-4 sm:px-6 flex items-center justify-between bg-[#FAFBF9] z-10 shrink-0">
        <button
          onClick={weightSelectMode ? exitSelectMode : onBack}
          className="p-2 -ml-2"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg sm:text-xl font-serif font-medium text-[#1B4332] uppercase tracking-wide">{t("proof.weightLog")}</h1>
        {sortedLog.length > 0 ? (
          <button
            onClick={() => weightSelectMode ? exitSelectMode() : setWeightSelectMode(true)}
            className="text-sm font-bold text-[#2D6A4F] active:opacity-60"
          >
            {weightSelectMode ? t("common.complete") : t("common.edit")}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Select All bar (edit mode) */}
      {weightSelectMode && sortedLog.length > 0 && (
        <div className="px-6 pb-3 flex items-center justify-between shrink-0">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-sm font-bold text-gray-600 active:opacity-60"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedWeightIdxs.size === sortedLog.length ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
            }`}>
              {selectedWeightIdxs.size === sortedLog.length && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {t("proof.selectAll")}
          </button>
          {selectedWeightIdxs.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="text-sm font-bold text-red-500 active:opacity-60"
            >
              {t("proof.deleteN", { count: String(selectedWeightIdxs.size) })}
            </button>
          )}
        </div>
      )}

      {/* Weight List */}
      <div
        className="flex-1 px-4 sm:px-6 overflow-y-auto scrollbar-hide"
        style={{ paddingBottom: "calc(128px + var(--safe-area-bottom, 0px))", overscrollBehavior: "contain" }}
        onTouchMove={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop === 0) e.preventDefault();
        }}
      >
        {sortedLog.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p>{t("proof.noWeightRecords")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedLog.map((entry, idx) => {
              const dateObj = new Date(entry.date + "T00:00:00");
              const dateLabel = dateObj.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
              const prevEntry = sortedLog[idx + 1];
              const diff = prevEntry ? entry.weight - prevEntry.weight : null;

              return (
                <div key={entry.date} className="relative flex items-stretch gap-3">
                  {weightSelectMode && (
                    <button
                      onClick={() => toggleWeightSelect(idx)}
                      className="flex items-center shrink-0 pt-5"
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedWeightIdxs.has(idx) ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
                      }`}>
                        {selectedWeightIdxs.has(idx) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )}

                  <div
                    className="flex-1 bg-gray-50 p-5 rounded-2xl border border-gray-100 transition-colors"
                    onClick={weightSelectMode ? () => toggleWeightSelect(idx) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-400">{dateLabel}</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-black text-[#1B4332]">{(isImperial ? kgToLb(entry.weight) : entry.weight).toFixed(1)}</span>
                        <span className="text-xs text-gray-400">{isImperial ? "lb" : "kg"}</span>
                        {diff !== null && diff !== 0 && (
                          <span className={`text-[10px] font-black ml-1 ${diff > 0 ? "text-rose-400" : "text-sky-400"}`}>
                            {diff > 0 ? "+" : ""}{(isImperial ? kgToLb(diff) : diff).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Weight FAB */}
      {!weightSelectMode && !showAddWeight && (
        <button
          onClick={() => setShowAddWeight(true)}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[#1B4332] text-white shadow-lg flex items-center justify-center active:scale-95 transition-all z-30"
          style={{ marginBottom: "var(--safe-area-bottom, 0px)" }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {showBulkDeleteConfirm && selectedWeightIdxs.size > 0 && (
        <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center animate-fade-in px-8">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-[#1B4332] mb-2">{t("proof.deleteRecords")}</h3>
            <p className="text-sm text-gray-500 mb-6">
              {t("proof.deleteWeightConfirm", { count: String(selectedWeightIdxs.size) })}<br/>{t("proof.deleteIrreversible")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
              >
                {t("proof.cancel")}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-all"
              >
                {t("proof.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Weight Bottom Sheet */}
      {showAddWeight && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setShowAddWeight(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 animate-slide-up shadow-2xl" style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 24px)" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-[#1B4332]">{t("proof.addWeightRecord")}</h3>
              <UnitToggle metric="kg" imperial="lb" className="" />
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{t("proof.date")}</label>
                <input
                  type="date"
                  value={newWeightDate}
                  onChange={e => setNewWeightDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-[#1B4332] focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                  {isImperial ? t("proof.weightLb") : t("proof.weightKg")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={isImperial ? "165.3" : "75.0"}
                  value={newWeightValue}
                  onChange={e => setNewWeightValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-[#1B4332] focus:outline-none focus:border-[#2D6A4F]"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleAddWeight(); }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddWeight(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all"
              >
                {t("proof.cancel")}
              </button>
              <button
                onClick={handleAddWeight}
                disabled={!newWeightValue || parseFloat(newWeightValue) <= 0}
                className="flex-1 py-3 rounded-xl bg-[#1B4332] text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
              >
                {t("proof.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
