"use client";

import { useEffect } from "react";

/**
 * Sets --safe-area-bottom CSS variable on <html>.
 *
 * 회의 ζ-3 (2026-04-28): cbad2b5 의 "PhoneFrame height calc(100dvh - env)" 가 안드 PWA 에서
 * env() 가 0 으로 잡히는 케이스 발생 → viewport 가 nav 뒤로 확장 → 화면이 nav 뒤로 숨음.
 * PhoneFrame 100dvh 복원 + useSafeArea 가 환경별 padding 직접 보장:
 * - 안드 PWA: env() 안 잡혀도 fallback 48px 강제 (Android nav bar 평균)
 * - iOS PWA: 12px 고정 (홈 인디케이터)
 * - 모바일 브라우저: 0px (chrome 이 nav 위에서 끝남)
 * - PC: 4px
 */
export function useSafeArea() {
  useEffect(() => {
    function update() {
      const isDesktop = window.matchMedia("(min-width: 640px)").matches;
      if (isDesktop) {
        document.documentElement.style.setProperty("--safe-area-bottom", "4px");
        return;
      }

      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const isIOS = (navigator as unknown as { standalone?: boolean }).standalone === true
        || /iPhone|iPad|iPod/.test(navigator.userAgent);

      if (isIOS && isStandalone) {
        // iOS PWA: 홈 인디케이터 회피 — env(~34px)는 과해서 12px 고정.
        document.documentElement.style.setProperty("--safe-area-bottom", "12px");
        return;
      }

      // 회의 ζ-3 (2026-04-28): PhoneFrame 100svh 채택 후 — svh 자체가 chrome/nav 노출 상태 기준 안전 viewport.
      // BottomTabs / CTA 들이 svh 하단 = 시스템 nav top 과 동일선상. 추가 padding 0.
      document.documentElement.style.setProperty("--safe-area-bottom", "0px");
    }

    update();

    // Re-check on display mode change or viewport resize
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", update);
    window.addEventListener("resize", update);

    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}
