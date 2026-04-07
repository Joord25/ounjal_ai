"use client";

import React, { useState, useEffect } from "react";
import { saveUserProfile, updateGender, updateBirthYear, updateWeight } from "@/utils/userProfile";
import { WorkoutHistory } from "@/constants/workout";
import { FitnessTest } from "./FitnessTest";
import { useTranslation } from "@/hooks/useTranslation";
import { RegressionChart } from "./RegressionChart";
import { Big3RegressionChart } from "./Big3RegressionChart";
import {
  calcCalorieBalanceTrend,
  linearRegression,
} from "@/utils/predictionUtils";
import {
  computeReading,
  type PredictionItem,
  PREDICTIONS_BY_GOAL,
  getMuscleGainItems,
} from "./predictionReading";

/* ─── types ─── */
import { type FitnessProfile } from "./fitnessTypes";
export type { FitnessProfile } from "./fitnessTypes";

interface Props {
  userName: string;
  onComplete: (profile: FitnessProfile) => void;
  onPremium?: () => void;
  isPremium?: boolean;
  resultOnly?: boolean;
  onBack?: () => void;
  workoutCount?: number;
  workoutHistory?: WorkoutHistory[];
  weightLog?: { date: string; weight: number }[];
  onEdit1RM?: () => void;
}

