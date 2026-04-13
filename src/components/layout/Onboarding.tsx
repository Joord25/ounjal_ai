"use client";

import React, { useState, useEffect } from "react";
import { updateGender, updateBirthYear, updateWeight, saveUserProfile } from "@/utils/userProfile";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnits } from "@/hooks/useUnits";
import { cmToInches, inchesToCm, kgToLb, lbToKg } from "@/utils/units";
import { WheelPicker } from "./WheelPicker";
import { RulerPicker } from "./RulerPicker";
import type { FitnessProfile } from "@/components/dashboard/fitnessTypes";

interface OnboardingProps {
  userName: string;
  onComplete: () => void;
}

type Step = "welcome" | "gender" | "birth_year" | "height" | "weight" | "goal" | "done";

const GOAL_OPTIONS: { value: FitnessProfile["goal"]; key: string; descKey: string }[] = [
  { value: "fat_loss", key: "growth.goal.fat_loss", descKey: "onboarding.done.fat_loss" },
  { value: "muscle_gain", key: "growth.goal.muscle_gain", descKey: "onboarding.done.muscle_gain" },
  { value: "endurance", key: "growth.goal.endurance", descKey: "onboarding.done.endurance" },
  { value: "health", key: "growth.goal.health", descKey: "onboarding.done.health" },
];

// Pre-generate value arrays
const BIRTH_YEARS = Array.from({ length: 80 }, (_, i) => 2010 - i); // 2010 ~ 1931
const HEIGHTS_CM = Array.from({ length: 81 }, (_, i) => 120 + i);   // 120 ~ 200 cm
const HEIGHTS_IN = Array.from({ length: 34 }, (_, i) => 47 + i);    // 47 ~ 80 inches (≈ 119~203cm)

const STEP_ORDER: Step[] = ["welcome", "gender", "birth_year", "height", "weight", "goal", "done"];

