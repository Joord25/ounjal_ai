"use client";

/**
 * 러닝 프로그램 생성 바텀시트 — 회의 64-D.
 *
 * 진입: ChatHome 입력창 우측 하단 "달리는 아이콘" 탭
 * 플로우: select → (Full sub-3 시) gate_check → settings → preview → [loading → onProgramCreated]
 *
 * 진입 조건: isLoggedIn + isPremium. 아니면 onRequestLogin / onRequestPaywall 발화 후 시트 닫힘.
 *
 * SPEC: .planning/RUNNING_PROGRAM_SPEC.md v1
 */

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import { newProgramId, saveProgramSessions, remoteSaveProgram, deleteProgram, type SavedPlan } from "@/utils/savedPlans";
import { getCachedWorkoutHistory } from "@/utils/workoutHistory";
import type { RunningProgramId } from "@/constants/workout";

type DaysPerWeek = 3 | 4 | 5;
type StartChoice = "today" | "tomorrow" | "next_monday";
type Step = "select" | "gate_check" | "gate_fail" | "settings" | "preview" | "loading";

interface GateAnswers {
  /** 유저가 직접 입력한 Half 기록 (초). null = "없음" 선택. undefined = 아직 선택 안 함 */
  halfMarathonSec?: number | null;
  recentInjury?: boolean;
}

export interface ProgramCreatedInfo {
  programId: string;
  programName: string;
  firstSessionTitle: string;
}

interface RunningProgramSheetProps {
  open: boolean;
  /** "sheet" = 기존 바텀시트(ChatHome 호환) / "fullscreen" = ROOT 카드 진입 (회의 2026-04-27) */
  variant?: "sheet" | "fullscreen";
  onClose: () => void;
  onProgramCreated: (info: ProgramCreatedInfo) => void;
  isLoggedIn: boolean;
  isPremium: boolean;
  onRequestLogin: () => void;
  onRequestPaywall: () => void;
  /** 회의 2026-04-27: 진행 중인 러닝 프로그램 — select 화면 상단에 "이어가기" 카드로 노출 */
  activePrograms?: Array<{ programId: string; programName: string; completed: number; total: number; nextSession: { id: string } | null }>;
  onResumeProgram?: (programId: string, nextSessionId: string) => void;
}

// 회의 2026-04-27: 추천 뱃지 정리 — 10k_sub_50 추천 제거, full_sub_3 "경험자" 태그 유지(별도 키로 표시).
const PROGRAM_META: Array<{
  id: RunningProgramId;
  titleKey: string;
  subKey: string;
  caption: string;
  recommended?: boolean;
}> = [
  { id: "vo2_boost",  titleKey: "running_program.program.vo2_boost.title", subKey: "running_program.program.vo2_boost.sub", caption: "VO2 MAX" },
  { id: "10k_sub_50", titleKey: "running_program.program.10k.title",       subKey: "running_program.program.10k.sub",       caption: "10K · SUB 50" },
  { id: "half_sub_2", titleKey: "running_program.program.half.title",      subKey: "running_program.program.half.sub",      caption: "HALF · SUB 2" },
  { id: "full_sub_3", titleKey: "running_program.program.full.title",      subKey: "running_program.program.full.sub",      caption: "FULL · SUB 3" },
];

