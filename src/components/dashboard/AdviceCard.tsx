"use client";

/**
 * AdviceCard — 회의 57 후속: ChatHome의 advice 모드 응답 렌더링.
 * 마스터플랜 스타일 섹션 카드 + 하단 "오늘 운동" CTA.
 * 이모지 금지, SVG·라벨만 사용.
 */

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export interface AdviceContent {
  headline: string;
  goals: string[];
  intensity?: string[];
  monthProgram?: {
    week1?: string;
    week2?: string;
    week3?: string;
    week4?: string;
  };
  // Phase 8A: 운동 루틴 표
  workoutTable?: {
    title: string;
    columns: string[];
    rows: string[][];
  };
  principles: string[];
  criticalPoints?: string[];
  supplements?: string[];
  conclusion?: string[];
  // Phase 8B: 실행 유도 (24시간 내 3가지)
  actionItems?: string[];
  sessionParams?: Array<{
    weekNumber: number;
    dayInWeek: number;
    sessionMode: "balanced" | "split" | "running" | "home_training";
    targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
    goal: "fat_loss" | "muscle_gain" | "strength" | "general_fitness";
    availableTime: 30 | 50 | 90;
    intensityOverride?: "high" | "moderate" | "low";
    label: string;
  }>;
  recommendedWorkout?: {
    condition: {
      bodyPart: "upper_stiff" | "lower_heavy" | "full_fatigue" | "good";
      energyLevel: 1 | 2 | 3 | 4 | 5;
      availableTime: 30 | 50 | 90;
      bodyWeightKg?: number;
      gender?: "male" | "female";
      birthYear?: number;
    };
    goal: "fat_loss" | "muscle_gain" | "strength" | "general_fitness";
    sessionMode: "balanced" | "split" | "running" | "home_training";
    targetMuscle?: "chest" | "back" | "shoulders" | "arms" | "legs";
    runType?: "interval" | "easy" | "long";
    intensityOverride?: "high" | "moderate" | "low";
    reasoning: string;
    /**
     * 회의 2026-04-24: workoutTable ↔ MasterPlan 동기화. AdviceCard가 본 main 운동 리스트를
     * 서버 룰엔진에 그대로 전달해서 고정 balanced/split 템플릿 우회.
     */
    exerciseList?: Array<{
      name: string;
      sets: number;
      reps: string;
      rpe?: string;
    }>;
  };
}

interface AdviceCardProps {
  advice: AdviceContent;
  onStartRecommended: () => void | Promise<void>;
  starting?: boolean;
  /** monthProgram 있을 때 장기 프로그램 저장 CTA */
  onGenerateProgram?: () => void | Promise<void>;
  generatingProgram?: boolean;
}

/** 인라인 마크다운 파서 — **굵게**만 처리 (Gemini 응답 대응) */
const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

