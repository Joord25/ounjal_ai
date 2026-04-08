"use client";

import React, { useState, useEffect, useRef } from "react";
import { UserCondition, WorkoutGoal, WorkoutHistory, SessionMode, TargetMuscle, RunType } from "@/constants/workout";
import { updateWeight, updateGender, updateBirthYear } from "@/utils/userProfile";
import { getIntensityRecommendation, type IntensityLevel } from "@/utils/workoutMetrics";
import { CoachTooltip } from "./Tutorial";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { WheelPicker } from "@/components/layout/WheelPicker";

export interface SessionSelection {
  goal: WorkoutGoal;
  sessionMode: SessionMode;
  targetMuscle?: TargetMuscle;
  runType?: RunType;
}

interface ConditionCheckProps {
  onComplete: (condition: UserCondition, goal: WorkoutGoal, session?: SessionSelection) => void;
  onBack?: () => void;
  userName?: string;
  isGuest?: boolean;
}

type Step = "body_check" | "weight_input" | "goal_select";

export const ConditionCheck: React.FC<ConditionCheckProps> = ({ onComplete, onBack, userName, isGuest }) => {
  const { t } = useTranslation();
  const displayName = userName || t("home.defaultName");
  const [step, setStep] = useState<Step>("body_check");

  // State
  const [bodyPart, setBodyPart] = useState<UserCondition["bodyPart"] | null>(null);
  const [goal, setGoal] = useState<WorkoutGoal | null>(null);
  const [showWeightEdit, setShowWeightEdit] = useState(false);
  const [bodyWeight, setBodyWeight] = useState<string>(() => {
    if (isGuest || typeof window === "undefined") return "";
    return localStorage.getItem("ohunjal_body_weight") || "";
  });
  const [bodyWeightNum, setBodyWeightNum] = useState<number>(() => {
    if (isGuest || typeof window === "undefined") return 70;
    const v = parseInt(localStorage.getItem("ohunjal_body_weight") || "");
    return !isNaN(v) && v > 0 ? v : 70;
  });
  const [gender, setGender] = useState<"male" | "female" | null>(() => {
    if (isGuest || typeof window === "undefined") return null;
    return (localStorage.getItem("ohunjal_gender") as "male" | "female") || null;
  });
  const [birthYear, setBirthYear] = useState<string>(() => {
    if (isGuest || typeof window === "undefined") return "";
    return localStorage.getItem("ohunjal_birth_year") || "";
  });

  const [recentHistory, setRecentHistory] = useState<WorkoutHistory[]>([]);
  const [showCoachTip, setShowCoachTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("ohunjal_tip_condition");
    }
    return true;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { trackEvent("condition_check_start"); }, []);

  // Load recent history for intensity recommendation
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ohunjal_workout_history");
      if (raw) {
        const all: WorkoutHistory[] = JSON.parse(raw);
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        setRecentHistory(all.filter(h => new Date(h.date).getTime() > cutoff));
      }
    } catch { /* ignore */ }
  }, []);

  const savedBirthYear = (() => {
    if (typeof window === "undefined") return undefined;
    const v = parseInt(localStorage.getItem("ohunjal_birth_year") || "");
    return !isNaN(v) && v > 1900 ? v : undefined;
  })();

  const savedGender = (() => {
    if (typeof window === "undefined") return undefined;
    return (localStorage.getItem("ohunjal_gender") as "male" | "female") || undefined;
  })();

  const intensityRec = recentHistory.length > 0
    ? getIntensityRecommendation(recentHistory, savedBirthYear, savedGender)
    : null;




  const dismissCoachTip = () => {
    setShowCoachTip(false);
    localStorage.setItem("ohunjal_tip_condition", "1");
  };



  // 성별+출생연도가 있으면 재방문 유저 (체중만 입력)
  const [hasProfile] = useState(() => {
    if (isGuest || typeof window === "undefined") return false;
    return !!(localStorage.getItem("ohunjal_gender") && localStorage.getItem("ohunjal_birth_year"));
  });

  const handleBack = () => {
    if (step === "goal_select") {
      setStep("weight_input");
    } else if (step === "weight_input") {
      setStep("body_check");
    } else if (onBack) {
      onBack();
    }
  };

  const handleNext = (selectedBodyPart?: UserCondition["bodyPart"], selectedGoal?: WorkoutGoal, session?: SessionSelection) => {
    if (step === "body_check" && selectedBodyPart) {
      trackEvent("condition_check_step", { step: "body_check" });
      setBodyPart(selectedBodyPart);
      setStep("weight_input");
    } else if (step === "weight_input") {
      const weightNum = parseFloat(bodyWeight.trim());
      if (!isNaN(weightNum) && weightNum > 0) {
        updateWeight(weightNum);
      }
      if (gender) {
        updateGender(gender);
      }
      const byNum = parseInt(birthYear.trim());
      if (!isNaN(byNum) && byNum > 1900) {
        updateBirthYear(byNum);
      }
      // 첫 프로필 입력 완료 시 플래그 세팅 (예측모델 등에서 참조)
      if (!localStorage.getItem("ohunjal_fitness_reading_done")) {
        localStorage.setItem("ohunjal_fitness_reading_done", "1");
      }
      trackEvent("condition_check_step", { step: "weight_input" });
      setStep("goal_select");
    } else if (step === "goal_select" && selectedGoal) {
      trackEvent("condition_check_complete", { goal: selectedGoal });
      setGoal(selectedGoal);
      const weightNum = parseFloat(bodyWeight);
      const birthYearNum = parseInt(birthYear);
      const energyFromBodyPart = bodyPart === "full_fatigue" ? 2 : bodyPart === "good" ? 4 : 3;
      onComplete({
        bodyPart: bodyPart!,
        energyLevel: energyFromBodyPart as 1|2|3|4|5,
        availableTime: 50,
        bodyWeightKg: !isNaN(weightNum) && weightNum > 0 ? weightNum : undefined,
        gender: gender || undefined,
        birthYear: !isNaN(birthYearNum) && birthYearNum > 1900 ? birthYearNum : undefined,
      }, selectedGoal, session);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full p-6 animate-fade-in relative">
      {/* Progress Dots */}
      <div className="flex justify-center gap-2 pt-2 pb-1">
        {["body_check", "weight_input", "goal_select"].map((s, i) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all duration-300 ${
              s === step ? "w-6 bg-[#2D6A4F]" : i < ["body_check", "weight_input", "goal_select"].indexOf(step) ? "w-2 bg-[#2D6A4F]" : "w-2 bg-gray-200"
            }`}
          />
        ))}
      </div>

      <div key={step} className="flex-1 flex flex-col gap-6 overflow-y-auto pb-24 scrollbar-hide">
        <div key={`header-${step}`} className="pt-4 pb-2 animate-fade-in shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={step === "body_check" ? onBack : handleBack}
              className="text-gray-400 hover:text-gray-600 active:scale-90 transition-all -ml-1 p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[#2D6A4F] font-bold tracking-[0.2em] uppercase text-xs">
              {t("condition.step.prefix")} {step === "body_check" ? "1" : step === "weight_input" ? "2" : "3"}
            </span>
          </div>
          <h1 className="text-3xl font-black mt-2 leading-tight text-[#1B4332] whitespace-pre-line">
            {step === "body_check" ? `${displayName}${t("condition.suffix.name")}\n${t("condition.title.bodyCheck")}` : step === "weight_input" ? (hasProfile ? `${displayName}${t("condition.suffix.name")}\n${t("condition.title.weightInput")}` : t("condition.title.profileInput")) : `${displayName}${t("condition.suffix.name")}\n${t("condition.title.goalSelect")}`}
          </h1>
        </div>
        {step === "body_check" ? (
          <>
            {/* Coach tip placeholder — overlay rendered below */}
            {/* Body Condition Selection */}
            <div className="flex flex-col gap-3">
              <ConditionCard
                selected={bodyPart === "upper_stiff"}
                onClick={() => handleNext("upper_stiff")}
                title={t("condition.body.upperStiff")}
                desc={t("condition.body.upperStiff.desc")}
                delay={0.05}
              />
              <ConditionCard
                selected={bodyPart === "lower_heavy"}
                onClick={() => handleNext("lower_heavy")}
                title={t("condition.body.lowerHeavy")}
                desc={t("condition.body.lowerHeavy.desc")}
                delay={0.1}
              />
              <ConditionCard
                selected={bodyPart === "full_fatigue"}
                onClick={() => handleNext("full_fatigue")}
                title={t("condition.body.fullFatigue")}
                desc={t("condition.body.fullFatigue.desc")}
                delay={0.15}
              />
              <ConditionCard
                selected={bodyPart === "good"}
                onClick={() => handleNext("good")}
                title={t("condition.body.good")}
                desc={t("condition.body.good.desc")}
                delay={0.2}
              />
            </div>
          </>
        ) : step === "weight_input" ? (
          <div className="flex flex-col gap-5">
            {!hasProfile ? (
              /* 초기: 성별 + 출생연도 + 체중 동일 크기 카드 */
              <>
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 animate-card-enter" style={{ animationDelay: "0.05s", animationFillMode: "forwards" }}>
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
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 animate-card-enter" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{t("condition.birthYear")}</p>
                  <div className="flex items-end justify-center gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      min={1930}
                      max={2015}
                      placeholder="1995"
                      className="w-full text-center text-3xl font-black text-[#1B4332] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="animate-card-enter" style={{ animationDelay: "0.15s", animationFillMode: "forwards" }}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3 text-center">{t("condition.weight")}</p>
                  <WheelPicker
                    values={Array.from({ length: 131 }, (_, i) => 30 + i)}
                    selected={bodyWeightNum}
                    onChange={(v) => { setBodyWeightNum(v); setBodyWeight(String(v)); }}
                    suffix="kg"
                  />
                </div>
              </>
            ) : (
              /* 재방문: "어제랑 같아요" 원탭 + 변경 옵션 */
              showWeightEdit ? (
                <div className="animate-card-enter" style={{ animationDelay: "0.05s", animationFillMode: "forwards" }}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3 text-center">{t("condition.weight.edit")}</p>
                  <WheelPicker
                    values={Array.from({ length: 131 }, (_, i) => 30 + i)}
                    selected={bodyWeightNum}
                    onChange={(v) => { setBodyWeightNum(v); setBodyWeight(String(v)); }}
                    suffix="kg"
                  />
                </div>
              ) : (
                <button
                  onClick={() => handleNext()}
                  className="w-full bg-white rounded-2xl border-2 border-gray-100 p-6 animate-card-enter active:scale-[0.98] transition-all text-center"
                  style={{ animationDelay: "0.05s", animationFillMode: "forwards" }}
                >
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">{t("condition.prevWeight")}</p>
                  <p className="text-4xl font-black text-[#1B4332]">{bodyWeight || "—"}<span className="text-lg font-bold text-gray-400 ml-1">kg</span></p>
                  {(() => {
                    const prevWeight = recentHistory.length > 0 && recentHistory[recentHistory.length - 1].stats
                      ? parseFloat(localStorage.getItem("ohunjal_prev_weight") || "0") : 0;
                    const currentW = parseFloat(bodyWeight || "0");
                    if (prevWeight > 0 && currentW > 0 && prevWeight !== currentW) {
                      const diff = Math.round((currentW - prevWeight) * 10) / 10;
                      return <p className={`text-[12px] font-bold mt-1 ${diff < 0 ? "text-[#2D6A4F]" : "text-gray-400"}`}>{t("condition.weightDiff", { diff: `${diff > 0 ? "+" : ""}${diff}` })}</p>;
                    }
                    return null;
                  })()}
                  <p className="text-sm font-bold text-[#2D6A4F] mt-3">{t("condition.weight.same")}</p>
                </button>
              )
            )}

            <p className="text-[11px] text-gray-500 text-center font-medium">
              {hasProfile ? (
                showWeightEdit ? t("condition.weight.recording") : <button onClick={() => setShowWeightEdit(true)} className="underline underline-offset-2">{t("condition.weight.changed")}</button>
              ) : t("condition.basicInfoHint")}
            </p>

            <button
              onClick={() => handleNext()}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#1B4332] text-white hover:bg-[#2D6A4F] ${hasProfile && !showWeightEdit ? "hidden" : ""}`}
            >
              {t("common.next")}
            </button>
          </div>
        ) : (
          /* Goal Selection */
          <>
            {/* 컨디션 기반 AI 코치 안내 */}
            {(bodyPart === "full_fatigue" || bodyPart === "upper_stiff" || bodyPart === "lower_heavy") && (
              <div className="bg-[#2D6A4F]/5 rounded-xl px-4 py-3 flex items-center gap-2 -mt-2 mb-1">
                <img src="/favicon_backup.png" alt="AI" className="w-5 h-5 rounded-full shrink-0" />
                <p className="text-[12px] font-bold text-[#2D6A4F]">
                  {bodyPart === "full_fatigue" ? t("condition.tip.fatigue") : bodyPart === "upper_stiff" ? t("condition.tip.upper") : t("condition.tip.lower")}
                </p>
              </div>
            )}
            <GoalSelection
              goal={goal}
              onSelect={(g, session) => handleNext(undefined, g, session)}
            />
          </>
        )}
      </div>

      <div className="absolute bottom-8 left-6 right-6">
        {/* Next Button Removed */}
      </div>

      {showCoachTip && step === "body_check" && (
        <CoachTooltip recentHistory={recentHistory} intensityRec={intensityRec} onDismiss={dismissCoachTip} />
      )}

    </div>
  );
};

