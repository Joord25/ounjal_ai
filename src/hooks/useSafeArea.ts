"use client";

import { useEffect } from "react";

/**
 * Sets --safe-area-bottom CSS variable on <html>.
 *
 * - If env(safe-area-inset-bottom) > 0 (iOS, some Android): uses it directly
 * - If env() returns 0 AND in standalone PWA: uses a small fallback (12px)
 *   to prevent overlap with Android gesture/button nav bar
 * - Browser mode: 0px (browser chrome handles spacing)
 */
export function useSafeArea() {
  useEffect(() => {
    function update() {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;

      // Check if CSS env() provides a real value
      const test = document.createElement("div");
      test.style.paddingBottom = "env(safe-area-inset-bottom)";
      document.body.appendChild(test);
      const envValue = parseInt(getComputedStyle(test).paddingBottom) || 0;
      document.body.removeChild(test);

      if (envValue > 0) {
        // iOS or device with proper safe-area support
        document.documentElement.style.setProperty(
          "--safe-area-bottom",
          `env(safe-area-inset-bottom)`
        );
      } else if (isStandalone) {
        // Android PWA: env() returns 0 but nav bar may overlap
        // Estimate nav bar height from screen vs viewport difference
        const navBarHeight = window.screen.height - window.innerHeight;
        // Only apply if reasonable range (16~80px), otherwise small fallback
        const fallback = navBarHeight > 16 && navBarHeight < 80 ? navBarHeight : 24;
        document.documentElement.style.setProperty(
          "--safe-area-bottom",
          `${fallback}px`
        );
      } else {
        // Regular browser: browser chrome provides spacing
        document.documentElement.style.setProperty("--safe-area-bottom", "0px");
      }
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
