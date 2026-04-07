"use client";

import React, { useState, useEffect } from "react";
import { updateGender, updateBirthYear, updateWeight, saveUserProfile } from "@/utils/userProfile";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import type { FitnessProfile } from "@/components/dashboard/fitnessTypes";

interface OnboardingProps {
  userName: string;
  onComplete: () => void;
}

type Step = "welcome" | "profile" | "goal";

const GOAL_OPTIONS: { value: FitnessProfile["goal"]; key: string }[] = [
  { value: "fat_loss", key: "growth.goal.fat_loss" },
  { value: "muscle_gain", key: "growth.goal.muscle_gain" },
  { value: "endurance", key: "growth.goal.endurance" },
  { value: "health", key: "growth.goal.health" },
];

export const Onboarding: React.FC<OnboardingProps> = ({ userName, onComplete }) => {
  const { t, locale } = useTranslation();
  const displayName = userName || t("home.defaultName");
  const [step, setStep] = useState<Step>("welcome");
  const [welcomeVisible, setWelcomeVisible] = useState(false);

  // Profile fields
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [height, setHeight] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");

  useEffect(() => { trackEvent("onboarding_start"); }, []);

  useEffect(() => {
    if (step === "welcome") {
      const t = setTimeout(() => setWelcomeVisible(true), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleProfileNext = () => {
    if (!gender) return;
    const byNum = parseInt(birthYear.trim());
    const hNum = parseFloat(height.trim());
    const wNum = parseFloat(bodyWeight.trim());
    if (isNaN(byNum) || byNum < 1900) return;
    if (isNaN(hNum) || hNum <= 0) return;
    if (isNaN(wNum) || wNum <= 0) return;

    updateGender(gender);
    updateBirthYear(byNum);
    updateWeight(wNum);

    // Save height to fitness profile
    try {
      const fp = JSON.parse(localStorage.getItem("fitness_profile") || "{}");
      fp.gender = gender;
      fp.birthYear = byNum;
      fp.height = hNum;
      fp.bodyWeight = wNum;
      localStorage.setItem("fitness_profile", JSON.stringify(fp));
    } catch { /* ignore */ }

    trackEvent("onboarding_profile");
    setStep("goal");
  };

  const handleGoal = (goal: FitnessProfile["goal"]) => {
    try {
      const fp = JSON.parse(localStorage.getItem("fitness_profile") || "{}");
      fp.goal = goal;
      localStorage.setItem("fitness_profile", JSON.stringify(fp));
      saveUserProfile({ fitnessProfile: fp }).catch(() => {});
    } catch { /* ignore */ }

    localStorage.setItem("onboarding_done", "1");
    trackEvent("onboarding_goal", { goal });
    trackEvent("onboarding_complete");
    onComplete();
  };

  const handleBack = () => {
    if (step === "goal") setStep("profile");
    else if (step === "profile") setStep("welcome");
  };

  const stepIndicator = () => {
    const steps: Step[] = ["profile", "goal"];
    const currentIdx = steps.indexOf(step);
    if (currentIdx < 0) return null;
    return (
      <div className="flex items-center gap-1.5 justify-center mb-6">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1 rounded-full transition-all duration-300 ${
              i <= currentIdx ? "bg-emerald-600 w-6" : "bg-gray-200 w-4"
            }`}
          />
        ))}
      </div>
    );
  };

  const backButton = () => (
    <button
      onClick={handleBack}
      className="self-start mb-4 text-[#6B7280] text-sm flex items-center gap-1"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      {t("onboarding.back")}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Welcome */}
      {step === "welcome" && (
        <div className="flex-1 flex flex-col bg-[#FAFBF9] overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            {/* Logo */}
            <div
              className={`mb-6 transition-all duration-700 ${
                welcomeVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
            >
              <img
                src={locale === "ko" ? "/login-logo-kor2.png" : "/login-logo-Eng.png"}
                alt="logo"
                className="h-24 object-contain"
              />
            </div>

            {/* Greeting */}
            <h1
              className={`text-[#1B4332] text-2xl font-bold text-center mb-3 transition-all duration-700 delay-200 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              {t("onboarding.welcome.title", { name: displayName })}
            </h1>

            {/* Message */}
            <div
              className={`text-center mb-10 transition-all duration-700 delay-400 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <p className="text-[#6B7280] text-sm leading-loose">
                {t("onboarding.welcome.desc1")}
              </p>
              <p className="text-[#6B7280] text-sm leading-loose mt-1">
                {t("onboarding.welcome.desc2")}
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setStep("profile")}
              className={`w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all duration-700 delay-800 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              {t("onboarding.welcome.cta")}
            </button>
          </div>
        </div>
      )}

      {/* Profile — gender + birthYear + height + weight in one screen */}
      {step === "profile" && (
        <div className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto pb-24">
          {backButton()}
          {stepIndicator()}
          <h2 className="text-lg font-bold text-gray-900 text-left w-full mb-6 leading-relaxed whitespace-pre-line">
            {t("onboarding.profile.title")}
          </h2>
          <div className="w-full space-y-4">
            {/* Gender */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{t("condition.gender")}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setGender("male")}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                    gender === "male" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {t("condition.gender.male")}
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                    gender === "female" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {t("condition.gender.female")}
                </button>
              </div>
            </div>

            {/* Birth Year */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{t("condition.birthYear")}</p>
              <input
                type="number"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="1995"
                className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Height */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{t("onboarding.profile.height")}</p>
              <div className="flex items-end justify-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm font-bold text-gray-400 pb-2">cm</span>
              </div>
            </div>

            {/* Body Weight */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{t("condition.weight")}</p>
              <div className="flex items-end justify-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  placeholder="70"
                  className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm font-bold text-gray-400 pb-2">kg</span>
              </div>
            </div>
          </div>

          {/* Fixed CTA */}
          <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={handleProfileNext}
              disabled={!gender || !birthYear.trim() || !height.trim() || !bodyWeight.trim()}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#2D6A4F] text-white hover:bg-[#1B4332] disabled:opacity-30 disabled:active:scale-100"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Goal */}
      {step === "goal" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {stepIndicator()}
          <h2 className="text-lg font-bold text-gray-900 text-left w-full mb-2 leading-relaxed whitespace-pre-line">
            {t("onboarding.goal.title")}
          </h2>
          <p className="text-sm text-gray-400 mb-6">{t("onboarding.goal.subtitle")}</p>
          <div className="w-full space-y-3">
            {GOAL_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleGoal(o.value)}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-gray-100 bg-white text-gray-700 hover:border-gray-200 transition-all duration-200 active:scale-[0.98]"
              >
                <span className="font-semibold text-center w-full block">{t(o.key)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
