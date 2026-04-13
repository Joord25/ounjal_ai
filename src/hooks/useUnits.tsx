"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  UnitSystem,
  defaultUnitSystemForLocale,
  formatWeight,
  formatHeight,
  formatDistance,
  formatPace,
  parseWeightToKg,
  parseHeightToCm,
  unitWeightLabel,
  unitHeightLabel,
  unitDistanceLabel,
} from "@/utils/units";
import { useTranslation } from "./useTranslation";

const STORAGE_KEY = "ohunjal_units_system";

interface UnitsContextType {
  system: UnitSystem;
  setSystem: (s: UnitSystem) => void;
  /** 표시 포맷터 묶음 — locale-aware 단축 사용 */
  fmt: {
    weight: (kg: number | undefined | null, opts?: { precision?: number; unit?: boolean }) => string;
    height: (cm: number | undefined | null, opts?: { unit?: boolean }) => string;
    distance: (km: number | undefined | null, opts?: { precision?: number; unit?: boolean }) => string;
    pace: (secPerKm: number | undefined | null) => string;
  };
  parse: {
    weightToKg: (input: string | number) => number | null;
    heightToCm: (input: string | number) => number | null;
  };
  labels: {
    weight: string;
    height: string;
    distance: string;
  };
}

const UnitsContext = createContext<UnitsContextType | null>(null);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useTranslation();

  const [system, setSystemState] = useState<UnitSystem>(() => {
    if (typeof window === "undefined") return "metric";
    const stored = localStorage.getItem(STORAGE_KEY) as UnitSystem | null;
    if (stored === "metric" || stored === "imperial") return stored;
    return defaultUnitSystemForLocale(locale);
  });

  // 로케일 변경 시 아직 유저가 수동 설정 안 했다면 locale 기본값으로
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setSystemState(defaultUnitSystemForLocale(locale));
  }, [locale]);

  const setSystem = useCallback((next: UnitSystem) => {
    setSystemState(next);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<UnitsContextType>(() => ({
    system,
    setSystem,
    fmt: {
      weight: (kg, opts) => formatWeight(kg, system, opts),
      height: (cm, opts) => formatHeight(cm, system, opts),
      distance: (km, opts) => formatDistance(km, system, opts),
      pace: (sec) => formatPace(sec, system),
    },
    parse: {
      weightToKg: (input) => parseWeightToKg(input, system),
      heightToCm: (input) => parseHeightToCm(input, system),
    },
    labels: {
      weight: unitWeightLabel(system),
      height: unitHeightLabel(system),
      distance: unitDistanceLabel(system),
    },
  }), [system, setSystem]);

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextType {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used inside <UnitsProvider>");
  return ctx;
}
