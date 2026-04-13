/**
 * 단위 변환 유틸 — DB는 항상 SI (kg/cm/km)로 저장, 표시만 변환.
 * - metric: kg · cm · km · min/km
 * - imperial: lb · ft'in" · mi · min/mi
 */

export type UnitSystem = "metric" | "imperial";

const KG_TO_LB = 2.20462;
const CM_PER_INCH = 2.54;
const KM_TO_MI = 0.621371;

// ───────── 무게 ─────────

export function kgToLb(kg: number): number {
  return kg * KG_TO_LB;
}

export function lbToKg(lb: number): number {
  return lb / KG_TO_LB;
}

export function formatWeight(kg: number | undefined | null, system: UnitSystem, opts?: { precision?: number; unit?: boolean }): string {
  if (kg == null || Number.isNaN(kg)) return "";
  const precision = opts?.precision ?? (system === "imperial" ? 0 : 1);
  const showUnit = opts?.unit !== false;
  const val = system === "imperial" ? kgToLb(kg) : kg;
  const rounded = Number(val.toFixed(precision));
  // 정수면 소수점 제거
  const display = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(precision);
  return showUnit ? `${display}${system === "imperial" ? "lb" : "kg"}` : display;
}

/** 입력 문자열을 kg로 파싱. 빈값/NaN이면 null. */
export function parseWeightToKg(input: string | number, system: UnitSystem): number | null {
  if (typeof input === "number") return input;
  const cleaned = String(input).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return system === "imperial" ? lbToKg(n) : n;
}

export function unitWeightLabel(system: UnitSystem): string {
  return system === "imperial" ? "lb" : "kg";
}

// ───────── 신장 ─────────

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/** imperial: "5'9\"" 형태. metric: "175cm" */
export function formatHeight(cm: number | undefined | null, system: UnitSystem, opts?: { unit?: boolean }): string {
  if (cm == null || Number.isNaN(cm)) return "";
  const showUnit = opts?.unit !== false;
  if (system === "imperial") {
    const totalInches = cmToInches(cm);
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    // 반올림으로 12in 되면 ft 올림
    if (inches === 12) return `${feet + 1}'0"`;
    return `${feet}'${inches}"`;
  }
  return showUnit ? `${Math.round(cm)}cm` : `${Math.round(cm)}`;
}

/** imperial: "5'9" / "5'9\"" / "69in" / "69" 를 cm로. metric: 숫자만 cm. */
export function parseHeightToCm(input: string | number, system: UnitSystem): number | null {
  if (typeof input === "number") return input;
  const raw = String(input).trim();
  if (!raw) return null;
  if (system === "imperial") {
    const m = raw.match(/^(\d+)\s*'\s*(\d+(?:\.\d+)?)?/);
    if (m) {
      const feet = parseInt(m[1], 10);
      const inches = m[2] ? parseFloat(m[2]) : 0;
      return inchesToCm(feet * 12 + inches);
    }
    // 순수 inches
    const n = parseFloat(raw.replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n)) return inchesToCm(n);
    return null;
  }
  const n = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
}

export function unitHeightLabel(system: UnitSystem): string {
  return system === "imperial" ? "ft" : "cm";
}

// ───────── 거리 (러닝) ─────────

export function kmToMi(km: number): number {
  return km * KM_TO_MI;
}

export function miToKm(mi: number): number {
  return mi / KM_TO_MI;
}

export function formatDistance(km: number | undefined | null, system: UnitSystem, opts?: { precision?: number; unit?: boolean }): string {
  if (km == null || Number.isNaN(km)) return "";
  const precision = opts?.precision ?? 2;
  const showUnit = opts?.unit !== false;
  const val = system === "imperial" ? kmToMi(km) : km;
  const display = val.toFixed(precision);
  return showUnit ? `${display}${system === "imperial" ? "mi" : "km"}` : display;
}

export function unitDistanceLabel(system: UnitSystem): string {
  return system === "imperial" ? "mi" : "km";
}

// ───────── 페이스 (러닝) ─────────

/** 초/km → "m'ss\"/km" 또는 변환 후 "m'ss\"/mi" */
export function formatPace(secPerKm: number | undefined | null, system: UnitSystem): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "";
  const secPerUnit = system === "imperial" ? secPerKm / KM_TO_MI : secPerKm;
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit - m * 60);
  const ss = s.toString().padStart(2, "0");
  return `${m}'${ss}"/${system === "imperial" ? "mi" : "km"}`;
}

// ───────── 로케일 → 기본 단위 ─────────

export function defaultUnitSystemForLocale(locale: string): UnitSystem {
  return locale === "en" ? "imperial" : "metric";
}
