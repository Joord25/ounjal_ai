"use client";

import React, { useState, useEffect } from "react";
import type { WorkoutHistory, WorkoutGoal } from "@/constants/workout";
import { getOrCreateWeeklyQuests, type QuestDefinition, type QuestProgress } from "@/utils/questSystem";
import { getIntensityRecommendation } from "@/utils/workoutMetrics";
import { calcE1RMTrendByExercise, calcVolumeGrowthRate, calcCalorieBalanceTrend, linearRegression } from "@/utils/predictionUtils";
import { useTranslation } from "@/hooks/useTranslation";


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


export const HomeScreen: React.FC<HomeScreenProps> = ({ userName, onStartWorkout, onShowPrediction }) => {
  const { t, locale } = useTranslation();

  // 퀘스트 라벨 번역 헬퍼
  const tq = (label: string) => {
    if (locale !== "en") return label;
    return label
      .replace(/이번 주 (\d+)일 운동/, "$1 days this week")
      .replace(/(\d+)일 연속 운동/, "$1-day streak")
      .replace(/고강도 운동 (\d+)회/, "$1 high intensity sessions")
      .replace(/중강도 운동 (\d+)회/, "$1 moderate sessions")
      .replace(/저강도 운동 (\d+)회/, "$1 light sessions")
      .replace(/새 운동 (\d+)종목 시도/, "Try $1 new exercises");
  };
  const [history, setHistory] = useState<WorkoutHistory[]>([]);
  const [questData, setQuestData] = useState<ReturnType<typeof getOrCreateWeeklyQuests> | null>(null);
  const [savedGoal, setSavedGoal] = useState<WorkoutGoal | null>(null);
  const [, setIntensityLabel] = useState<string>("중간");
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [ctaPulse, setCtaPulse] = useState(false);

  // 5초 후 CTA 버튼 pulse 시작
  useEffect(() => {
    const timer = setTimeout(() => setCtaPulse(true), 5000);
    return () => clearTimeout(timer);
  }, []);

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

  // 연속 운동일 계산 (이번 달 범위만)
  const streak = (() => {
    if (history.length === 0) return 0;
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 0; ; i++) {
      const checkDate = new Date(today.getTime() - i * dayMs);
      if (checkDate < monthStart) break;
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

  // 이번 주 운동 일수 (당일 N회도 1일로, 이번 달 범위만)
  const thisWeekCount = (() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = monday > monthStart ? monday : monthStart;
    const days = new Set(
      history
        .filter(h => new Date(h.date).getTime() >= weekStart.getTime())
        .map(h => new Date(h.date).toDateString())
    );
    return days.size;
  })();

  const displayName = userName || t("home.defaultName");

  // 오늘 운동 했는지
  const didWorkoutToday = history.some(h => new Date(h.date).toDateString() === new Date().toDateString());

  // 시간대별 인사
  const greetingMsg = (() => {
    const hour = new Date().getHours();
    if (didWorkoutToday) {
      if (hour < 12) return t("home.greeting.done.morning");
      if (hour < 17) return t("home.greeting.done.afternoon");
      return t("home.greeting.done.evening");
    }
    if (hour < 6) return t("home.greeting.dawn");
    if (hour < 10) return t("home.greeting.morning");
    if (hour < 12) return t("home.greeting.preLunch");
    if (hour < 15) return t("home.greeting.lunch");
    if (hour < 18) return t("home.greeting.afternoon");
    if (hour < 21) return t("home.greeting.evening");
    return t("home.greeting.night");
  })();

  // 날짜 포맷
  const dateStr = (() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = locale === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["일", "월", "화", "수", "목", "금", "토"];
    if (locale === "en") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[month - 1]} ${date} (${days[now.getDay()]})`;
    }
    return `${month}월 ${date}일 (${days[now.getDay()]})`;
  })();


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
        const timelineMsg = isGrowing ? t("home.prediction.stronger", { label: ex.label }) : t("home.prediction.checkPace", { label: ex.label });
        previews.push({
          current: `${ex.lastE1RM}kg`,
          predicted: `${pred4w}kg`,
          timeline: lowConfidence ? `${timelineMsg} (${t("home.prediction.lowData")})` : timelineMsg,
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
              timeline: isLosing ? t("home.prediction.losing") : t("home.prediction.checkPaceGeneral"),
              label: t("home.prediction.weightLabel"),
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
          timeline: volGrowth.trend === "up" ? t("home.prediction.volumeUp") : t("home.prediction.volumeFlat"),
          label: t("home.prediction.volumeLabel"),
        });
      }

      return previews;
    })();

    // 목표에 맞는 프리뷰 우선 정렬
    const sortedPreviews = (() => {
      if (!savedGoal || predictionPreviews.length === 0) return predictionPreviews;
      const goalOrder: Record<string, string[]> = {
        fat_loss: [t("home.prediction.weightLabel")],
        muscle_gain: [t("my.1rm.bench"), t("my.1rm.squat"), t("my.1rm.deadlift")],
        general_fitness: [t("home.prediction.volumeLabel")],
      };
      const priority = goalOrder[savedGoal] || [];
      return [...predictionPreviews].sort((a, b) => {
        const aIdx = priority.findIndex(p => a.label.includes(p));
        const bIdx = priority.findIndex(p => b.label.includes(p));
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    })();


  // AI 코치 2버블: [인사/감정, 추천/행동]
  const coachBubbles: [string, string] = (() => {
    const isEn = locale === "en";
    const daySeed = new Date().getDate();
    const pick = <T,>(arr: T[]): T => arr[daySeed % arr.length];
    const hour = new Date().getHours();

    // 마지막 운동으로부터 며칠 지났는지
    const daysSinceLast = history.length > 0
      ? Math.floor((Date.now() - new Date(history[history.length - 1].date).getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    // 최근 3개에서 안 한 부위 추출
    const allParts = [t("home.bodyPart.chest"), t("home.bodyPart.back"), t("home.bodyPart.shoulder"), t("home.bodyPart.arm"), t("home.bodyPart.lower"), t("home.bodyPart.core"), t("home.bodyPart.cardio")];
    const recentTitles = history.slice(-3).map(h => (h.sessionData.title + " " + h.sessionData.description).toLowerCase());
    const doneParts = new Set<string>();
    for (const title of recentTitles) {
      if (/가슴|푸시|chest|push|벤치/.test(title)) doneParts.add(t("home.bodyPart.chest"));
      if (/등|풀|back|pull|로우|랫/.test(title)) doneParts.add(t("home.bodyPart.back"));
      if (/어깨|shoulder|프레스|레이즈/.test(title)) doneParts.add(t("home.bodyPart.shoulder"));
      if (/팔|이두|삼두|arm|bicep|tricep|컬/.test(title)) doneParts.add(t("home.bodyPart.arm"));
      if (/하체|레그|스쿼트|leg|squat|런지|데드/.test(title)) doneParts.add(t("home.bodyPart.lower"));
      if (/코어|복근|core|ab|플랭크/.test(title)) doneParts.add(t("home.bodyPart.core"));
      if (/러닝|유산소|cardio|run|hiit|서킷/.test(title)) doneParts.add(t("home.bodyPart.cardio"));
    }
    const missing = allParts.filter(p => !doneParts.has(p));
    const recommend = missing.length > 0 && missing.length < allParts.length ? missing.slice(0, 2).join(" · ") : "";

    // === 버블 1: 인사/감정 ===
    let bubble1: string;
    if (history.length === 0) {
      bubble1 = pick(isEn
        ? ["Welcome! I'm excited to start with you!", "Hey! Let's take the first step together!"]
        : ["어서오세요! 첫 발 같이 뗄 생각에 설레요!", "와 드디어 시작이에요! 같이 해서 두근두근!ㅎㅎ", "첫 운동이 제일 특별해요! 같이 만들어가요!"]);
    } else if (didWorkoutToday) {
      bubble1 = pick(isEn
        ? ["You're back again today?! Amazing stamina!", "Already worked out and coming back? Love the energy!"]
        : ["오늘 또 왔어요?! 체력 진짜 좋아졌다!ㅎㅎ", "아까 운동했는데 또 오다니! 이 열정 대단해요!", "벌써 오늘 한 번 했는데! 이 의지 진짜 멋있어요!"]);
    } else if (streak >= 3) {
      bubble1 = pick(isEn
        ? [`${streak} days straight! Love running together!`, `Day ${streak}! At this point it's instinct!`]
        : [`${streak}일 연속이네요! 같이 달리니까 좋아요!`, `${streak}일째! 이쯤 되면 습관 아니라 본능이에요ㅎㅎ`, `와 ${streak}일째! 저도 이 기록 깨고 싶지 않아요!ㅎㅎ`]);
    } else if (daysSinceLast >= 3) {
      bubble1 = pick(isEn
        ? ["Hey! I was waiting for you!", "You're back! So glad to see you!"]
        : ["오! 기다리고 있었어요! 반가워요!", "돌아왔네요! 보고싶었어요!ㅎㅎ", "다시 온 거 자체가 대단해요!"]);
    } else {
      // 시간대별
      bubble1 = hour < 6
        ? pick(isEn ? ["At this hour! Let's conquer the dawn!"] : ["이 시간에 오다니! 같이 새벽 정복해봐요!"])
        : hour < 12
        ? pick(isEn ? ["Morning workout! You've already won the day!"] : ["아침부터 운동이라니! 오늘 하루 이미 이겼어요!", "좋은 아침이에요! 같이 시작해볼까요?"])
        : hour < 14
        ? pick(isEn ? ["Lunch workout? That's impressive!"] : ["점심시간 쪼개서 온 거예요? 진짜 대단!"])
        : hour < 22
        ? pick(isEn ? ["Working out at day's end! Let's finish strong!"] : ["하루 끝에 운동하러 온 거 멋있어요! 같이 마무리해요!", "오늘도 왔네요! 저도 기다리고 있었어요!ㅎㅎ"])
        : pick(isEn ? ["Late night grind! That dedication!"] : ["남들 쉬는 시간에 온 거잖아요! 이 열정!ㅎㅎ"]);
    }

    // === 버블 2: 추천/행동 ===
    let bubble2: string;
    if (history.length === 0) {
      bubble2 = pick(isEn
        ? ["Shall we start light today? I'll guide you!", "I've got your first plan ready! Let's go!"]
        : ["오늘 가볍게 시작해볼까요? 제가 안내할게요!", "첫 플랜 준비해놨어요! 같이 가요!"]);
    } else if (didWorkoutToday) {
      bubble2 = pick(isEn
        ? ["Want to go again? I'm ready!", "If you want more, I won't stop you!"]
        : ["한 번 더 하실 거예요? 저도 준비됐어요!", "더 하고 싶으면 말리진 않을게요! 같이 가요!ㅎㅎ"]);
    } else if (recommend) {
      bubble2 = pick(isEn
        ? [`How about ${recommend} today? I'll set up the plan!`, `${recommend} has been resting — let's wake it up!`]
        : [`오늘 ${recommend} 어때요? 제가 플랜 짜놓을게요!`, `${recommend} 좀 쉬었으니 오늘 깨워볼까요?ㅎㅎ`, `오늘 ${recommend} 가면 밸런스 딱이에요! 같이 가요!`]);
    } else if (daysSinceLast >= 3) {
      bubble2 = pick(isEn
        ? ["Let's start easy today! No pressure!", "Shall we warm up and ease in?"]
        : ["오늘은 부담 없이 가볍게 가요!", "몸 풀면서 천천히 시작해볼까요?ㅎㅎ"]);
    } else {
      bubble2 = pick(isEn
        ? ["I've got today's plan ready! Shall we?", "Ready when you are! Let's go!"]
        : ["오늘 플랜 준비해놨어요! 같이 가볼까요?", "준비 다 됐어요! 오늘도 같이 해요!ㅎㅎ"]);
    }

    return [bubble1, bubble2];
  })();


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
            src={locale === "ko" ? "/login-logo-kor2.png" : "/login-logo-Eng.png"}
            alt="오운잘 AI"
            className="w-48 object-contain"
          />

          <div className="text-center">
            <h1 className="text-2xl font-black text-[#1B4332] mb-2 leading-tight">
              {locale === "ko" ? <>{displayName}님,<br />반갑습니다</> : <>Welcome,<br />{displayName}</>}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {locale === "ko" ? "오운잘과 함께 첫 운동을 시작해볼까요?" : "Ready to start your first workout?"}
            </p>
          </div>

          <button
            onClick={onStartWorkout}
            className="w-40 h-40 rounded-full bg-[#2D6A4F] text-white flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all"
          >
            <span className="text-lg font-black tracking-tight">{locale === "ko" ? "첫 운동" : "Start"}</span>
            <span className="text-sm font-bold text-emerald-200 mt-1">{locale === "ko" ? "시작하기" : "Workout"}</span>
          </button>

          <p className="text-xs text-gray-400 font-medium text-center">
            {locale === "ko" ? <>운동 목표와 컨디션을 선택하면<br />맞춤 플랜이 자동으로 만들어져요</> : <>Pick your goal and condition<br />AI builds your custom plan</>}
          </p>
        </div>
      </div>
    );
  }

  // 퀘스트 타입별 과학적 맥락
  const questScienceNote: Record<string, string> = {
    intensity_high: t("home.quest.highDesc"),
    intensity_moderate: t("home.quest.modDesc"),
    intensity_low: t("home.quest.lowDesc"),
    consistency: t("home.quest.consistencyDesc"),
    bonus_streak: t("home.quest.streakDesc"),
    bonus_new_exercise: t("home.quest.newExDesc"),
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
          <h3 className="text-[13px] font-black text-[#1B4332]">{t("home.quest.title")}</h3>
          <span className="text-[11px] font-bold text-[#2D6A4F] bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">{doneCount}/{questDefs.length} {t("home.quest.done")}</span>
        </div>
        <div className="space-y-2.5">
          {visible.map(q => {
            const p = prog(q);
            const pct = Math.min(p.current / q.target, 1);
            return (
              <div key={q.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] font-bold ${p.completed ? "text-[#2D6A4F]" : q.isBonus ? "text-gray-500" : "text-gray-700"}`}>
                    {p.completed ? "✓ " : ""}{tq(q.label)}
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
            {showAllQuests ? t("home.quest.collapse") : t("home.quest.showAll", { count: String(questDefs.length) })}
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
        {/* AI 코치 카드 — 2버블 채팅 */}
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm px-4 pt-4 pb-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <img src="/favicon_backup.png" alt="AI" className="w-6 h-6 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-gray-400">{t("home.coachTitle")}</span>
          </div>
          {/* 버블 1: 인사/감정 */}
          <div className="mb-2">
            <div className="bg-[#2D6A4F]/5 rounded-2xl px-4 py-3">
              <p className="text-[14px] font-medium text-[#1B4332] leading-relaxed">
                {coachBubbles[0]}
              </p>
            </div>
          </div>
          {/* 버블 2: 추천/행동 */}
          <div className="mb-4">
            <div className="bg-[#2D6A4F]/5 rounded-2xl px-4 py-3">
              <p className="text-[14px] font-medium text-[#1B4332] leading-relaxed">
                {coachBubbles[1]}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setCtaPulse(false); onStartWorkout(); }}
            className={`w-full py-4 rounded-2xl bg-[#1B4332] border-2 border-black shadow-[4px_4px_0px_0px_#000000] text-white font-bold text-[16px] flex items-center justify-center gap-2 active:shadow-[1px_1px_0px_0px_#000000] active:translate-x-[3px] active:translate-y-[3px] transition-all ${ctaPulse ? "animate-cta-breathe" : ""}`}
          >
            {didWorkoutToday ? t("home.coach.oneMore") : t("home.coach.startToday")}
          </button>
        </div>

        {/* 성장 통계 */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-[#1B4332] leading-none">{(() => {
              const now = new Date();
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              return history.filter(h => new Date(h.date) >= monthStart).length;
            })()}<span className="text-[11px] font-bold text-gray-400 ml-0.5">{t("home.stats.unit.sessions")}</span></p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">{t("home.stats.thisMonth")}</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-[#1B4332] leading-none">{streak}<span className="text-[11px] font-bold text-gray-400 ml-0.5">{t("home.stats.unit.days")}</span></p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">{t("home.stats.streak")}</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-[#1B4332] leading-none">{thisWeekCount}<span className="text-[11px] font-bold text-gray-400 ml-0.5">{t("home.stats.unit.days")}</span></p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">{t("home.stats.thisWeek")}</p>
          </div>
        </div>


        {/* 성장 예측 프리뷰 (분리된 카드) */}
        {sortedPreviews.length > 0 && (() => {
          const preview = sortedPreviews[previewIdx % sortedPreviews.length];
          // 경험 번역
          const previewExpMsg = (() => {
            const label = (preview.label || "").toLowerCase();
            if (/볼륨|volume/i.test(label)) return t("home.prediction.volume");
            if (/감량|체중|weight|loss/i.test(label)) return t("home.prediction.weightLoss");
            if (/1rm|근력|strength/i.test(label)) return t("home.prediction.strength");
            return t("home.prediction.default");
          })();
          return (
            <div
              className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-4 cursor-pointer active:opacity-80 transition-all"
              onClick={onShowPrediction}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-gray-500">{t("home.prediction.atThisPace")}</p>
                {sortedPreviews.length > 1 && (
                  <div className="flex gap-1">
                    {sortedPreviews.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === previewIdx % sortedPreviews.length ? "bg-[#2D6A4F]" : "bg-gray-200"}`} />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[10px] font-bold text-[#2D6A4F]/60 mb-1">{locale !== "ko" ? ({"벤치프레스": "Bench Press", "스쿼트": "Squat", "데드리프트": "Deadlift"}[preview.label] || preview.label.replace(/.*\(([^)]+)\).*/, "$1")) : preview.label}</p>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-400 mb-0.5">{t("home.prediction.current")}</p>
                  <p className="text-[18px] font-black text-[#1B4332]">{preview.current}</p>
                </div>
                <div className="flex-1 flex items-center justify-center px-3">
                  <div className="flex-1 h-[2px] bg-gray-200 rounded-full relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-[#2D6A4F]" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-[#2D6A4F]/60 mb-0.5">{t("home.prediction.in4weeks")}</p>
                  <p className="text-[18px] font-black text-[#2D6A4F]">{preview.predicted}</p>
                </div>
              </div>
              <p className="text-[13px] font-bold text-[#2D6A4F] leading-relaxed mt-2">{previewExpMsg}</p>
              <p className="text-[11px] font-bold text-gray-400 text-center mt-2">
                {t("home.prediction.viewReport")} &gt;
              </p>
            </div>
          );
        })()}

        {/* 주간 퀘스트 */}
        {renderQuestPreview()}
      </div>
    </div>
  );
};