export const Onboarding: React.FC<OnboardingProps> = ({ userName, onComplete }) => {
  const { t } = useTranslation();
  const { system: unitSystem } = useUnits();
  const isImperial = unitSystem === "imperial";
  const displayName = userName || t("home.defaultName");
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState(0);
  const [welcomeVisible, setWelcomeVisible] = useState(false);

  // Profile fields
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [birthYear, setBirthYear] = useState(1995);
  const [height, setHeight] = useState(170);
  const [bodyWeight, setBodyWeight] = useState(70);
  const [selectedGoal, setSelectedGoal] = useState<FitnessProfile["goal"] | null>(null);

  useEffect(() => { trackEvent("onboarding_start"); }, []);

  useEffect(() => {
    if (step === "welcome") {
      const timer = setTimeout(() => setWelcomeVisible(true), 200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const goTo = (next: Step) => {
    const curIdx = STEP_ORDER.indexOf(step);
    const nextIdx = STEP_ORDER.indexOf(next);
    setDirection(nextIdx > curIdx ? "forward" : "backward");
    setAnimKey(k => k + 1);
    setStep(next);
  };

  const handleGender = (g: "male" | "female") => {
    setGender(g);
    setTimeout(() => goTo("birth_year"), 300);
  };

  const handleGoal = (goal: FitnessProfile["goal"]) => {
    setSelectedGoal(goal);

    // Save all profile data
    updateGender(gender!);
    updateBirthYear(birthYear);
    updateWeight(bodyWeight);

    try {
      const fp = JSON.parse(localStorage.getItem("ohunjal_fitness_profile") || "{}");
      fp.gender = gender;
      fp.birthYear = birthYear;
      fp.height = height;
      fp.bodyWeight = bodyWeight;
      fp.goal = goal;
      localStorage.setItem("ohunjal_fitness_profile", JSON.stringify(fp));
      saveUserProfile({ fitnessProfile: fp }).catch(() => {});
    } catch { /* ignore */ }

    localStorage.setItem("ohunjal_onboarding_done", "1");
    trackEvent("onboarding_profile");
    trackEvent("onboarding_goal", { goal });
    trackEvent("onboarding_complete");

    goTo("done");
  };

  const handleBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) goTo(STEP_ORDER[idx - 1]);
  };

  const animClass = direction === "forward"
    ? "animate-[slideInRight_0.3s_ease-out]"
    : "animate-[slideInLeft_0.3s_ease-out]";

  const stepIndicator = () => {
    const steps: Step[] = ["gender", "birth_year", "height", "weight", "goal"];
    const currentIdx = steps.indexOf(step);
    if (currentIdx < 0) return null;
    return (
      <div className="flex items-center gap-1.5 justify-center mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i <= currentIdx ? "bg-[#2D6A4F] w-6" : "bg-gray-200 w-4"
            }`}
          />
        ))}
      </div>
    );
  };

  const backButton = () => (
    <button
      onClick={handleBack}
      className="self-start mb-4 text-gray-400 text-sm flex items-center gap-1 active:opacity-60"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      {t("onboarding.back")}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-white relative overflow-hidden">


      {/* Welcome */}
      {step === "welcome" && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <div className={`mb-8 transition-all duration-700 ${welcomeVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
              <img src="/welcome.png" alt="hello" className="h-40 object-contain" />
            </div>
            <h1 className={`text-[#1B4332] text-[28px] font-black text-center mb-3 leading-tight transition-all duration-700 delay-200 ${welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              {t("onboarding.welcome.title", { name: displayName })}
            </h1>
            <div className={`text-center mb-12 transition-all duration-700 delay-[400ms] ${welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <p className="text-gray-500 text-base font-medium leading-relaxed whitespace-pre-line">
                {t("onboarding.welcome.desc1")}
              </p>
              <p className="text-gray-500 text-base font-medium leading-relaxed whitespace-pre-line mt-3">
                {t("onboarding.welcome.desc2")}
              </p>
            </div>
            <button
              onClick={() => goTo("gender")}
              className={`w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all duration-700 delay-[600ms] ${welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              {t("onboarding.welcome.cta")}
            </button>
          </div>
        </div>
      )}

      {/* Gender */}
      {step === "gender" && (
        <div key={`gender-${animKey}`} className={`flex-1 flex flex-col px-6 pt-6 ${animClass}`}>
          {backButton()}
          {stepIndicator()}
          <h2 className="text-xl font-black text-[#1B4332] text-center mb-2">
            {t("onboarding.gender.title")}
          </h2>
          <p className="text-sm text-gray-400 text-center">{t("onboarding.gender.sub")}</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-4 justify-center">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => handleGender(g)}
                  className={`w-32 h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
                    gender === g ? "border-[#2D6A4F] bg-emerald-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <svg className="w-12 h-12 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {g === "male" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    )}
                  </svg>
                  <span className="text-base font-bold text-[#1B4332]">
                    {t(`condition.gender.${g}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Birth Year */}
      {step === "birth_year" && (
        <div key={`by-${animKey}`} className={`flex-1 flex flex-col px-6 pt-6 ${animClass}`}>
          {backButton()}
          {stepIndicator()}
          <h2 className="text-xl font-black text-[#1B4332] text-center mb-2">
            {t("onboarding.birthYear.title")}
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">{t("onboarding.birthYear.sub")}</p>
          <div className="flex-1 flex items-center justify-center">
            <WheelPicker values={BIRTH_YEARS} selected={birthYear} onChange={setBirthYear} />
          </div>
          <div className="px-6 pb-6 pt-3">
            <button
              onClick={() => goTo("height")}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-[#2D6A4F] text-white active:scale-[0.98] transition-all"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Height */}
      {step === "height" && (
        <div key={`h-${animKey}`} className={`flex-1 flex flex-col px-6 pt-6 ${animClass}`}>
          {backButton()}
          {stepIndicator()}
          <h2 className="text-xl font-black text-[#1B4332] text-center mb-2">
            {t("onboarding.height.title")}
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">{t("onboarding.height.sub")}</p>
          <div className="flex-1 flex items-center justify-center">
            {isImperial ? (
              <WheelPicker
                values={HEIGHTS_IN}
                selected={Math.round(cmToInches(height))}
                onChange={(v) => setHeight(Math.round(inchesToCm(v)))}
                suffix="in"
              />
            ) : (
              <WheelPicker values={HEIGHTS_CM} selected={height} onChange={setHeight} suffix="cm" />
            )}
          </div>
          <div className="px-6 pb-6 pt-3">
            <button
              onClick={() => goTo("weight")}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-[#2D6A4F] text-white active:scale-[0.98] transition-all"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Weight */}
      {step === "weight" && (
        <div key={`w-${animKey}`} className={`flex-1 flex flex-col px-6 pt-6 ${animClass}`}>
          {backButton()}
          {stepIndicator()}
          <h2 className="text-xl font-black text-[#1B4332] text-center mb-2">
            {t("onboarding.weight.title")}
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">{t("onboarding.weight.sub")}</p>
          <div className="flex-1 flex items-center justify-center">
            {isImperial ? (
              <RulerPicker
                min={66}
                max={352}
                value={Math.round(kgToLb(bodyWeight))}
                onChange={(v) => setBodyWeight(Math.round(lbToKg(v) * 10) / 10)}
                suffix="lb"
              />
            ) : (
              <RulerPicker min={30} max={160} value={bodyWeight} onChange={setBodyWeight} suffix="kg" />
            )}
          </div>
          <div className="px-6 pb-6 pt-3">
            <button
              onClick={() => goTo("goal")}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-[#2D6A4F] text-white active:scale-[0.98] transition-all"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Goal */}
      {step === "goal" && (
        <div key={`goal-${animKey}`} className={`flex-1 flex flex-col px-6 pt-6 ${animClass}`}>
          {backButton()}
          {stepIndicator()}
          <h2 className="text-xl font-black text-[#1B4332] text-center mb-2">
            {t("onboarding.goal.title")}
          </h2>
          <p className="text-sm text-gray-400 text-center mb-8">{t("onboarding.goal.subtitle")}</p>
          <div className="w-full space-y-3">
            {GOAL_OPTIONS.map((o, i) => (
              <button
                key={o.value}
                onClick={() => handleGoal(o.value)}
                className="w-full py-4 px-5 rounded-2xl border-2 border-gray-100 bg-white text-gray-800 hover:border-[#2D6A4F]/30 hover:bg-emerald-50/30 transition-all duration-200 active:scale-[0.97] animate-[slideInRight_0.3s_ease-out]"
                style={{ animationDelay: `${i * 0.08}s`, animationFillMode: "both" }}
              >
                <span className="font-bold text-base">{t(o.key)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {step === "done" && selectedGoal && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 animate-[scaleIn_0.4s_ease-out]">
          <div className="w-16 h-16 rounded-full bg-[#2D6A4F] flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-[#1B4332] text-center mb-2">
            {t("onboarding.done.thanks", { name: displayName })}
          </h1>
          <p className="text-gray-600 text-sm text-center leading-relaxed mb-6">
            {t("onboarding.done.goalMsg", { goal: t(GOAL_OPTIONS.find(o => o.value === selectedGoal)!.key) })}
          </p>
          <div className="bg-gray-50 rounded-2xl p-5 w-full mb-8">
            <p className="text-[#1B4332] text-sm text-center leading-relaxed font-medium whitespace-pre-line">
              {t("onboarding.done.credential")}
            </p>
          </div>
          <button
            onClick={onComplete}
            className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all"
          >
            {t("onboarding.done.cta")}
          </button>
        </div>
      )}
    </div>
  );
};
