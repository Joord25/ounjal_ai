"use client";

import React, { useState, useEffect, useRef } from "react";
import type { WorkoutHistory, WorkoutGoal } from "@/constants/workout";
import { getOrCreateWeeklyQuests, type QuestDefinition, type QuestProgress } from "@/utils/questSystem";
import { getIntensityRecommendation } from "@/utils/workoutMetrics";
import { calcE1RMTrendByExercise, calcVolumeGrowthRate, calcWeightTrend } from "@/utils/predictionUtils";

interface HomeScreenProps {
  userName?: string;
  onStartWorkout: () => void;
  onShowPrediction?: () => void;
}

interface FitnessProfile {
  gender: "male" | "female";
  birthYear: number;
  bodyWeight: number;
  weeklyFrequency: number;
  sessionMinutes: number;
  goal: "fat_loss" | "muscle_gain" | "endurance" | "health";
  bench1RM?: number;
  squat1RM?: number;
  deadlift1RM?: number;
}

// 오늘의 추천 운동 타입 계산
const getTodayWorkoutInfo = (goal: WorkoutGoal | null) => {
  const dayIndex = (new Date().getDay() + 6) % 7; // 월=0 ~ 일=6
  const g = goal || "muscle_gain";

  const splitLabels: Record<string, { label: string; focus: string }> = {
    push: { label: "푸시 데이", focus: "가슴 · 어깨 · 삼두" },
    pull: { label: "풀 데이", focus: "등 · 이두" },
    leg_core: { label: "레그 데이", focus: "하체 · 코어" },
    run_speed: { label: "스피드 러닝", focus: "인터벌 트레이닝" },
    run_easy: { label: "회복 러닝", focus: "가벼운 유산소" },
    run_long: { label: "장거리 러닝", focus: "지구력 훈련" },
    mobility: { label: "모빌리티", focus: "회복 · 스트레칭" },
    full_body_circuit: { label: "전신 서킷", focus: "서킷 트레이닝" },
    hiit_cardio: { label: "HIIT 유산소", focus: "고강도 인터벌" },
    full_body_mobility: { label: "전신 모빌리티", focus: "유연성 회복" },
    upper_cardio: { label: "상체 + 유산소", focus: "상체 트레이닝" },
    lower_core: { label: "하체 + 코어", focus: "하체 트레이닝" },
  };

  const goalLabels: Record<WorkoutGoal, string> = {
    muscle_gain: "근육 키우기",
    strength: "근력 강화",
    fat_loss: "체지방 감량",
    general_fitness: "체력 향상",
  };

  const defaultSchedule = ["push", "run_speed", "pull", "run_easy", "leg_core", "run_long", "mobility"];
  const fatLossSchedule = ["push", "pull", "leg_core", "full_body_circuit", "push", "leg_core", "mobility"];
  const generalSchedule = ["full_body_circuit", "hiit_cardio", "lower_core", "upper_cardio", "full_body_mobility", "mobility", "mobility"];

  const schedule = g === "fat_loss" ? fatLossSchedule : g === "general_fitness" ? generalSchedule : defaultSchedule;
  const type = schedule[dayIndex];
  const info = splitLabels[type] || { label: "운동", focus: "전신 트레이닝" };

  return {
    goalLabel: goalLabels[g],
    ...info,
  };
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ userName, onStartWorkout, onShowPrediction }) => {
  const [history, setHistory] = useState<WorkoutHistory[]>([]);
  const [questData, setQuestData] = useState<ReturnType<typeof getOrCreateWeeklyQuests> | null>(null);
  const [savedGoal, setSavedGoal] = useState<WorkoutGoal | null>(null);
  const [, setIntensityLabel] = useState<string>("중간");
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const typingStarted = useRef(false);
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const isFirstVisit = history.length === 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("alpha_workout_history");
      const all: WorkoutHistory[] = raw ? JSON.parse(raw) : [];
      setHistory(all);

      const birthYear = parseInt(localStorage.getItem("alpha_birth_year") || "");
      const gender = (localStorage.getItem("alpha_gender") as "male" | "female") || undefined;
      if (all.length > 0) {
        setQuestData(getOrCreateWeeklyQuests(all, isNaN(birthYear) ? undefined : birthYear, gender));

        // 강도 추천
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const recent = all.filter(h => new Date(h.date).getTime() > cutoff);
        if (recent.length > 0) {
          const rec = getIntensityRecommendation(recent, isNaN(birthYear) ? undefined : birthYear, gender);
          const labels: Record<string, string> = { high: "높은", moderate: "중간", low: "낮은" };
          setIntensityLabel(labels[rec.nextRecommended] || "중간");
        }
      }

      // 저장된 프로필 불러오기
      const profileRaw = localStorage.getItem("alpha_fitness_profile");
      if (profileRaw) {
        const p = JSON.parse(profileRaw);
        const goalMap: Record<string, WorkoutGoal> = {
          muscle_gain: "muscle_gain", strength: "strength",
          fat_loss: "fat_loss", health: "general_fitness", endurance: "general_fitness",
        };
        if (p.goal) setSavedGoal(goalMap[p.goal] || "muscle_gain");
        if (p.bodyWeight && p.weeklyFrequency) setProfile(p as FitnessProfile);
      }
    } catch { /* ignore */ }
  }, []);

  // 연속 운동일 계산
  const streak = (() => {
    if (history.length === 0) return 0;
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 0; ; i++) {
      const checkDate = new Date(today.getTime() - i * dayMs);
      const checkStr = checkDate.toDateString();
      if (history.some(h => new Date(h.date).toDateString() === checkStr)) {
        count++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    return count;
  })();

  // 이번 주 운동 횟수
  const thisWeekCount = (() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return history.filter(h => new Date(h.date).getTime() >= monday.getTime()).length;
  })();

  const displayName = userName || "회원";

  // 오늘 운동 했는지
  const didWorkoutToday = history.some(h => new Date(h.date).toDateString() === new Date().toDateString());

  // 시간대별 인사
  const greetingMsg = (() => {
    const hour = new Date().getHours();
    if (didWorkoutToday) {
      if (hour < 12) return "아침부터 해치웠네요!";
      if (hour < 17) return "오늘도 해냈군요!";
      return "고생 많았어요!";
    }
    if (hour < 6) return "이 시간에 오시다니 본캐는 히어로?!";
    if (hour < 10) return "미라클 모닝의 완성은 쇠질이죠!";
    if (hour < 12) return "점심 맛있게 먹으려면 지금이에요!";
    if (hour < 15) return "식후 혈당 근육으로 보내버려요!";
    if (hour < 18) return "카페인 대신 아드레날린 수혈 가시죠!";
    if (hour < 21) return "오늘 스트레스 여기서 다 털어요!";
    return "다들 잘 때 우린 성장하죠!";
  })();

  // 날짜 포맷
  const dateStr = (() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}월 ${date}일 (${days[now.getDay()]})`;
  })();

  // 추천 루틴 정보
  const routineInfo = getTodayWorkoutInfo(savedGoal);

  // 개인 성장 인사이트
  const growthInsight = (() => {
    if (history.length < 2) return null;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = history.filter(h => new Date(h.date) >= thisMonthStart);

    // 1RM 보너스 (있을 때만)
    const e1rmEntries = history.filter(h => h.stats.bestE1RM && h.stats.bestE1RM > 0);
    if (e1rmEntries.length >= 2) {
      const recent = e1rmEntries[e1rmEntries.length - 1].stats.bestE1RM!;
      const older = e1rmEntries[0].stats.bestE1RM!;
      const diff = recent - older;
      if (diff > 0) {
        return `추정 1RM ${Math.round(recent)}kg (+${Math.round(diff)}kg)`;
      }
    }

    // 이번 주 실제 횟수 기반
    if (thisWeekCount > 0) {
      return `이번 주 ${thisWeekCount}회 운동 완료!`;
    }
    if (thisMonth.length > 0) {
      return `이번 달 ${thisMonth.length}회 운동 완료`;
    }

    return null;
  })();

  // 연속 출석 최고 기록
  const bestStreak = (() => {
    if (history.length < 2) return 0;
    let best = 0, cur = 1;
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      prev.setHours(0, 0, 0, 0);
      curr.setHours(0, 0, 0, 0);
      const diff = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      if (diff === 1) cur++;
      else if (diff > 1) { best = Math.max(best, cur); cur = 1; }
    }
    return Math.max(best, cur);
  })();

  // 헤드라인: "이전 → 오늘" 연결 (항상 표시 — AI가 나를 안다)
  const routineContext = (() => {
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    const lastTitle = last.sessionData.title || last.sessionData.description || "";
    const lastFocus = (() => {
      if (/푸시|가슴|어깨|삼두|chest|push/i.test(lastTitle)) return "상체 앞면";
      if (/풀|등|이두|back|pull/i.test(lastTitle)) return "상체 뒷면";
      if (/레그|하체|코어|스쿼트|leg/i.test(lastTitle)) return "하체";
      if (/러닝|유산소|HIIT|run|cardio/i.test(lastTitle)) return "유산소";
      if (/모빌리티|회복|mobility/i.test(lastTitle)) return "회복";
      if (/서킷|circuit/i.test(lastTitle)) return "전신";
      return null;
    })();

    if (lastFocus) {
      return { prev: `이전에 ${lastFocus} 했으니`, next: `오늘은 ${routineInfo.focus}` };
    }
    return { prev: null, next: `오늘은 ${routineInfo.focus}` };
  })();

  // 서브 뱃지: 연속 출석 / 이번 주 달성 (있을 때만)
  const subBadges: string[] = [];
  if (streak >= 2 && streak >= bestStreak) {
    subBadges.push(`연속 ${streak}일째 최고 기록`);
  } else if (streak >= 2) {
    subBadges.push(`연속 ${streak}일째`);
  }
  if (!didWorkoutToday && thisWeekCount >= 1) {
    subBadges.push(`오늘 하면 이번 주 ${thisWeekCount + 1}회`);
  } else if (thisWeekCount > 0) {
    subBadges.push(`이번 주 ${thisWeekCount}회`);
  }

    // 성장 예측 프리뷰 (선형 회귀 기반 — FitnessReading과 동일한 예측 모델 사용)
    const predictionPreview = (() => {
      if (history.length < 3) return null;

      // 경로 1: 운동별 e1RM 회귀분석 (3대 운동 중 데이터 가장 많은 종목)
      const byEx = calcE1RMTrendByExercise(history);
      if (byEx.length > 0) {
        const best = byEx[0];
        const raw4w = best.lastE1RM + best.growthPerWeek * 4;
        // 현재값의 ±50% 이내로 제한 (비현실적 예측 방지)
        const pred4w = Math.round(Math.max(best.lastE1RM * 0.5, Math.min(best.lastE1RM * 1.5, raw4w)) * 10) / 10;
        const isGrowing = pred4w > best.lastE1RM;
        return {
          current: `${best.lastE1RM}kg`,
          predicted: `${pred4w}kg`,
          timeline: isGrowing ? `${best.label} 4주 후 더 강해져요` : `${best.label} 페이스 점검 필요`,
          label: best.label,
        };
      }

      // 경로 2: 체중 감량 예측 (회귀분석 기반, 최소 4회 체중 기록 필요)
      if (profile && profile.goal === "fat_loss") {
        const weightLog: { date: string; weight: number }[] = (() => {
          try { return JSON.parse(localStorage.getItem("alpha_weight_log") || "[]"); } catch { return []; }
        })();
        if (weightLog.length >= 4) {
          const wt = calcWeightTrend(weightLog);
          if (wt) {
            const current = weightLog.sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0].weight;
            const pred4w = wt.predictInWeeks(4);
            const isLosing = pred4w < current;
            return {
              current: `${current}kg`,
              predicted: `${pred4w}kg`,
              timeline: isLosing ? "꾸준히 감량 중이에요" : "페이스 점검이 필요해요",
              label: "4주 후 예상 체중",
            };
          }
        }
      }

      // 경로 3: 볼륨 성장률
      const volGrowth = calcVolumeGrowthRate(history);
      if (volGrowth) {
        const clampedPct = Math.max(-50, Math.min(50, volGrowth.growthPct));
        const pred4wVol = Math.round(Math.max(0, volGrowth.lastVolume * (1 + clampedPct / 100)));
        return {
          current: `${Math.round(volGrowth.lastVolume).toLocaleString()}kg`,
          predicted: `${pred4wVol.toLocaleString()}kg`,
          timeline: volGrowth.trend === "up" ? "세션 볼륨이 꾸준히 늘고 있어요" : "볼륨 유지 중, 강도를 올려보세요",
          label: "운동 볼륨",
        };
      }

      return null;
    })();


  // AI 코치 메시지 타이핑 효과
  const coachMessage = (() => {
    if (!routineContext) return "";
    if (routineContext.prev) {
      const prev = routineContext.prev.replace("이전에 ", "").replace(" 했으니", "");
      const next = routineContext.next.replace("오늘은 ", "");
      return `어제 ${prev} 했으니, 오늘은 ${next} 어때요?`;
    }
    return `오늘은 ${routineInfo.focus} 어때요?`;
  })();

  useEffect(() => {
    if (!coachMessage || typingStarted.current) return;
    typingStarted.current = true;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(coachMessage.slice(0, i));
      if (i >= coachMessage.length) {
        clearInterval(timer);
        setTimeout(() => setTypingDone(true), 200);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [coachMessage]);

  // 첫 방문자 화면
  if (isFirstVisit) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
          <img
            src="/login-logo-kor2.png"
            alt="오운잘 AI"
            className="w-48 object-contain"
          />

          <div className="text-center">
            <h1 className="text-2xl font-black text-[#1B4332] mb-2 leading-tight">
              {displayName}님,<br />반갑습니다
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              오운잘과 함께 첫 운동을 시작해볼까요?
            </p>
          </div>

          <button
            onClick={onStartWorkout}
            className="w-40 h-40 rounded-full bg-[#2D6A4F] text-white flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all"
          >
            <span className="text-lg font-black tracking-tight">첫 운동</span>
            <span className="text-sm font-bold text-emerald-200 mt-1">시작하기</span>
          </button>

          <p className="text-xs text-gray-400 font-medium text-center">
            운동 목표와 컨디션을 선택하면<br />맞춤 플랜이 자동으로 만들어져요
          </p>
        </div>
      </div>
    );
  }

  // 퀘스트 타입별 과학적 맥락
  const questScienceNote: Record<string, string> = {
    intensity_high: "ACSM: 주 1-2회 고강도 훈련이 근력 향상에 효과적",
    intensity_moderate: "ACSM: 중강도 훈련은 근비대와 체력 향상의 핵심",
    intensity_low: "NSCA: 저강도 회복 세션이 과훈련을 예방합니다",
    consistency: "WHO: 주 150분 이상 운동 시 만성질환 위험 감소",
    bonus_streak: "연속 운동이 습관 형성의 핵심입니다 (Lally, 2010)",
    bonus_new_exercise: "새로운 자극은 정체기 돌파에 효과적 (NSCA)",
  };

  // 퀘스트 헬퍼 (축약 2개 + 전체 펼치기)
  const renderQuestPreview = () => {
    if (!questData) return null;
    const { questDefs, questState: qs } = questData;
    const doneCount = qs.quests.filter(q => q.completed).length;
    const prog = (qDef: QuestDefinition): QuestProgress =>
      qs.quests.find(p => p.questId === qDef.id) || { questId: qDef.id, current: 0, completed: false };

    // 미완료 우선, 진행률 높은 순 정렬
    const sorted = [...questDefs].sort((a, b) => {
      const pa = prog(a);
      const pb = prog(b);
      if (pa.completed !== pb.completed) return pa.completed ? 1 : -1;
      return (pb.current / b.target) - (pa.current / a.target);
    });
    const visible = showAllQuests ? sorted : sorted.slice(0, 2);

    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-black text-[#1B4332]">이번 주 퀘스트</h3>
          <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{doneCount}/{questDefs.length} 완료</span>
        </div>
        <div className="space-y-2.5">
          {visible.map(q => {
            const p = prog(q);
            const pct = Math.min(p.current / q.target, 1);
            return (
              <div key={q.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] font-bold ${p.completed ? "text-[#2D6A4F]" : q.isBonus ? "text-gray-500" : "text-gray-700"}`}>
                    {p.completed ? "✓ " : ""}{q.label}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">{p.current}/{q.target}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, backgroundColor: p.completed ? "#2D6A4F" : q.isBonus ? "#d1d5db" : "#a7f3d0" }} />
                </div>
                {p.completed && questScienceNote[q.type] && (
                  <p className="text-[10px] text-[#2D6A4F]/70 mt-1">{questScienceNote[q.type]}</p>
                )}
              </div>
            );
          })}
        </div>
        {questDefs.length > 2 && (
          <button
            onClick={() => setShowAllQuests(v => !v)}
            className="w-full mt-3 pt-3 border-t border-gray-100 text-[12px] font-bold text-[#2D6A4F] text-center"
          >
            {showAllQuests ? "접기" : `전체 퀘스트 보기 (${questDefs.length})`}
          </button>
        )}
      </div>
    );
  };

  // 재방문 유저 홈 화면
  return (
    <div className="flex flex-col h-full bg-[#FAFBF9]">
      {/* 인사 + 날짜 */}
      <div className="pt-[max(2.5rem,env(safe-area-inset-top))] px-6 pb-1">
        <h1 className="text-xl font-black leading-snug">
          <span className="text-2xl text-[#2D6A4F]">{displayName}</span>
          <span className="text-[#1B4332]">님, {greetingMsg}</span>
        </h1>
        <p className="text-[12px] font-medium text-gray-400 mt-1">{dateStr}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        {/* 추천 루틴 카드 */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <img src="/favicon_backup.png " alt="AI" className="w-6 h-6 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-gray-400">오운잘 AI 코치</span>
          </div>
          <p className="text-[15px] font-bold text-[#1B4332] leading-relaxed mb-3 min-h-[3em]">
            {typedText}
            {!typingDone && <span className="inline-block w-[2px] h-[14px] bg-[#2D6A4F] ml-0.5 animate-pulse align-middle" />}
          </p>
          <div className={`transition-opacity duration-500 ${typingDone ? "opacity-100" : "opacity-0"}`}>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{routineInfo.goalLabel}</span>
              {subBadges.map((badge, i) => (
                <span key={i} className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{badge}</span>
              ))}
            </div>
          </div>
          {/* 성장 예측 프리뷰 — 코칭 카드 안에 통합 */}
          {predictionPreview && (
            <div
              className="border-t border-gray-100 pt-3 mb-3 cursor-pointer active:opacity-80 transition-all"
              onClick={onShowPrediction}
            >
              <p className="text-[12px] font-medium text-gray-500 mb-2">지금 페이스대로라면</p>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-400 mb-0.5">현재</p>
                  <p className="text-[18px] font-black text-[#1B4332]">{predictionPreview.current}</p>
                </div>
                <div className="flex-1 flex items-center justify-center px-3">
                  <div className="flex-1 h-[2px] bg-gray-200 rounded-full relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-[#2D6A4F]" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-[#2D6A4F]/60 mb-0.5">4주 후</p>
                  <p className="text-[18px] font-black text-[#2D6A4F]">{predictionPreview.predicted}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">{predictionPreview.timeline}</p>
              <p className="text-[11px] font-bold text-[#2D6A4F] text-center mt-2">
                전체 리포트 보기 &gt;
              </p>
            </div>
          )}
          <button
            onClick={onStartWorkout}
            className="w-full py-3.5 rounded-xl bg-[#1B4332] text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
          >
            {didWorkoutToday ? "한 번 더 운동하기" : "오늘 운동 시작하기"}
          </button>
        </div>

        {/* 성장 통계 카드 */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-[#1B4332] leading-none">{history.length}<span className="text-[11px] font-bold text-gray-400 ml-0.5">회</span></p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">총 운동</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-[#1B4332] leading-none">{streak}<span className="text-[11px] font-bold text-gray-400 ml-0.5">일</span></p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">연속 출석</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-[#1B4332] leading-none">{thisWeekCount}<span className="text-[11px] font-bold text-gray-400 ml-0.5">일</span></p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">이번 주</p>
          </div>
        </div>

        {/* 성장 인사이트 */}
        {growthInsight && (
          <div className="rounded-2xl bg-[#2D6A4F]/5 border border-[#2D6A4F]/10 px-4 py-3 mb-4">
            <p className="text-[13px] font-bold text-[#1B4332]">{growthInsight}</p>
          </div>
        )}


        {/* 주간 퀘스트 축약 */}
        {renderQuestPreview()}
      </div>
    </div>
  );
};