export const RunningProgramSheet: React.FC<RunningProgramSheetProps> = ({
  open, variant = "sheet", onClose, onProgramCreated, isLoggedIn, isPremium, onRequestLogin, onRequestPaywall,
  activePrograms, onResumeProgram,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("select");
  const [selectedProgram, setSelectedProgram] = useState<RunningProgramId | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<DaysPerWeek>(4);
  const [startChoice, setStartChoice] = useState<StartChoice>("today");
  const [vo5kMin, setVo5kMin] = useState<number>(25);
  const [vo5kSec, setVo5kSec] = useState<number>(0);
  const [gateAnswers, setGateAnswers] = useState<GateAnswers>({});
  const [gateReasons, setGateReasons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * 회의 64-E Phase 4.1: GPS 히스토리 기반 실제 주간 평균 km 자동 계산.
   * 유저 Yes/No 입력 제거 — 거짓 답변 우회 불가.
   */
  const autoWeeklyAvgKm = useMemo<number | null>(() => {
    if (!open) return null;
    try {
      const history = getCachedWorkoutHistory();
      if (!Array.isArray(history) || history.length === 0) return null;
      const cutoffMs = 8 * 7 * 86400 * 1000;
      const now = Date.now();
      const recent = history.filter(h => {
        const t = new Date(h.date).getTime();
        return !Number.isNaN(t) && (now - t) <= cutoffMs;
      });
      const totalMeters = recent.reduce((sum, h) => sum + (h.runningStats?.distance ?? 0), 0);
      return Math.round(totalMeters / 1000 / 8 * 10) / 10; // 소수점 1자리
    } catch {
      return null;
    }
  }, [open]);

  // 회의 64-F (2026-04-18): 진입 가드 해제 — 누구나 탐색 가능. 저장 시점 서버에서 프리미엄 여부 처리.
  // isLoggedIn / isPremium / onRequestLogin / onRequestPaywall 는 handleGenerate 에서만 참조.
  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelectedProgram(null);
    setGateAnswers({});
    setGateReasons([]);
    setError(null);
    trackEvent("running_program_sheet_open");
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (step !== "loading") {
      if (step !== "select") {
        trackEvent("running_program_sheet_abandoned", { step });
      }
      onClose();
    }
  };

  const handleSelectProgram = (programId: RunningProgramId) => {
    trackEvent("running_program_select", { program: programId });
    setSelectedProgram(programId);
    // 회의 64-F: 게이트 잠금 해제 — 모든 프로그램 바로 설정으로. 권장 조건은 UI 안내로만 표시.
    setStep("settings");
  };

  const handleGateSubmit = async () => {
    // halfMarathonSec이 undefined면 "아직 선택 안 함", null이면 "없음", number면 입력 완료
    if (gateAnswers.halfMarathonSec === undefined || gateAnswers.recentInjury == null) return;
    // 서버 재검증 — GPS 자동 계산값 + 유저 입력 실제값 전송 (placeholder 제거)
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      if (!token) { onClose(); onRequestLogin(); return; }
      const res = await fetch("/api/checkFullSub3Gate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          weeklyAvgKm8wk: autoWeeklyAvgKm ?? 0,
          recentHalfMarathonSec: gateAnswers.halfMarathonSec ?? undefined,
          recentInjury: gateAnswers.recentInjury,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        trackEvent("running_program_gate_pass");
        setStep("settings");
      } else {
        trackEvent("running_program_gate_fail");
        setGateReasons(Array.isArray(result.reasons) ? result.reasons : []);
        setStep("gate_fail");
      }
    } catch {
      setError(t("running_program.error.generic"));
    }
  };

  const handleGateFailRedirect = () => {
    setSelectedProgram("half_sub_2");
    setGateAnswers({});
    setGateReasons([]);
    setStep("settings");
  };

  const handleGenerate = async () => {
    if (!selectedProgram) return;

    // 회의 64-G (2026-04-18): 장기 프로그램 저장은 프리미엄만. 무료 유저는 페이월 유도.
    const { auth } = await import("@/lib/firebase");
    if (!auth.currentUser) { onClose(); onRequestLogin(); return; }
    if (!isPremium) { onClose(); onRequestPaywall(); return; }

    setStep("loading");
    setError(null);

    try {
      const token = await auth.currentUser.getIdToken();

      // limiter 판정 — 초심자 단순화: Full/Half/10K = break_ceiling, VO2 = build_aerobic
      const limiter = selectedProgram === "vo2_boost" ? "build_aerobic" : "break_ceiling";
      const user5kPaceSec = selectedProgram === "vo2_boost"
        ? Math.floor((vo5kMin * 60 + vo5kSec) / 5) // 5K pace = total / 5
        : undefined;

      const res = await fetch("/api/generateRunningProgram", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          programId: selectedProgram,
          limiter,
          daysPerWeek,
          user5kPaceSec,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { ok: boolean; programId: string; sessions: SavedPlan[] };
      if (!data.ok || !Array.isArray(data.sessions)) throw new Error("Invalid response");

      // programId 치환 — 클라 newProgramId 재생성 (서버가 준 것도 OK지만 일관성)
      const localProgramId = newProgramId();
      const sessions: SavedPlan[] = data.sessions.map(s => ({ ...s, programId: localProgramId }));

      // 로컬 저장 (낙관적)
      saveProgramSessions(sessions);

      // 서버 저장 — 실패 시 로컬 롤백 (데이터 유실 방지, 회의 64-G)
      const remoteRes = await remoteSaveProgram(sessions);
      if (!remoteRes.ok) {
        console.error("remoteSaveProgram failed:", remoteRes);
        deleteProgram(localProgramId); // 로컬 롤백
        // 서버가 403(premium 또는 한도) 반환 시 페이월로 유도. 그 외는 일반 에러.
        if ("reason" in remoteRes && remoteRes.reason === "limit") {
          onClose();
          onRequestPaywall();
        } else {
          setError(t("running_program.error.generic"));
          setStep("preview");
        }
        return;
      }

      trackEvent("running_program_created", {
        program: selectedProgram,
        days_per_week: daysPerWeek,
        total_sessions: sessions.length,
      });

      onProgramCreated({
        programId: localProgramId,
        programName: sessions[0]?.programName ?? "Running Program",
        firstSessionTitle: sessions[0]?.sessionData.title ?? "첫 세션",
      });
      onClose();
    } catch (err) {
      trackEvent("running_program_create_failed", {
        program: selectedProgram ?? "unknown",
        message: err instanceof Error ? err.message : "unknown",
      });
      setError(t("running_program.error.generic"));
      setStep("preview");
    }
  };

  if (variant === "fullscreen") {
    // 회의 2026-04-27: step-aware ← (select=root-back, 그 외=step-back) + 큰 타이틀 헤더 (Kenko 통일).
    // sub-step의 자체 헤더(닫기/← 이전/세팅 라벨)는 hideHeader prop으로 숨김.
    const stepHeader: Record<Step, { caption: string; titleKey: string } > = {
      select: { caption: "RUNNING PROGRAMS", titleKey: "runningHub.header.select" },
      gate_check: { caption: "QUALIFICATION", titleKey: "runningHub.header.gate_check" },
      gate_fail: { caption: "QUALIFICATION", titleKey: "runningHub.header.gate_check" },
      settings: { caption: "SETTINGS", titleKey: "runningHub.header.settings" },
      preview: { caption: "YOUR JOURNEY", titleKey: "runningHub.header.preview" },
      loading: { caption: "GENERATING", titleKey: "runningHub.header.loading" },
    };
    const handleStepBack = () => {
      if (step === "select" || step === "loading") {
        handleClose();
      } else if (step === "settings") {
        setStep("select");
      } else if (step === "preview") {
        setStep("settings");
      } else if (step === "gate_check" || step === "gate_fail") {
        setStep("select");
      }
    };
    const cur = stepHeader[step];
    return (
      <div className="h-full w-full bg-white overflow-y-auto">
        <div className="relative pt-[max(2.5rem,env(safe-area-inset-top))]">
          <button
            onClick={handleStepBack}
            disabled={step === "loading"}
            className="absolute left-4 top-[max(2.5rem,env(safe-area-inset-top))] p-2 text-gray-500 active:text-[#1B4332] transition-colors disabled:opacity-40"
            aria-label={t("runningHub.back")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {/* 회의 2026-04-27 (5차): 헤더와 본문 사이 충분한 separation (pb-6). */}
          <div className="px-6 pt-20 pb-6">
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400">{cur.caption}</p>
            <h1 className="text-3xl font-black text-[#1B4332] mt-1">{t(cur.titleKey)}</h1>
          </div>
        </div>
        <div className="px-6 pb-10">
          {step === "select" && (
            <StepSelect
              t={t}
              onSelect={handleSelectProgram}
              onClose={handleClose}
              hideHeader
              activePrograms={activePrograms}
              onResumeProgram={onResumeProgram}
            />
          )}
          {step === "gate_check" && (
            <StepGateCheck t={t} autoWeeklyAvgKm={autoWeeklyAvgKm} answers={gateAnswers} setAnswers={setGateAnswers} onBack={() => setStep("select")} onSubmit={handleGateSubmit} hideHeader />
          )}
          {step === "gate_fail" && (
            <StepGateFail t={t} reasons={gateReasons} onRedirect={handleGateFailRedirect} onClose={handleClose} />
          )}
          {step === "settings" && selectedProgram && (
            <StepSettings t={t} programId={selectedProgram} daysPerWeek={daysPerWeek} setDaysPerWeek={setDaysPerWeek} startChoice={startChoice} setStartChoice={setStartChoice} vo5kMin={vo5kMin} setVo5kMin={setVo5kMin} vo5kSec={vo5kSec} setVo5kSec={setVo5kSec} onBack={() => setStep("select")} onNext={() => setStep("preview")} hideHeader />
          )}
          {step === "preview" && selectedProgram && (
            <StepPreview t={t} programId={selectedProgram} error={error} onBack={() => setStep("settings")} onStart={handleGenerate} hideHeader />
          )}
          {step === "loading" && (
            <div className="py-20 text-center">
              <div className="inline-block w-10 h-10 border-4 border-[#2D6A4F] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[14px] font-black text-[#1B4332]">{t("running_program.loading.title")}</p>
              <p className="text-[11px] text-gray-500 mt-1">{t("running_program.loading.desc")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
      <div
        className="absolute bottom-2 left-2 right-2 bg-white rounded-[2rem] p-6 animate-slide-up shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {step === "select" && (
          <StepSelect t={t} onSelect={handleSelectProgram} onClose={handleClose} />
        )}
        {step === "gate_check" && (
          <StepGateCheck
            t={t}
            autoWeeklyAvgKm={autoWeeklyAvgKm}
            answers={gateAnswers}
            setAnswers={setGateAnswers}
            onBack={() => setStep("select")}
            onSubmit={handleGateSubmit}
          />
        )}
        {step === "gate_fail" && (
          <StepGateFail t={t} reasons={gateReasons} onRedirect={handleGateFailRedirect} onClose={handleClose} />
        )}
        {step === "settings" && selectedProgram && (
          <StepSettings
            t={t}
            programId={selectedProgram}
            daysPerWeek={daysPerWeek}
            setDaysPerWeek={setDaysPerWeek}
            startChoice={startChoice}
            setStartChoice={setStartChoice}
            vo5kMin={vo5kMin}
            setVo5kMin={setVo5kMin}
            vo5kSec={vo5kSec}
            setVo5kSec={setVo5kSec}
            onBack={() => setStep("select")}
            onNext={() => setStep("preview")}
          />
        )}
        {step === "preview" && selectedProgram && (
          <StepPreview
            t={t}
            programId={selectedProgram}
            error={error}
            onBack={() => setStep("settings")}
            onStart={handleGenerate}
          />
        )}
        {step === "loading" && (
          <div className="py-10 text-center">
            <div className="inline-block w-10 h-10 border-4 border-[#2D6A4F] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[14px] font-black text-[#1B4332]">{t("running_program.loading.title")}</p>
            <p className="text-[11px] text-gray-500 mt-1">{t("running_program.loading.desc")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== Sub-steps =====

type TFn = (key: string) => string;

/**
 * 세팅 단계 chip 버튼. 컴포넌트 함수 바깥에 정의 — 매 렌더 재생성 금지 (lint 회의 64-E).
 */
const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all ${active ? "bg-[#1B4332] text-white" : "bg-gray-50 text-gray-600 border border-gray-200"}`}
  >{children}</button>
);

const StepSelect: React.FC<{
  t: TFn;
  onSelect: (id: RunningProgramId) => void;
  onClose: () => void;
  hideHeader?: boolean;
  activePrograms?: Array<{ programId: string; programName: string; completed: number; total: number; nextSession: { id: string } | null }>;
  onResumeProgram?: (programId: string, nextSessionId: string) => void;
}> = ({ t, onSelect, onClose, hideHeader, activePrograms, onResumeProgram }) => (
  <>
    {!hideHeader && (
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("running_program.step1.title")}</p>
        <button onClick={onClose} className="text-sm text-gray-400 font-bold">{t("running_program.close")}</button>
      </div>
    )}
    <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">{t("running_program.step1.subtitle")}</p>

    {/* 회의 2026-04-27: 진행 중 러닝 프로그램 — "이어가기" 카드. 위계: 신규 시작 카드보다 위에. */}
    {activePrograms && activePrograms.length > 0 && (
      <>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-3">{t("runningHub.inProgress.label")}</p>
        <div className="flex flex-col gap-3 mb-6">
          {activePrograms.map((p) => {
            const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
            return (
              <button
                key={p.programId}
                onClick={() => p.nextSession && onResumeProgram?.(p.programId, p.nextSession.id)}
                disabled={!p.nextSession}
                className="w-full bg-white border border-[#2D6A4F]/30 rounded-3xl shadow-sm px-6 py-5 active:scale-[0.98] transition-transform hover:bg-emerald-50/30 text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-base font-black text-[#1B4332] leading-tight truncate">{p.programName}</span>
                  <span className="shrink-0 text-[11px] font-bold text-[#2D6A4F]">{p.completed}/{p.total}</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2D6A4F] transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-[#2D6A4F] font-bold mt-2">{t("runningHub.inProgress.resume")} →</p>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-3">{t("runningHub.startNew.label")}</p>
      </>
    )}
    {/* 회의 2026-04-27 (4차 가독성 수정): 카드 안 영문 caption 제거(헤더가 이미 있어 중복+어수선). 한글 title + sub-text + (full만) 경험자 칩. */}
    <div className="flex flex-col gap-3">
      {PROGRAM_META.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="w-full bg-white border border-gray-100 rounded-3xl shadow-sm px-6 py-5 active:scale-[0.98] transition-transform hover:bg-gray-50 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xl font-black text-[#1B4332] leading-tight">{t(p.titleKey)}</span>
            {p.id === "full_sub_3" && (
              <span className="shrink-0 text-[10px] font-black tracking-[0.15em] uppercase text-[#2D6A4F] whitespace-nowrap">{t("running_program.program.full.recommend_tag")}</span>
            )}
          </div>
          <p className="text-[12.5px] text-gray-500 mt-1.5 leading-relaxed">{t(p.subKey)}</p>
        </button>
      ))}
    </div>
  </>
);

const StepGateCheck: React.FC<{
  t: TFn;
  autoWeeklyAvgKm: number | null;
  answers: GateAnswers;
  setAnswers: (a: GateAnswers) => void;
  onBack: () => void;
  onSubmit: () => void;
  hideHeader?: boolean;
}> = ({ t, autoWeeklyAvgKm, answers, setAnswers, onBack, onSubmit, hideHeader }) => {
  const [halfMin, setHalfMin] = useState<string>("");
  const [halfSec, setHalfSec] = useState<string>("");
  const [halfNone, setHalfNone] = useState<boolean>(answers.halfMarathonSec === null);

  // half input → answers 반영
  useEffect(() => {
    if (halfNone) {
      setAnswers({ ...answers, halfMarathonSec: null });
      return;
    }
    const m = parseInt(halfMin, 10);
    const s = parseInt(halfSec, 10);
    if (Number.isFinite(m) && m > 0 && m < 180 && Number.isFinite(s) && s >= 0 && s < 60) {
      setAnswers({ ...answers, halfMarathonSec: m * 60 + s });
    } else if (halfMin === "" && halfSec === "") {
      setAnswers({ ...answers, halfMarathonSec: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfMin, halfSec, halfNone]);

  const halfAnswered = answers.halfMarathonSec !== undefined;
  const allAnswered = halfAnswered && answers.recentInjury != null;
  const autoKmOk = autoWeeklyAvgKm != null && autoWeeklyAvgKm >= 50;

  return (
    <>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-sm text-gray-400 font-bold">← {t("running_program.step3.back")}</button>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("running_program.gate.title")}</p>
          <div className="w-10" />
        </div>
      )}
      <p className="text-[12px] text-gray-500 mb-4">{t("running_program.gate.desc")}</p>

      {/* Q1 — GPS 자동 계산 읽기전용 (회의 64-E Phase 4.1) */}
      <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100 mb-2.5">
        <p className="text-[11px] text-gray-500 font-bold">{t("running_program.gate.auto_km_title")}</p>
        {autoWeeklyAvgKm == null ? (
          <p className="text-[14px] text-gray-400 font-black">{t("running_program.gate.auto_km_none")}</p>
        ) : (
          <>
            <p className="text-[22px] text-[#1B4332] font-black leading-none mt-0.5">
              {autoWeeklyAvgKm}
              <span className="text-[12px] text-gray-400 font-bold ml-1">{t("running_program.gate.auto_km_suffix")}</span>
            </p>
            <p className={`text-[11px] mt-1 ${autoKmOk ? "text-[#2D6A4F]" : "text-amber-600"} font-bold`}>
              {autoKmOk ? t("running_program.gate.auto_km_hint_ok") : t("running_program.gate.auto_km_hint_low")}
            </p>
          </>
        )}
      </div>

      {/* Q2 — Half 기록 입력 또는 없음 */}
      <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100 mb-2.5">
        <p className="text-[13px] text-[#1B4332] font-bold leading-snug">{t("running_program.gate.half_label")}</p>
        {!halfNone && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={179}
              placeholder="1:30 → 90"
              value={halfMin}
              onChange={(e) => setHalfMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-gray-200 text-[14px] font-bold text-[#1B4332] outline-none focus:border-[#2D6A4F]"
            />
            <span className="text-[12px] text-gray-500">{t("running_program.gate.half_minutes")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              placeholder="0"
              value={halfSec}
              onChange={(e) => setHalfSec(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-gray-200 text-[14px] font-bold text-[#1B4332] outline-none focus:border-[#2D6A4F]"
            />
            <span className="text-[12px] text-gray-500">{t("running_program.gate.half_seconds")}</span>
          </div>
        )}
        <button
          onClick={() => { setHalfNone(!halfNone); if (!halfNone) { setHalfMin(""); setHalfSec(""); } }}
          className={`w-full py-2 rounded-xl text-[12px] font-bold transition-all ${halfNone ? "bg-[#2D6A4F] text-white" : "bg-white text-gray-500 border border-gray-200"}`}
        >
          {t("running_program.gate.half_none")}
        </button>
      </div>

      {/* Q3 — 부상 Yes/No (유저 판단) */}
      <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100 mb-4">
        <p className="text-[13px] text-[#1B4332] font-bold leading-snug">{t("running_program.gate.injury_label")}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setAnswers({ ...answers, recentInjury: true })}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all ${answers.recentInjury === true ? "bg-[#2D6A4F] text-white" : "bg-white text-gray-600 border border-gray-200"}`}
          >{t("running_program.gate.yes")}</button>
          <button
            onClick={() => setAnswers({ ...answers, recentInjury: false })}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all ${answers.recentInjury === false ? "bg-[#2D6A4F] text-white" : "bg-white text-gray-600 border border-gray-200"}`}
          >{t("running_program.gate.no")}</button>
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="w-full py-3 rounded-2xl bg-[#1B4332] text-white text-[13px] font-black disabled:opacity-30 disabled:bg-gray-300 active:scale-[0.98] transition-all"
      >
        {t("running_program.gate.continue")}
      </button>
    </>
  );
};

const StepGateFail: React.FC<{ t: TFn; reasons: string[]; onRedirect: () => void; onClose: () => void }> = ({ t, reasons, onRedirect, onClose }) => (
  <>
    <div className="flex items-center justify-between mb-3">
      <div className="w-10" />
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("running_program.gate.fail_title")}</p>
      <button onClick={onClose} className="text-sm text-gray-400 font-bold">{t("running_program.close")}</button>
    </div>
    <div className="py-2 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3 border border-amber-200">
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3l-7.07-12a2 2 0 00-3.46 0l-7.07 12a2 2 0 001.73 3z" />
        </svg>
      </div>
      <p className="text-[13px] font-black text-[#1B4332] mb-1">{t("running_program.gate.fail_title")}</p>
      <p className="text-[12px] text-gray-600 leading-relaxed px-2">{t("running_program.gate.fail_desc")}</p>
      {reasons.length > 0 && (
        <ul className="mt-3 px-4 text-left text-[11px] text-gray-500 space-y-1 list-disc list-inside">
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
    <button
      onClick={onRedirect}
      className="w-full mt-4 py-3 rounded-2xl bg-[#1B4332] text-white text-[13px] font-black active:scale-[0.98] transition-all"
    >
      {t("running_program.gate.fail_redirect")}
    </button>
  </>
);

const StepSettings: React.FC<{
  t: TFn;
  programId: RunningProgramId;
  daysPerWeek: DaysPerWeek;
  setDaysPerWeek: (d: DaysPerWeek) => void;
  startChoice: StartChoice;
  setStartChoice: (s: StartChoice) => void;
  vo5kMin: number;
  setVo5kMin: (n: number) => void;
  vo5kSec: number;
  setVo5kSec: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
  hideHeader?: boolean;
}> = ({ t, programId, daysPerWeek, setDaysPerWeek, startChoice, setStartChoice, vo5kMin, setVo5kMin, vo5kSec, setVo5kSec, onBack, onNext, hideHeader }) => {
  const isVo2 = programId === "vo2_boost";
  const vo5kValid = !isVo2 || (vo5kMin >= 10 && vo5kMin <= 59 && vo5kSec >= 0 && vo5kSec <= 59);

  return (
    <>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-sm text-gray-400 font-bold">← {t("running_program.step3.back")}</button>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("running_program.step2.title")}</p>
          <div className="w-10" />
        </div>
      )}

      {/* 회의 2026-04-27 (5차 가독성): 섹션 간격 mb-4 → mb-7, 라벨↔칩 mb-2 → mb-3, 라벨 typo 강화 */}
      <div className="mb-7">
        <p className="text-[13px] font-bold text-[#1B4332] mb-3">{t("running_program.step2.days_label")}</p>
        <div className="flex gap-2.5">
          <Chip active={daysPerWeek === 3} onClick={() => setDaysPerWeek(3)}>{t("running_program.step2.days_3")}</Chip>
          <Chip active={daysPerWeek === 4} onClick={() => setDaysPerWeek(4)}>{t("running_program.step2.days_4")}</Chip>
          <Chip active={daysPerWeek === 5} onClick={() => setDaysPerWeek(5)}>{t("running_program.step2.days_5")}</Chip>
        </div>
      </div>

      <div className="mb-7">
        <p className="text-[13px] font-bold text-[#1B4332] mb-3">{t("running_program.step2.start_label")}</p>
        <div className="flex gap-2.5">
          <Chip active={startChoice === "today"} onClick={() => setStartChoice("today")}>{t("running_program.step2.start_today")}</Chip>
          <Chip active={startChoice === "tomorrow"} onClick={() => setStartChoice("tomorrow")}>{t("running_program.step2.start_tomorrow")}</Chip>
          <Chip active={startChoice === "next_monday"} onClick={() => setStartChoice("next_monday")}>{t("running_program.step2.start_next_mon")}</Chip>
        </div>
      </div>

      {isVo2 && (
        <div className="mb-7">
          <p className="text-[13px] font-bold text-[#1B4332] mb-1">{t("running_program.step2.vo2_5k_label")}</p>
          <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">{t("running_program.step2.vo2_5k_desc")}</p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={59}
              value={vo5kMin}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") { setVo5kMin(0); return; }
                const v = parseInt(raw);
                if (isNaN(v)) return;
                setVo5kMin(Math.min(59, Math.max(0, v)));
              }}
              onBlur={() => { if (vo5kMin < 10) setVo5kMin(10); }}
              className="flex-1 min-w-0 px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[16px] font-bold text-[#1B4332] outline-none focus:border-[#2D6A4F]"
            />
            <span className="text-[12px] text-gray-500">{t("running_program.step2.vo2_5k_minutes")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={vo5kSec}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") { setVo5kSec(0); return; }
                const v = parseInt(raw);
                if (isNaN(v)) return;
                setVo5kSec(Math.min(59, Math.max(0, v)));
              }}
              className="flex-1 min-w-0 px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[16px] font-bold text-[#1B4332] outline-none focus:border-[#2D6A4F]"
            />
            <span className="text-[12px] text-gray-500">{t("running_program.step2.vo2_5k_seconds")}</span>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!vo5kValid}
        className="w-full py-3.5 rounded-2xl bg-[#1B4332] text-white text-[14px] font-black disabled:opacity-30 disabled:bg-gray-300 active:scale-[0.98] transition-all"
      >
        {t("running_program.step2.continue")}
      </button>
    </>
  );
};

interface ChapterPreview {
  key: "base" | "build" | "peak_taper";
  weeks: string;
}

function previewChapters(programId: RunningProgramId): ChapterPreview[] {
  if (programId === "vo2_boost") {
    return [
      { key: "base", weeks: "1-4주" },
      { key: "peak_taper", weeks: "5-8주" },
    ];
  }
  if (programId === "10k_sub_50") {
    return [
      { key: "base", weeks: "1-4주" },
      { key: "build", weeks: "5-8주" },
      { key: "peak_taper", weeks: "9-10주" },
    ];
  }
  return [
    { key: "base", weeks: "1-4주" },
    { key: "build", weeks: "5-8주" },
    { key: "peak_taper", weeks: "9-12주" },
  ];
}

const StepPreview: React.FC<{ t: TFn; programId: RunningProgramId; error: string | null; onBack: () => void; onStart: () => void; hideHeader?: boolean }> = ({ t, programId, error, onBack, onStart, hideHeader }) => {
  const chapters = previewChapters(programId);
  return (
    <>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-sm text-gray-400 font-bold">← {t("running_program.step3.back")}</button>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t("running_program.step3.title")}</p>
          <div className="w-10" />
        </div>
      )}
      <p className="text-[12px] text-gray-500 mb-4">{t("running_program.step3.subtitle")}</p>
      {/* 회의 2026-04-27: Kenko 톤다운 — gradient/colored container 제거, 흰 배경 + border-gray-100 */}
      <div className="flex flex-col gap-2.5 mb-4">
        {chapters.map((ch, i) => (
          <div key={ch.key} className="p-3.5 rounded-2xl bg-white border border-gray-100">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-6 h-6 rounded-lg bg-[#2D6A4F] text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
              <p className="text-[13px] font-black text-[#1B4332]">{t(`running_program.chapter.${ch.key}`)}</p>
              <span className="ml-auto text-[10px] text-gray-400 font-bold">{ch.weeks}</span>
            </div>
            <p className="text-[11px] text-gray-600 pl-8">{t(`running_program.chapter.${ch.key}_desc`)}</p>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-[11px] text-red-500 text-center mb-2">{error}</p>
      )}
      <button
        onClick={onStart}
        className="w-full py-3 rounded-2xl bg-[#1B4332] text-white text-[13px] font-black active:scale-[0.98] transition-all"
      >
        {t("running_program.step3.start")}
      </button>
    </>
  );
};
