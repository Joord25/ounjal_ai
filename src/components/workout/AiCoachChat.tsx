"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { kgToLb } from "@/utils/units";
import { getExerciseName } from "@/utils/exerciseName";

interface SessionRecord {
  weights: number[];
  reps: number[];
  maxWeight: number;
  hadEasy: boolean;
  date: string;
}

interface AiCoachChatProps {
  record: SessionRecord | null;
  exerciseName?: string;
  gender?: "male" | "female";
  onClose: () => void;
}

function buildAdvice(record: SessionRecord, gender: "male" | "female" = "male", t: (key: string, vars?: Record<string, string>) => string): string {
  const { weights, reps, hadEasy, maxWeight } = record;
  const step = gender === "female" ? 2.5 : 5;
  const allSameWeight = weights.every(w => w === weights[0]);
  const avgReps = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);
  const repsDecreasing = reps.length >= 2 && reps[reps.length - 1] < reps[0] - 2;
  let nextWeight = Math.round(maxWeight * 1.05 / step) * step;
  if (nextWeight <= maxWeight) nextWeight = maxWeight + step;

  if (hadEasy && allSameWeight) {
    return t("coach.advice.allSame", { sets: String(weights.length), weight: String(weights[0]), next: String(nextWeight) });
  }
  if (hadEasy && !allSameWeight) {
    return t("coach.advice.mixed", { max: String(maxWeight), next: String(nextWeight) });
  }
  if (!hadEasy && repsDecreasing) {
    const lowerWeight = Math.round((weights[0] * 0.9) / step) * step;
    return t("coach.advice.decreasing", { lower: String(lowerWeight) });
  }
  if (!hadEasy && allSameWeight) {
    return t("coach.advice.maintain", { weight: String(weights[0]), reps: String(avgReps + 2) });
  }
  return t("coach.advice.default");
}

export const AiCoachChat: React.FC<AiCoachChatProps> = ({ record, exerciseName, gender, onClose }) => {
  const { t, locale } = useTranslation();
  const { system: unitSystem, labels: unitLabels } = useUnits();
  const toDispW = (kg: number) => unitSystem === "imperial" ? Math.round(kgToLb(kg) * 10) / 10 : kg;
  const hasRecord = !!record;
  const sets = record ? record.weights.map((w, i) => ({ weight: w, reps: record.reps[i] ?? 0 })) : [];
  const displayName = exerciseName ? getExerciseName(exerciseName, locale) : "";

  const messages: string[] = hasRecord
    ? [buildAdvice(record, gender, t)]
    : [t("coach.noRecord1"), t("coach.noRecord2")];

  const [phase, setPhase] = useState<"loading" | "record" | "typing" | "done">("loading");
  const [msgIdx, setMsgIdx] = useState(0);
  const [typedMsgs, setTypedMsgs] = useState<string[]>([]);
  const [currentTyped, setCurrentTyped] = useState("");
  const charIdx = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setPhase("record"), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "record") return;
    const timer = setTimeout(() => setPhase("typing"), 800);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "typing") return;
    const msg = messages[msgIdx];
    if (!msg) { setPhase("done"); return; }
    if (charIdx.current >= msg.length) {
      setTypedMsgs(prev => [...prev, msg]);
      setCurrentTyped("");
      charIdx.current = 0;
      if (msgIdx + 1 >= messages.length) {
        setPhase("done");
      } else {
        setMsgIdx(i => i + 1);
        setPhase("record");
      }
      return;
    }
    const timer = setTimeout(() => {
      charIdx.current += 1;
      setCurrentTyped(msg.slice(0, charIdx.current));
    }, 25);
    return () => clearTimeout(timer);
  }, [phase, currentTyped, msgIdx, messages]);

  return (
    <div className="absolute inset-0 z-[70] flex flex-col animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex flex-col mx-3 my-auto bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ maxHeight: "70%" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <button onClick={onClose} className="text-gray-400 active:scale-90 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <img src="/favicon_backup.png" alt="AI" className="w-8 h-8 rounded-full shrink-0" />
          <div>
            <p className="text-sm font-black text-[#1B4332]">{t("coach.title")}</p>
            <p className="text-[10px] text-[#2D6A4F] font-medium">{t("coach.online")}</p>
          </div>
        </div>
        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-5 bg-gray-50/50">
          {phase === "loading" ? (
            <div className="flex gap-2.5">
              <img src="/favicon_backup.png" alt="AI" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium mb-1">{t("coach.name")}</p>
                <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[12px] text-gray-400 ml-1">{t("coach.analyzing")}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2.5 mb-4">
                <img src="/favicon_backup.png" alt="AI" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-gray-400 font-medium mb-1">{t("coach.justNow")}</p>
                  <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                    {hasRecord ? (
                      <>
                        <p className="text-[11px] font-bold text-gray-400 mb-2">{t("coach.prevRecord", { name: displayName || "" })}</p>
                        <div className="space-y-1">
                          {sets.map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-400 w-10">{t("coach.setLabel", { n: String(i + 1) })}</span>
                              <span className="text-[13px] font-black text-[#1B4332]">{toDispW(s.weight)}{unitLabels.weight}</span>
                              <span className="text-[11px] text-gray-400">×</span>
                              <span className="text-[13px] font-bold text-[#2D6A4F]">{t("coach.repsLabel", { r: String(s.reps) })}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[13px] font-bold text-[#1B4332] leading-relaxed">
                        {t("coach.greeting")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {typedMsgs.map((msg, i) => (
                <div key={i} className="flex gap-2.5 mb-4 animate-fade-in">
                  <div className="w-7 shrink-0" />
                  <div>
                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                      <p className="text-[13px] text-[#1B4332] leading-relaxed">{msg}</p>
                    </div>
                  </div>
                </div>
              ))}
              {phase === "typing" && currentTyped && (
                <div className="flex gap-2.5 mb-4 animate-fade-in">
                  <div className="w-7 shrink-0" />
                  <div>
                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                      <p className="text-[13px] text-[#1B4332] leading-relaxed">
                        {currentTyped}<span className="inline-block w-0.5 h-4 bg-[#2D6A4F] ml-0.5 animate-pulse align-middle" />
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* Input (disabled) */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
            <p className="flex-1 text-[13px] text-gray-400">{t("coach.inputPlaceholder")}</p>
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </div>
          </div>
          <p className="text-[9px] text-gray-300 text-center mt-1.5">{t("coach.comingSoon")}</p>
        </div>
      </div>
    </div>
  );
};
