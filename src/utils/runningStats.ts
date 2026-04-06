// ====================================================================
// Running Stats Computation
// 회의 41: GPS 데이터 → 거리/페이스/인터벌 분해 계산
// 지도 없음 — 숫자 summary만 저장 (Firestore gpsTrack 저장 안 함)
// ====================================================================

import type { RunningStats, RunningType, IntervalRoundRecord } from "@/constants/workout";

export interface GpsPoint {
  lat: number;
  lng: number;
  t: number;          // Date.now() ms
  accuracy: number;   // m
  speed?: number;     // m/s (OS 제공, 옵셔널)
}

export interface PhaseMark {
  t: number;                      // Date.now() ms
  phase: "sprint" | "recovery";   // 러닝 코치 권고: 인터벌 전환 시점
  round: number;
}

// ─────────────────────────────────────────────────────────────────
// Haversine 거리 계산 (m 단위)
// ─────────────────────────────────────────────────────────────────
const EARTH_R_M = 6_371_000;

export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_R_M * c;
}

// ─────────────────────────────────────────────────────────────────
// 포인트 필터링
// - accuracy > 20m 샘플 버림 (GPS 신호 불량)
// - 시작 후 첫 5초 샘플 버림 (cold start 오차)
// ─────────────────────────────────────────────────────────────────
// 12 m/s = 2:47/km — 인간이 지속할 수 없는 속도. 이 이상이면 GPS 순간이동.
const MAX_HUMAN_SPEED_MS = 12;

