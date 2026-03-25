"use client";

import React, { useState, useEffect } from "react";
import { saveUserProfile, updateGender, updateBirthYear, updateWeight } from "@/utils/userProfile";

/* ─── types ─── */
export interface FitnessProfile {
  gender: "male" | "female";
  birthYear: number;
  bodyWeight: number;
  weeklyFrequency: number;       // 주 몇 회
  sessionMinutes: number;        // 1회 운동 시간(분)
  goal: "fat_loss" | "muscle_gain" | "endurance" | "health";
}

interface Props {
  userName: string;
  onComplete: (profile: FitnessProfile) => void;
  onPremium?: () => void;
}

/* ─── constants ─── */
const FREQ_OPTIONS = [
  { value: 0, label: "안 해봤어요", sub: "처음이에요" },
  { value: 2, label: "주 1~2회", sub: "가볍게" },
  { value: 3, label: "주 3~4회", sub: "꾸준히" },
  { value: 5, label: "주 5회+", sub: "열심히" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30분" },
  { value: 45, label: "50분" },
  { value: 60, label: "60분" },
  { value: 90, label: "90분+" },
];

const GOAL_OPTIONS: { value: FitnessProfile["goal"]; label: string }[] = [
  { value: "fat_loss", label: "체지방 감량" },
  { value: "muscle_gain", label: "근력 증가" },
  { value: "endurance", label: "기초 체력" },
  { value: "health", label: "건강 유지" },
];

/* ─── 목표별 + 레벨별 예측 항목 ─── */
type UserLevel = "beginner" | "advanced";

interface PredictionItem {
  label: string;
}

interface GoalPrediction {
  title: string;
  beginner: PredictionItem[];
  advanced: PredictionItem[];
}

const PREDICTIONS_BY_GOAL: Record<string, GoalPrediction> = {
  fat_loss: {
    title: "체지방 감량",
    beginner: [
      { label: "5kg / 10kg 감량 도달 기간" },
      { label: "옷 핏 달라지는 시점" },
      { label: "다이어트 정체기 예상 시점" },
    ],
    advanced: [
      { label: "5kg / 10kg 감량 도달 기간" },
      { label: "린매스 유지 커팅 기간 예측" },
      { label: "다이어트 정체기 예상 시점" },
    ],
  },
  muscle_gain: {
    title: "근력 증가",
    beginner: [
      { label: "벤치프레스 예상 중량 변화" },
      { label: "체중 1배 벤치 도달 시점" },
      { label: "골격근량 1kg 증가 예상 기간" },
    ],
    advanced: [
      { label: "3대 운동 합계 목표 도달 시점" },
      { label: "체중 대비 2배 스쿼트 도달 시점" },
      { label: "3대 운동 중량 등급 예측" },
    ],
  },
  endurance: {
    title: "기초 체력",
    beginner: [
      { label: "5km 완주 가능 시점" },
      { label: "계단 3층 안 헐떡이는 시점" },
      { label: "턱걸이 1개 달성 예상 기간" },
    ],
    advanced: [
      { label: "10km 기록 단축 예측" },
      { label: "VO2max 향상 곡선" },
      { label: "심폐 회복 속도 변화 예측" },
    ],
  },
  health: {
    title: "건강 유지",
    beginner: [
      { label: "내 건강 나이 vs 실제 나이" },
      { label: "당뇨·심혈관 위험도 감소 예측" },
      { label: "근감소증 예방 시작 시점" },
    ],
    advanced: [
      { label: "생물학적 나이 역전 시점" },
      { label: "주요 건강 지표 최적화 기간" },
      { label: "운동 습관별 건강 나이 변화" },
    ],
  },
};

/* ─── helpers ─── */
function weeksToLabel(weeks: number): string {
  if (weeks <= 4) return `약 ${weeks}주`;
  if (weeks < 12) return `약 ${Math.round(weeks / 4)}개월`;
  if (weeks < 52) return `약 ${Math.round(weeks / 4)}개월`;
  const y = Math.floor(weeks / 52);
  const m = Math.round((weeks % 52) / 4);
  return m > 0 ? `약 ${y}년 ${m}개월` : `약 ${y}년`;
}

function weeksToTargetDate(weeks: number): string {
  const target = new Date();
  target.setDate(target.getDate() + weeks * 7);
  return `${String(target.getFullYear()).slice(2)}년 ${target.getMonth() + 1}월`;
}

/* ─── reading results (논문 기반) ─── */
interface FreePeekData {
  stat: string;       // 현재 상태 (예: "추정 체지방률: 약 24%")
  timeline: string;   // 목표 도달 시점 (예: "복근 라인 도달: 약 4개월 (2026년 7월)")
  condition: string;  // 조건 설명 (예: "하루 60분, 주 3회 기준")
}

interface ReadingResult {
  typeName: string;
  typeEmoji: string;
  message: string;
  growthStars: number;
  freePeek: FreePeekData;
}

function computeReading(p: FitnessProfile): ReadingResult {
  // 주간 총 운동 시간(분)
  const weeklyMin = p.weeklyFrequency * p.sessionMinutes;
  const age = new Date().getFullYear() - p.birthYear;

  // ACSM 권고: 주 150분 moderate or 75분 vigorous
  const acsmPct = Math.round((weeklyMin / 150) * 100);

  // 성장 포텐셜 별점 (1~5)
  let stars = 3;
  if (p.weeklyFrequency === 0) stars = 3; // 초보자 = 가장 빠른 성장 구간
  else if (p.weeklyFrequency >= 4 && p.sessionMinutes >= 60) stars = 5;
  else if (p.weeklyFrequency >= 3 && p.sessionMinutes >= 45) stars = 4;
  else if (p.weeklyFrequency <= 2 && p.sessionMinutes <= 30) stars = 2;
  // 나이 보정: 20대 +0, 30대 +0, 40대+ -0.5 (소수점 버림)
  if (age >= 40) stars = Math.max(1, stars - 1);

  // 타입 결정
  let typeName: string;
  let typeEmoji: string;
  if (p.goal === "fat_loss") {
    typeName = p.weeklyFrequency >= 4 ? "불꽃 연소형" : "꾸준한 연소형";
    typeEmoji = "🔥";
  } else if (p.goal === "muscle_gain") {
    typeName = p.weeklyFrequency >= 4 ? "폭발 성장형" : "안정 성장형";
    typeEmoji = "💪";
  } else if (p.goal === "endurance") {
    typeName = "끈기 상승형";
    typeEmoji = "⚡";
  } else {
    typeName = "균형 유지형";
    typeEmoji = "🌿";
  }

  // 메시지 (체중/나이 반영)
  const message =
    p.weeklyFrequency === 0
      ? "처음이라면 지금이 가장 좋은 시작입니다\n초보자일수록 성장 속도가 빠릅니다"
      : acsmPct >= 150
        ? "당신의 조건은\n빠른 변화를 만들기에 충분합니다"
        : acsmPct >= 100
          ? "당신의 조건은\n변화를 만들기에 충분합니다"
          : "작은 시작이\n가장 큰 변화를 만듭니다";

  // 무료 공개: 목표별 구체 수치 예측 (논문 기반 계산)
  const isBeginner = p.weeklyFrequency <= 2;

  // 주간 칼로리 소모 (운동 + 식이 보정)
  // 운동 칼로리: MET 간이 계산
  const exCalPerSession = Math.round(p.sessionMinutes * (p.bodyWeight / 13));
  // 총 적자 = 운동 칼로리 + 식이 적자 가정 (하루 300kcal 식이 조절)
  const weeklyDeficit = (p.weeklyFrequency * exCalPerSession) + (300 * 7);
  // 체지방 1kg ≈ 7700kcal — 5kg/10kg 단위 감량 기간 예측
  const weeksFor5kg = weeklyDeficit > 0 ? Math.ceil((5 * 7700) / weeklyDeficit) : 0;
  const weeksFor10kg = weeklyDeficit > 0 ? Math.ceil((10 * 7700) / weeklyDeficit) : 0;

  const conditionStr = p.weeklyFrequency === 0
    ? "운동 시작 후 측정"
    : `하루 ${p.sessionMinutes}분, 주 ${p.weeklyFrequency}회 기준`;

  let freePeek: FreePeekData;
  if (p.goal === "fat_loss") {
    if (p.weeklyFrequency === 0) {
      freePeek = {
        stat: "5kg 감량 목표",
        timeline: "운동 시작 후 측정 가능",
        condition: conditionStr,
      };
    } else {
      freePeek = {
        stat: `5kg 감량: ${weeksToLabel(weeksFor5kg)} (${weeksToTargetDate(weeksFor5kg)})`,
        timeline: `10kg 감량: ${weeksToLabel(weeksFor10kg)} (${weeksToTargetDate(weeksFor10kg)})`,
        condition: conditionStr,
      };
    }
  } else if (p.goal === "muscle_gain") {
    const startBench = Math.round(p.bodyWeight * (isBeginner ? 0.4 : 0.8));
    const weeklyGainPct = isBeginner ? 2.5 : 1.5;
    if (isBeginner) {
      const targetBench = p.bodyWeight;
      const pctNeeded = ((targetBench - startBench) / startBench) * 100;
      const weeks = Math.ceil(pctNeeded / weeklyGainPct);
      freePeek = {
        stat: `벤치프레스 예상: ${startBench}kg → ${targetBench}kg`,
        timeline: `체중 1배 도달: ${weeksToLabel(weeks)} (${weeksToTargetDate(weeks)})`,
        condition: conditionStr,
      };
    } else {
      const target15x = Math.round(p.bodyWeight * 1.5);
      const weeks = Math.ceil(((target15x - startBench) / startBench * 100) / weeklyGainPct);
      freePeek = {
        stat: `현재 추정 벤치프레스: 약 ${startBench}kg`,
        timeline: `${target15x}kg(1.5배) 도달: ${weeksToLabel(weeks)} (${weeksToTargetDate(weeks)})`,
        condition: conditionStr,
      };
    }
  } else if (p.goal === "endurance") {
    if (isBeginner) {
      const weeksTo5k = p.weeklyFrequency === 0 ? 8 : p.weeklyFrequency >= 2 ? 4 : 6;
      freePeek = {
        stat: "5km 완주 목표",
        timeline: `달성 예상: ${weeksToLabel(weeksTo5k)} (${weeksToTargetDate(weeksTo5k)})`,
        condition: p.weeklyFrequency === 0 ? "Couch to 5K 프로그램 기준" : conditionStr,
      };
    } else {
      freePeek = {
        stat: "5km 완주: 이미 가능 수준",
        timeline: `10km 기록 단축: 약 2~3개월`,
        condition: conditionStr,
      };
    }
  } else {
    const healthAge = p.weeklyFrequency === 0
      ? age + 5
      : p.weeklyFrequency >= 3 ? age - 3 : age;
    const diff = healthAge - age;
    const diffStr = diff > 0 ? `+${diff}세 (개선 필요)` : diff < 0 ? `${diff}세 (더 젊음!)` : "동일";
    freePeek = {
      stat: `건강 나이: ${healthAge}세 (실제 ${age}세)`,
      timeline: `차이: ${diffStr}`,
      condition: p.weeklyFrequency === 0 ? "규칙적 운동 시작 시 개선 가능" : conditionStr,
    };
  }

  return { typeName, typeEmoji, message, growthStars: stars, freePeek };
}

/* ─── step type ─── */
type Step = "welcome" | "profile" | "frequency" | "time" | "goal" | "analyzing" | "result";

/* ─── Component ─── */
export const FitnessReading: React.FC<Props> = ({ userName, onComplete, onPremium }) => {
  const [step, setStep] = useState<Step>("welcome");
  const [profile, setProfile] = useState<Partial<FitnessProfile>>({});
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultReady, setResultReady] = useState(false);

  const displayName = userName || "회원";

  /* ─── back navigation ─── */
  const stepOrder: Step[] = ["welcome", "profile", "frequency", "time", "goal"];
  const handleBack = () => {
    const currentIdx = stepOrder.indexOf(step);
    if (currentIdx <= 0) return;
    setStep(stepOrder[currentIdx - 1]);
  };

  /* ─── step transitions ─── */
  const handleProfileNext = () => {
    if (!gender) return;
    const byNum = parseInt(birthYear.trim());
    const wNum = parseFloat(bodyWeight.trim());
    if (isNaN(byNum) || byNum < 1900) return;
    if (isNaN(wNum) || wNum <= 0) return;

    // Save profile data
    setProfile((p) => ({ ...p, gender, birthYear: byNum, bodyWeight: wNum }));
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
    const complete = { ...profile, goal: v } as FitnessProfile;
    setProfile(complete);
    // Save to localStorage
    localStorage.setItem("alpha_fitness_profile", JSON.stringify(complete));
    localStorage.setItem("alpha_fitness_reading_done", "true");
    // Save to Firestore (users/{uid}.fitnessProfile)
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
  const reading = step === "result" ? computeReading(profile as FitnessProfile) : null;

  /* ─── render helpers ─── */
  const renderStepIndicator = () => {
    const steps: Step[] = ["profile", "frequency", "time", "goal"];
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

  useEffect(() => {
    if (step === "welcome") {
      const t = setTimeout(() => setWelcomeVisible(true), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  /* ─── RENDER ─── */
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
                src="/login-logo-kor2.png"
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
                placeholder="1995"
                className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
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
                  placeholder="70"
                  className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm font-bold text-gray-400 pb-2">kg</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 text-center font-medium mt-4">
            성별·연령·체중 기반 예측 모델에 활용됩니다
          </p>

          {/* Fixed CTA */}
          <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={handleProfileNext}
              disabled={!gender || !birthYear.trim() || !bodyWeight.trim()}
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
                <span className="font-semibold text-center w-full block">{o.label}</span>
              ), o.value)
            )}
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
        const goalKey = (profile as FitnessProfile).goal;
        const allGoals = Object.entries(PREDICTIONS_BY_GOAL);
        const myGoal = allGoals.find(([k]) => k === goalKey);
        const fp = profile as FitnessProfile;
        const freqLabel = fp.weeklyFrequency === 0 ? "입문" : `주 ${fp.weeklyFrequency}회`;
        const age = new Date().getFullYear() - fp.birthYear;
        const genderLabel = fp.gender === "male" ? "남" : "여";

        return (
          <div className="flex-1 flex flex-col bg-[#FAFBF9] min-h-0">
            {/* Fixed Header */}
            <div className="shrink-0 px-6 pt-6 pb-3 bg-[#FAFBF9]">
              <h1
                className={`text-[#1B4332] text-xl font-bold mb-2 transition-all duration-700 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {displayName}님의 성장 예측
              </h1>
              <p
                className={`text-[#6B7280] text-sm transition-all duration-700 delay-100 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                {genderLabel} · {age}세 · {fp.bodyWeight}kg · {freqLabel} · {fp.sessionMinutes}분
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">

              {/* Message + Stars */}
              <div
                className={`w-full bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm transition-all duration-700 delay-200 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <p className="text-[#1B4332] text-sm font-medium leading-relaxed whitespace-pre-line mb-4">
                  {reading.message}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280] text-sm">성장 가능성</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`text-base text-[#2D6A4F] transition-all duration-300 ${
                          resultReady ? "scale-100" : "scale-0"
                        }`}
                        style={{ transitionDelay: `${400 + i * 100}ms` }}
                      >
                        {i <= reading.growthStars ? "★" : "☆"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* My goal predictions — my level */}
              {myGoal && (() => {
                const myLevel: UserLevel = fp.weeklyFrequency <= 2 ? "beginner" : "advanced";
                const otherLevel: UserLevel = myLevel === "beginner" ? "advanced" : "beginner";
                const myItems = myGoal[1][myLevel];
                const levelLabel = myLevel === "beginner" ? "입문자" : "상급자";
                const otherLevelLabel = otherLevel === "beginner" ? "입문자" : "상급자";

                return (
                  <>
                    {/* My level card */}
                    <div
                      className={`w-full bg-white rounded-2xl p-5 mb-4 border-2 border-[#2D6A4F]/20 shadow-sm transition-all duration-700 delay-400 ${
                        showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
                        <span className="text-[#1B4332] text-sm font-bold">내 목표: {myGoal[1].title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2D6A4F]/10 text-[#2D6A4F]">{levelLabel}</span>
                      </div>
                      <div className="space-y-2.5">
                        {myItems.map((item: PredictionItem, i: number) => (
                          <div key={i}>
                            {i === 0 ? (
                              <div className="bg-[#FAFBF9] rounded-xl p-3 -mx-1">
                                <p className="text-[#6B7280] text-xs mb-1.5">{item.label}</p>
                                <p className="text-[#1B4332] text-base font-black text-right">{reading.freePeek.stat}</p>
                                <p className="text-[#2D6A4F] text-sm font-bold mt-1 text-right">{reading.freePeek.timeline}</p>
                                <p className="text-[#6B7280] text-[11px] mt-1.5 text-right">{reading.freePeek.condition}</p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-[#1B4332] text-sm">{item.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full w-3/4 bg-gray-200 rounded-full" style={{ filter: "blur(3px)" }} />
                                  </div>
                                  <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Other goals button */}
                    <button
                      onClick={() => setShowOtherGoals(true)}
                      className={`w-full py-3 text-[#6B7280] text-sm font-medium transition-all duration-700 delay-500 ${
                        showResult ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {otherLevelLabel}라면? · 다른 목표도 궁금하신가요?
                    </button>
                  </>
                );
              })()}

            </div>

            {/* Fixed CTA */}
            <div className="shrink-0 bg-[#FAFBF9] px-6 pb-6 pt-3 border-t border-gray-100">
              <p className="text-[#6B7280] text-xs text-center mb-3">
                운동 데이터 수집 후 예측 리포트가 열립니다
              </p>
              <button
                onClick={() => onComplete(profile as FitnessProfile)}
                className="w-full py-4 rounded-2xl font-bold text-white bg-[#2D6A4F] active:scale-95 transition-all"
              >
                첫 운동 시작하기
              </button>
            </div>
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
