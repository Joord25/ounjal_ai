"use client";

import React, { useState, useEffect, useRef } from "react";
import type { WorkoutHistory, WorkoutGoal } from "@/constants/workout";
import { getOrCreateWeeklyQuests, type QuestDefinition, type QuestProgress } from "@/utils/questSystem";
import { getIntensityRecommendation } from "@/utils/workoutMetrics";
import { calcE1RMTrendByExercise, calcVolumeGrowthRate, calcCalorieBalanceTrend, linearRegression } from "@/utils/predictionUtils";

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

const GOAL_LABELS: Record<WorkoutGoal, string> = {
  muscle_gain: "근육 키우기",
  strength: "근력 강화",
  fat_loss: "체지방 감량",
  general_fitness: "체력 향상",
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ userName, onStartWorkout, onShowPrediction }) => {
  const [history, setHistory] = useState<WorkoutHistory[]>([]);
  const [questData, setQuestData] = useState<ReturnType<typeof getOrCreateWeeklyQuests> | null>(null);
  const [savedGoal, setSavedGoal] = useState<WorkoutGoal | null>(null);
  const [, setIntensityLabel] = useState<string>("중간");
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [previewIdx, setPreviewIdx] = useState(0);
  const [typingDone, setTypingDone] = useState(false);

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
    if (hour < 6) return "새벽 각 제대로네요!";
    if (hour < 10) return "미라클 모닝 가시죠!";
    if (hour < 12) return "점심 전에 한판 해요!";
    if (hour < 15) return "식후엔 근육이 답이죠!";
    if (hour < 18) return "오후 한방 가시죠!";
    if (hour < 21) return "스트레스 여기서 털어요!";
    return "잘 때 우린 성장하죠!";
  })();

  // 날짜 포맷
  const dateStr = (() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}월 ${date}일 (${days[now.getDay()]})`;
  })();

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

    // 성장 예측 프리뷰 (여러 경로 수집 → 자동 슬라이드)
    const predictionPreviews = (() => {
      if (history.length < 3) return [];
      const previews: { current: string; predicted: string; timeline: string; label: string }[] = [];

      // 경로 1: 운동별 e1RM 회귀분석
      const byEx = calcE1RMTrendByExercise(history);
      for (const ex of byEx) {
        const clampedGrowth = Math.max(-5, Math.min(5, ex.growthPerWeek));
        const pred4w = Math.round(Math.max(0, ex.lastE1RM + clampedGrowth * 4) * 10) / 10;
        const isGrowing = pred4w > ex.lastE1RM;
        const r2 = ex.regression.r2;
        const lowConfidence = r2 < 0.5;
        const timelineMsg = isGrowing ? `${ex.label} 4주 후 더 강해져요` : `${ex.label} 페이스 점검 필요`;
        previews.push({
          current: `${ex.lastE1RM}kg`,
          predicted: `${pred4w}kg`,
          timeline: lowConfidence ? `${timelineMsg} (데이터 부족)` : timelineMsg,
          label: ex.label,
        });
      }

      // 경로 2: 체지방 감량 (칼로리 밸런스 회귀분석)
      try {
        const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
        const heightCm = fp.height || 170;
        const gender = fp.gender || profile?.gender || "male";
        const bw = profile?.bodyWeight || fp.bodyWeight || 70;
        const age = new Date().getFullYear() - (fp.birthYear || profile?.birthYear || 1990);
        const balanceTrend = calcCalorieBalanceTrend(history, gender, bw, heightCm, age);
        if (balanceTrend && balanceTrend.points.length >= 2) {
          const reg = linearRegression(balanceTrend.points.map(pt => ({ x: pt.x, y: pt.y })));
          if (reg) {
            const lastX = balanceTrend.points[balanceTrend.points.length - 1].x;
            const pred4w = Math.round(reg.predict(lastX + 28));
            const currentCum = balanceTrend.cumulative;
            const predKgLoss = Math.round(Math.abs(pred4w) / 7700 * 10) / 10;
            const currentKgLoss = Math.round(Math.abs(currentCum) / 7700 * 10) / 10;
            const isLosing = pred4w < currentCum;
            previews.push({
              current: `-${currentKgLoss}kg`,
              predicted: `-${predKgLoss}kg`,
              timeline: isLosing ? "꾸준히 감량 중이에요" : "페이스 점검이 필요해요",
              label: "누적 감량 예상",
            });
          }
        }
      } catch { /* ignore */ }

      // 경로 3: 볼륨 성장률
      const volGrowth = calcVolumeGrowthRate(history);
      if (volGrowth) {
        const clampedPct = Math.max(-50, Math.min(50, volGrowth.growthPct));
        const pred4wVol = Math.round(Math.max(0, volGrowth.lastVolume * (1 + clampedPct / 100)));
        previews.push({
          current: `${Math.round(volGrowth.lastVolume).toLocaleString()}kg`,
          predicted: `${pred4wVol.toLocaleString()}kg`,
          timeline: volGrowth.trend === "up" ? "세션 볼륨이 꾸준히 늘고 있어요" : "볼륨 유지 중, 강도를 올려보세요",
          label: "운동 볼륨",
        });
      }

      return previews;
    })();

    // 목표에 맞는 프리뷰 우선 정렬
    const sortedPreviews = (() => {
      if (!savedGoal || predictionPreviews.length === 0) return predictionPreviews;
      const goalOrder: Record<string, string[]> = {
        fat_loss: ["누적 감량 예상"],
        muscle_gain: ["벤치", "스쿼트", "데드"],
        general_fitness: ["운동 볼륨"],
      };
      const priority = goalOrder[savedGoal] || [];
      return [...predictionPreviews].sort((a, b) => {
        const aIdx = priority.findIndex(p => a.label.includes(p));
        const bIdx = priority.findIndex(p => b.label.includes(p));
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    })();


  // AI 코치 메시지: 최근 3개 기록 분석 → 안 한 부위 추천
  const coachMessage = (() => {
    if (history.length === 0) return "오늘 첫 운동을 시작해볼까요?";
    if (didWorkoutToday) {
      const last = history[history.length - 1];
      const desc = last.sessionData.description || last.sessionData.title || "";
      return desc ? `오늘 ${desc} 완료! 내일도 이 페이스 유지해봐요` : "오늘도 해냈어요! 내일도 힘내봐요";
    }

    // 최근 3개 기록에서 한 부위 추출
    const allParts = ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소"];
    const recentTitles = history.slice(-3).map(h =>
      (h.sessionData.title + " " + h.sessionData.description).toLowerCase()
    );
    const doneParts = new Set<string>();
    for (const t of recentTitles) {
      if (/가슴|푸시|chest|push|벤치/.test(t)) doneParts.add("가슴");
      if (/등|풀|back|pull|로우|랫/.test(t)) doneParts.add("등");
      if (/어깨|shoulder|프레스|레이즈/.test(t)) doneParts.add("어깨");
      if (/팔|이두|삼두|arm|bicep|tricep|컬/.test(t)) doneParts.add("팔");
      if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(t)) doneParts.add("하체");
      if (/코어|복근|core|ab|플랭크/.test(t)) doneParts.add("코어");
      if (/러닝|유산소|cardio|run|hiit|서킷/.test(t)) doneParts.add("유산소");
    }
    const missing = allParts.filter(p => !doneParts.has(p));

    if (missing.length > 0 && missing.length < allParts.length) {
      const done = [...doneParts].join(" · ");
      const recommend = missing.slice(0, 2).join(" · ");
      return `최근 ${done} 했어요. 오늘은 ${recommend} 어때요?`;
    }
    const last = history[history.length - 1];
    const desc = last.sessionData.description || last.sessionData.title || "";
    return desc ? `지난번 ${desc} 했어요. 오늘도 해볼까요?` : "오늘 운동 한번 해볼까요?";
  })();

  const prevCoachRef = useRef("");
  useEffect(() => {
    if (!coachMessage) return;
    // 같은 메시지 캐시 있으면 타이핑 생략
    const cached = sessionStorage.getItem("coach_typed");
    if (cached === coachMessage) {
      setTypedText(coachMessage);
      setTypingDone(true);
      return;
    }
    // 메시지가 바뀌었으면 리셋
    if (prevCoachRef.current && prevCoachRef.current !== coachMessage) {
      setTypedText("");
      setTypingDone(false);
    }
    prevCoachRef.current = coachMessage;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(coachMessage.slice(0, i));
      if (i >= coachMessage.length) {
        clearInterval(timer);
        sessionStorage.setItem("coach_typed", coachMessage);
        setTimeout(() => setTypingDone(true), 200);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [coachMessage]);

  // 성장 예측 프리뷰 자동 슬라이드 (4초 간격)
  useEffect(() => {
    if (sortedPreviews.length <= 1) return;
    const timer = setInterval(() => {
      setPreviewIdx(prev => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, [sortedPreviews.length]);

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
        <h1 className="font-black leading-snug">
          <span className={`text-[#2D6A4F] ${displayName.length > 6 ? "text-2xl" : "text-3xl"}`}>{displayName}</span>
          <span className={`text-[#1B4332] ${greetingMsg.length > 14 ? "text-base" : "text-xl"}`}> 님, {greetingMsg}</span>
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
              <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{GOAL_LABELS[savedGoal || "muscle_gain"]}</span>
              {subBadges.map((badge, i) => (
                <span key={i} className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{badge}</span>
              ))}
            </div>
          </div>
          {/* 성장 예측 프리뷰 — 자동 슬라이드 */}
          {sortedPreviews.length > 0 && (() => {
            const preview = sortedPreviews[previewIdx % sortedPreviews.length];
            return (
              <div
                className="border-t border-gray-100 pt-3 mb-3 cursor-pointer active:opacity-80 transition-all"
                onClick={onShowPrediction}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-medium text-gray-500">지금 페이스대로라면</p>
                  {sortedPreviews.length > 1 && (
                    <div className="flex gap-1">
                      {sortedPreviews.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === previewIdx % sortedPreviews.length ? "bg-[#2D6A4F]" : "bg-gray-200"}`} />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-bold text-[#2D6A4F]/60 mb-1">{preview.label}</p>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 mb-0.5">현재</p>
                    <p className="text-[18px] font-black text-[#1B4332]">{preview.current}</p>
                  </div>
                  <div className="flex-1 flex items-center justify-center px-3">
                    <div className="flex-1 h-[2px] bg-gray-200 rounded-full relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-[#2D6A4F]" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-[#2D6A4F]/60 mb-0.5">4주 후</p>
                    <p className="text-[18px] font-black text-[#2D6A4F]">{preview.predicted}</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">{preview.timeline}</p>
                <p className="text-[11px] font-bold text-[#2D6A4F] text-center mt-2">
                  전체 리포트 보기 &gt;
                </p>
              </div>
            );
          })()}
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
