"use client";

import React, { useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import { getCoachWeightSuggestion, type WeightChip, type UserWeightProfile } from "@/utils/coachWeightSuggestion";

interface ChatStyleWeightPickerProps {
  exerciseName: string;
  /** 마지막 사용 무게 (kg). null = 첫 사용 → first 모드 */
  lastWeight: number | null;
  /** 칩 또는 직접 입력 confirm 시 호출. 호출자가 localStorage 저장 + sequence advance */
  onSelect: (weight: number) => void;
}

function readUserProfile(): UserWeightProfile {
  if (typeof window === "undefined") return { gender: null, age: null };
  const gender = localStorage.getItem("ohunjal_gender") as "male" | "female" | null;
  const birthYear = localStorage.getItem("ohunjal_birth_year");
  const age = birthYear ? new Date().getFullYear() - parseInt(birthYear) : null;
  return { gender, age };
}

export const ChatStyleWeightPicker: React.FC<ChatStyleWeightPickerProps> = ({
  exerciseName, lastWeight, onSelect,
}) => {
  const { t } = useTranslation();
  const profile = useMemo(() => readUserProfile(), []);
  const suggestion = useMemo(
    () => getCoachWeightSuggestion(exerciseName, lastWeight, profile),
    [exerciseName, lastWeight, profile],
  );
  const [selected, setSelected] = useState<number>(suggestion.base);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState<string>("");

  const introKey = suggestion.mode === "history"
    ? "beginner_mode.chat_weight.intro_history"
    : "beginner_mode.chat_weight.intro_first";
  const introText = suggestion.mode === "history"
    ? t(introKey).replace("{weight}", String(lastWeight ?? 0)).replace("{reps}", "5")
    : t(introKey).replace("{base}", String(suggestion.base));

  const handleChip = (chip: WeightChip) => {
    setSelected(chip.weight);
    setCustomMode(false);
    trackEvent("chat_weight_chip_select", { exercise: exerciseName, chip: chip.key, weight: chip.weight });
  };

  const handleCustomToggle = () => {
    setCustomMode(true);
    setCustomInput(String(selected));
  };

  const handleConfirm = () => {
    const finalWeight = customMode ? Math.max(0, parseFloat(customInput) || suggestion.base) : selected;
    onSelect(finalWeight);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">
          {t("beginner_mode.chat_weight.label")}
        </p>
        <h2 className="text-2xl font-black text-[#1B4332] mt-1">{t("beginner_mode.chat_weight.title")}</h2>
      </div>

      <div className="bg-emerald-50/60 rounded-2xl px-4 py-3.5">
        <p className="text-emerald-900 text-[13.5px] leading-relaxed">{introText}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {suggestion.chips.map((chip) => {
          const isActive = !customMode && selected === chip.weight;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleChip(chip)}
              className={`w-full px-4 py-3.5 rounded-2xl border text-[14px] font-bold flex justify-between items-center transition-colors ${
                isActive
                  ? "bg-[#1B4332] text-white border-[#1B4332]"
                  : "bg-white text-[#1B4332] border-gray-200 active:bg-gray-50"
              }`}
            >
              <span>{t(chip.key)}</span>
              <span className={`text-[13px] tabular-nums ${isActive ? "text-white/80" : "text-gray-400"}`}>
                {chip.weight}kg
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleCustomToggle}
          className={`w-full px-4 py-3.5 rounded-2xl border text-[14px] font-bold transition-colors ${
            customMode
              ? "bg-[#1B4332] text-white border-[#1B4332]"
              : "bg-white text-gray-500 border-gray-200 border-dashed active:bg-gray-50"
          }`}
        >
          {t("beginner_mode.chat_weight.input_label")}
        </button>

        {customMode && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="number"
              inputMode="decimal"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={t("beginner_mode.chat_weight.input_placeholder")}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-[15px] font-bold text-[#1B4332] focus:outline-none focus:border-[#1B4332]"
              min={0}
              step={2.5}
              autoFocus
            />
            <span className="text-[13px] text-gray-500 font-medium">kg</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full h-14 rounded-2xl bg-[#1B4332] text-white text-[15px] font-black active:scale-[0.98] transition-transform"
      >
        {t("beginner_mode.chat_weight.cta")}
      </button>
    </div>
  );
};
