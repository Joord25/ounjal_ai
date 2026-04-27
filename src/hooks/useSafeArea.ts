"use client";

import { useEffect } from "react";

/**
 * Sets --safe-area-bottom CSS variable on <html>.
 *
 * 회의 2026-04-28: 앱 레이어가 시스템 nav와 "동일선상"에 있어야 함 — 앱이 위로 떠 있는 느낌도,
 * 시스템 nav 뒤로 숨어 가려지는 느낌도 NO. 100dvh는 이미 시스템 nav 위까지만 잡혀있으므로
 * 우리가 extra padding 안 주면 BottomTabs pill이 viewport 하단 = 시스템 nav 바로 위에 flush.
 *
 * - 모바일 (브라우저 / 안드 PWA): 0px → BottomTabs 내부 16px만 남아 시스템 nav와 동일선상
 * - iOS PWA: 12px (홈 인디케이터 회피용 — 인디케이터에 가려지면 동일선상이 아니라 "뒤에 숨음")
 * - PC: 4px (브라우저 윈도우 하단과 약간 여유 — 나답 수준)
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
        // iOS PWA: 홈 인디케이터 회피 — 그 외엔 인디케이터에 BottomTabs가 가려져 "뒤에 숨음" 됨.
        document.documentElement.style.setProperty("--safe-area-bottom", "12px");
        return;
      }

      // 모바일 브라우저 + 안드 PWA: 0px — 시스템 nav 바로 위에 붙어 동일선상.
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
