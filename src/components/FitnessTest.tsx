"use client";

import React, { useState, useEffect, useRef } from "react";

interface FitnessTestProps {
  gender: "male" | "female";
  birthYear: number;
  onComplete: (results: FitnessTestResult) => void;
  onBack: () => void;
}

export interface FitnessTestResult {
  date: string;
  pushups: number;
  crunches: number;
  squats: number;
  pushupGrade: number; // 1~5
  crunchGrade: number;
  squatGrade: number;
  overallGrade: number;
}

type TestPhase = "intro" | "ready" | "testing" | "rest" | "result";
type Exercise = "pushups" | "crunches" | "squats";

const EXERCISES: { key: Exercise; label: string; icon: string }[] = [
  { key: "pushups", label: "푸쉬업", icon: "" },
  { key: "crunches", label: "크런치", icon: "" },
  { key: "squats", label: "맨몸 스쿼트", icon: "" },
];

const TEST_DURATION = 120; // 2분
const REST_DURATION = 30; // 30초 휴식

// 푸쉬업 등급표 (ACSM 기준, 2분)
const PUSHUP_STANDARDS = {
  male: [
    { age: [19, 24], grades: [45, 37, 28, 20, 0] },
    { age: [25, 29], grades: [43, 35, 27, 19, 0] },
    { age: [30, 34], grades: [40, 33, 25, 18, 0] },
    { age: [35, 39], grades: [38, 31, 23, 16, 0] },
    { age: [40, 49], grades: [35, 28, 21, 14, 0] },
    { age: [50, 59], grades: [30, 24, 18, 12, 0] },
    { age: [60, 99], grades: [25, 20, 15, 10, 0] },
  ],
  female: [
    { age: [19, 24], grades: [40, 33, 25, 17, 0] },
    { age: [25, 29], grades: [38, 31, 23, 16, 0] },
    { age: [30, 34], grades: [36, 29, 22, 15, 0] },
    { age: [35, 39], grades: [33, 27, 20, 13, 0] },
    { age: [40, 49], grades: [30, 24, 18, 12, 0] },
    { age: [50, 59], grades: [25, 20, 15, 10, 0] },
    { age: [60, 99], grades: [20, 16, 12, 8, 0] },
  ],
};

// 크런치 등급표 (국민체력100 윗몸일으키기 기준, 2분)
const CRUNCH_STANDARDS = {
  male: [
    { age: [19, 24], grades: [58, 48, 36, 25, 0] },
    { age: [25, 29], grades: [55, 45, 33, 22, 0] },
    { age: [30, 34], grades: [52, 42, 30, 19, 0] },
    { age: [35, 39], grades: [48, 38, 28, 18, 0] },
    { age: [40, 49], grades: [42, 33, 24, 15, 0] },
    { age: [50, 59], grades: [35, 28, 20, 12, 0] },
    { age: [60, 99], grades: [28, 22, 16, 10, 0] },
  ],
  female: [
    { age: [19, 24], grades: [50, 40, 28, 18, 0] },
    { age: [25, 29], grades: [47, 37, 26, 16, 0] },
    { age: [30, 34], grades: [44, 34, 24, 15, 0] },
    { age: [35, 39], grades: [40, 31, 22, 13, 0] },
    { age: [40, 49], grades: [35, 27, 19, 11, 0] },
    { age: [50, 59], grades: [28, 22, 15, 9, 0] },
    { age: [60, 99], grades: [22, 17, 12, 7, 0] },
  ],
};

// 맨몸 스쿼트 등급표 (자체 기준, 2분)
const SQUAT_STANDARDS = {
  male: [
    { age: [19, 24], grades: [45, 37, 28, 20, 0] },
    { age: [25, 29], grades: [43, 35, 27, 19, 0] },
    { age: [30, 34], grades: [40, 33, 25, 18, 0] },
    { age: [35, 39], grades: [38, 31, 23, 16, 0] },
    { age: [40, 49], grades: [35, 28, 21, 14, 0] },
    { age: [50, 59], grades: [30, 24, 18, 12, 0] },
    { age: [60, 99], grades: [25, 20, 15, 10, 0] },
  ],
  female: [
    { age: [19, 24], grades: [40, 33, 25, 17, 0] },
    { age: [25, 29], grades: [38, 31, 23, 16, 0] },
    { age: [30, 34], grades: [36, 29, 22, 15, 0] },
    { age: [35, 39], grades: [33, 27, 20, 13, 0] },
    { age: [40, 49], grades: [30, 24, 18, 12, 0] },
    { age: [50, 59], grades: [25, 20, 15, 10, 0] },
    { age: [60, 99], grades: [20, 16, 12, 8, 0] },
  ],
};

