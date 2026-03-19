"use client";

import React, { useState, useEffect, useRef } from "react";
import { UserCondition, WorkoutGoal, WorkoutHistory, SessionMode, TargetMuscle, RunType } from "@/constants/workout";
import { updateWeight, updateGender, updateBirthYear } from "@/utils/userProfile";
import { getIntensityRecommendation, type IntensityLevel } from "@/utils/workoutMetrics";

export interface SessionSelection {
  goal: WorkoutGoal;
  sessionMode: SessionMode;
  targetMuscle?: TargetMuscle;
  runType?: RunType;
}

interface ConditionCheckProps {
  onComplete: (condition: UserCondition, goal: WorkoutGoal, session?: SessionSelection) => void;
  onBack?: () => void;
}

type Step = "body_check" | "weight_input" | "goal_select";

export const ConditionCheck: React.FC<ConditionCheckProps> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState<Step>("body_check");

  // State
  const [bodyPart, setBodyPart] = useState<UserCondition["bodyPart"] | null>(null);
  const [energy, setEnergy] = useState<number>(3);
  const [goal, setGoal] = useState<WorkoutGoal | null>(null);
  const [bodyWeight, setBodyWeight] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alpha_body_weight") || "";
    }
    return "";
  });
  const [gender, setGender] = useState<"male" | "female" | null>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("alpha_gender") as "male" | "female") || null;
    }
    return null;
  });
  const [birthYear, setBirthYear] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alpha_birth_year") || "";
    }
    return "";
  });

  const [recentHistory, setRecentHistory] = useState<WorkoutHistory[]>([]);
  const [showCoachTip, setShowCoachTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_condition");
    }
    return true;
  });
  const [showGoalTip, setShowGoalTip] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("alpha_tip_goal");
    }
    return true;
  });
  const firstCardRef = useRef<HTMLDivElement>(null);
  const goalSectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [goalPos, setGoalPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Load recent history for intensity recommendation
  useEffect(() => {
    try {
      const raw = localStorage.getItem("alpha_workout_history");
      if (raw) {
        const all: WorkoutHistory[] = JSON.parse(raw);
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        setRecentHistory(all.filter(h => new Date(h.date).getTime() > cutoff));
      }
    } catch { /* ignore */ }
  }, []);

  const savedBirthYear = (() => {
    if (typeof window === "undefined") return undefined;
    const v = parseInt(localStorage.getItem("alpha_birth_year") || "");
    return !isNaN(v) && v > 1900 ? v : undefined;
  })();

  const savedGender = (() => {
    if (typeof window === "undefined") return undefined;
    return (localStorage.getItem("alpha_gender") as "male" | "female") || undefined;
  })();

  const intensityRec = recentHistory.length > 0
    ? getIntensityRecommendation(recentHistory, savedBirthYear, savedGender)
    : null;

  // 코치 한마디 생성 (히스토리 기반)
  const coachMessage = (() => {
    const isFirstTime = recentHistory.length === 0;
    if (isFirstTime) {
      return {
        greeting: "반가워요! 함께 할 수 있어 기쁘네요 :)",
        message: "ACSM 국제 스포츠의학 기관, 한국체육대학교, 그리고 건강운동관리사 가이드라인과 현직 10년 이상의 트레이닝 노하우, 최근 5년 내 500건 이상의 SCI급 연구 논문들을 학습한 제가 하나하나 도와드릴테니 믿고 따라와주세요!\n\n오늘의 컨디션은 어떠신가요?",
      };
    }
    const lastSession = recentHistory[0];
    const daysSinceLast = Math.floor((Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24));
    const nextIntensity = intensityRec?.nextRecommended === "high" ? "고강도" : intensityRec?.nextRecommended === "moderate" ? "중강도" : "저강도";

    if (daysSinceLast === 0) {
      return { greeting: "오늘 또 운동오셨군요!", message: "이미 오늘 운동하셨는데 부족했나보네요. 그것도 좋아요. 몸 상태부터 체크할게요." };
    } else if (daysSinceLast === 1) {
      return { greeting: "이틀 연속이네요! 잘한다! 잘한다! 잘한다!", message: `오늘은 ${nextIntensity} 세션을 추천드려요. 몸 상태부터 확인할게요.` };
    } else if (daysSinceLast <= 3) {
      return { greeting: "다시 오셨네요!", message: `${daysSinceLast}일 만이에요. 오늘 ${nextIntensity} 세션 어떠세요?` };
    } else {
      return { greeting: `${daysSinceLast}일 만이에요!`, message: "충분히 쉬셨으니 가볍게 시작해볼까요? 몸 상태부터 알려주세요." };
    }
  })();

  // 튜토리얼 카드 위치 계산
  useEffect(() => {
    if (!showCoachTip || !firstCardRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const cardRect = firstCardRef.current.getBoundingClientRect();
    setCardPos({
      top: cardRect.top - containerRect.top,
      left: cardRect.left - containerRect.left,
      width: cardRect.width,
      height: cardRect.height,
    });
  }, [showCoachTip, step]);

  const dismissCoachTip = () => {
    setShowCoachTip(false);
    localStorage.setItem("alpha_tip_condition", "1");
  };

  // Goal 튜토리얼 위치 계산
  useEffect(() => {
    if (!showGoalTip || step !== "goal_select" || !goalSectionRef.current || !containerRef.current) return;
    const timer = setTimeout(() => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const goalRect = goalSectionRef.current!.getBoundingClientRect();
      setGoalPos({
        top: goalRect.top - containerRect.top,
        left: goalRect.left - containerRect.left,
        width: goalRect.width,
        height: goalRect.height,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [showGoalTip, step]);

  const dismissGoalTip = () => {
    setShowGoalTip(false);
    localStorage.setItem("alpha_tip_goal", "1");
  };

  // Goal 튜토리얼 메시지
  const goalTipMessage = (() => {
    const hasHistory = recentHistory.length > 0;
    if (hasHistory && intensityRec) {
      const { weekSummary, target, nextRecommended, reason } = intensityRec;
      const recLabel = nextRecommended === "high" ? "고강도" : nextRecommended === "moderate" ? "중강도" : "저강도";
      return {
        title: `오늘은 ${recLabel}를 추천드려요`,
        message: `이번 주 강도 밸런스:\n고강도 ${weekSummary.high}/${target.high}회 · 중강도 ${weekSummary.moderate}/${target.moderate}회 · 저강도 ${weekSummary.low}/${target.low}회\n\n${reason}\n\n추천을 따르면 세트·횟수·무게까지\n자동으로 최적화됩니다!`,
      };
    }
    return {
      title: "원하시는 목표로 시작하세요!",
      message: "체지방 연소 → 고반복 경량\n근비대 → 중량 볼륨\n최대근력 → 고중량 저반복\n\n다음 운동부터는 주간 강도 밸런스,\n회복 시간, 나이·성별까지 분석해서\n제가 오늘의 목표를 추천해드려요!",
    };
  })();

  // 이전에 이미 프로필을 저장한 적이 있으면 체중만 표시 (현재 입력값이 아닌 저장된 값 기준)
  const [hasProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    const savedG = localStorage.getItem("alpha_gender");
    const savedBY = localStorage.getItem("alpha_birth_year");
    return !!savedG && !!savedBY && savedBY.length >= 4;
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
      setStep("goal_select");
    } else if (step === "goal_select" && selectedGoal) {
      setGoal(selectedGoal);
      const weightNum = parseFloat(bodyWeight);
      const birthYearNum = parseInt(birthYear);
      onComplete({
        bodyPart: bodyPart!,
        energyLevel: energy as 1|2|3|4|5,
        availableTime: 50,
        bodyWeightKg: !isNaN(weightNum) && weightNum > 0 ? weightNum : undefined,
        gender: gender || undefined,
        birthYear: !isNaN(birthYearNum) && birthYearNum > 1900 ? birthYearNum : undefined,
      }, selectedGoal, session);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full p-6 animate-fade-in relative">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
        <div
          className="h-full bg-[#2D6A4F] transition-all duration-500"
          style={{ width: step === "body_check" ? "33%" : step === "weight_input" ? "66%" : "100%" }}
        />
      </div>

      <div key={step} className="flex-1 flex flex-col gap-6 overflow-y-auto pb-24 scrollbar-hide">
        <div key={`header-${step}`} className="pt-4 pb-2 animate-fade-in shrink-0">
          <div className="flex items-center gap-2">
            {step !== "body_check" && (
              <button
                onClick={handleBack}
                className="text-gray-400 hover:text-gray-600 active:scale-90 transition-all -ml-1 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="text-[#2D6A4F] font-bold tracking-[0.2em] uppercase text-xs">
              AI 분석 • 단계 {step === "body_check" ? "1" : step === "weight_input" ? "2" : "3"}
            </span>
          </div>
          <h1 className="text-3xl font-black mt-2 leading-tight text-[#5C795E]">
            {step === "body_check" ? "오늘 몸 상태는\n어떠신가요?" : step === "weight_input" ? (hasProfile ? "오늘 체중을\n입력해주세요" : "기본 정보를\n입력해주세요") : "오늘의 운동\n목표는 무엇인가요?"}
          </h1>
        </div>
        {step === "body_check" ? (
          <>
            {/* Coach tip placeholder — overlay rendered below */}
            {/* Body Condition Selection */}
            <div className="flex flex-col gap-3">
              <div ref={firstCardRef}>
                <ConditionCard
                  selected={bodyPart === "upper_stiff"}
                  onClick={() => handleNext("upper_stiff")}
                  title="상체가 굳어있음"
                  desc="목, 어깨, 등, 날개뼈 주위가 뻐근함"
                  delay={0.05}
                />
              </div>
              <ConditionCard
                selected={bodyPart === "lower_heavy"}
                onClick={() => handleNext("lower_heavy")}
                title="하체가 무거움"
                desc="고관절, 햄스트링, 종아리가 타이트함"
                delay={0.1}
              />
              <ConditionCard
                selected={bodyPart === "full_fatigue"}
                onClick={() => handleNext("full_fatigue")}
                title="전반적 피로감"
                desc="근육통 혹은 전신 컨디션 저하"
                delay={0.15}
              />
              <ConditionCard
                selected={bodyPart === "good"}
                onClick={() => handleNext("good")}
                title="컨디션 좋음"
                desc="특별한 불편함 없이 활력 넘침"
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
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 animate-card-enter" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">출생연도</p>
                  <div className="flex items-end justify-center gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      placeholder="1995"
                      className="w-full text-center text-3xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 animate-card-enter" style={{ animationDelay: "0.15s", animationFillMode: "forwards" }}>
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
              </>
            ) : (
              /* 재방문: 체중만 크게 */
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 animate-card-enter" style={{ animationDelay: "0.05s", animationFillMode: "forwards" }}>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">오늘 체중</p>
                <div className="flex items-end justify-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(e.target.value)}
                    placeholder="70"
                    autoFocus
                    className="w-32 text-center text-4xl font-black text-[#5C795E] bg-transparent border-b-2 border-[#2D6A4F] outline-none pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-lg font-bold text-gray-400 pb-2">kg</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-500 text-center font-medium">
              {hasProfile ? "매일 체중을 기록하면 더 정확한 분석이 가능해요" : "성별·연령·체중 기반 백분위 비교 및 AI 코칭에 활용됩니다"}
            </p>

            <button
              onClick={() => handleNext()}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] bg-[#5C795E] text-white hover:bg-[#2D6A4F]"
            >
              다음
            </button>
          </div>
        ) : (
          /* Goal Selection */
          <GoalSelection
            goal={goal}
            onSelect={(g, session) => handleNext(undefined, g, session)}
            recommendedIntensity={intensityRec?.nextRecommended || null}
            goalSectionRef={goalSectionRef}
          />
        )}
      </div>

      <div className="absolute bottom-8 left-6 right-6">
        {/* Next Button Removed */}
      </div>

      {/* Coach Tutorial Overlay — spotlight on first condition card */}
      {showCoachTip && step === "body_check" && cardPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissCoachTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          {/* Spotlight on first card */}
          <div
            className="absolute rounded-2xl border-2 border-white/70 bg-white/10"
            style={{ top: cardPos.top - 4, left: cardPos.left - 4, width: cardPos.width + 8, height: cardPos.height + 8 }}
          />
          {/* Tooltip below first card */}
          <div
            className="absolute px-4"
            style={{ top: cardPos.top + cardPos.height + 14, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-2 relative">
              <div className="absolute -top-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
              <p className="text-emerald-600 text-[11px] font-bold tracking-wider uppercase mb-2">오운잘 코치</p>
              <p className="text-[15px] font-black text-[#1B4332] leading-snug">{coachMessage.greeting}</p>
              <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1.5 whitespace-pre-line">{coachMessage.message}</p>
              <p className="text-[10px] text-gray-400 mt-3 font-medium">탭하여 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* Goal Tutorial Overlay — spotlight on goal cards */}
      {showGoalTip && step === "goal_select" && goalPos && (
        <div className="absolute inset-0 z-[60] animate-fade-in" onClick={dismissGoalTip}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          {/* Spotlight on strength card */}
          <div
            className="absolute rounded-2xl border-2 border-white/70 bg-white/10"
            style={{ top: goalPos.top - 4, left: goalPos.left - 4, width: goalPos.width + 8, height: goalPos.height + 8 }}
          />
          {/* Tooltip above strength card */}
          <div
            className="absolute px-4"
            style={{ bottom: `calc(100% - ${goalPos.top}px + 14px)`, left: 0, right: 0 }}
          >
            <div className="bg-white rounded-2xl px-5 py-5 shadow-2xl mx-2 relative">
              <p className="text-emerald-600 text-[11px] font-bold tracking-wider uppercase mb-2">오운잘 코치</p>
              <p className="text-[15px] font-black text-[#1B4332] leading-snug">{goalTipMessage.title}</p>
              <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1.5 whitespace-pre-line">{goalTipMessage.message}</p>
              <p className="text-[10px] text-gray-400 mt-3 font-medium">탭하여 닫기</p>
              <div className="absolute -bottom-2 left-8 w-4 h-4 bg-white rotate-45 rounded-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const INTENSITY_TO_GOAL: Record<string, WorkoutGoal> = {
  high: "strength",
  moderate: "muscle_gain",
  low: "fat_loss",
};

const GoalSelection = ({
  goal,
  onSelect,
  recommendedIntensity,
  goalSectionRef,
}: {
  goal: WorkoutGoal | null;
  onSelect: (g: WorkoutGoal, session?: SessionSelection) => void;
  recommendedIntensity: "high" | "moderate" | "low" | null;
  goalSectionRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const [subView, setSubView] = useState<"split" | "running" | null>(null);
  const recGoal = recommendedIntensity ? INTENSITY_TO_GOAL[recommendedIntensity] : null;

  // 부위별 운동 서브뷰
  if (subView === "split") {
    const muscles: { key: TargetMuscle; label: string; desc: string }[] = [
      { key: "chest", label: "가슴", desc: "벤치프레스, 인클라인, 플라이 등" },
      { key: "back", label: "등", desc: "풀업, 로우, 페이스풀 등" },
      { key: "shoulders", label: "어깨", desc: "프레스, 레터럴레이즈, 리어델트 등" },
      { key: "arms", label: "팔", desc: "바벨컬, 해머컬, 트라이셉 등" },
      { key: "legs", label: "하체", desc: "스쿼트, 런지, 레그컬 등" },
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
          뒤로
        </button>
        <p className="text-sm font-bold text-[#2D6A4F] mb-1">어떤 부위를 집중할까요?</p>
        {muscles.map((m, i) => (
          <ConditionCard
            key={m.key}
            selected={false}
            onClick={() => onSelect("muscle_gain", { goal: "muscle_gain", sessionMode: "split", targetMuscle: m.key })}
            title={m.label}
            desc={m.desc}
            delay={0.05 * (i + 1)}
          />
        ))}
      </div>
    );
  }

  // 러닝 종류 서브뷰
  if (subView === "running") {
    const runs: { key: RunType; label: string; desc: string }[] = [
      { key: "interval", label: "인터벌 달리기", desc: "빠르게/느리게 반복, 심폐 능력 향상" },
      { key: "easy", label: "이지런 (가벼운 조깅)", desc: "편하게 30-40분, 체지방 연소" },
      { key: "long", label: "장거리 달리기", desc: "60분 이상, 지구력 훈련" },
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
          뒤로
        </button>
        <p className="text-sm font-bold text-[#2D6A4F] mb-1">어떤 달리기를 할까요?</p>
        {runs.map((r, i) => (
          <ConditionCard
            key={r.key}
            selected={false}
            onClick={() => onSelect("general_fitness", { goal: "general_fitness", sessionMode: "running", runType: r.key })}
            title={r.label}
            desc={r.desc}
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
        title="살 빼기"
        desc="유산소 + 근지구력 위주 운동"
        highlight="Burn"
        recommended={recGoal === "fat_loss"}
        delay={0.05}
      />
      <ConditionCard
        selected={goal === "muscle_gain"}
        onClick={() => onSelect("muscle_gain", { goal: "muscle_gain", sessionMode: "balanced" })}
        title="근육 키우기"
        desc="근육량 증가에 집중하는 운동"
        highlight="Build"
        recommended={recGoal === "muscle_gain"}
        delay={0.1}
      />
      <div ref={goalSectionRef}>
        <ConditionCard
          selected={goal === "strength"}
          onClick={() => onSelect("strength", { goal: "strength", sessionMode: "balanced" })}
          title="힘 세지기"
          desc="무거운 무게로 힘을 키우는 운동"
          highlight="Power"
          recommended={recGoal === "strength"}
          delay={0.15}
        />
      </div>

      {/* 다른 운동 */}
      <div className="flex flex-col gap-3">
          <ConditionCard
            selected={false}
            onClick={() => setSubView("split")}
            title="부위별 운동"
            desc="가슴, 등, 어깨, 팔, 하체 중 선택"
            delay={0.2}
          />
          <ConditionCard
            selected={false}
            onClick={() => setSubView("running")}
            title="러닝 훈련"
            desc="인터벌, 이지런, 장거리 중 선택"
            delay={0.25}
          />
          <ConditionCard
            selected={false}
            onClick={() => onSelect("general_fitness", { goal: "general_fitness", sessionMode: "home_training" })}
            title="기초체력 강화"
            desc="맨몸 + 덤벨, 집에서도 가능한 전신 운동"
            highlight="Fit"
            delay={0.3}
          />
      </div>
    </div>
  );
};

const ConditionCard = ({
  title,
  desc,
  selected,
  onClick,
  highlight,
  recommended,
  delay = 0
}: {
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  highlight?: string;
  recommended?: boolean;
  delay?: number;
}) => (
  <button
    onClick={onClick}
    className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 active:scale-[0.98] animate-card-enter ${
      selected
        ? "border-[#2D6A4F] bg-emerald-50 ring-1 ring-[#2D6A4F]"
        : recommended
          ? "border-amber-300 bg-amber-50/40 hover:border-amber-400 ring-1 ring-amber-200"
          : "border-gray-100 bg-white hover:border-gray-300"
    }`}
    style={{ animationDelay: `${delay}s`, animationFillMode: "forwards" }}
  >
    <div className="flex justify-between items-center mb-1">
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${selected ? "text-[#1B4332]" : "text-gray-900"}`}>
          {title}
        </span>
        {recommended && !selected && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wider">추천</span>
        )}
      </div>
      {selected && (
        <svg className="w-6 h-6 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <p className={`text-xs font-medium ${selected ? "text-[#2D6A4F]" : "text-gray-500"}`}>
      {desc}
    </p>
  </button>
);
