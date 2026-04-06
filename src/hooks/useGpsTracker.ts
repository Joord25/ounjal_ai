// ====================================================================
// useGpsTracker — GPS 기반 러닝 측정 훅 (회의 41)
// ====================================================================
// 역할:
// - navigator.geolocation.watchPosition 구독
// - Wake Lock API로 화면 유지 (러닝 중 꺼지지 않게)
// - 포인트 누적 + accuracy 필터링 (> 20m 버림, 첫 5s 버림)
// - 현재 페이스 5초 이동평균 스무딩
// - 인터벌 페이즈 전환 마킹 (세션 종료 시 분해 계산용)
// - pause/resume: enabled false → 좌표 수집 중단, true로 돌아올 때 재개
//
// 설계 원칙:
// - 파생 상태(status)는 이벤트(position/error) 콜백에서만 setState
// - enable/disable useEffect body에서는 setState 하지 않음 (cascading renders 회피)
// - Firestore에 gpsTrack 저장하지 않음 (지도 제거 결정, 회의 40)
// ====================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GpsPoint, PhaseMark } from "@/utils/runningStats";
import {
  accumulateDistance,
  haversineMeters,
  computeCurrentPace,
  isAcceptablePoint,
} from "@/utils/runningStats";

export type GpsTrackingStatus = "pending" | "searching" | "tracking" | "denied" | "error";

interface UseGpsTrackerOptions {
  enabled: boolean;
  isIndoor: boolean;
  /** 스무딩 윈도우 (초). 기본 10초 (업계 표준 10-20초). */
  smoothingWindowSec?: number;
}

export type GpsStatus = "idle" | "searching" | "tracking" | "denied" | "error" | "disabled";

interface UseGpsTrackerReturn {
  status: GpsStatus;
  distance: number;          // meters (필터 적용 후 누적)
  currentPace: number | null; // sec/km
  accuracy: number | null;   // m — 가장 최근 포인트의 정확도
  gpsAvailable: boolean;
  /** 세션 종료 시 collected 데이터 스냅샷 획득 */
  getSnapshot: () => { points: GpsPoint[]; phaseMarks: PhaseMark[]; sessionStartMs: number };
  /** 인터벌 페이즈 전환 마크 (FitScreen이 페이즈 바꿀 때 호출) */
  markPhase: (phase: "sprint" | "recovery", round: number) => void;
  /** 수동 리셋 (세션 재시작) */
  reset: () => void;
}

export function useGpsTracker(options: UseGpsTrackerOptions): UseGpsTrackerReturn {
  const { enabled, isIndoor, smoothingWindowSec = 10 } = options;

  // 내부 tracking status — 이벤트 콜백(position/error)에서만 setState
  const [trackingStatus, setTrackingStatus] = useState<GpsTrackingStatus>("pending");
  const [distance, setDistance] = useState(0);
  const [currentPace, setCurrentPace] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const pointsRef = useRef<GpsPoint[]>([]);
  const cumulativeDistRef = useRef<number>(0);
  const phaseMarksRef = useRef<PhaseMark[]>([]);
  const sessionStartMsRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // 파생 노출용 status — 렌더 시점에 계산 (effect에서 setState 안 함)
  let displayStatus: GpsStatus;
  if (!enabled) displayStatus = "idle";
  else if (isIndoor) displayStatus = "disabled";
  else displayStatus = trackingStatus === "pending" ? "searching" : trackingStatus;

  // ── Wake Lock 관리 ──
  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock?.request) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      // Wake Lock 실패해도 세션은 진행 (블록 금지)
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  // ── 포인트 추가 + 파생 상태 업데이트 (이벤트 콜백) ──
  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const p: GpsPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      t: Date.now(),
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed ?? undefined,
    };
    setAccuracy(p.accuracy);

    const lastPoint = pointsRef.current.length > 0 ? pointsRef.current[pointsRef.current.length - 1] : undefined;
    if (isAcceptablePoint(p, sessionStartMsRef.current, lastPoint)) {
      // 누적합: 마지막 세그먼트만 더함 (O(1), 기존 O(n) 재계산 제거)
      if (lastPoint) {
        cumulativeDistRef.current += haversineMeters(lastPoint.lat, lastPoint.lng, p.lat, p.lng);
      }
      pointsRef.current.push(p);
      setDistance(cumulativeDistRef.current);
      setCurrentPace(computeCurrentPace(pointsRef.current, smoothingWindowSec));
      setTrackingStatus("tracking");
    } else {
      // lock-on 대기 중 (첫 5s 또는 accuracy 불량)
      setTrackingStatus(prev => (prev === "tracking" ? "tracking" : "searching"));
    }
  }, [smoothingWindowSec]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setTrackingStatus("denied");
    } else {
      setTrackingStatus("error");
    }
  }, []);

  // ── enabled 변화 시 watch 시작/종료 (setState 없음) ──
  useEffect(() => {
    if (!enabled || isIndoor) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      releaseWakeLock();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // geolocation API 없음 — handleError로 처리 불가하니 ref로 표시
      // (실제 현대 브라우저에선 이 경로 거의 미발동)
      return;
    }

    // 세션 시작 타임스탬프 (최초 enable 시에만)
    if (sessionStartMsRef.current === 0) {
      sessionStartMsRef.current = Date.now();
    }

    acquireWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      releaseWakeLock();
    };
  }, [enabled, isIndoor, acquireWakeLock, releaseWakeLock, handlePosition, handleError]);

  // ── 인터벌 페이즈 전환 마크 ──
  const markPhase = useCallback((phase: "sprint" | "recovery", round: number) => {
    phaseMarksRef.current.push({ t: Date.now(), phase, round });
  }, []);

  // ── 스냅샷 획득 (세션 종료 시) ──
  const getSnapshot = useCallback(() => ({
    points: [...pointsRef.current],
    phaseMarks: [...phaseMarksRef.current],
    sessionStartMs: sessionStartMsRef.current,
  }), []);

  // ── 리셋 ──
  const reset = useCallback(() => {
    pointsRef.current = [];
    cumulativeDistRef.current = 0;
    phaseMarksRef.current = [];
    sessionStartMsRef.current = 0;
    setDistance(0);
    setCurrentPace(null);
    setAccuracy(null);
    setTrackingStatus("pending");
  }, []);

  return {
    status: displayStatus,
    distance,
    currentPace,
    accuracy,
    gpsAvailable: displayStatus === "tracking" || displayStatus === "searching",
    getSnapshot,
    markPhase,
    reset,
  };
}