/** 섹션 한 블록 — 라벨 + bullet 리스트 */
const Section: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="border-t border-gray-100 pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
      <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[12.5px] text-[#1B4332] leading-relaxed flex gap-1.5">
            <span className="text-[#2D6A4F] shrink-0">·</span>
            <span className="flex-1">{renderInline(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Phase 8A: 운동 루틴 표 — Table */
const WorkoutTable: React.FC<{
  title: string;
  columns: string[];
  rows: string[][];
}> = ({ title, columns, rows }) => (
  <div className="border-t border-gray-100 pt-3 mt-3">
    <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mb-2">{title}</p>
    <div className="rounded-lg border border-gray-100 overflow-hidden">
      <table className="w-full text-[11.5px] table-fixed">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-2 py-1.5 text-left font-black text-[#1B4332] text-[10.5px] tracking-wide">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 text-[#1B4332] break-keep align-top">
                  {j === 0 ? <span className="font-semibold">{renderInline(cell)}</span> : renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/** Phase 8D: 경고 섹션 — 중요 포인트 amber 강조 박스 */
const WarningSection: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-[10px] font-black text-amber-800 tracking-[0.2em] uppercase">{label}</p>
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[12.5px] text-amber-900 leading-relaxed flex gap-1.5">
            <span className="text-amber-600 shrink-0">·</span>
            <span className="flex-1">{renderInline(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Phase 8B: 실행 유도 섹션 — 24시간 내 3가지 체크리스트 */
const ActionItemsSection: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 bg-[#F0FDF4] border border-[#2D6A4F]/30 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p className="text-[10px] font-black text-[#1B4332] tracking-[0.2em] uppercase">{label}</p>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 3).map((it, i) => (
          <li key={i} className="text-[13px] text-[#1B4332] leading-relaxed flex gap-2 items-start">
            <span className="w-4 h-4 rounded border-[1.5px] border-[#2D6A4F] shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{renderInline(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 주간 프로그램 (4주) — 칩 스타일 */
const WeekRow: React.FC<{ label: string; content?: string }> = ({ label, content }) => {
  if (!content) return null;
  return (
    <div className="flex gap-2 items-start py-1">
      <span className="text-[10px] font-black text-[#2D6A4F] tracking-wider shrink-0 w-12 pt-0.5">{label}</span>
      <span className="text-[12.5px] text-[#1B4332] leading-relaxed flex-1">{renderInline(content)}</span>
    </div>
  );
};

/** 추천 운동 요약 라벨 빌더 */
function buildRecSummary(
  rec: AdviceContent["recommendedWorkout"],
  locale: "ko" | "en",
): string {
  if (!rec) return "";
  const muscleKo: Record<string, string> = {
    chest: "가슴", back: "등", shoulders: "어깨", arms: "팔", legs: "하체",
  };
  const muscleEn: Record<string, string> = {
    chest: "chest", back: "back", shoulders: "shoulders", arms: "arms", legs: "legs",
  };
  const runKo: Record<string, string> = { interval: "인터벌", easy: "쉬운 러닝", long: "롱런" };
  const runEn: Record<string, string> = { interval: "interval", easy: "easy run", long: "long run" };

  let part: string;
  if (rec.sessionMode === "running") {
    part = locale === "en"
      ? (rec.runType ? runEn[rec.runType] : "run")
      : (rec.runType ? runKo[rec.runType] : "러닝");
  } else if (rec.sessionMode === "home_training") {
    part = locale === "en" ? "home workout" : "홈트";
  } else if (rec.sessionMode === "split" && rec.targetMuscle) {
    part = locale === "en" ? muscleEn[rec.targetMuscle] : muscleKo[rec.targetMuscle];
  } else {
    part = locale === "en" ? "full body" : "전신";
  }
  return `${part} · ${rec.condition.availableTime}${locale === "en" ? " min" : "분"}`;
}

export const AdviceCard: React.FC<AdviceCardProps> = ({ advice, onStartRecommended, starting, onGenerateProgram, generatingProgram }) => {
  const { t, locale } = useTranslation();
  const recLabel = buildRecSummary(advice.recommendedWorkout, locale as "ko" | "en");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden my-1">
      {/* 헤더 */}
      <div className="px-4 pt-3 pb-3 border-b border-gray-100">
        <p className="text-[10px] font-black text-gray-400 tracking-[0.25em] uppercase">
          {t("advice.header")}
        </p>
        {advice.headline && (
          <h3 className="text-[15px] font-black text-[#1B4332] mt-1 leading-tight">
            {advice.headline}
          </h3>
        )}
      </div>

      {/* 본문 */}
      <div className="px-4 py-3">
        <Section label={t("advice.section.goals")} items={advice.goals} />
        {advice.intensity && advice.intensity.length > 0 && (
          <Section label={t("advice.section.intensity")} items={advice.intensity} />
        )}

        {advice.monthProgram && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mb-1.5">
              {t("advice.section.monthProgram")}
            </p>
            <div className="space-y-0.5">
              <WeekRow label="WEEK 1" content={advice.monthProgram.week1} />
              <WeekRow label="WEEK 2" content={advice.monthProgram.week2} />
              <WeekRow label="WEEK 3" content={advice.monthProgram.week3} />
              <WeekRow label="WEEK 4" content={advice.monthProgram.week4} />
            </div>
          </div>
        )}

        {/* Phase 8A: 운동 루틴 표 */}
        {advice.workoutTable && advice.workoutTable.rows.length > 0 && (
          <WorkoutTable
            title={advice.workoutTable.title}
            columns={advice.workoutTable.columns}
            rows={advice.workoutTable.rows}
          />
        )}

        <Section label={t("advice.section.principles")} items={advice.principles} />
        {/* Phase 8D: criticalPoints는 amber 경고 박스로 차별화 */}
        {advice.criticalPoints && advice.criticalPoints.length > 0 && (
          <WarningSection label={t("advice.section.criticalPoints")} items={advice.criticalPoints} />
        )}
        {advice.supplements && advice.supplements.length > 0 && (
          <Section label={t("advice.section.supplements")} items={advice.supplements} />
        )}
        {advice.conclusion && advice.conclusion.length > 0 && (
          <Section label={t("advice.section.conclusion")} items={advice.conclusion} />
        )}
        {/* Phase 8B: 실행 유도 — 24시간 내 3가지 */}
        {advice.actionItems && advice.actionItems.length > 0 && (
          <ActionItemsSection label={t("advice.section.actionItems")} items={advice.actionItems} />
        )}
      </div>

      {/* 하단 CTA — 오늘 운동 + 프로그램 저장 (recommendedWorkout 없으면 정보성 응답이므로 CTA 숨김) */}
      {advice.recommendedWorkout && (
        <div className="px-4 py-3 border-t border-gray-100 bg-[#FAFBF9]">
          {advice.recommendedWorkout.reasoning && (
            <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
              {renderInline(advice.recommendedWorkout.reasoning)}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={onStartRecommended}
              disabled={starting}
              className={`w-full py-3 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                starting
                  ? "bg-[#1B4332]/80 text-white"
                  : "bg-[#1B4332] text-white active:scale-[0.98] hover:bg-[#2D6A4F]"
              }`}
            >
              {starting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 60" />
                  </svg>
                  <span>{locale === "en" ? "Loading..." : "준비 중..."}</span>
                </>
              ) : (
                <>
                  <span>{t("advice.startCTA")}</span>
                  <span className="opacity-70">·</span>
                  <span className="font-normal">{recLabel}</span>
                </>
              )}
            </button>
            {onGenerateProgram && (
              <button
                onClick={onGenerateProgram}
                disabled={generatingProgram}
                className={`w-full py-2.5 rounded-xl text-[12.5px] font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  generatingProgram
                    ? "bg-gray-50 text-gray-400 border-gray-200"
                    : "bg-white text-[#1B4332] border-[#1B4332]/30 active:scale-[0.98] hover:bg-[#F0FDF4]"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{generatingProgram
                  ? (locale === "en" ? "Generating sessions..." : "세션 생성 중...")
                  : (locale === "en" ? "Save as program" : "프로그램으로 저장")
                }</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
