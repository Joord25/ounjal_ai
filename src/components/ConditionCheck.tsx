"use client";

import React, { useState } from "react";
import { UserCondition, WorkoutGoal } from "@/constants/workout";

interface ConditionCheckProps {
  onComplete: (condition: UserCondition, goal: WorkoutGoal) => void;
}

type Step = "body_check" | "goal_select";

export const ConditionCheck: React.FC<ConditionCheckProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>("body_check");
  
  // State
  const [bodyPart, setBodyPart] = useState<UserCondition["bodyPart"] | null>(null);
  const [energy, setEnergy] = useState<number>(3);
  const [goal, setGoal] = useState<WorkoutGoal | null>(null);

  const handleNext = (selectedBodyPart?: UserCondition["bodyPart"], selectedGoal?: WorkoutGoal) => {
    if (step === "body_check" && selectedBodyPart) {
      setBodyPart(selectedBodyPart);
      setStep("goal_select");
    } else if (step === "goal_select" && selectedGoal) {
      setGoal(selectedGoal);
      onComplete({
        bodyPart: bodyPart!,
        energyLevel: energy as 1|2|3|4|5,
        availableTime: 50, // Fixed for Masterplan
      }, selectedGoal);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 animate-fade-in relative">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
        <div 
          className="h-full bg-emerald-600 transition-all duration-500"
          style={{ width: step === "body_check" ? "50%" : "100%" }}
        />
      </div>

      <div className="pt-4 pb-8">
        <span className="text-emerald-600 font-bold tracking-[0.2em] uppercase text-xs">
          AI Analysis • Step {step === "body_check" ? "1" : "2"}
        </span>
        <h1 className="text-3xl font-black mt-2 leading-tight text-gray-900">
          {step === "body_check" ? "오늘 몸 상태는\n어떠신가요?" : "오늘의 운동\n목표는 무엇인가요?"}
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pb-24 scrollbar-hide">
        {step === "body_check" ? (
          <>
            {/* Body Condition Selection */}
            <div className="flex flex-col gap-3">
              <ConditionCard
                selected={bodyPart === "upper_stiff"}
                onClick={() => handleNext("upper_stiff")}
                title="상체가 굳어있음"
                desc="목, 어깨, 등, 날개뼈 주위가 뻐근함"
              />
              <ConditionCard
                selected={bodyPart === "lower_heavy"}
                onClick={() => handleNext("lower_heavy")}
                title="하체가 무거움"
                desc="고관절, 햄스트링, 종아리가 타이트함"
              />
              <ConditionCard
                selected={bodyPart === "full_fatigue"}
                onClick={() => handleNext("full_fatigue")}
                title="전반적 피로감"
                desc="근육통 혹은 전신 컨디션 저하"
              />
              <ConditionCard
                selected={bodyPart === "good"}
                onClick={() => handleNext("good")}
                title="컨디션 좋음"
                desc="특별한 불편함 없이 활력 넘침"
              />
            </div>

            {/* Energy Slider Removed */}

          </>
        ) : (
          /* Goal Selection */
          <div className="flex flex-col gap-3">
            <ConditionCard
              selected={goal === "fat_loss"}
              onClick={() => handleNext(undefined, "fat_loss")}
              title="체지방 연소"
              desc="유산소성 근지구력 (15-20+ Reps)"
              highlight="Burn"
            />
            <ConditionCard
              selected={goal === "muscle_gain"}
              onClick={() => handleNext(undefined, "muscle_gain")}
              title="근육량 증가"
              desc="근비대 볼륨 타겟 (8-12 Reps)"
              highlight="Build"
            />
            <ConditionCard
              selected={goal === "strength"}
              onClick={() => handleNext(undefined, "strength")}
              title="최대 근력"
              desc="고중량 스트렝스 (3-5 Reps)"
              highlight="Power"
            />
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-6 right-6">
        {/* Next Button Removed */}
      </div>
    </div>
  );
};

const ConditionCard = ({ 
  title, 
  desc, 
  selected, 
  onClick, 
  highlight 
}: { 
  title: string; 
  desc: string; 
  selected: boolean; 
  onClick: () => void;
  highlight?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
      selected 
        ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" 
        : "border-gray-100 bg-white hover:border-gray-300"
    }`}
  >
    <div className="flex justify-between items-center mb-1">
      <span className={`text-lg font-bold ${selected ? "text-emerald-900" : "text-gray-900"}`}>
        {title}
      </span>
      {selected && (
        <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <p className={`text-xs font-medium ${selected ? "text-emerald-700" : "text-gray-500"}`}>
      {desc}
    </p>
  </button>
);
