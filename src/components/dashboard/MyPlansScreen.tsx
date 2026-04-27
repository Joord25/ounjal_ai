"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SavedPlan, deletePlan, getSavedPlans, remoteDeletePlan,
  syncSavedPlansFromServer, getProgramSessions,
  deleteProgram, remoteDeleteProgram,
} from "@/utils/savedPlans";
import { getProgramSessionLabel } from "@/utils/programSessionLabels";
import {
  deriveProgramCompletions,
  getNextProgramSessionFromHistory,
  type CompletionEntry,
} from "@/utils/programCompletion";
import { getCachedWorkoutHistory } from "@/utils/workoutHistory";
import type { WorkoutHistory } from "@/constants/workout";

interface MyPlansScreenProps {
  onBack: () => void;
  onSelectPlan: (plan: SavedPlan) => void;
}

export const MyPlansScreen: React.FC<MyPlansScreenProps> = ({ onBack, onSelectPlan }) => {
  const { t, locale } = useTranslation();
  const [plans, setPlans] = useState<SavedPlan[]>(() => getSavedPlans());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteProgramId, setConfirmDeleteProgramId] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory[]>(() => getCachedWorkoutHistory());

  useEffect(() => {
    let cancelled = false;
    syncSavedPlansFromServer().then((fresh) => {
      if (!cancelled) setPlans(fresh);
    });
    // 회의 64-ζ-γ: workout_history 는 source-of-truth. 진입 시 캐시 최신값 재로드.
    setWorkoutHistory(getCachedWorkoutHistory());
    return () => { cancelled = true; };
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return locale === "ko"
      ? `${d.getMonth() + 1}월 ${d.getDate()}일`
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDelete = async (id: string) => {
    await remoteDeletePlan(id);
    deletePlan(id);
    setPlans(getSavedPlans());
    setConfirmDeleteId(null);
  };

  const handleDeleteProgram = async (programId: string) => {
    await remoteDeleteProgram(programId);
    deleteProgram(programId);
    setPlans(getSavedPlans());
    setConfirmDeleteProgramId(null);
  };

  // 회의 64-ζ-γ: 프로그램 그룹 + 완료 상태를 workout_history 기반으로 재계산.
  // saved_plans.completedAt 필드 의존 제거 — 서버 sync 덮어쓰기·순서 오류에 영향 안 받음.
  const { programs, singlePlans } = useMemo(() => {
    const all = plans;
    const programIds = new Set<string>();
    const result: Array<{
      programId: string;
      programName: string;
      completed: number;
      total: number;
      nextSession: SavedPlan | null;
      completionMap: Map<string, CompletionEntry>;
    }> = [];
    for (const p of all) {
      if (!p.programId || programIds.has(p.programId)) continue;
      programIds.add(p.programId);
      const sessions = getProgramSessions(p.programId);
      const completionMap = deriveProgramCompletions(sessions, workoutHistory);
      result.push({
        programId: p.programId,
        programName: p.programName ?? p.name,
        completed: completionMap.size,
        total: sessions.length,
        nextSession: getNextProgramSessionFromHistory(sessions, workoutHistory),
        completionMap,
      });
    }
    return {
      programs: result,
      singlePlans: all.filter(p => !p.programId),
    };
  }, [plans, workoutHistory]);
  const isEmpty = programs.length === 0 && singlePlans.length === 0;

  return (
    <div className="h-full flex flex-col bg-[#FAFBF9]">
      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 bg-[#FAFBF9] border-b border-gray-200"
        style={{ paddingTop: "calc(var(--safe-area-top, 0px) + 12px)" }}
      >
        <button onClick={() => { setIsEditMode(false); onBack(); }} className="p-2 -ml-2 text-gray-600 active:text-gray-900">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] font-serif font-medium tracking-[0.25em] text-gray-400 uppercase">
          {t("my_plans.title")}
        </span>
        {isEmpty ? (
          <div className="w-8" />
        ) : (
          <button
            onClick={() => {
              setIsEditMode((v) => !v);
              setExpandedProgram(null);
            }}
            className={`px-2 py-1 -mr-2 text-[13px] font-bold transition-colors ${isEditMode ? "text-[#2D6A4F]" : "text-gray-500 active:text-[#2D6A4F]"}`}
          >
            {isEditMode ? t("my_plans.done") : t("my_plans.edit")}
          </button>
        )}
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 scrollbar-hide">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <p className="text-sm font-black text-gray-700 mb-1">{t("my_plans.empty")}</p>
            <p className="text-xs text-gray-500">{t("my_plans.empty_desc")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-8">
            {/* 프로그램 그룹 */}
            {programs.map((prog) => {
              const isExpanded = expandedProgram === prog.programId;
              const sessions = isExpanded ? getProgramSessions(prog.programId) : [];
              const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
              return (
                <div key={prog.programId} className="rounded-2xl border border-[#2D6A4F]/15 bg-white overflow-hidden">
                  {/* 프로그램 헤더 */}
                  <div className="w-full flex items-center gap-3 px-4 py-3">
                    {isEditMode && (
                      <button
                        onClick={() => setConfirmDeleteProgramId(prog.programId)}
                        className="shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1B4332] hover:border-gray-300 active:scale-[0.94] transition-all"
                        aria-label={t("my_plans.delete")}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => !isEditMode && setExpandedProgram(isExpanded ? null : prog.programId)}
                      disabled={isEditMode}
                      className="flex-1 flex items-center gap-3 text-left active:bg-gray-50 transition-colors -my-3 py-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D6A4F] to-[#1B4332] flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-black text-[#1B4332] truncate">{prog.programName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{prog.completed}/{prog.total} {locale === "en" ? "sessions" : "세션"}</p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#2D6A4F] text-[10px] font-bold border border-[#2D6A4F]/20">
                        {prog.completed}/{prog.total}
                      </span>
                      {!isEditMode && (
                        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* 진행률 바 */}
                  <div className="px-4 pb-1">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2D6A4F] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* 다음 세션 CTA */}
                  {prog.nextSession && !isExpanded && !isEditMode && (() => {
                    const nextLabel = getProgramSessionLabel(prog.nextSession);
                    const nextDesc = nextLabel?.description || prog.nextSession.sessionData.description || (locale === "en" ? "Next session" : "다음 세션");
                    return (
                    <button
                      onClick={() => onSelectPlan(prog.nextSession!)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 text-left active:bg-emerald-50/50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="flex-1 text-[12px] text-[#1B4332] truncate">
                        <span className="font-bold">{prog.nextSession.sessionNumber}/{prog.total}</span>
                        {" "}<span className="truncate">{nextDesc}</span>
                      </span>
                      <svg className="w-3 h-3 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    );
                  })()}

                  {/* 펼친 세션 리스트 — 회의 64-ζ-γ: workout_history 기반 isDone 판정 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {sessions.map((s) => {
                        const completion = prog.completionMap.get(s.id);
                        const isDone = !!completion;
                        const isAbandoned = isDone && completion?.abandoned === true;
                        const isNext = !isDone && prog.nextSession?.id === s.id;
                        const ctxLabel = getProgramSessionLabel(s);
                        const displayDesc = ctxLabel?.description || s.sessionData.description || s.name;
                        return (
                          <button
                            key={s.id}
                            onClick={() => onSelectPlan(s)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-50 last:border-b-0 active:bg-gray-50 transition-colors ${isDone ? "opacity-50" : ""} ${isNext ? "bg-[#FAFFF7]" : ""}`}
                          >
                            {/* 회의 64-M3: 완료=emerald check, 중도=amber 하프원, 미완료=번호 */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                              isAbandoned ? "bg-amber-100 text-amber-700 border border-amber-300"
                              : isDone ? "bg-[#2D6A4F] text-white"
                              : isNext ? "border-2 border-[#2D6A4F] text-[#2D6A4F]"
                              : "bg-gray-100 text-gray-400"
                            }`}>
                              {isAbandoned ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                                </svg>
                              ) : isDone ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : s.sessionNumber}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[12px] font-bold truncate ${isNext ? "text-[#2D6A4F]" : "text-[#1B4332]"}`}>
                                {s.sessionNumber != null && (
                                  <span className="text-gray-400 font-black mr-1.5 tabular-nums">#{s.sessionNumber}</span>
                                )}
                                {displayDesc}
                              </p>
                              {isDone && completion && (
                                <p className="text-[10px] text-gray-400">{formatDate(completion.completedAtMs)}</p>
                              )}
                              {isNext && (
                                <p className="text-[10px] text-[#2D6A4F]">{locale === "en" ? "Next" : "다음 세션"}</p>
                              )}
                            </div>
                            {isNext && (
                              <svg className="w-3 h-3 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 단일 플랜 */}
            {singlePlans.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-2xl border-2 border-gray-200 bg-white p-4 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  {isEditMode && (
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center active:bg-red-600"
                      aria-label={t("my_plans.delete")}
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" d="M5 12h14" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => !isEditMode && onSelectPlan(p)}
                    disabled={isEditMode}
                    className="flex-1 text-left min-w-0"
                  >
                    <h3 className="text-base font-black text-[#1B4332] mb-1 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-1">{p.sessionData.description}</p>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-gray-500">
                      <span>{p.sessionData.exercises.filter(e => e.type !== "warmup").length} {locale === "en" ? "exercises" : "운동"}</span>
                      <span className="w-px h-3 bg-gray-300" />
                      <span>
                        {p.useCount > 0
                          ? t("my_plans.use_count", { n: String(p.useCount) })
                          : t("my_plans.never_used")}
                      </span>
                      <span className="w-px h-3 bg-gray-300" />
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 단일 플랜 삭제 확인 */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-8" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-black text-[#1B4332] mb-4 text-center">
              {plans.find(p => p.id === confirmDeleteId)?.name}
            </p>
            <p className="text-xs text-gray-500 text-center mb-5">
              {locale === "en" ? "Delete this plan?" : "정말 삭제할까요?"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-black text-sm">
                {t("common.cancel")}
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 h-11 rounded-xl bg-red-500 text-white font-black text-sm">
                {t("my_plans.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로그램 삭제 확인 */}
      {confirmDeleteProgramId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-8" onClick={() => setConfirmDeleteProgramId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-black text-[#1B4332] mb-4 text-center">
              {programs.find(p => p.programId === confirmDeleteProgramId)?.programName}
            </p>
            <p className="text-xs text-gray-500 text-center mb-5">
              {locale === "en" ? "Delete entire program and all sessions?" : "프로그램과 모든 세션을 삭제할까요?"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteProgramId(null)} className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-700 font-black text-sm">
                {t("common.cancel")}
              </button>
              <button onClick={() => handleDeleteProgram(confirmDeleteProgramId)} className="flex-1 h-11 rounded-xl bg-red-500 text-white font-black text-sm">
                {t("my_plans.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