export function isAcceptablePoint(
  p: GpsPoint,
  sessionStartMs: number,
  lastAcceptedPoint?: GpsPoint,
): boolean {
  if (p.accuracy > 20) return false;
  if (p.t - sessionStartMs < 5000) return false;
  // 속도 기반 이상치 거부: 이전 포인트 대비 12m/s 초과 시 GPS 순간이동으로 판단
  if (lastAcceptedPoint) {
    const dt = (p.t - lastAcceptedPoint.t) / 1000;
    if (dt > 0) {
      const dist = haversineMeters(lastAcceptedPoint.lat, lastAcceptedPoint.lng, p.lat, p.lng);
      if (dist / dt > MAX_HUMAN_SPEED_MS) return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────
// 누적 거리 (필터 적용)
// ─────────────────────────────────────────────────────────────────
export function accumulateDistance(points: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng,
    );
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────
// 페이스 sanity 상수 (회의 42 후속 — GPS drift 방어)
// - MIN_WINDOW_DIST_M: 5초 윈도우에서 최소 이동 거리 미만이면 "정지"로 판단, null 반환
//   (GPS drift는 정지 상태에서도 2-3m 움직임을 낼 수 있어 3m로 설정)
// - MAX_PACE_SEC_PER_KM: 20:00 /km 넘으면 러닝 범위 벗어남, null 반환 (걷기도 안 됨)
// - MIN_PACE_SEC_PER_KM: 2:00 /km 미만은 세계 최고 기록급, GPS 오측정으로 판단
// ─────────────────────────────────────────────────────────────────
const MIN_WINDOW_DIST_M = 3;
const MAX_PACE_SEC_PER_KM = 20 * 60;    // 20:00
const MIN_PACE_SEC_PER_KM = 2 * 60;     // 2:00

// ─────────────────────────────────────────────────────────────────
// 현재 페이스 (sec/km) — 최근 windowSec 구간의 이동평균
// 전문가 회의: 5초 → 10초 (업계 표준 Strava/Apple 10-20초)
// 회의 42: drift 방어 — 최소 거리 3m + 20:00 /km 상한
// ─────────────────────────────────────────────────────────────────
export function computeCurrentPace(
  points: GpsPoint[],
  windowSec: number = 10,
): number | null {
  if (points.length < 2) return null;
  const now = points[points.length - 1].t;
  const cutoff = now - windowSec * 1000;
  const recent = points.filter(p => p.t >= cutoff);
  if (recent.length < 2) return null;
  const dist = accumulateDistance(recent);
  const durSec = (recent[recent.length - 1].t - recent[0].t) / 1000;
  if (durSec <= 0) return null;
  // 최소 이동 거리 가드 (정지 상태 GPS drift 방어)
  if (dist < MIN_WINDOW_DIST_M) return null;
  const pace = durSec / (dist / 1000);
  // 페이스 범위 sanity
  if (pace > MAX_PACE_SEC_PER_KM) return null;
  if (pace < MIN_PACE_SEC_PER_KM) return null;
  return pace;
}

// ─────────────────────────────────────────────────────────────────
// 평균 페이스 (sec/km) — 동일한 sanity cap 적용
// ─────────────────────────────────────────────────────────────────
export function computeAvgPace(distanceM: number, durationSec: number): number | null {
  if (distanceM <= 0 || durationSec <= 0) return null;
  // 최소 총 거리 가드 — 50m 미만은 러닝으로 판단 불가
  if (distanceM < 50) return null;
  const pace = durationSec / (distanceM / 1000);
  if (pace > MAX_PACE_SEC_PER_KM) return null;
  if (pace < MIN_PACE_SEC_PER_KM) return null;
  return pace;
}

// ─────────────────────────────────────────────────────────────────
// 인터벌 라운드 분해 — phaseMarks 기반
// 러닝 코치 권고: 인터벌 모드에선 km 스플릿보다 라운드별 전력/회복 페이스가 의미 있음
// ─────────────────────────────────────────────────────────────────
export function computeIntervalRounds(
  points: GpsPoint[],
  marks: PhaseMark[],
): IntervalRoundRecord[] {
  if (marks.length === 0) return [];

  // phase segments: 각 mark는 "이 시점에 새 페이즈 시작"을 의미
  // segments[i] = { start: marks[i].t, end: marks[i+1]?.t, phase, round }
  type Segment = { start: number; end: number; phase: "sprint" | "recovery"; round: number };
  const segments: Segment[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].t;
    const end = i + 1 < marks.length ? marks[i + 1].t : Number.MAX_SAFE_INTEGER;
    segments.push({ start, end, phase: marks[i].phase, round: marks[i].round });
  }

  // round별로 sprint/recovery 집계
  const rounds = new Map<number, IntervalRoundRecord>();
  for (const seg of segments) {
    const inRange = points.filter(p => p.t >= seg.start && p.t <= seg.end);
    if (inRange.length < 2) continue;
    const dist = accumulateDistance(inRange);
    const durSec = (inRange[inRange.length - 1].t - inRange[0].t) / 1000;
    // 회의 42: 구간 페이스도 sanity — 최소 5m 이동 + 범위 가드
    let pace: number | null = null;
    if (dist >= 5 && durSec > 0) {
      const raw = durSec / (dist / 1000);
      if (raw >= MIN_PACE_SEC_PER_KM && raw <= MAX_PACE_SEC_PER_KM) pace = raw;
    }

    const existing = rounds.get(seg.round) ?? {
      round: seg.round,
      sprintPace: null,
      recoveryPace: null,
      sprintDurationSec: 0,
      recoveryDurationSec: 0,
    };
    if (seg.phase === "sprint") {
      existing.sprintPace = pace;
      existing.sprintDurationSec = durSec;
    } else {
      existing.recoveryPace = pace;
      existing.recoveryDurationSec = durSec;
    }
    rounds.set(seg.round, existing);
  }

  return Array.from(rounds.values()).sort((a, b) => a.round - b.round);
}

// ─────────────────────────────────────────────────────────────────
// km 스플릿 계산 — 1km 경계를 지날 때마다 구간 페이스 기록
// ─────────────────────────────────────────────────────────────────
export function computeKmSplits(points: GpsPoint[]): { km: number; paceSec: number }[] {
  if (points.length < 2) return [];
  const splits: { km: number; paceSec: number }[] = [];
  let cumDist = 0;
  let splitStartIdx = 0;
  let nextKm = 1000; // 다음 스플릿 경계 (m)

  for (let i = 1; i < points.length; i++) {
    const segDist = haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    cumDist += segDist;

    if (cumDist >= nextKm) {
      const splitDurSec = (points[i].t - points[splitStartIdx].t) / 1000;
      const splitDistM = cumDist - (nextKm - 1000);
      if (splitDurSec > 0 && splitDistM > 0) {
        const paceSec = splitDurSec / (splitDistM / 1000);
        // sanity check
        if (paceSec >= MIN_PACE_SEC_PER_KM && paceSec <= MAX_PACE_SEC_PER_KM) {
          splits.push({ km: nextKm / 1000, paceSec: Math.round(paceSec) });
        }
      }
      splitStartIdx = i;
      nextKm += 1000;
    }
  }
  return splits;
}

// ─────────────────────────────────────────────────────────────────
// 최종 RunningStats 조립
// 세션 종료 시 한 번 호출되어 Firestore에 저장할 요약 생성
// ─────────────────────────────────────────────────────────────────
export interface ComputeRunningStatsInput {
  runningType: RunningType;
  isIndoor: boolean;
  gpsAvailable: boolean;
  points: GpsPoint[];
  phaseMarks: PhaseMark[];
  sessionStartMs: number;
  sessionEndMs: number;
  completedRounds: number;
  totalRounds: number;
}

export function computeRunningStats(input: ComputeRunningStatsInput): RunningStats {
  const {
    runningType, isIndoor, gpsAvailable,
    points, phaseMarks,
    sessionStartMs, sessionEndMs,
    completedRounds, totalRounds,
  } = input;

  const durationSec = Math.max(0, (sessionEndMs - sessionStartMs) / 1000);

  // 필터링된 유효 포인트 (실내/GPS 없음이면 빈 배열)
  const validPoints = (gpsAvailable && !isIndoor)
    ? points.filter(p => isAcceptablePoint(p, sessionStartMs))
    : [];

  const distance = accumulateDistance(validPoints);
  const avgPace = computeAvgPace(distance, durationSec);

  const intervalRounds = (gpsAvailable && !isIndoor)
    ? computeIntervalRounds(validPoints, phaseMarks)
    : [];

  // 전력/회복 구간 평균 (인터벌 분해가 있을 때만)
  const sprintPaces = intervalRounds.map(r => r.sprintPace).filter((p): p is number => p != null);
  const recoveryPaces = intervalRounds.map(r => r.recoveryPace).filter((p): p is number => p != null);
  const sprintAvgPace = sprintPaces.length > 0
    ? sprintPaces.reduce((a, b) => a + b, 0) / sprintPaces.length
    : null;
  const recoveryAvgPace = recoveryPaces.length > 0
    ? recoveryPaces.reduce((a, b) => a + b, 0) / recoveryPaces.length
    : null;

  // 최고 페이스 (가장 빠른 = sec/km 최소값)
  const allPaces = [...sprintPaces, ...recoveryPaces];
  const bestPace = allPaces.length > 0 ? Math.min(...allPaces) : null;

  const completionRate = totalRounds > 0
    ? Math.min(1, completedRounds / totalRounds)
    : 1;

  // km 스플릿 (GPS 사용 가능한 경우만)
  const splits = (gpsAvailable && !isIndoor) ? computeKmSplits(validPoints) : [];

  return {
    runningType,
    isIndoor,
    gpsAvailable,
    distance,
    duration: durationSec,
    avgPace,
    sprintAvgPace,
    recoveryAvgPace,
    bestPace,
    intervalRounds,
    splits: splits.length > 0 ? splits : undefined,
    completionRate,
  };
}