const GoalSelection = ({
  goal,
  onSelect,
}: {
  goal: WorkoutGoal | null;
  onSelect: (g: WorkoutGoal, session?: SessionSelection) => void;
}) => {
  const { t } = useTranslation();
  const [subView, setSubView] = useState<"running" | null>(null);

  // 러닝 종류 서브뷰
  if (subView === "running") {
    const runs: { key: RunType; labelKey: string; descKey: string }[] = [
      { key: "interval", labelKey: "condition.running.interval", descKey: "condition.running.interval.desc" },
      { key: "easy", labelKey: "condition.running.easy", descKey: "condition.running.easy.desc" },
      { key: "long", labelKey: "condition.running.long", descKey: "condition.running.long.desc" },
    ];
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setSubView(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1 self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back")}
        </button>
        <p className="text-sm font-bold text-[#2D6A4F] mb-1">{t("condition.running.title")}</p>
        {runs.map((r, i) => (
          <ConditionCard
            key={r.key}
            selected={false}
            onClick={() => onSelect("general_fitness", { goal: "general_fitness", sessionMode: "running", runType: r.key })}
            title={t(r.labelKey)}
            desc={t(r.descKey)}
            delay={0.05 * (i + 1)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 메인 3개 목표 */}
      <ConditionCard
        selected={goal === "fat_loss"}
        onClick={() => onSelect("fat_loss", { goal: "fat_loss", sessionMode: "balanced" })}
        title={t("condition.goal.fatLoss")}
        desc={t("condition.goal.fatLoss.desc")}
        badge={t("plan.intensity.low")}
        badgeColor="text-emerald-600 bg-emerald-50"
        delay={0.05}
      />
      <ConditionCard
        selected={goal === "muscle_gain"}
        onClick={() => onSelect("muscle_gain", { goal: "muscle_gain", sessionMode: "balanced" })}
        title={t("condition.goal.muscleGain")}
        desc={t("condition.goal.muscleGain.desc")}
        badge={t("plan.intensity.moderate")}
        badgeColor="text-amber-600 bg-amber-50"
        delay={0.1}
      />
      <ConditionCard
        selected={goal === "strength"}
        onClick={() => onSelect("strength", { goal: "strength", sessionMode: "balanced" })}
        title={t("condition.goal.strength")}
        desc={t("condition.goal.strength.desc")}
        badge={t("plan.intensity.high")}
        badgeColor="text-red-500 bg-red-50"
        delay={0.15}
      />

      {/* 부위별 집중 */}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-3 mb-1">{t("condition.split.title")}</p>
      <div className="flex gap-2 animate-card-enter" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
        {[
          { key: "chest" as TargetMuscle, label: t("home.bodyPart.chest") },
          { key: "back" as TargetMuscle, label: t("home.bodyPart.back") },
          { key: "shoulders" as TargetMuscle, label: t("home.bodyPart.shoulder") },
          { key: "arms" as TargetMuscle, label: t("home.bodyPart.arm") },
          { key: "legs" as TargetMuscle, label: t("home.bodyPart.lower") },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => onSelect("muscle_gain", { goal: "muscle_gain", sessionMode: "split", targetMuscle: m.key })}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-[#2D6A4F]/30 hover:bg-emerald-50/30 transition-all duration-200 active:scale-[0.97] text-[13px] font-bold text-gray-800 text-center"
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 특수 훈련 */}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-2 mb-1">{t("condition.special.title")}</p>
      <div className="flex gap-2">
        {[
          { label: t("condition.special.fitness"), sub: t("condition.special.fitness.desc"), onClick: () => onSelect("general_fitness", { goal: "general_fitness", sessionMode: "home_training" }) },
          { label: t("condition.special.running"), sub: t("condition.special.running.desc"), onClick: () => setSubView("running") },
        ].map((item, i) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex-1 py-3 rounded-xl border border-gray-200 bg-white hover:border-[#2D6A4F]/30 hover:bg-emerald-50/30 transition-all duration-200 active:scale-[0.97] animate-card-enter"
            style={{ animationDelay: `${0.25 + i * 0.05}s`, animationFillMode: "forwards" }}
          >
            <p className="text-[13px] font-bold text-gray-800">{item.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const ConditionCard = ({
  title,
  desc,
  selected,
  onClick,
  badge,
  badgeColor,
  delay = 0
}: {
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  badgeColor?: string;
  delay?: number;
}) => (
  <button
    onClick={onClick}
    className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 active:scale-[0.98] animate-card-enter ${
      selected
        ? "border-[#2D6A4F] bg-emerald-50 ring-1 ring-[#2D6A4F]"
        : "border-gray-100 bg-white hover:border-gray-300"
    }`}
    style={{ animationDelay: `${delay}s`, animationFillMode: "forwards" }}
  >
    <div className="flex justify-between items-center mb-1">
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${selected ? "text-[#1B4332]" : "text-gray-900"}`}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor || "text-gray-500 bg-gray-100"}`}>
            {badge}
          </span>
        )}
        {selected && (
          <svg className="w-6 h-6 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </div>
    <p className={`text-xs font-medium ${selected ? "text-[#2D6A4F]" : "text-gray-500"}`}>
      {desc}
    </p>
  </button>
);
