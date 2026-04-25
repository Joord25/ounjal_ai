/**
 * useScreenWakeLock — 화면 꺼짐 방지 hook
 *
 * 정책 (회의 2026-04-26 음악 도입):
 * - useGpsTracker 가 이미 자체 wake lock 을 잡고 있음. 같은 navigator.wakeLock 은 동시 호출 안전 (각자 인스턴스 발급).
 * - 음악 재생 중 헬스 운동(GPS 미사용) 에서 화면 꺼짐 방지용.
 * - active=true 시 lock, false 시 release.
 * - visibilitychange 시 자동 재취득 (브라우저 정책상 wake lock 은 백그라운드 진입 시 자동 해제됨).
 * - 실패해도 세션 블록 금지.
 */

import { useEffect, useRef } from "react";

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (e: string, cb: () => void) => void };

export function useScreenWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: string) => Promise<WakeLockSentinel> };
        };
        if (!nav.wakeLock?.request) return;
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        lockRef.current = sentinel;
      } catch {
        // Wake Lock 실패해도 운동은 진행
      }
    };

    const release = async () => {
      try {
        if (lockRef.current) {
          await lockRef.current.release();
          lockRef.current = null;
        }
      } catch {
        // ignore
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && active && !lockRef.current) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active]);
}