function getGrade(count: number, standards: typeof PUSHUP_STANDARDS, gender: "male" | "female", age: number): number {
  const table = standards[gender];
  const row = table.find(r => age >= r.age[0] && age <= r.age[1]) || table[table.length - 1];
  if (count >= row.grades[0]) return 1; // 최우수
  if (count >= row.grades[1]) return 2; // 우수
  if (count >= row.grades[2]) return 3; // 양호
  if (count >= row.grades[3]) return 4; // 보통
  return 5; // 미흡
}

const GRADE_LABELS = ["", "최우수", "우수", "양호", "보통", "미흡"];
const GRADE_COLORS = ["", "#059669", "#2D6A4F", "#D97706", "#EA580C", "#DC2626"];

export const FitnessTest: React.FC<FitnessTestProps> = ({ gender, birthYear, onComplete, onBack }) => {
  const age = new Date().getFullYear() - birthYear;
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [phase, setPhase] = useState<TestPhase>("intro");
  const [timer, setTimer] = useState(TEST_DURATION);
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<Record<Exercise, number>>({ pushups: 0, crunches: 0, squats: 0 });
  const [restTimer, setRestTimer] = useState(REST_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentExercise = EXERCISES[exerciseIdx];
  const isLastExercise = exerciseIdx === EXERCISES.length - 1;

  // 타이머
  useEffect(() => {
    if (phase === "testing" && timer > 0) {
      timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    if (phase === "testing" && timer === 0) {
      // 시간 종료
      handleExerciseDone();
    }
  }, [phase, timer]);

  // 휴식 타이머
  useEffect(() => {
    if (phase === "rest" && restTimer > 0) {
      const t = setTimeout(() => setRestTimer(r => r - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === "rest" && restTimer === 0) {
      startNextExercise();
    }
  }, [phase, restTimer]);

  const handleExerciseDone = () => {
    const updated = { ...results, [currentExercise.key]: count };
    setResults(updated);

    if (isLastExercise) {
      // 전체 완료 → 결과
      const pushupGrade = getGrade(updated.pushups, PUSHUP_STANDARDS, gender, age);
      const crunchGrade = getGrade(updated.crunches, CRUNCH_STANDARDS, gender, age);
      const squatGrade = getGrade(updated.squats, SQUAT_STANDARDS, gender, age);
      const overallGrade = Math.round((pushupGrade + crunchGrade + squatGrade) / 3);

      const result: FitnessTestResult = {
        date: new Date().toISOString(),
        pushups: updated.pushups,
        crunches: updated.crunches,
        squats: updated.squats,
        pushupGrade,
        crunchGrade,
        squatGrade,
        overallGrade,
      };

      // localStorage에 저장
      try {
        const history = JSON.parse(localStorage.getItem("alpha_fitness_test_history") || "[]");
        history.push(result);
        localStorage.setItem("alpha_fitness_test_history", JSON.stringify(history));
      } catch { /* ignore */ }

      setPhase("result");
      onComplete(result);
    } else {
      // 다음 종목 휴식
      setPhase("rest");
      setRestTimer(REST_DURATION);
    }
  };

  const startNextExercise = () => {
    setExerciseIdx(i => i + 1);
    setCount(0);
    setTimer(TEST_DURATION);
    setPhase("ready");
  };

  const startTest = () => {
    setCount(0);
    setTimer(TEST_DURATION);
    setPhase("testing");
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 인트로 화면
  if (phase === "intro") {
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        <div className="pt-[max(2rem,env(safe-area-inset-top))] pb-3 px-6 flex items-center shrink-0">
          <button onClick={onBack} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-black text-[#1B4332] mb-2">기초체력 테스트</h1>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            3가지 종목을 각 2분씩 측정합니다.<br />
            최대 횟수를 기록해주세요.
          </p>
          <div className="w-full space-y-3 mb-8">
            {EXERCISES.map((ex, i) => (
              <div key={ex.key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                <span className="text-sm font-black text-[#2D6A4F] w-6">{i + 1}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-[#1B4332]">{i + 1}. {ex.label}</p>
                  <p className="text-[11px] text-gray-400">2분간 최대 횟수</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setPhase("ready")}
            className="w-full py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-lg active:scale-[0.98] transition-all"
          >
            테스트 시작
          </button>
        </div>
      </div>
    );
  }

  // 준비 화면
  if (phase === "ready") {
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-4">
            종목 {exerciseIdx + 1} / {EXERCISES.length}
          </p>
          <h1 className="text-3xl font-black text-[#1B4332] mb-2">{currentExercise.label}</h1>
          <p className="text-sm text-gray-500 mb-2">2분간 최대 횟수를 수행하세요</p>
          <p className="text-xs text-gray-400 mb-8">준비되면 시작 버튼을 눌러주세요</p>
          <button
            onClick={startTest}
            className="w-48 h-48 rounded-full bg-[#2D6A4F] text-white font-bold text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center"
          >
            시작
          </button>
        </div>
      </div>
    );
  }

  // 테스트 진행
  if (phase === "testing") {
    const progress = 1 - timer / TEST_DURATION;
    const isUrgent = timer <= 10;
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        <div className="flex-1 flex flex-col items-center justify-evenly px-6 text-center">
          {/* 상단: 종목 + 타이머 */}
          <div className="flex flex-col items-center shrink-0">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">
              종목 {exerciseIdx + 1} / {EXERCISES.length}
            </p>
            <p className="text-lg font-bold text-[#1B4332] mb-3">{currentExercise.label}</p>
            <p className={`text-6xl font-black tabular-nums tracking-tighter ${isUrgent ? "text-red-500 animate-pulse" : "text-[#1B4332]"}`}>
              {formatTime(timer)}
            </p>
            {/* 프로그레스 바 */}
            <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-[#2D6A4F]"}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* 중앙: 카운트 */}
          <div className="flex flex-col items-center shrink-0">
            <p className="text-8xl font-black text-[#2D6A4F] tabular-nums">{count}</p>
            <p className="text-sm font-bold text-gray-400 mt-1">회</p>
          </div>

          {/* 하단: 카운트 버튼 + 완료 */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <button
              onClick={() => setCount(c => c + 1)}
              className="w-32 h-32 rounded-full bg-[#2D6A4F] text-white shadow-2xl active:scale-90 transition-all flex items-center justify-center"
            >
              <span className="text-2xl font-black">+1</span>
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setCount(c => Math.max(0, c - 1))}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold active:scale-95"
              >
                -1
              </button>
              <button
                onClick={handleExerciseDone}
                className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-bold active:scale-95"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 휴식 화면
  if (phase === "rest") {
    const nextEx = EXERCISES[exerciseIdx + 1];
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-2">
            {currentExercise.label} 완료!
          </p>
          <p className="text-4xl font-black text-[#2D6A4F] mb-6">{count}회 기록</p>
          <p className="text-sm text-gray-500 mb-2">잠시 휴식 후 다음 종목</p>
          <p className="text-6xl font-black text-[#1B4332] tabular-nums mb-4">{restTimer}</p>
          <p className="text-xs text-gray-400 mb-8">다음: {nextEx?.label}</p>
          <button
            onClick={startNextExercise}
            className="px-8 py-3 rounded-xl bg-[#2D6A4F] text-white font-bold active:scale-95 transition-all"
          >
            바로 시작
          </button>
        </div>
      </div>
    );
  }

  // 결과 화면
  const pushupGrade = getGrade(results.pushups, PUSHUP_STANDARDS, gender, age);
  const crunchGrade = getGrade(results.crunches, CRUNCH_STANDARDS, gender, age);
  const squatGrade = getGrade(results.squats, SQUAT_STANDARDS, gender, age);
  const overallGrade = Math.round((pushupGrade + crunchGrade + squatGrade) / 3);

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in">
      <div className="pt-[max(2rem,env(safe-area-inset-top))] pb-3 px-6 flex items-center shrink-0">
        <button onClick={onBack} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 text-center text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">테스트 결과</span>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="text-center mb-6">
          <p className="text-5xl font-black mb-2" style={{ color: GRADE_COLORS[overallGrade] }}>
            {GRADE_LABELS[overallGrade]}
          </p>
          <p className="text-sm text-gray-500">{gender === "male" ? "남성" : "여성"} {age}세 기준</p>
        </div>

        <div className="space-y-3 mb-6">
          {EXERCISES.map((ex, i) => {
            const grade = [pushupGrade, crunchGrade, squatGrade][i];
            const reps = [results.pushups, results.crunches, results.squats][i];
            return (
              <div key={ex.key} className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#1B4332]">{ex.label}</p>
                    <p className="text-xs text-gray-400">{reps}회 / 2분</p>
                  </div>
                </div>
                <span className="text-sm font-black px-3 py-1 rounded-full" style={{ color: GRADE_COLORS[grade], backgroundColor: `${GRADE_COLORS[grade]}15` }}>
                  {GRADE_LABELS[grade]}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={onBack}
          className="w-full py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-lg active:scale-[0.98] transition-all"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};