/* ─── constants ─── */
const FREQ_OPTIONS = [
  { value: 0, label: "안 해봤어요", sub: "처음이에요" },
  { value: 2, label: "주 1~2회", sub: "가볍게" },
  { value: 3, label: "주 3~4회", sub: "꾸준히" },
  { value: 5, label: "주 5회+", sub: "열심히" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30분-" },
  { value: 50, label: "50분" },
  { value: 60, label: "60분" },
  { value: 90, label: "90분+" },
];

const GOAL_OPTIONS: { value: FitnessProfile["goal"]; label: string }[] = [
  { value: "fat_loss", label: "체지방 감량" },
  { value: "muscle_gain", label: "근력 증가" },
  { value: "endurance", label: "기초 체력" },
  { value: "health", label: "건강 유지" },
];

/* ─── Phase 기반 예측 항목 ─── */
// Phase 0: 프로필 데이터만으로 (가이드라인 비교, 공식 기반 추정)
// Phase 1: 3회 운동 후 (초기 트렌드)
// Phase 2: 10회 운동 후 (ML 예측)

type UserLevel = "beginner" | "advanced";


/* ─── step type ─── */
type Step = "welcome" | "profile" | "frequency" | "time" | "goal" | "onerm" | "analyzing" | "result";

/* ─── Component ─── */
const UNLOCK_THRESHOLDS = [0, 5, 10, 20];

export const FitnessReading: React.FC<Props> = ({ userName, onComplete, onPremium, isPremium, resultOnly, onBack, workoutCount = 0, workoutHistory, weightLog, onEdit1RM }) => {
  const { t, locale } = useTranslation();
  // Load saved profile
  const savedProfile = React.useMemo<FitnessProfile | null>(() => {
    try {
      const raw = localStorage.getItem("ohunjal_fitness_profile");
      if (raw) return JSON.parse(raw) as FitnessProfile;
    } catch {}
    return null;
  }, []);

  const [step, setStep] = useState<Step>(() => {
    if (resultOnly && savedProfile && savedProfile.height) return "result";
    if (savedProfile && !savedProfile.height) return "profile";
    // 온보딩 완료 유저: 이미 입력된 항목 스킵
    if (savedProfile?.height && savedProfile?.gender) {
      if (!savedProfile.weeklyFrequency && savedProfile.weeklyFrequency !== 0) return "frequency";
      if (!savedProfile.sessionMinutes) return "time";
      if (!savedProfile.goal) return "goal";
      return "result";
    }
    return "welcome";
  });
  const [profile, setProfile] = useState<Partial<FitnessProfile>>(savedProfile || {});
  const [gender, setGender] = useState<"male" | "female" | null>(savedProfile?.gender || null);
  const [birthYear, setBirthYear] = useState(savedProfile?.birthYear?.toString() || "");
  const [height, setHeight] = useState(savedProfile?.height?.toString() || "");
  const [bodyWeight, setBodyWeight] = useState(savedProfile?.bodyWeight?.toString() || "");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showResult, setShowResult] = useState(!!resultOnly);
  const [resultReady, setResultReady] = useState(!!resultOnly);

  // 1RM inputs (상급자용)
  const [bench1RM, setBench1RM] = useState(savedProfile?.bench1RM?.toString() || "");
  const [squat1RM, setSquat1RM] = useState(savedProfile?.squat1RM?.toString() || "");
  const [deadlift1RM, setDeadlift1RM] = useState(savedProfile?.deadlift1RM?.toString() || "");

  const displayName = userName || "회원";

  /* ─── back navigation ─── */
  const getStepOrder = (): Step[] => {
    const base: Step[] = ["welcome", "profile", "frequency", "time", "goal"];
    // 상급자(주 5+)이고 근력 목표일 때 1RM 입력 스텝 추가
    if ((profile.weeklyFrequency ?? 0) >= 3 && profile.goal === "muscle_gain") {
      base.push("onerm");
    }
    return base;
  };

  const handleBack = () => {
    const order = getStepOrder();
    const currentIdx = order.indexOf(step);
    if (currentIdx <= 0) return;
    setStep(order[currentIdx - 1]);
  };

  /* ─── step transitions ─── */
  const handleProfileNext = () => {
    if (!gender) return;
    const byNum = parseInt(birthYear.trim());
    const hNum = parseFloat(height.trim());
    const wNum = parseFloat(bodyWeight.trim());
    if (isNaN(byNum) || byNum < 1900) return;
    if (isNaN(hNum) || hNum <= 0) return;
    if (isNaN(wNum) || wNum <= 0) return;

    setProfile((p) => ({ ...p, gender, birthYear: byNum, height: hNum, bodyWeight: wNum }));
    updateGender(gender);
    updateBirthYear(byNum);
    updateWeight(wNum);
    setStep("frequency");
  };

  const handleFrequency = (v: number) => {
    setProfile((p) => ({ ...p, weeklyFrequency: v }));
    setStep("time");
  };

  const handleTime = (v: number) => {
    setProfile((p) => ({ ...p, sessionMinutes: v }));
    setStep("goal");
  };

  const handleGoal = (v: FitnessProfile["goal"]) => {
    const updated = { ...profile, goal: v };
    setProfile(updated);
    // 상급자 + 근력증가 → 1RM 입력 스텝
    if ((updated.weeklyFrequency ?? 0) >= 3 && v === "muscle_gain") {
      setStep("onerm");
    } else {
      finishOnboarding(updated as FitnessProfile);
    }
  };

  const handle1RMNext = () => {
    const bench = parseFloat(bench1RM.trim()) || undefined;
    const squat = parseFloat(squat1RM.trim()) || undefined;
    const dead = parseFloat(deadlift1RM.trim()) || undefined;
    const complete = { ...profile, bench1RM: bench, squat1RM: squat, deadlift1RM: dead } as FitnessProfile;
    setProfile(complete);
    finishOnboarding(complete);
  };

  const finishOnboarding = (complete: FitnessProfile) => {
    localStorage.setItem("ohunjal_fitness_profile", JSON.stringify(complete));
    localStorage.setItem("ohunjal_fitness_reading_done", "true");
    saveUserProfile({ fitnessProfile: complete }).catch(() => {});
    setStep("analyzing");
  };

  /* ─── fake analysis animation ─── */
  const analysisMessages = [
    `${displayName}님의 훈련 환경을 분석하고 있습니다`,
    "운동 과학 데이터를 매칭하고 있습니다",
    "성장 가능성을 계산하고 있습니다",
    "패턴 리딩을 준비하고 있습니다",
  ];

  useEffect(() => {
    if (step !== "analyzing") return;

    setAnalysisProgress(0);
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      const progress = Math.min(frame * 2.5, 100);
      setAnalysisProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setStep("result");
          setTimeout(() => setShowResult(true), 100);
        }, 400);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── result animation ─── */
  useEffect(() => {
    if (step === "result" && showResult) {
      const timer = setTimeout(() => setResultReady(true), 600);
      return () => clearTimeout(timer);
    }
  }, [step, showResult]);

  /* ─── reading ─── */
  const reading = step === "result" ? computeReading(profile as FitnessProfile, workoutCount, workoutHistory, weightLog) : null;

  /* ─── render helpers ─── */
  const renderStepIndicator = () => {
    const steps: Step[] = ["profile", "frequency", "time", "goal"];
    // 상급자 + 근력이면 onerm도 포함
    if ((profile.weeklyFrequency ?? 0) >= 3 && profile.goal === "muscle_gain") {
      steps.push("onerm");
    }
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

  const questionTitle = (text: string) => (
    <h2 className="text-lg font-bold text-gray-900 text-left w-full mb-6 leading-relaxed whitespace-pre-line">
      {text}
    </h2>
  );

  const backButton = () => (
    <button
      onClick={handleBack}
      className="self-start mb-4 text-[#6B7280] text-sm flex items-center gap-1"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      이전
    </button>
  );

  const optionButton = (
    selected: boolean,
    onClick: () => void,
    children: React.ReactNode,
    key?: string,
  ) => (
    <button
      key={key}
      onClick={onClick}
      className={`w-full py-3.5 px-4 rounded-2xl border-2 text-left transition-all duration-200 ${
        selected
          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
          : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
      }`}
    >
      {children}
    </button>
  );

  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [showMLTooltip, setShowMLTooltip] = useState(false);
  const [showOtherGoals, setShowOtherGoals] = useState(false);
  const [selectedGoalKey, setSelectedGoalKey] = useState<string | null>(null); // null = 내 목표
  const [showChart, setShowChart] = useState(false);
  const [showFitnessTest, setShowFitnessTest] = useState(false);

  useEffect(() => {
    if (step === "welcome") {
      const t = setTimeout(() => setWelcomeVisible(true), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  /* ─── RENDER ─── */
  if (showFitnessTest) {
    const fp = profile as FitnessProfile;
    return (
      <FitnessTest
        gender={fp?.gender || "male"}
        birthYear={fp?.birthYear || 1990}
        onComplete={() => setShowFitnessTest(false)}
        onBack={() => setShowFitnessTest(false)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Welcome Screen */}
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
                alt="오운잘"
                className="h-24 object-contain"
              />
            </div>

            {/* Greeting */}
            <h1
              className={`text-[#1B4332] text-2xl font-bold text-center mb-3 transition-all duration-700 delay-200 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              {displayName}님, 환영합니다
            </h1>

            {/* Message */}
            <div
              className={`text-center mb-10 transition-all duration-700 delay-400 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <p className="text-[#6B7280] text-sm leading-loose">
                오운잘 AI는 미래 예측 모델인
              </p>
              <p className="text-[#6B7280] text-sm leading-loose">
                <button onClick={() => setShowMLTooltip(true)} className="text-[#1B4332] font-semibold underline decoration-dotted underline-offset-2"> 회귀분석 기반 머신러닝</button> 기술로
              </p>
              <p className="text-[#6B7280] text-sm leading-loose mt-2">
                당신의 <span className="text-[#1B4332] font-semibold">운동 패턴을 분석</span>하고
              </p>
              <p className="text-[#6B7280] text-sm leading-loose">
                <span className="text-[#1B4332] font-semibold">더 나은 미래의 모습</span>을 안내드립니다
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setStep("profile")}
              className={`w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all duration-700 delay-800 ${
                welcomeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              준비되었습니다
            </button>

          </div>
        </div>
      )}

      {/* Profile Step */}
      {step === "profile" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("기본 정보를 알려주세요")}
          <div className="w-full space-y-4">
            {/* Gender */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">성별</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setGender("male")}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                    gender === "male" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  남성
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                    gender === "female" ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  여성
                </button>
              </div>
            </div>

            {/* Birth Year */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">출생연도</p>
              <input
                type="number"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                min={1930}
                max={2015}
                placeholder="1995"
                className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Height */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">키</p>
              <div className="flex items-end justify-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  min={100}
                  max={250}
                  placeholder="175"
                  className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm font-bold text-gray-400 pb-2">cm</span>
              </div>
            </div>

            {/* Body Weight */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">체중</p>
              <div className="flex items-end justify-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  min={20}
                  max={300}
                  placeholder="70"
                  className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm font-bold text-gray-400 pb-2">kg</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 text-center font-medium mt-4">
            성별·연령·키·체중 기반 예측 모델에 활용됩니다
          </p>

          {/* Fixed CTA */}
          <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={handleProfileNext}
              disabled={!gender || !birthYear.trim() || !height.trim() || !bodyWeight.trim()}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#2D6A4F] text-white hover:bg-[#1B4332] disabled:opacity-30 disabled:active:scale-100"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Question Steps */}
      {step === "frequency" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle(`${displayName}님,\n일주일에 몇 번 운동해 오셨나요?`)}
          <div className="w-full space-y-3">
            {FREQ_OPTIONS.map((o) =>
              optionButton(profile.weeklyFrequency === o.value, () => handleFrequency(o.value), (
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-xs text-gray-400">{o.sub}</span>
                </div>
              ), String(o.value))
            )}
          </div>
        </div>
      )}

      {step === "time" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("1회 운동 시간은\n어느 정도인가요?")}
          <div className="w-full grid grid-cols-2 gap-3">
            {TIME_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleTime(o.value)}
                className={`py-4 rounded-2xl border-2 font-semibold transition-all duration-200 ${
                  profile.sessionMinutes === o.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "goal" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("가장 원하는 변화는\n무엇인가요?")}
          <div className="w-full space-y-3">
            {GOAL_OPTIONS.map((o) =>
              optionButton(profile.goal === o.value, () => handleGoal(o.value), (
                <span className="font-semibold text-center w-full block">{t(`growth.goal.${o.value}`)}</span>
              ), o.value)
            )}
          </div>
        </div>
      )}

      {/* 1RM Input Step (상급자 + 근력증가 목표) */}
      {step === "onerm" && (
        <div className="flex-1 flex flex-col px-6 pt-6">
          {backButton()}
          {renderStepIndicator()}
          {questionTitle("3대 운동 1RM을\n알고 계시면 입력해주세요")}
          <p className="text-[#6B7280] text-xs mb-5 -mt-3">
            모르면 비워두셔도 됩니다. 운동 데이터가 쌓이면 자동 추정됩니다.
          </p>
          <div className="w-full space-y-4">
            {[
              { label: "벤치프레스", value: bench1RM, setter: setBench1RM },
              { label: "스쿼트", value: squat1RM, setter: setSquat1RM },
              { label: "데드리프트", value: deadlift1RM, setter: setDeadlift1RM },
            ].map((lift) => (
              <div key={lift.label} className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">{lift.label} 1RM</p>
                <div className="flex items-end justify-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={lift.value}
                    onChange={(e) => lift.setter(e.target.value)}
                    min={0}
                    max={500}
                    placeholder="—"
                    className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm font-bold text-gray-400 pb-2">kg</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-500 text-center font-medium mt-4">
            ExRx/NSCA 강도 기준표 기반 수준 평가에 활용됩니다
          </p>

          <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={handle1RMNext}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#2D6A4F] text-white hover:bg-[#1B4332]"
            >
              {bench1RM || squat1RM || deadlift1RM ? "분석 시작" : "건너뛰기"}
            </button>
          </div>
        </div>
      )}

      {/* Analyzing Animation */}
      {step === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white">
          {/* Pulse animation */}
          <div className="relative w-16 h-16 mb-8">
            <div className="absolute inset-0 rounded-full bg-[#2D6A4F]/10 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="absolute inset-2 rounded-full bg-[#2D6A4F]/20 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-[#2D6A4F] flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <p className="text-lg font-bold text-[#1B4332] text-center">
            {displayName}님의 데이터를 분석하고 있어요
          </p>

          {/* Step checklist */}
          <div className="mt-8 space-y-3 w-full max-w-[260px]">
            {analysisMessages.map((msg, i) => {
              const currentStep = analysisProgress < 25 ? 0 : analysisProgress < 50 ? 1 : analysisProgress < 75 ? 2 : 3;
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    done ? "bg-[#2D6A4F]" : active ? "bg-[#2D6A4F]/20 animate-pulse" : "bg-gray-100"
                  }`}>
                    {done && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm transition-all duration-300 ${
                    done ? "text-[#1B4332] font-medium" : active ? "text-[#1B4332] font-medium animate-pulse" : "text-gray-300"
                  }`}>
                    {msg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result Screen */}
      {step === "result" && reading && (() => {
        const fp = profile as FitnessProfile;

        return (
          <div className="flex-1 flex flex-col bg-[#FAFBF9] min-h-0">
            {/* Fixed Header */}
            {resultOnly && onBack && (
              <div className="shrink-0 pt-5 pb-3 px-6 flex items-center justify-between bg-[#FAFBF9]">
                <button onClick={onBack} className="p-2 -ml-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-[#2D6A4F]">{t("growth.title")}</span>
                <div className="w-9" />
              </div>
            )}
            <div className={`shrink-0 px-6 ${resultOnly ? "pt-2" : "pt-6"} pb-3 bg-[#FAFBF9]`}>
              <h1
                className={`text-[#1B4332] text-xl font-bold mb-2 transition-all duration-700 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {locale === "en" ? `${displayName}'s Growth Prediction` : `${displayName}님의 성장 예측`}
              </h1>
              <p
                className={`text-[#6B7280] text-sm transition-all duration-700 delay-100 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {locale === "en"
                  ? `${fp.weeklyFrequency}x per week, ${fp.sessionMinutes} min each — ${fp.weeklyFrequency >= 3 ? "great consistency!" : "keep it up!"}`
                  : fp.weeklyFrequency >= 3
                    ? `주 ${fp.weeklyFrequency}회, ${fp.sessionMinutes}분씩 꾸준히 하고 계시네요`
                    : `주 ${fp.weeklyFrequency}회, ${fp.sessionMinutes}분씩 운동 중이에요`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">

              {/* AI 코치 메시지 */}
              <div
                className={`w-full bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm transition-all duration-700 delay-200 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <img src="/favicon_backup.png" alt="AI" className="w-5 h-5 rounded-full shrink-0" />
                  <span className="text-[11px] font-bold text-gray-400">{t("home.coachTitle")}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 shrink-0" />
                  <div className="bg-[#2D6A4F]/5 rounded-2xl px-4 py-3">
                <p className="text-[#1B4332] text-sm font-bold leading-relaxed whitespace-pre-line">
                  {(() => {
                    // 선택된 목표에 따라 멘트 변경
                    const activeGoal = selectedGoalKey || fp.goal;
                    const activeMsg = activeGoal !== fp.goal
                      ? computeReading({ ...fp, goal: activeGoal as FitnessProfile["goal"] }, workoutCount, workoutHistory, weightLog).message
                      : reading.message;
                    const msg = activeMsg;
                    const isEn = locale === "en";
                    // 날짜 기반 시드 (같은 날 = 같은 멘트)
                    const daySeed = new Date().getDate();
                    const pick = <T,>(arr: T[]): T => arr[daySeed % arr.length];

                    if (msg === "growth.coach.beginner") return t(msg);

                    if (msg.startsWith("growth.coach.fatLoss:")) {
                      const [, w4, w8, weeksTo1kg] = msg.split(":");
                      return pick(isEn ? [
                        `About ${w4}kg in 4 weeks at this pace!\nI've got the workouts — you handle the diet!`,
                        `4 weeks → ${w4}kg, 8 weeks → ${w8}kg!\nWe're on track, keep going together!`,
                        `About ${weeksTo1kg} weeks per 1kg — ${w4}kg by next month!\nI can already see the change!`,
                        `${w8}kg in 2 months is within reach!\nEvery session is burning it away!`,
                        `4 weeks to ${w4}kg! You eat clean, I'll make you sweat!`,
                      ] : [
                        `이 기세면 4주 뒤 약 ${w4}kg!\n운동은 제가 책임질게요, 식단만 더 신경쓰자!ㅎㅎ`,
                        `4주 뒤 ${w4}kg, 8주 뒤 ${w8}kg!\n같이 달려가는 중이에요 우리!ㅎㅎ`,
                        `약 ${weeksTo1kg}주에 1kg씩! 4주 뒤 ${w4}kg 목표!\n거울 앞에서 달라진 거 느끼실 거예요!`,
                        `2달 뒤 ${w8}kg도 충분해요!\n매 운동이 지방을 태우고 있어요!`,
                        `4주 뒤 ${w4}kg 향해 질주 중!\n맛있는 거 좀만 참으면 체중계가 웃어요!ㅎㅎ`,
                      ]);
                    }

                    if (msg.startsWith("growth.coach.muscleGain:")) {
                      const [, total, levelKo, nextTarget, remaining] = msg.split(":");
                      const hasNext = parseInt(nextTarget) > 0;
                      // 회의 22: EN 모드에서 strength level 한글 라벨 영문 변환
                      const toEnStrengthLevel = (g: string) => g === "입문" ? "Novice" : g === "초급" ? "Beginner" : g === "중급" ? "Intermediate" : g === "상급" ? "Advanced" : g === "엘리트" ? "Elite" : g;
                      const level = isEn ? toEnStrengthLevel(levelKo) : levelKo;
                      return pick(isEn ? [
                        `Big 3 total: ${total}kg! ${hasNext ? `${remaining}kg to ${level} level!` : `${level} level achieved!`}`,
                        `${total}kg and climbing! ${hasNext ? `${nextTarget}kg is the next milestone!` : `You're at the top!`}`,
                        `${total}kg total lift! ${hasNext ? `Just ${remaining}kg more to ${nextTarget}kg!` : `Elite status!`}\nWe're building this together!`,
                        `Remember when we started? Now it's ${total}kg!\n${hasNext ? `${nextTarget}kg, here we come!` : `What a journey!`}`,
                        `${total}kg! Every session adds plates!\n${hasNext ? `${level} → next level in sight!` : `${level} — legendary!`}`,
                      ] : [
                        `3대 합계 추정 ${total}kg! ${hasNext ? `${level}까지 ${remaining}kg 남았어요!` : `${level} 달성!`}\n같이 가즈아!`,
                        `${total}kg 돌파 중! ${hasNext ? `${nextTarget}kg이 다음 목표에요!` : `정상에 섰어요!`}\n같이 만든 기록이라 더 뿌듯!ㅎㅎ`,
                        `${total}kg! ${hasNext ? `${nextTarget}kg까지 딱 ${remaining}kg!` : `엘리트 달성!`}\n이 기세 절대 놓치지 말자!`,
                        `처음 시작할 때 생각하면 ${total}kg이 진짜 많이 온 거예요!\n${hasNext ? `${nextTarget}kg 향해 같이 달려요!` : `전설이에요 우리!`}`,
                        `${total}kg 찍는 중! 매 세션이 무게를 쌓고 있어요!\n${hasNext ? `${level} 넘고 ${nextTarget}kg 가자!` : `${level}, 최고예요!`}ㅎㅎ`,
                      ]);
                    }

                    if (msg === "growth.coach.muscleGainStart") {
                      return pick(isEn ? [
                        `Let's build your records together!\nEvery session is laying the foundation!`,
                        `We're just getting started!\nYour strength journey begins now — I'm excited!`,
                        `First records are the most special!\nLet's see those numbers grow together!`,
                      ] : [
                        `같이 기록을 만들어가요!\n매 세션이 근력의 기반이 됩니다!`,
                        `이제 시작이에요! 여기서부터 올라가는 거예요!\n같이 해서 저도 두근두근!ㅎㅎ`,
                        `첫 기록이 제일 특별해요!\n숫자가 올라가는 거 같이 지켜봐요!`,
                      ]);
                    }

                    if (msg.startsWith("growth.coach.endurance:")) {
                      const [, weeklyMin, gradeKo, minRemaining, nextMin] = msg.split(":");
                      const hasNext = parseInt(minRemaining) > 0;
                      const nextGradeKo = gradeKo === "성장중" ? "우수" : gradeKo === "우수" ? "상급" : gradeKo === "상급" ? "특급" : "";
                      // 회의 21: EN 모드에서 grade 한글 라벨을 영문으로 변환
                      const toEnGrade = (g: string) => g === "성장중" ? "Growing" : g === "우수" ? "Excellent" : g === "상급" ? "Advanced" : g === "특급" ? "Elite" : g;
                      const grade = isEn ? toEnGrade(gradeKo) : gradeKo;
                      const nextGrade = isEn ? toEnGrade(nextGradeKo) : nextGradeKo;
                      return pick(isEn ? [
                        `${weeklyMin} min/week! Grade: ${grade}!\n${hasNext ? `${minRemaining} more min to ${nextGrade}!` : `Top grade! National team level!`}`,
                        `${grade} grade with ${weeklyMin} min weekly!\n${hasNext ? `${nextMin} min/week unlocks ${nextGrade}!` : `Elite athlete vibes!`}`,
                        `Weekly ${weeklyMin} min = ${grade} level!\n${hasNext ? `${nextGrade} is ${minRemaining} min away!` : `Peak human performance!`}`,
                        `${grade} stamina! ${weeklyMin} min every week!\n${hasNext ? `Level up at ${nextMin} min!` : `Olympic spirit right here!`}`,
                        `${weeklyMin} min weekly = ${grade}!\n${hasNext ? `${nextGrade} promotion incoming!` : `Special forces level!`}`,
                      ] : [
                        `주 ${weeklyMin}분 운동! 체력 ${grade}!\n${hasNext ? `${nextGrade}까지 주 ${minRemaining}분만 더!` : `이 정도면 국대급이에요!`}`,
                        `${grade}급 체력! 주 ${weeklyMin}분 투자 중!\n${hasNext ? `주 ${nextMin}분 넘기면 ${nextGrade} 진급!` : `특급 전사에요 진짜!`}ㅎㅎ`,
                        `매주 ${weeklyMin}분씩! 체력 ${grade}!\n${hasNext ? `${nextGrade} 진급까지 ${minRemaining}분!` : `체력으로는 못 말려요!`}`,
                        `${grade}급 체력! 주 ${weeklyMin}분!\n${hasNext ? `${nextGrade}까지 얼마 안 남았어요! 가즈아!` : `군에서도 특급 감이에요!`}ㅎㅎ`,
                        `주 ${weeklyMin}분이면 ${grade}! 대단해요!\n${hasNext ? `${nextMin}분 넘기면 ${nextGrade} 확정!` : `올림픽 정신 그 자체!`}ㅎㅎ`,
                      ]);
                    }

                    if (msg.startsWith("growth.coach.health:")) {
                      const [, freq, totalWk, weeks] = msg.split(":");
                      return pick(isEn ? [
                        `${freq}x per week for ${weeks} weeks! That's real commitment!\nYour body is thanking you every day!`,
                        `${totalWk} total workouts! ${freq}x weekly consistency!\nHealthiest version of you is here!`,
                        `${weeks} weeks of ${freq}x training! Incredible discipline!\nThis habit is your superpower!`,
                        `${totalWk} sessions done! ${freq}x every week!\nYour future self is already grateful!`,
                        `${freq}x weekly warrior! ${totalWk} total sessions!\nConsistency is the real strength!`,
                      ] : [
                        `주 ${freq}회씩 ${weeks}주째! 진짜 대단한 꾸준함이에요!\n몸이 매일 감사하고 있을 거예요!`,
                        `총 ${totalWk}회 운동! 주 ${freq}회 습관 완성!\n가장 건강한 버전의 나, 완성 중!ㅎㅎ`,
                        `${weeks}주 동안 주 ${freq}회! 이 습관이 진짜 초능력이에요!\n같이 만든 결과라 더 뿌듯해요!`,
                        `${totalWk}회 달성! 주 ${freq}회 빠짐없이!\n미래의 내가 지금의 나한테 감사할 거예요!ㅎㅎ`,
                        `주 ${freq}회 전사! 총 ${totalWk}회!\n꾸준함이 진짜 실력이에요 우리!`,
                      ]);
                    }

                    return t(msg);
                  })()}
                </p>
                  </div>
                </div>
              </div>

              {/* My goal card (always visible) + other goal buttons */}
              {(() => {
                const myLevel: UserLevel = fp.weeklyFrequency <= 2 ? "beginner" : "advanced";
                const myGoalData = PREDICTIONS_BY_GOAL[fp.goal];
                const myItems = fp.goal === "muscle_gain" ? getMuscleGainItems(fp, workoutHistory) : (myGoalData?.[myLevel] || []);
                const levelLabel = myLevel === "beginner" ? (locale === "en" ? "Beginner" : "입문자") : (locale === "en" ? "Advanced" : "상급자");

                return (
                  <>
                    {/* 목표 탭 슬라이드 */}
                    <div className={`flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4 transition-all duration-700 delay-300 ${
                      showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                    }`}>
                      {Object.entries(PREDICTIONS_BY_GOAL).map(([key]) => {
                        const isMyGoal = key === fp.goal;
                        const isActive = selectedGoalKey === key || (selectedGoalKey === null && isMyGoal);
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              if (isMyGoal) { setSelectedGoalKey(null); }
                              else { setSelectedGoalKey(key); }
                            }}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                              isActive ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-400"
                            }`}
                          >
                            {t(`growth.goal.${key}`)}
                          </button>
                        );
                      })}
                    </div>

                    {/* 선택된 목표 예측 카드 */}
                    {(() => {
                      const isOtherGoal = selectedGoalKey !== null && selectedGoalKey !== fp.goal;
                      const activeGoalKey = isOtherGoal ? selectedGoalKey : fp.goal;
                      const activeGoalData = PREDICTIONS_BY_GOAL[activeGoalKey];
                      const activeItems = activeGoalKey === "muscle_gain" ? getMuscleGainItems(fp, workoutHistory) : (activeGoalData?.[myLevel] || []);
                      const activeReading = isOtherGoal ? computeReading({ ...fp, goal: activeGoalKey as FitnessProfile["goal"] }, workoutCount, workoutHistory, weightLog) : reading;
                      const canAccess = !isOtherGoal || isPremium;

                      return (
                        <div className="relative">
                          <div
                            className={`w-full bg-white rounded-2xl p-5 mb-4 border-2 shadow-sm transition-all duration-700 delay-400 ${
                              showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                            } ${!isOtherGoal ? "border-[#2D6A4F]/20" : "border-gray-100"} ${!canAccess ? "blur-md" : ""}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-y-1 mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={`w-2 h-2 rounded-full ${!isOtherGoal ? "bg-[#2D6A4F]" : "bg-[#059669]"}`} />
                                <span className="text-[#1B4332] text-sm font-bold">{!isOtherGoal ? t("growth.myGoal") : ""}: {t(`growth.goal.${activeGoalKey}`)}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2D6A4F]/10 text-[#2D6A4F]">{levelLabel}</span>
                              </div>
                              <span className="text-[#6B7280] text-[11px]">{(() => {
                                const c = activeReading.condition;
                                if (c === "growth.condition.notStarted") return locale === "en" ? "After starting" : "운동 시작 후 측정";
                                if (c.startsWith("growth.condition.active:")) {
                                  const [, min, freq] = c.split(":");
                                  return locale === "en" ? `${min} min/day, ${freq}x/week` : `하루 ${min}분, 주 ${freq}회 기준`;
                                }
                                return c;
                              })()}</span>
                            </div>
                      <div className="space-y-2.5">
                        {activeItems.map((item: PredictionItem, i: number) => {
                          const pred = activeReading.predictions[i];
                          const threshold = UNLOCK_THRESHOLDS[item.phase] ?? 999;
                          const isUnlocked = workoutCount >= threshold;
                          const isOpen = isUnlocked && (i === 0 || isPremium);
                          const rawLabel = locale === "en" ? item.label
                            .replace("안전한 주간 체중 감량 속도", "Safe weekly weight loss rate")
                            .replace("1개월 후 예상 체중", "Projected weight in 1 month")
                            .replace("2개월 후 예상 체중", "Projected weight in 2 months")
                            .replace("4개월 후 예상 체중", "Projected weight in 4 months")
                            .replace(/-(\d+)kg 감량 예상 기간/, "-$1kg loss timeline")
                            // 회의 22: 더 긴 문구부터 먼저 치환 (순서 의존)
                            .replace("현재 근력 수준 평가", "Current strength assessment")
                            .replace("현재 근력 수준", "Current strength level")
                            .replace("강점·약점 분석", "Strength & weakness analysis")
                            .replace(/(\d+)kg 증량 예상 기간/, "$1kg gain timeline")
                            .replace("상급 진입 예상 기간", "Advanced level timeline")
                            .replace("중급 진입 예상 기간", "Intermediate level timeline")
                            .replace("체력 테스트 등급", "Fitness test grade")
                            .replace("체력 점수 변화 예측", "Fitness score projection")
                            .replace("건강 지표 현황", "Health metrics status")
                            .replace("주간 균형 분석", "Weekly balance analysis")
                            .replace("맞춤 운동 추천", "Personalized recommendations")
                            .replace("현재 기초체력 등급", "Current fitness grade")
                            .replace("다음 등급 도달 예상 기간", "Next grade timeline")
                            .replace("2단계 상위 등급 도달 예상 기간", "2nd tier grade timeline")
                            .replace("최고 등급 도달 예상 기간", "Top grade timeline")
                            .replace("WHO 권장 운동량 달성률", "WHO exercise target %")
                            .replace("운동 빈도 분석", "Workout frequency analysis")
                            .replace("운동 일관성 분석", "Workout consistency analysis")
                            .replace("근육군 밸런스 분석", "Muscle group balance")
                            : item.label;
                          const easyLabel = rawLabel.replace(/e1RM/g, locale === "en" ? "est. 1RM" : "최대 중량").replace(/1RM/g, locale === "en" ? "1RM" : "최대 중량");
                          const rawValue = pred?.value?.toString() || "";
                          const rawSub = pred?.sub || "";
                          const easyValue = locale === "en" ? rawValue
                            .replace(/주 ([\d.]+)~([\d.]+)kg 권장/, "$1-$2 kg/week recommended")
                            .replace(/(\d+)개월 후 예상: ([\d.]+)kg/, "Projected in $1 mo: $2kg")
                            .replace("현재 칼로리 소모가 부족해요", "Not enough calorie burn")
                            .replace(/(\d+)% 달성/, "$1% achieved")
                            .replace("최대 중량 입력 후 평가 가능", "Enter 1RM to evaluate")
                            .replace("체력 테스트를 완료하면 등급이 표시됩니다", "Complete fitness test to see grade")
                            .replace("체력 테스트 2회 이상 필요", "2+ fitness tests required")
                            .replace(/주 평균 ([\d.]+)회 ✅ 충분한 빈도/, "$1x/week avg ✅ Great frequency")
                            .replace(/주 평균 ([\d.]+)회 ⚠️ 권장 기준 충족/, "$1x/week avg ⚠️ Meets minimum")
                            .replace(/주 평균 ([\d.]+)회 ❌ 빈도를 늘려보세요/, "$1x/week avg ❌ Increase frequency")
                            .replace("4주 이상 기록이 필요합니다", "4+ weeks of data needed")
                            .replace(/충족/, "Met").replace(/우수/, "Excellent").replace(/미달/, "Below")
                            .replace(/(\d+)회 운동 후 해금/, "$1 more workouts to unlock")
                            .replace(/벤치/g, "Bench").replace(/스쿼트/g, "Squat").replace(/데드/g, "Dead")
                            .replace(/초급/g, "Beginner").replace(/중급/g, "Intermediate").replace(/상급/g, "Advanced").replace(/엘리트/g, "Elite")
                            .replace(/달성/g, "Achieved")
                            .replace(/(\d+)주/g, "$1 wks")
                            .replace(/e1RM/g, "est. 1RM")
                            : rawValue.replace(/e1RM/g, "최대 중량").replace(/Best e1RM/g, "최고 기록");
                          const easySub = locale === "en" ? rawSub
                            .replace(/운동만으로 주 약 ([\d.]+)kg 소모/, "Exercise alone burns ~$1kg/week")
                            .replace(/누적 ([+-][\d.]+)kg \(칼로리 밸런스 기준\)/, "Cumulative $1kg (calorie balance)")
                            .replace("운동 빈도를 늘리거나 식단 조절이 필요해요", "Increase frequency or adjust diet")
                            .replace(/주 (\d+)분 운동 중 \/ 권장 (.+)/, "$1 min/week — recommended $2")
                            .replace(/체중 (\d+)kg 기준/, "Based on $1kg body weight")
                            .replace("각 종목별 성장률 기준", "Based on per-exercise growth rate")
                            .replace("푸쉬업 · 크런치 · 맨몸 스쿼트 (각 2분)", "Push-ups · Crunches · Squats (2 min each)")
                            .replace("테스트를 반복하면 성장 추세를 예측합니다", "Repeated tests predict growth trends")
                            .replace(/푸쉬업/g, "Push-ups").replace(/크런치/g, "Crunches").replace(/스쿼트/g, "Squats")
                            .replace(/보건복지부 권장: 주 2회 이상 근력운동/, "Recommended: 2+ strength sessions/week")
                            .replace(/150~300분/, "150-300 min")
                            .replace(/현재 (\d+)회 완료/, "$1 completed so far")
                            .replace(/e1RM/g, "est. 1RM").replace(/R²=\d+%/g, "").trim()
                            : rawSub.replace(/e1RM/g, "최대 중량").replace(/Best e1RM/g, "최고 기록").replace(/R²=\d+%/g, "").replace(/\s+,\s*/g, ", ").trim();
                          return (
                            <div key={i}>
                              {isOpen ? (
                                <div className="bg-[#FAFBF9] rounded-xl p-3 -mx-1">
                                  <p className="text-[#6B7280] text-xs mb-2">{easyLabel}</p>
                                  {/* 근력 수준 프로그레스 바 */}
                                  {pred?.strengthBars ? (
                                    <div className="space-y-2.5">
                                      {pred.strengthBars.map((bar, bi) => (
                                        <div key={bi}>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] text-[#1B4332] font-medium">{bar.name}</span>
                                            <span className="text-[11px] font-bold text-[#2D6A4F]">{bar.level}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-700"
                                              style={{
                                                width: `${bar.pct}%`,
                                                backgroundColor: bar.pct >= 80 ? "#059669" : bar.pct >= 50 ? "#2D6A4F" : "#6B7280",
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : pred?.action === "edit_1rm" && onEdit1RM ? (
                                    <button onClick={onEdit1RM} className="text-[#1B4332] text-sm font-black text-right w-full bg-[#2D6A4F]/10 px-3 py-1.5 rounded-xl active:bg-[#2D6A4F]/20 transition-all">
                                      {easyValue} →
                                    </button>
                                  ) : pred?.action === "fitness_test" ? (
                                    <button onClick={() => setShowFitnessTest(true)} className="flex items-center justify-center gap-2 w-full bg-[#2D6A4F]/10 px-3 py-2 rounded-xl active:bg-[#2D6A4F]/20 transition-all">
                                      <span className="text-[#1B4332] text-sm font-black">{easyValue}</span>
                                      <svg className="w-4 h-4 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                  ) : (
                                    <p className="text-[#1B4332] text-sm font-black text-right whitespace-pre-line">{easyValue}</p>
                                  )}
                                  {!pred?.strengthBars && easySub && <p className="text-[#2D6A4F] text-[11px] mt-1 text-right">{easySub}</p>}
                                  {!pred?.strengthBars && !pred?.action && (() => {
                                    const label = (easyLabel || "").toLowerCase();
                                    if (/체중|감량|kg|weight|loss/i.test(label)) return <p className="text-[#2D6A4F] text-[11px] mt-1.5 text-right font-bold">{t("home.prediction.weightLoss")}</p>;
                                    if (/1rm|중량|근력|strength/i.test(label)) return <p className="text-[#2D6A4F] text-[11px] mt-1.5 text-right font-bold">{t("home.prediction.strength")}</p>;
                                    if (/칼로리|kcal|calorie/i.test(label)) return <p className="text-[#2D6A4F] text-[11px] mt-1.5 text-right font-bold">{t("home.prediction.volume")}</p>;
                                    if (/who|권장|health/i.test(label)) return <p className="text-[#2D6A4F] text-[11px] mt-1.5 text-right font-bold">{t("growth.coach.good")}</p>;
                                    return null;
                                  })()}
                                </div>
                              ) : (
                                <div className="bg-gray-50 rounded-xl p-3 -mx-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[#1B4332] text-sm font-medium">{easyLabel}</span>
                                    <div className="flex items-center gap-1.5">
                                      {!isUnlocked ? (
                                        <span className="text-[10px] text-[#2D6A4F] font-bold">{locale === "en" ? `${Math.max(0, threshold - workoutCount)} more to unlock` : `${Math.max(0, threshold - workoutCount)}회 더 하면 열려요`}</span>
                                      ) : (
                                        <span className="text-[10px] text-amber-600 font-bold">프리미엄</span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-gray-400 leading-relaxed">
                                    {(() => {
                                      const label = (easyLabel || "").toLowerCase();
                                      if (/체중|감량/.test(label)) return "해금되면: 목표까지 몇 주 걸리는지 알려드려요";
                                      if (/1rm|중량|근력/.test(label)) return "해금되면: 근력 성장 추이를 예측해드려요";
                                      if (/칼로리/.test(label)) return "해금되면: 칼로리 밸런스를 분석해드려요";
                                      if (/체력|who/.test(label)) return "해금되면: 체력 변화를 추적해드려요";
                                      return locale === "en" ? "Unlock for detailed predictions" : "해금되면: 상세 예측을 확인할 수 있어요";
                                    })()}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 회귀분석 그래프 */}
                      {canAccess && (
                        <>
                          <button
                            onClick={() => setShowChart(!showChart)}
                            className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-xl bg-[#2D6A4F]/5 active:bg-[#2D6A4F]/10 transition-all"
                          >
                            <span className="text-[11px] font-bold text-[#2D6A4F]">{showChart ? (locale === "en" ? "Hide graph" : "그래프 접기") : (locale === "en" ? "View analysis graph" : "데이터 분석 그래프 보기")}</span>
                            <span className={`text-[10px] text-[#2D6A4F] transition-transform ${showChart ? "rotate-180" : ""}`}>▼</span>
                          </button>
                          {showChart && (
                            <div className="mt-3 animate-fade-in">
                              {activeGoalKey === "muscle_gain" ? (
                                <Big3RegressionChart history={workoutHistory || []} profile={fp} />
                              ) : (
                                <RegressionChart goal={activeGoalKey as "fat_loss" | "endurance"} history={workoutHistory || []} weightLog={weightLog || []} profile={fp} />
                              )}
                            </div>
                          )}
                        </>
                      )}

                    </div>

                          {/* 블러 오버레이 (프리미엄 아닌 다른 목표) */}
                          {!canAccess && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[1px]">
                              <p className="text-[15px] font-black text-[#1B4332] mb-1">프리미엄으로 모든 목표 예측 보기</p>
                              <p className="text-[11px] text-gray-400 mb-4">구독하면 모든 목표의 성장 예측을 확인할 수 있어요</p>
                              <button
                                onClick={() => onPremium?.()}
                                className="px-6 py-2.5 rounded-2xl bg-[#1B4332] text-white text-sm font-bold active:scale-95 transition-all"
                              >
                                구독하기
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

            </div>

            {/* Fixed CTA - only for initial onboarding */}
            {!resultOnly && (
              <div className="shrink-0 bg-[#FAFBF9] px-6 pb-6 pt-3 border-t border-gray-100">
                <p className="text-[#6B7280] text-xs text-center mb-3">
                  운동 데이터가 쌓일수록 예측이 정교해집니다
                </p>
                <button
                  onClick={() => onComplete(profile as FitnessProfile)}
                  className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all"
                >
                  {locale === "ko" ? "첫 운동 시작하기" : "Start First Workout"}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Premium Popup (tooltip style) */}
      {showOtherGoals && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center animate-fade-in" onClick={() => setShowOtherGoals(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-6 relative z-10" onClick={(e) => e.stopPropagation()}>
            <p className="text-emerald-600 text-[11px] font-bold tracking-wider uppercase mb-2">PREMIUM</p>
            <p className="text-[15px] font-black text-[#1B4332] leading-snug mb-1">전체 예측 리포트를 열어보세요</p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1.5">
              AI 예측 모델이 분석한 모든 목표의{"\n"}성장 예측과 레벨별 상세 리포트를 확인하세요
            </p>

            <div className="mt-4 space-y-2">
              {Object.entries(PREDICTIONS_BY_GOAL).filter(([k]) => k !== (profile as FitnessProfile).goal).map(([key, goalData]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[#1B4332] text-[13px] font-medium">{goalData.title} 예측</span>
                  <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-[#1B4332] text-[13px] font-medium">
                  {(profile as FitnessProfile).weeklyFrequency <= 2 ? "상급자" : "입문자"} 레벨 분석
                </span>
                <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <button
              onClick={() => {
                setShowOtherGoals(false);
                onPremium?.();
              }}
              className="w-full mt-5 py-3.5 rounded-2xl font-black text-sm text-amber-300 bg-[#1B4332] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)]"
            >
              프리미엄 구독하기
            </button>
            <p className="text-[10px] text-gray-400 mt-3 font-medium text-center">탭하여 닫기</p>
          </div>
        </div>
      )}

      {/* ML Tooltip (CoachTooltip style) */}
      {showMLTooltip && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center animate-fade-in" onClick={() => setShowMLTooltip(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-6 relative z-10">
            <p className="text-emerald-600 text-[11px] font-bold tracking-wider uppercase mb-2">예측 모델 안내</p>
            <p className="text-[15px] font-black text-[#1B4332] leading-snug">회귀분석 기반 머신러닝이란?</p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1.5">
              오운잘 AI는 당신의 운동 데이터에서{"\n"}총볼륨(중량x횟수), 세트수, 운동시간,{"\n"}빈도, 체중 등 다양한 입력값을 수집합니다.
            </p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-2">
              이 데이터를 XGBoost(트리 기반 앙상블) 모델과{"\n"}논문 검증된 회귀분석에 적용하여{"\n"}칼로리 소모, 근력 성장, 볼륨 추세를 예측합니다.
            </p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed mt-2">
              데이터가 쌓일수록 당신만의 패턴을 학습해{"\n"}예측 정밀도가 높아집니다.
            </p>

            <p className="text-[10px] text-gray-400 mt-3 font-medium">탭하여 닫기</p>
          </div>
        </div>
      )}
    </div>
  );
};
