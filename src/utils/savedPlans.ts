import { WorkoutSessionData, getExerciseMuscleGroups } from "@/constants/workout";

export interface SavedPlan {
  id: string;
  name: string;
  sessionData: WorkoutSessionData;
  createdAt: number;
  lastUsedAt: number | null;
  useCount: number;
}

const STORAGE_KEY = "ohunjal_saved_plans";
export const FREE_LIMIT = 1;
export const PREMIUM_LIMIT = 5;

export function getSavedPlans(): SavedPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlans(plans: SavedPlan[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function savePlan(plan: SavedPlan): void {
  const all = getSavedPlans();
  const idx = all.findIndex(p => p.id === plan.id);
  if (idx >= 0) all[idx] = plan;
  else all.unshift(plan);
  savePlans(all);
}

export function deletePlan(id: string): void {
  savePlans(getSavedPlans().filter(p => p.id !== id));
}

export function getPlanById(id: string): SavedPlan | null {
  return getSavedPlans().find(p => p.id === id) ?? null;
}

export function markPlanUsed(id: string): void {
  const all = getSavedPlans();
  const p = all.find(x => x.id === id);
  if (!p) return;
  p.lastUsedAt = Date.now();
  p.useCount += 1;
  savePlans(all);
}

export function canAddPlan(isPremium: boolean): boolean {
  const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
  return getSavedPlans().length < limit;
}

// ─── 서버 동기화 (Firestore 경유 Cloud Functions) ──────────────────
// 로그인 유저만 호출. 서버가 SSOT, 클라이언트 localStorage는 오프라인 캐시.

async function authedFetch(path: string, body?: object): Promise<Response | null> {
  const { auth } = await import("@/lib/firebase");
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** 서버에 플랜 저장. 서버가 한도 초과 판정하면 403 반환. */
export async function remoteSavePlan(plan: SavedPlan): Promise<{ ok: true } | { ok: false; reason: "limit" | "error"; detail?: string }> {
  try {
    const res = await authedFetch("/api/savePlan", plan);
    if (!res) return { ok: false, reason: "error", detail: "Not authenticated" };
    if (res.status === 403) return { ok: false, reason: "limit" };
    if (!res.ok) return { ok: false, reason: "error", detail: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", detail: (e as Error).message };
  }
}

/** 서버에서 플랜 목록 가져와 localStorage와 병합 (서버 우선). */
export async function syncSavedPlansFromServer(): Promise<SavedPlan[]> {
  try {
    const res = await authedFetch("/api/listSavedPlans");
    if (!res || !res.ok) return getSavedPlans();
    const { plans } = await res.json() as { plans: SavedPlan[] };
    savePlans(plans);
    return plans;
  } catch {
    return getSavedPlans();
  }
}

export async function remoteDeletePlan(id: string): Promise<boolean> {
  try {
    const res = await authedFetch("/api/deleteSavedPlan", { id });
    return !!res?.ok;
  } catch {
    return false;
  }
}

export async function remoteMarkPlanUsed(id: string): Promise<boolean> {
  try {
    const res = await authedFetch("/api/markSavedPlanUsed", { id });
    return !!res?.ok;
  } catch {
    return false;
  }
}

export function newPlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 세션 데이터로부터 자동 이름 생성 — "가슴·삼두·어깨 40분 · 4월 16일" */
export function autoNamePlan(session: WorkoutSessionData, locale: string = "ko"): string {
  const groupCounts = new Map<string, number>();
  for (const ex of session.exercises) {
    if (ex.type === "warmup") continue;
    const groups = getExerciseMuscleGroups(ex.name);
    for (const g of groups) {
      groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
    }
  }
  const topGroups = [...groupCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const totalMin = Math.round(session.exercises.reduce((sum, ex) => {
    const m = ex.count.match(/(\d+)\s*(분|min)/i);
    if (m) return sum + parseInt(m[1], 10);
    return sum + (ex.sets || 1) * 2; // set당 대략 2분 추정
  }, 0));

  const today = new Date();
  const dateLabel = locale === "ko"
    ? `${today.getMonth() + 1}월 ${today.getDate()}일`
    : today.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const groupLabel = topGroups.length > 0 ? topGroups.join("·") : (locale === "ko" ? "전신" : "Full Body");
  const minSuffix = locale === "ko" ? "분" : "min";
  return `${groupLabel} ${totalMin}${minSuffix} · ${dateLabel}`;
}
