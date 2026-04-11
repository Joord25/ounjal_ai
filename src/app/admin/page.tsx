"use client";

import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";

const ADMIN_UIDS = ["jDkXqeAFCMgJj8cFbRZITpokS2H2"];

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}
type Tab = "dashboard" | "users" | "cancel" | "refund" | "history";

interface UserStats {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  total: number;
}

interface DashboardData {
  totalUsers: number;
  active: number;
  free: number;
  cancelled: number;
  expired: number;
  expiringIn3Days: number;
  monthlyRevenue: number;
  trial: UserStats;
  registered: UserStats;
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

interface CancelFeedback {
  email: string;
  reason: string;
  date: string;
}

interface RefundRequest {
  id: string;
  email: string;
  reason: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  date: string;
  planCountAtPayment: number;
  currentPlanCount: number;
  planUsed: boolean;
}


export default function AdminPage() {
  useBodyScroll();
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

  // Feedback
  const [cancelFeedbacks, setCancelFeedbacks] = useState<CancelFeedback[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // 회의 57 Tier 1: 환불 확장 컨텍스트 (유저 정보) + 2단계 확인 모달
  const [expandedRefund, setExpandedRefund] = useState<string | null>(null);
  const [refundUserContext, setRefundUserContext] = useState<Record<string, UserInfo>>({});
  const [loadingRefundContext, setLoadingRefundContext] = useState<string | null>(null);
  const [confirmRefund, setConfirmRefund] = useState<{ id: string; action: "approve" | "reject"; email: string; amount: number } | null>(null);

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
  // 회의 57 Tier 1: "오늘 할 일" 섹션 때문에 refund/cancel도 최초 로드
  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
      loadLogs();
      loadFeedback(); // 환불/해지 피드백도 대시보드에 요약으로 필요
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

  const loadFeedback = async () => {
    setLoadingFeedback(true);
    try {
      const token = await getToken();
      const [cancelRes, refundRes] = await Promise.all([
        fetch("/api/adminCancelFeedbacks", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        }),
        fetch("/api/adminRefundRequests", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        }),
      ]);
      if (cancelRes.ok) {
        const data = await cancelRes.json();
        setCancelFeedbacks(data.feedbacks || []);
      }
      if (refundRes.ok) {
        const data = await refundRes.json();
        setRefundRequests(data.requests || []);
      }
    } catch { /* ignore */ }
    setLoadingFeedback(false);
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

  // 회의 57 Tier 1: 2단계 확인 모달 경유 (confirmRefund state로 중간 단계 거침)
  const handleRefundAction = (requestId: string, action: "approve" | "reject") => {
    const req = refundRequests.find(r => r.id === requestId);
    if (!req) return;
    setConfirmRefund({ id: requestId, action, email: req.email, amount: req.amount });
  };

  // 모달에서 "정말 실행" 눌렀을 때
  const executeRefundAction = async () => {
    if (!confirmRefund) return;
    const { id, action } = confirmRefund;
    const actionLabel = action === "approve" ? "승인" : "거부";
    try {
      const token = await getToken();
      const res = await fetch("/api/adminProcessRefund", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ requestId: id, action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setConfirmRefund(null);
      alert(`환불 요청 ${actionLabel} 완료`);
      loadFeedback();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "처리 실패"); }
  };

  // 회의 57 Tier 1: 환불 카드 확장 — 유저 컨텍스트 on-demand 로드
  const toggleRefundExpand = async (requestId: string, email: string) => {
    if (expandedRefund === requestId) {
      setExpandedRefund(null);
      return;
    }
    setExpandedRefund(requestId);
    if (refundUserContext[requestId]) return; // 이미 로드됨
    setLoadingRefundContext(requestId);
    try {
      const token = await getToken();
      const res = await fetch("/api/adminCheckUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        setRefundUserContext(prev => ({ ...prev, [requestId]: data }));
      }
    } catch { /* ignore */ }
    setLoadingRefundContext(null);
  };

  // 회의 57 Tier 1: 카드 drill-down — 유저 탭으로 이동 + 필터 자동 적용
  const drilldownToUsers = (filter: string) => {
    setUserFilter(filter);
    setUserPage(1);
    setTab("users");
  };

  // 회의 57 Tier 1: "오늘 할 일" 집계
  const todayActions = (() => {
    const pendingRefunds = refundRequests.filter(r => r.status === "pending").length;
    const expiringSoon = dashboard?.expiringIn3Days ?? 0;
    // 최근 7일 내 해지 피드백
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newCancels = cancelFeedbacks.filter(fb => fb.date && new Date(fb.date).getTime() >= cutoff).length;
    return { pendingRefunds, expiringSoon, newCancels };
  })();

  const statusLabel = (s: string) => s === "active" ? "구독중" : s === "free" ? "무료" : s === "cancelled" ? "해지됨" : s === "expired" ? "만료됨" : s;
  const statusColor = (s: string) => s === "active" ? "bg-emerald-100 text-emerald-700" : s === "cancelled" ? "bg-amber-100 text-amber-700" : s === "expired" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">로딩 중...</p></div>;
  if (!user || user.isAnonymous) return (
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
          {([["dashboard","대시보드"],["users","유저"],["cancel","취소"],["refund","환불"],["history","이력"]] as [Tab,string][]).map(([t, label]) => (
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
                {/* 회의 57 Tier 1: "오늘 할 일" 섹션 — 박충환 교수 제안 + Inbox Zero 원칙 (항상 표시) */}
                <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] rounded-2xl p-5 mb-4 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300/70 mb-3">📌 오늘 처리할 일</p>
                  {(todayActions.pendingRefunds === 0 && todayActions.expiringSoon === 0 && todayActions.newCancels === 0) ? (
                    // Empty state — 축하 메시지 (Inbox Zero)
                    <div className="text-center py-4">
                      <p className="text-2xl mb-1">🎉</p>
                      <p className="text-sm font-bold text-white">모두 처리됐어요!</p>
                      <p className="text-[11px] text-emerald-300/60 mt-1">여유로운 하루 되세요</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayActions.pendingRefunds > 0 && (
                        <button
                          onClick={() => setTab("refund")}
                          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-xl px-4 py-3 transition-colors"
                        >
                          <span className="text-sm font-bold">환불 요청 대기</span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-black text-amber-300">{todayActions.pendingRefunds}건</span>
                            <span className="text-xs text-emerald-300/60">→</span>
                          </span>
                        </button>
                      )}
                      {todayActions.expiringSoon > 0 && (
                        <button
                          onClick={() => drilldownToUsers("expiring_soon")}
                          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-xl px-4 py-3 transition-colors"
                        >
                          <span className="text-sm font-bold">3일 내 만료</span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-black text-amber-300">{todayActions.expiringSoon}명</span>
                            <span className="text-xs text-emerald-300/60">→</span>
                          </span>
                        </button>
                      )}
                      {todayActions.newCancels > 0 && (
                        <button
                          onClick={() => setTab("cancel")}
                          className="w-full flex items-center justify-between bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-xl px-4 py-3 transition-colors"
                        >
                          <span className="text-sm font-bold">최근 7일 해지 피드백</span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-black text-amber-300">{todayActions.newCancels}건</span>
                            <span className="text-xs text-emerald-300/60">→</span>
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 회의 57 Tier 1: 숫자 카드 → drill-down 가능 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => drilldownToUsers("all")} className="bg-white rounded-2xl border border-gray-200 hover:border-[#1B4332] active:scale-[0.98] p-4 text-center transition-all">
                    <p className="text-3xl font-black text-[#1B4332]">{dashboard.totalUsers}</p>
                    <p className="text-xs text-gray-400 mt-1">전체 유저 <span className="text-[9px]">→</span></p>
                  </button>
                  <button onClick={() => drilldownToUsers("active")} className="bg-white rounded-2xl border border-emerald-200 hover:border-emerald-400 active:scale-[0.98] p-4 text-center transition-all">
                    <p className="text-3xl font-black text-emerald-600">{dashboard.active}</p>
                    <p className="text-xs text-gray-400 mt-1">구독중 <span className="text-[9px]">→</span></p>
                  </button>
                  <button onClick={() => drilldownToUsers("free")} className="bg-white rounded-2xl border border-gray-200 hover:border-[#1B4332] active:scale-[0.98] p-4 text-center transition-all">
                    <p className="text-3xl font-black text-gray-500">{dashboard.free}</p>
                    <p className="text-xs text-gray-400 mt-1">무료 유저 <span className="text-[9px]">→</span></p>
                  </button>
                  <button onClick={() => drilldownToUsers("expiring_soon")} className="bg-white rounded-2xl border border-amber-200 hover:border-amber-400 active:scale-[0.98] p-4 text-center transition-all">
                    <p className="text-3xl font-black text-amber-600">{dashboard.expiringIn3Days}</p>
                    <p className="text-xs text-gray-400 mt-1">3일 내 만료 <span className="text-[9px]">→</span></p>
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <p className="text-xs text-gray-400 mb-1">이번 달 매출</p>
                  <p className="text-2xl font-black text-[#1B4332]">₩{dashboard.monthlyRevenue.toLocaleString()}</p>
                </div>

                {/* User Segment Stats */}
                {dashboard.trial && dashboard.registered && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400">
                          <th className="text-left pb-3 font-medium"></th>
                          <th className="text-center pb-3 font-medium">오늘</th>
                          <th className="text-center pb-3 font-medium">어제</th>
                          <th className="text-center pb-3 font-medium">이번 주</th>
                          <th className="text-center pb-3 font-medium">이번 달</th>
                          <th className="text-center pb-3 font-medium">전체</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-50">
                          <td className="py-2.5 text-xs font-bold text-gray-500">체험</td>
                          <td className="py-2.5 text-center font-bold text-gray-700">{dashboard.trial.today}</td>
                          <td className="py-2.5 text-center font-bold text-gray-600">{dashboard.trial.yesterday ?? 0}</td>
                          <td className="py-2.5 text-center font-bold text-gray-700">{dashboard.trial.week}</td>
                          <td className="py-2.5 text-center font-bold text-gray-700">{dashboard.trial.month}</td>
                          <td className="py-2.5 text-center font-bold text-gray-400">{dashboard.trial.total}</td>
                        </tr>
                        <tr className="border-t border-gray-50">
                          <td className="py-2.5 text-xs font-bold text-[#2D6A4F]">가입</td>
                          <td className="py-2.5 text-center font-bold text-[#2D6A4F]">{dashboard.registered.today}</td>
                          <td className="py-2.5 text-center font-bold text-[#2D6A4F]/80">{dashboard.registered.yesterday ?? 0}</td>
                          <td className="py-2.5 text-center font-bold text-[#2D6A4F]">{dashboard.registered.week}</td>
                          <td className="py-2.5 text-center font-bold text-[#2D6A4F]">{dashboard.registered.month}</td>
                          <td className="py-2.5 text-center font-bold text-gray-400">{dashboard.registered.total}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

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

        {/* Feedback Tab */}
        {/* Cancel Feedbacks Tab */}
        {tab === "cancel" && (
          <div>
            {loadingFeedback ? (
              <p className="text-center text-gray-400 py-10 text-sm">로딩 중...</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="font-bold text-[#1B4332] mb-4">구독 취소 피드백</p>
                {cancelFeedbacks.length === 0 ? (
                  <p className="text-xs text-gray-400">피드백이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {cancelFeedbacks.map((fb, i) => (
                      <div key={i} className="py-2.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{fb.email}</p>
                          <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                            {fb.date ? new Date(fb.date).toLocaleDateString("ko-KR") : "-"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{fb.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Refund Requests Tab */}
        {tab === "refund" && (
          <div>
            {loadingFeedback ? (
              <p className="text-center text-gray-400 py-10 text-sm">로딩 중...</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="font-bold text-[#1B4332] mb-4">환불 요청</p>
                  {refundRequests.length === 0 ? (
                    <p className="text-xs text-gray-400">환불 요청이 없습니다</p>
                  ) : (
                    <div className="space-y-2">
                      {refundRequests.map((req, i) => {
                        const isExpanded = expandedRefund === req.id;
                        const userCtx = refundUserContext[req.id];
                        const isLoadingCtx = loadingRefundContext === req.id;
                        return (
                        <div key={req.id || i} className="py-2.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{req.email}</p>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                req.status === "pending" ? "bg-amber-100 text-amber-700" :
                                req.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                                "bg-red-100 text-red-600"
                              }`}>
                                {req.status === "pending" ? "대기" : req.status === "approved" ? "승인" : "거절"}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {req.date ? new Date(req.date).toLocaleDateString("ko-KR") : "-"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-gray-500">{req.reason}</p>
                            <span className="text-xs font-medium text-gray-600 shrink-0 ml-2">
                              {req.amount ? `₩${req.amount.toLocaleString()}` : "-"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">
                                플랜 생성: 결제 시 {req.planCountAtPayment ?? "-"}회 → 현재 {req.currentPlanCount ?? "-"}회
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                req.planUsed ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {req.planUsed ? "사용함" : "미사용"}
                              </span>
                            </div>
                            <div className="flex gap-1.5 shrink-0 ml-2">
                              <button
                                onClick={() => toggleRefundExpand(req.id, req.email)}
                                className="px-2 py-1 text-[10px] font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                              >
                                {isExpanded ? "닫기" : "상세"}
                              </button>
                              {req.status === "pending" && (
                                <>
                                  <button onClick={() => handleRefundAction(req.id, "approve")}
                                    className="px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100">승인</button>
                                  <button onClick={() => handleRefundAction(req.id, "reject")}
                                    className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100">거부</button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 회의 57 Tier 1: 유저 컨텍스트 패널 */}
                          {isExpanded && (
                            <div className="mt-2.5 bg-gray-50 rounded-xl p-3 text-[11px] text-gray-600 space-y-1.5">
                              {isLoadingCtx ? (
                                <p className="text-gray-400">유저 정보 불러오는 중...</p>
                              ) : userCtx ? (
                                <>
                                  {userCtx.displayName && (
                                    <div className="flex justify-between"><span className="text-gray-400">이름</span><span className="font-bold">{userCtx.displayName}</span></div>
                                  )}
                                  <div className="flex justify-between"><span className="text-gray-400">상태</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColor(userCtx.status)}`}>{statusLabel(userCtx.status)}</span>
                                  </div>
                                  {userCtx.plan && (
                                    <div className="flex justify-between"><span className="text-gray-400">플랜</span><span className="font-bold">{userCtx.plan}</span></div>
                                  )}
                                  {userCtx.expiresAt && (
                                    <div className="flex justify-between"><span className="text-gray-400">만료일</span><span className="font-bold">{new Date(userCtx.expiresAt).toLocaleDateString("ko-KR")}</span></div>
                                  )}
                                  {userCtx.lastPaymentAt && (
                                    <div className="flex justify-between"><span className="text-gray-400">마지막 결제</span><span className="font-bold">{new Date(userCtx.lastPaymentAt).toLocaleDateString("ko-KR")}</span></div>
                                  )}
                                  {userCtx.amount !== null && userCtx.amount !== undefined && userCtx.amount > 0 && (
                                    <div className="flex justify-between"><span className="text-gray-400">결제 금액</span><span className="font-bold">₩{userCtx.amount.toLocaleString()}</span></div>
                                  )}
                                  <div className="flex justify-between"><span className="text-gray-400">결제 수단</span><span className="font-bold">{userCtx.billingKey || "-"}</span></div>
                                </>
                              ) : (
                                <p className="text-gray-400">유저 정보를 불러올 수 없습니다</p>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            )}
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

      {/* 회의 57 Tier 1: 환불 승인/거부 2단계 확인 모달 */}
      {confirmRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmRefund(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-[#1B4332] mb-2">
              환불 요청 {confirmRefund.action === "approve" ? "승인" : "거부"}
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-400">유저</span>
                <span className="font-bold text-gray-800">{confirmRefund.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">금액</span>
                <span className="font-black text-[#1B4332] text-base">
                  {confirmRefund.amount ? `₩${confirmRefund.amount.toLocaleString()}` : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">처리</span>
                <span className={`font-bold ${confirmRefund.action === "approve" ? "text-emerald-600" : "text-red-500"}`}>
                  {confirmRefund.action === "approve" ? "✓ 승인 (실제 환불 실행)" : "✕ 거부"}
                </span>
              </div>
            </div>
            <p className="text-xs text-red-500 mb-4 leading-relaxed">
              ⚠ {confirmRefund.action === "approve"
                ? "승인 시 포트원 API를 통해 실제 환불이 실행되며 되돌릴 수 없습니다."
                : "거부 시 요청자는 환불 불가 안내를 받습니다."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRefund(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={executeRefundAction}
                className={`flex-1 py-3 rounded-xl text-white font-bold text-sm ${
                  confirmRefund.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {confirmRefund.action === "approve" ? "정말 승인" : "정말 거부"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
