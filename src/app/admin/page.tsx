"use client";

import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";

const ADMIN_UIDS = ["jDkXqeAFCMgJj8cFbRZITpokS2H2"];
const GA4_URL = "https://analytics.google.com/analytics/web/#/p/G-BVD88DPW9E";

type Tab = "dashboard" | "users" | "analytics" | "history";

interface DashboardData {
  totalUsers: number;
  active: number;
  free: number;
  cancelled: number;
  expired: number;
  expiringIn3Days: number;
  monthlyRevenue: number;
}

interface ListUser {
  uid: string;
  email: string;
  displayName: string;
  status: string;
  expiresAt: string | null;
  lastPaymentAt: string | null;
  amount: number;
  billingKey: string;
}

interface UserInfo {
  email: string;
  uid: string;
  displayName: string | null;
  status: string;
  plan: string | null;
  expiresAt: string | null;
  lastPaymentAt: string | null;
  amount: number | null;
  billingKey: string;
}

interface LogEntry {
  action: string;
  targetEmail: string;
  months: number;
  expiresAt: string;
  timestamp: string | null;
}

const FUNNEL_EVENTS = [
  { name: "onboarding_start", desc: "앱 진입 (로그인/게스트)" },
  { name: "condition_check_start", desc: "컨디션 체크 시작" },
  { name: "condition_check_step", desc: "컨디션 체크 각 스텝 완료" },
  { name: "condition_check_complete", desc: "컨디션 체크 완료 (목표 선택)" },
  { name: "plan_preview_view", desc: "운동 플랜 프리뷰 도달" },
  { name: "plan_preview_start", desc: "\"시작\" 버튼 탭" },
  { name: "workout_start", desc: "운동 세션 시작" },
  { name: "workout_complete", desc: "운동 세션 완료" },
  { name: "report_view", desc: "운동 리포트 화면" },
  { name: "paywall_view", desc: "페이월 노출" },
  { name: "paywall_tap_subscribe", desc: "구독 버튼 탭" },
  { name: "paywall_dismiss", desc: "페이월 닫기" },
  { name: "subscription_complete", desc: "결제 완료" },
];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");

  // Dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // User list
  const [userList, setUserList] = useState<ListUser[]>([]);
  const [userFilter, setUserFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Search (in users tab)
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<UserInfo | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  // Activate
  const [months, setMonths] = useState(1);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [activateResult, setActivateResult] = useState("");

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u ? ADMIN_UIDS.includes(u.uid) : false);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getToken = useCallback(async () => {
    return (await user?.getIdToken()) || "";
  }, [user]);

  // Load data when admin confirmed
  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
      loadLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && tab === "users") loadUserList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab, userFilter, userPage]);

  const loadDashboard = async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/adminDashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      });
      if (res.ok) setDashboard(await res.json());
    } catch { /* ignore */ }
  };

  const loadUserList = async () => {
    setLoadingUsers(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/adminListUsers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: userFilter, page: userPage, limit: 20 }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserList(data.users);
        setUserTotal(data.total);
        setUserTotalPages(data.totalPages);
      }
    } catch { /* ignore */ }
    setLoadingUsers(false);
  };

  const loadLogs = async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/adminLogs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      });
      if (res.ok) setLogs((await res.json()).logs || []);
    } catch { /* ignore */ }
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true); setSearchError(""); setSearchResult(null); setActivateResult("");
    try {
      const token = await getToken();
      const res = await fetch("/api/adminCheckUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: searchEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResult(data);
    } catch (e: unknown) { setSearchError(e instanceof Error ? e.message : "검색 실패"); }
    finally { setSearching(false); }
  };

  const handleActivate = async () => {
    if (!searchResult) return;
    setActivating(true); setActivateResult("");
    try {
      const token = await getToken();
      const res = await fetch("/api/adminActivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: searchResult.email, months }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivateResult(`${data.email} → ${data.months}개월 활성화 완료`);
      handleSearch(); loadLogs(); loadDashboard();
    } catch (e: unknown) { setActivateResult(e instanceof Error ? e.message : "실패"); }
    finally { setActivating(false); }
  };

  const handleDeactivate = async () => {
    if (!searchResult || !confirm(`${searchResult.email} 비활성화?`)) return;
    setDeactivating(true); setActivateResult("");
    try {
      const token = await getToken();
      const res = await fetch("/api/adminDeactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: searchResult.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivateResult(`${data.email} → 비활성화 완료`);
      handleSearch(); loadLogs(); loadDashboard();
    } catch (e: unknown) { setActivateResult(e instanceof Error ? e.message : "실패"); }
    finally { setDeactivating(false); }
  };

  const handleQuickActivate = async (email: string) => {
    const m = prompt(`${email} 활성화 기간 (개월 수)`, "1");
    if (!m) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/adminActivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email, months: parseInt(m) || 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert(`${email} → ${m}개월 활성화 완료`);
      loadUserList(); loadDashboard(); loadLogs();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "실패"); }
  };

  const handleQuickDeactivate = async (email: string) => {
    if (!confirm(`${email} 비활성화?`)) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/adminDeactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert(`${email} → 비활성화 완료`);
      loadUserList(); loadDashboard(); loadLogs();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "실패"); }
  };

  const statusLabel = (s: string) => s === "active" ? "구독중" : s === "free" ? "무료" : s === "cancelled" ? "해지됨" : s === "expired" ? "만료됨" : s;
  const statusColor = (s: string) => s === "active" ? "bg-emerald-100 text-emerald-700" : s === "cancelled" ? "bg-amber-100 text-amber-700" : s === "expired" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">로딩 중...</p></div>;
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-800 mb-4">관리자 로그인</h1>
        <button onClick={() => signInWithPopup(auth, googleProvider)} className="px-6 py-3 bg-[#1B4332] text-white font-bold rounded-xl">Google로 로그인</button>
      </div>
    </div>
  );
  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-xl font-bold text-red-500">접근 권한이 없습니다</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-[#1B4332]">오운잘 관리자</h1>
          <span className="text-xs text-gray-400">{user.email}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
          {([["dashboard","대시보드"],["users","유저 관리"],["analytics","분석"],["history","이력"]] as [Tab,string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${tab === t ? "bg-white text-[#1B4332] shadow-sm" : "text-gray-400"}`}
            >{label}</button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {tab === "dashboard" && (
          <div>
            {dashboard ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                    <p className="text-3xl font-black text-[#1B4332]">{dashboard.totalUsers}</p>
                    <p className="text-xs text-gray-400 mt-1">전체 유저</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-emerald-200 p-4 text-center">
                    <p className="text-3xl font-black text-emerald-600">{dashboard.active}</p>
                    <p className="text-xs text-gray-400 mt-1">구독중</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                    <p className="text-3xl font-black text-gray-500">{dashboard.free}</p>
                    <p className="text-xs text-gray-400 mt-1">무료 유저</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-amber-200 p-4 text-center">
                    <p className="text-3xl font-black text-amber-600">{dashboard.expiringIn3Days}</p>
                    <p className="text-xs text-gray-400 mt-1">3일 내 만료</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <p className="text-xs text-gray-400 mb-1">이번 달 매출</p>
                  <p className="text-2xl font-black text-[#1B4332]">₩{dashboard.monthlyRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>해지됨: {dashboard.cancelled}</span>
                    <span>만료됨: {dashboard.expired}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-400 py-10">로딩 중...</p>
            )}
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            {/* Search */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
              <div className="flex gap-2">
                <input type="email" placeholder="이메일로 검색" value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#059669]" />
                <button onClick={handleSearch} disabled={searching}
                  className="px-4 py-2.5 bg-[#1B4332] text-white text-sm font-bold rounded-xl disabled:opacity-50">
                  {searching ? "..." : "검색"}
                </button>
              </div>
              {searchError && <p className="text-xs text-red-500 mt-2">{searchError}</p>}
            </div>

            {/* Search Result */}
            {searchResult && (
              <div className="bg-white rounded-2xl border-2 border-[#059669] p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-[#1B4332]">{searchResult.email}</p>
                    {searchResult.displayName && <p className="text-xs text-gray-400">{searchResult.displayName}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(searchResult.status)}`}>{statusLabel(searchResult.status)}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1.5 mb-3">
                  {searchResult.expiresAt && <div className="flex justify-between"><span>만료일</span><span className="font-bold">{new Date(searchResult.expiresAt).toLocaleDateString("ko-KR")}</span></div>}
                  {searchResult.billingKey && <div className="flex justify-between"><span>결제</span><span>{searchResult.billingKey}</span></div>}
                </div>
                <div className="flex items-center gap-2">
                  <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value={1}>1개월</option><option value={3}>3개월</option><option value={6}>6개월</option><option value={12}>12개월</option>
                  </select>
                  <button onClick={handleActivate} disabled={activating}
                    className="flex-1 py-2 bg-[#059669] text-white text-sm font-bold rounded-lg disabled:opacity-50">
                    {activating ? "..." : "활성화"}
                  </button>
                  {searchResult.status !== "free" && (
                    <button onClick={handleDeactivate} disabled={deactivating}
                      className="py-2 px-3 bg-red-50 text-red-500 text-sm font-bold rounded-lg disabled:opacity-50">
                      {deactivating ? "..." : "비활성화"}
                    </button>
                  )}
                </div>
                {activateResult && <p className={`text-xs mt-2 ${activateResult.includes("완료") ? "text-emerald-600" : "text-red-500"}`}>{activateResult}</p>}
              </div>
            )}

            {/* Filter */}
            <div className="flex gap-1 mb-3">
              {[["all","전체"],["active","구독중"],["free","무료"],["expired","만료"]].map(([v, l]) => (
                <button key={v} onClick={() => { setUserFilter(v); setUserPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${userFilter === v ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500"}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* User List */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loadingUsers ? (
                <p className="text-center text-gray-400 py-8 text-sm">로딩 중...</p>
              ) : userList.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">유저가 없습니다</p>
              ) : (
                <>
                  {userList.map((u, i) => (
                    <div key={u.uid} className={`px-4 py-3 ${i < userList.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{u.email}</p>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ml-2 ${statusColor(u.status)}`}>{statusLabel(u.status)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          {u.expiresAt ? `만료: ${new Date(u.expiresAt).toLocaleDateString("ko-KR")}` : "구독 없음"}
                          {u.billingKey !== "-" ? ` · ${u.billingKey}` : ""}
                        </p>
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button onClick={() => handleQuickActivate(u.email)}
                            className="px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100">활성화</button>
                          {u.status !== "free" && (
                            <button onClick={() => handleQuickDeactivate(u.email)}
                              className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100">비활성화</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 text-xs text-gray-400">
                    <span>총 {userTotal}명</span>
                    <div className="flex gap-2">
                      <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage <= 1}
                        className="px-2 py-1 rounded bg-white border border-gray-200 disabled:opacity-30">이전</button>
                      <span className="py-1">{userPage} / {userTotalPages}</span>
                      <button onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))} disabled={userPage >= userTotalPages}
                        className="px-2 py-1 rounded bg-white border border-gray-200 disabled:opacity-30">다음</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && (
          <div>
            <a href={GA4_URL} target="_blank" rel="noopener noreferrer"
              className="block bg-white rounded-2xl border border-gray-200 p-5 mb-4 hover:border-[#059669] transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#1B4332]">Google Analytics 4 열기</p>
                  <p className="text-xs text-gray-400 mt-1">실시간 데이터, 퍼널 분석, 유저 행동</p>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="font-bold text-[#1B4332] mb-4">심어둔 퍼널 이벤트</p>
              <p className="text-xs text-gray-400 mb-4">GA4 탐색 → 퍼널 탐색에서 아래 이벤트 순서로 리포트 생성</p>
              <div className="space-y-2">
                {FUNNEL_EVENTS.map((evt, i) => (
                  <div key={evt.name} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-bold text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-sm font-mono text-[#1B4332]">{evt.name}</p>
                      <p className="text-xs text-gray-400">{evt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="font-bold text-[#1B4332] mb-4">관리자 활동 이력</p>
            {logs.length === 0 ? (
              <p className="text-xs text-gray-400">이력이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{log.targetEmail}</p>
                      <p className="text-xs text-gray-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString("ko-KR") : "-"}
                      </p>
                    </div>
                    <span className={`text-xs font-bold ${log.action === "deactivate" ? "text-red-500" : "text-[#059669]"}`}>
                      {log.action === "deactivate" ? "비활성화" : `${log.months}개월 활성화`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
