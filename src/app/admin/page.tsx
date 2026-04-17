"use client";

import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";

// 회의 57 Tier 3: ADMIN_UIDS 하드코딩 제거 — 서버 `/api/adminCheckSelf` 경유로 권한 확인
// 부트스트랩 UID는 여전히 backend helpers.ts에 있어 초기 어드민 보호됨
// 어드민 추가: Firestore `admins/{uid}` 문서 생성만 하면 됨 (재배포 불필요)

// 회의 57 Tier 3: 상태 색상 디자인 토큰 — 한 곳에서 관리
const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  active:    { bg: "bg-emerald-100", text: "text-emerald-700", ring: "border-emerald-200" },
  free:      { bg: "bg-gray-100",    text: "text-gray-600",    ring: "border-gray-200" },
  cancelled: { bg: "bg-amber-100",   text: "text-amber-700",   ring: "border-amber-200" },
  expired:   { bg: "bg-red-100",     text: "text-red-700",     ring: "border-red-200" },
};

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}
type Tab = "dashboard" | "users" | "payments" | "cancel" | "refund" | "history";

interface PaymentRecord {
  paymentId: string;
  uid: string;
  email: string;
  amount: number;
  plan: string;
  status: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

interface UserStats {
  today: number;
  yesterday: number;
  week: number;
  lastWeek?: number;  // 회의 57 Tier 2: 증감률 계산용
  month: number;
  lastMonth?: number; // 회의 57 Tier 2: 증감률 계산용
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
  // 회의 57 Tier 2: 매출 분해 + 증감률
  monthlyPaymentCount?: number;
  avgPayment?: number;
  lastMonthRevenue?: number;
  lastMonthPaymentCount?: number;
  revenueChangePercent?: number | null;
  trial: UserStats;
  registered: UserStats;
  // 결제 건수 행 (체험/가입 테이블 3번째 행)
  paid?: {
    today: number;
    yesterday: number;
    week: number;
    lastWeek: number;
    month: number;
    lastMonth: number;
    total: number;
  };
  // 성장 지표 (CVR / LTV / Churn)
  growth?: {
    cvrTrialToRegistered: number | null;
    cvrRegisteredToPaid: number | null;
    cvrTrialToPaid: number | null;
    ltv: number;
    churnRate: number | null;
    paidUniqueUsers: number;
    totalRevenue: number;
  };
  // 체험/무료 풀 소진 현황
  usage?: {
    guestTrial: {
      total: number;
      exhausted: number;
    };
    freePlan: {
      total: number;
      used0: number;
      used1: number;
      exhausted: number;
    };
  };
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
  planCount?: number;
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
  days?: number;
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
  const [days, setDays] = useState(0); // > 0 이면 days 사용, 아니면 months 사용
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

  // 회의 57 Tier 2: 일반 Confirm 모달 + Activate 모달 + Bulk + Export 상태
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: "default" | "danger";
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [activateModal, setActivateModal] = useState<{ email: string; months: number; days: number } | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // 회의 57 Tier 3: 다중 필드 검색 (email / displayName / uid substring)
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // 매출 상세 (payments 탭) — Firestore payments 서브컬렉션 기반
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsTotalAmount, setPaymentsTotalAmount] = useState(0);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u || u.isAnonymous) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // 회의 57 Tier 3: 서버 경유 어드민 확인 (Firestore admins + 부트스트랩 UID)
      try {
        const token = await u.getIdToken();
        const res = await fetch("/api/adminCheckSelf", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        });
        setIsAdmin(res.ok);
      } catch {
        setIsAdmin(false);
      }
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
  }, [isAdmin, tab, userFilter, userPage, debouncedSearchQuery]);

  useEffect(() => {
    if (isAdmin && tab === "payments") loadPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab]);

  // 회의 57 Tier 3: 검색 debounce (300ms) — 타이핑마다 API 치지 않도록
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(userSearchQuery), 300);
    return () => clearTimeout(t);
  }, [userSearchQuery]);

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
        body: JSON.stringify({
          status: userFilter,
          page: userPage,
          limit: 20,
          q: debouncedSearchQuery || undefined, // 회의 57 Tier 3: 다중 필드 검색
        }),
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

  // 결제 내역 로드 — Firestore payments 서브컬렉션 collectionGroup 기반
  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/adminListPayments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ limit: 100 }),
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setPaymentsTotal(data.total || 0);
        setPaymentsTotalAmount(data.totalAmount || 0);
      }
    } catch { /* ignore */ }
    setLoadingPayments(false);
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
      const body = days > 0 ? { email: searchResult.email, days } : { email: searchResult.email, months };
      const res = await fetch("/api/adminActivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const label = data.days > 0 ? `${data.days}일` : `${data.months}개월`;
      setActivateResult(`${data.email} → ${label} 활성화 완료`);
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

  // 회의 57 Tier 2: prompt/confirm → ActivateModal로 교체
  const handleQuickActivate = (email: string) => {
    setActivateModal({ email, months: 1, days: 0 });
  };

  const executeActivate = async () => {
    if (!activateModal) return;
    const { email, months, days } = activateModal;
    try {
      const token = await getToken();
      const body = days > 0 ? { email, days } : { email, months };
      const res = await fetch("/api/adminActivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setActivateModal(null);
      const label = days > 0 ? `${days}일` : `${months}개월`;
      alert(`${email} → ${label} 활성화 완료`);
      loadUserList(); loadDashboard(); loadLogs();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "실패"); }
  };

  // 회의 57 Tier 2: confirm → ConfirmDialog로 교체
  const handleQuickDeactivate = (email: string) => {
    setConfirmDialog({
      title: "구독 비활성화",
      description: `${email} 유저의 구독을 비활성화합니다. 실제 구독 권한이 즉시 회수됩니다.`,
      confirmLabel: "비활성화",
      variant: "danger",
      onConfirm: async () => {
        try {
          const token = await getToken();
          const res = await fetch("/api/adminDeactivate", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ email }),
          });
          if (!res.ok) throw new Error((await res.json()).error);
          setConfirmDialog(null);
          alert(`${email} → 비활성화 완료`);
          loadUserList(); loadDashboard(); loadLogs();
        } catch (e: unknown) { alert(e instanceof Error ? e.message : "실패"); }
      },
    });
  };

  // 회의 57 Tier 2: CSV Export — 현재 필터의 전체 유저 다운로드
  const exportUsersToCsv = async () => {
    setExportingCsv(true);
    try {
      const token = await getToken();
      // 모든 페이지 fetch (100씩, 최대 50페이지 = 5000명 상한)
      const allUsers: ListUser[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await fetch("/api/adminListUsers", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ status: userFilter, page, limit: 100 }),
        });
        if (!res.ok) break;
        const data = await res.json();
        allUsers.push(...(data.users || []));
        if (data.users?.length < 100) break; // 마지막 페이지
      }

      // CSV 생성
      const headers = ["이메일", "이름", "상태", "만료일", "마지막 결제", "금액", "결제 수단", "UID"];
      const escape = (v: string | number | null | undefined) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = allUsers.map(u => [
        u.email, u.displayName, statusLabel(u.status),
        u.expiresAt ? new Date(u.expiresAt).toLocaleDateString("ko-KR") : "",
        u.lastPaymentAt ? new Date(u.lastPaymentAt).toLocaleDateString("ko-KR") : "",
        u.amount || 0, u.billingKey, u.uid,
      ].map(escape).join(","));
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n"); // BOM for 한글 Excel
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users_${userFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "CSV 다운로드 실패"); }
    setExportingCsv(false);
  };

  // 회의 57 Tier 2: Bulk Action — 선택된 유저에 일괄 반영
  const toggleSelectUser = (uid: string) => {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedUids(prev => {
      const allVisible = userList.every(u => prev.has(u.uid));
      if (allVisible) {
        const next = new Set(prev);
        userList.forEach(u => next.delete(u.uid));
        return next;
      } else {
        const next = new Set(prev);
        userList.forEach(u => next.add(u.uid));
        return next;
      }
    });
  };

  const executeBulkAction = async (action: "activate" | "deactivate", opts: { months?: number; days?: number } = { months: 1 }) => {
    const selectedUsers = userList.filter(u => selectedUids.has(u.uid));
    if (selectedUsers.length === 0) return;

    setBulkRunning(true);
    let successCount = 0;
    const token = await getToken();

    for (const u of selectedUsers) {
      try {
        const endpoint = action === "activate" ? "/api/adminActivate" : "/api/adminDeactivate";
        const body = action === "activate"
          ? (opts.days && opts.days > 0 ? { email: u.email, days: opts.days } : { email: u.email, months: opts.months ?? 1 })
          : { email: u.email };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (res.ok) successCount++;
      } catch { /* skip */ }
    }

    setBulkRunning(false);
    setSelectedUids(new Set());
    setConfirmDialog(null);
    alert(`${successCount}/${selectedUsers.length}명 ${action === "activate" ? "활성화" : "비활성화"} 완료`);
    loadUserList(); loadDashboard(); loadLogs();
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
  // 회의 57 Tier 3: 상태 색상은 STATUS_COLORS 토큰 경유 (free 포함 전 상태 커버)
  const statusColor = (s: string) => {
    const token = STATUS_COLORS[s] || STATUS_COLORS.free;
    return `${token.bg} ${token.text}`;
  };

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
          {([["dashboard","대시보드"],["users","유저"],["payments","결제"],["cancel","취소"],["refund","환불"],["history","이력"]] as [Tab,string][]).map(([t, label]) => (
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
                {/* 회의 57 Tier 2: 매출 카드 분해 + 전월 대비 */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-xs text-gray-400">이번 달 매출</p>
                    {dashboard.revenueChangePercent !== null && dashboard.revenueChangePercent !== undefined && (
                      <span className={`text-xs font-bold ${dashboard.revenueChangePercent >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {dashboard.revenueChangePercent >= 0 ? "▲" : "▼"} {Math.abs(dashboard.revenueChangePercent)}% <span className="text-gray-400 font-medium">전월 대비</span>
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-[#1B4332]">₩{dashboard.monthlyRevenue.toLocaleString()}</p>
                  {/* 분해 정보 */}
                  {(dashboard.monthlyPaymentCount ?? 0) > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                      <span className="text-gray-400">결제 건수</span>
                      <span className="font-bold text-gray-700">{dashboard.monthlyPaymentCount}건</span>
                    </div>
                  )}
                  {(dashboard.avgPayment ?? 0) > 0 && (
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-gray-400">평균 결제액 (ARPU)</span>
                      <span className="font-bold text-gray-700">₩{dashboard.avgPayment!.toLocaleString()}</span>
                    </div>
                  )}
                  {(dashboard.lastMonthRevenue ?? 0) > 0 && (
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-gray-400">전월 매출</span>
                      <span className="text-gray-500">₩{dashboard.lastMonthRevenue!.toLocaleString()} ({dashboard.lastMonthPaymentCount}건)</span>
                    </div>
                  )}
                </div>

                {/* 성장 지표 카드 — 회의: CVR / LTV / Churn */}
                {dashboard.growth && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="font-bold text-[#1B4332]">성장 지표</p>
                      <p className="text-[10px] text-gray-400">누적 기준</p>
                    </div>

                    {/* CVR 퍼널 */}
                    <div className="mb-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">CVR · 전환율</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">체험 → 가입</span>
                          <span className="font-bold text-[#1B4332]">
                            {dashboard.growth.cvrTrialToRegistered !== null ? `${dashboard.growth.cvrTrialToRegistered}%` : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">가입 → 결제</span>
                          <span className="font-bold text-emerald-600">
                            {dashboard.growth.cvrRegisteredToPaid !== null ? `${dashboard.growth.cvrRegisteredToPaid}%` : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">체험 → 결제 (전체 전환)</span>
                          <span className="font-bold text-[#1B4332]">
                            {dashboard.growth.cvrTrialToPaid !== null ? `${dashboard.growth.cvrTrialToPaid}%` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 my-3" />

                    {/* LTV */}
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LTV · 생애가치</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          누적매출 ÷ 유니크 결제유저 ({dashboard.growth.paidUniqueUsers}명)
                        </p>
                      </div>
                      <p className="text-lg font-black text-[#1B4332]">₩{dashboard.growth.ltv.toLocaleString()}</p>
                    </div>

                    <div className="h-px bg-gray-100 my-3" />

                    {/* Churn */}
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Churn · 이탈률</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          (해지 + 만료) ÷ 전체 구독 이력
                        </p>
                      </div>
                      <p className={`text-lg font-black ${
                        dashboard.growth.churnRate === null ? "text-gray-400"
                          : dashboard.growth.churnRate >= 10 ? "text-red-500"
                          : dashboard.growth.churnRate >= 5 ? "text-amber-600"
                          : "text-emerald-600"
                      }`}>
                        {dashboard.growth.churnRate !== null ? `${dashboard.growth.churnRate}%` : "-"}
                      </p>
                    </div>

                    <div className="h-px bg-gray-100 my-3" />

                    {/* 누적 총 매출 */}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Revenue</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">PortOne 실결제 누적 (환불 제외)</p>
                      </div>
                      <p className="text-sm font-bold text-gray-600">₩{dashboard.growth.totalRevenue.toLocaleString()}</p>
                    </div>

                    <p className="text-[9px] text-gray-400 mt-3 leading-relaxed">
                      ⓘ 모든 수치는 현재 시점 누적값입니다. 시계열 추이는 Looker Studio 권장.
                    </p>
                  </div>
                )}

                {/* 무료 풀 소진 현황 카드 — 회의: 체험/무료 lifetime 사용량 분포 */}
                {dashboard.usage && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="font-bold text-[#1B4332]">무료 풀 소진 현황</p>
                      <p className="text-[10px] text-gray-400">누적 lifetime 한도 기준</p>
                    </div>

                    {/* 비로그인 체험 (1회 한도) */}
                    <div className="mb-4">
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">비로그인 체험 · 1회 한도</p>
                        <p className="text-[10px] text-gray-400">총 {dashboard.usage.guestTrial.total} IP</p>
                      </div>
                      {(() => {
                        const total = dashboard.usage.guestTrial.total || 1;
                        const { exhausted } = dashboard.usage.guestTrial;
                        const pct = (n: number) => Math.round((n / total) * 100);
                        return (
                          <div className="mb-1.5">
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              <span className="text-gray-500">1회 소진 (로그인 유도)</span>
                              <span className="font-bold text-gray-700">{exhausted} IP <span className="text-gray-400">({pct(exhausted)}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all bg-red-500" style={{ width: `${pct(exhausted)}%` }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="h-px bg-gray-100 my-3" />

                    {/* 로그인 무료 (2회 한도) */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">로그인 무료 · 2회 한도</p>
                        <p className="text-[10px] text-gray-400">총 {dashboard.usage.freePlan.total}명 (active 제외)</p>
                      </div>
                      {(() => {
                        const total = dashboard.usage.freePlan.total || 1;
                        const { used0, used1, exhausted } = dashboard.usage.freePlan;
                        const pct = (n: number) => Math.round((n / total) * 100);
                        const bar = (n: number, color: string, label: string, clickable?: boolean) => (
                          <div className="mb-1.5">
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              {clickable ? (
                                <button onClick={() => drilldownToUsers("paywall_hit")} className="text-gray-500 hover:text-[#1B4332] underline-offset-2 hover:underline">
                                  {label} →
                                </button>
                              ) : (
                                <span className="text-gray-500">{label}</span>
                              )}
                              <span className="font-bold text-gray-700">{n}명 <span className="text-gray-400">({pct(n)}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct(n)}%` }} />
                            </div>
                          </div>
                        );
                        return (
                          <>
                            {bar(used0, "bg-gray-300", "0회 (미시작)")}
                            {bar(used1, "bg-emerald-300", "1회 사용")}
                            {bar(exhausted, "bg-red-500", "2회 소진 (페이월 hit)", true)}
                          </>
                        );
                      })()}
                    </div>

                    <p className="text-[9px] text-gray-400 mt-3 leading-relaxed">
                      ⓘ 페이월 hit = 무료 한도 소진 + 결제 없음. &quot;페이월 hit&quot; 글자 클릭 → 해당 유저 리스트로 이동
                    </p>
                  </div>
                )}

                {/* User Segment Stats + 회의 57 Tier 2: 증감률 */}
                {dashboard.trial && dashboard.registered && (() => {
                  // 증감률 계산: 지난주/지난달 대비
                  const delta = (current: number, prev: number | undefined): { pct: number | null; up: boolean } => {
                    if (prev === undefined || prev === 0) return { pct: null, up: current > 0 };
                    const pct = Math.round(((current - prev) / prev) * 100);
                    return { pct, up: pct >= 0 };
                  };
                  const trialWeekDelta = delta(dashboard.trial.week, dashboard.trial.lastWeek);
                  const trialMonthDelta = delta(dashboard.trial.month, dashboard.trial.lastMonth);
                  const regWeekDelta = delta(dashboard.registered.week, dashboard.registered.lastWeek);
                  const regMonthDelta = delta(dashboard.registered.month, dashboard.registered.lastMonth);
                  // 결제 행 (회의: payments 서브컬렉션 기반)
                  const paid = dashboard.paid;
                  const paidWeekDelta = paid ? delta(paid.week, paid.lastWeek) : { pct: null, up: false };
                  const paidMonthDelta = paid ? delta(paid.month, paid.lastMonth) : { pct: null, up: false };
                  const renderDelta = (d: { pct: number | null; up: boolean }) => {
                    if (d.pct === null) return null;
                    return (
                      <span className={`block text-[9px] font-bold ${d.up ? "text-emerald-600" : "text-red-500"}`}>
                        {d.up ? "▲" : "▼"}{Math.abs(d.pct)}%
                      </span>
                    );
                  };
                  return (
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
                            <td className="py-2.5 text-center font-bold text-gray-700">
                              {dashboard.trial.week}
                              {renderDelta(trialWeekDelta)}
                            </td>
                            <td className="py-2.5 text-center font-bold text-gray-700">
                              {dashboard.trial.month}
                              {renderDelta(trialMonthDelta)}
                            </td>
                            <td className="py-2.5 text-center font-bold text-gray-400">{dashboard.trial.total}</td>
                          </tr>
                          <tr className="border-t border-gray-50">
                            <td className="py-2.5 text-xs font-bold text-[#2D6A4F]">가입</td>
                            <td className="py-2.5 text-center font-bold text-[#2D6A4F]">{dashboard.registered.today}</td>
                            <td className="py-2.5 text-center font-bold text-[#2D6A4F]/80">{dashboard.registered.yesterday ?? 0}</td>
                            <td className="py-2.5 text-center font-bold text-[#2D6A4F]">
                              {dashboard.registered.week}
                              {renderDelta(regWeekDelta)}
                            </td>
                            <td className="py-2.5 text-center font-bold text-[#2D6A4F]">
                              {dashboard.registered.month}
                              {renderDelta(regMonthDelta)}
                            </td>
                            <td className="py-2.5 text-center font-bold text-gray-400">{dashboard.registered.total}</td>
                          </tr>
                          {/* 결제 행 (회의: payments 서브컬렉션 기반) */}
                          {paid && (
                            <tr className="border-t border-gray-50">
                              <td className="py-2.5 text-xs font-bold text-[#059669]">결제</td>
                              <td className="py-2.5 text-center font-bold text-[#059669]">{paid.today}</td>
                              <td className="py-2.5 text-center font-bold text-[#059669]/80">{paid.yesterday}</td>
                              <td className="py-2.5 text-center font-bold text-[#059669]">
                                {paid.week}
                                {renderDelta(paidWeekDelta)}
                              </td>
                              <td className="py-2.5 text-center font-bold text-[#059669]">
                                {paid.month}
                                {renderDelta(paidMonthDelta)}
                              </td>
                              <td className="py-2.5 text-center font-bold text-gray-400">{paid.total}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <p className="text-[9px] text-gray-400 mt-2 leading-relaxed">▲▼ 지난 주/지난 달 대비 증감률</p>
                    </div>
                  );
                })()}

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
            {/* 회의 57 Tier 3: 다중 필드 검색 (리스트 필터링) + 기존 이메일 상세 검색 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-3">
              {/* 리스트 실시간 필터 */}
              <div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="이메일·이름·UID로 리스트 필터"
                    value={userSearchQuery}
                    onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(1); }}
                    className="flex-1 px-1 py-2 text-sm border-0 focus:outline-none bg-transparent"
                  />
                  {userSearchQuery && (
                    <button onClick={() => setUserSearchQuery("")} className="text-gray-400 hover:text-gray-600 text-xs shrink-0 px-2">✕</button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">부분 문자열 매칭 · 300ms debounce</p>
              </div>

              <div className="h-px bg-gray-100" />

              {/* 기존 이메일 완전일치 상세 조회 */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">상세 조회</p>
                <div className="flex gap-2">
                  <input type="email" placeholder="이메일 정확히 입력" value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#059669]" />
                  <button onClick={handleSearch} disabled={searching}
                    className="px-4 py-2.5 bg-[#1B4332] text-white text-sm font-bold rounded-xl disabled:opacity-50">
                    {searching ? "..." : "조회"}
                  </button>
                </div>
                {searchError && <p className="text-xs text-red-500 mt-2">{searchError}</p>}
              </div>
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
                  <select
                    value={days > 0 ? `d${days}` : `m${months}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith("d")) { setDays(Number(v.slice(1))); setMonths(0); }
                      else { setMonths(Number(v.slice(1))); setDays(0); }
                    }}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="d7">1주</option>
                    <option value="m1">1개월</option>
                    <option value="m3">3개월</option>
                    <option value="m6">6개월</option>
                    <option value="m12">12개월</option>
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

            {/* Filter + CSV Export — 회의 57 Tier 2 */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex gap-1 flex-wrap">
                {[["all","전체"],["active","구독중"],["free","무료"],["expired","만료"],["expiring_soon","만료 임박"],["paywall_hit","페이월 hit"]].map(([v, l]) => (
                  <button key={v} onClick={() => { setUserFilter(v); setUserPage(1); setSelectedUids(new Set()); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${userFilter === v ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button
                onClick={exportUsersToCsv}
                disabled={exportingCsv}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 shrink-0"
                title="현재 필터 기준 전체 유저 CSV 다운로드"
              >
                {exportingCsv ? "..." : "⬇ CSV"}
              </button>
            </div>

            {/* User List */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loadingUsers ? (
                <p className="text-center text-gray-400 py-8 text-sm">로딩 중...</p>
              ) : userList.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">유저가 없습니다</p>
              ) : (
                <>
                  {/* 전체 선택 헤더 — 회의 57 Tier 2 Bulk Action */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={userList.length > 0 && userList.every(u => selectedUids.has(u.uid))}
                      onChange={toggleSelectAllVisible}
                      className="w-4 h-4 accent-[#1B4332] cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-gray-500">
                      {selectedUids.size > 0 ? `${selectedUids.size}명 선택됨` : "현재 페이지 전체 선택"}
                    </span>
                  </div>
                  {userList.map((u, i) => {
                    const isSelected = selectedUids.has(u.uid);
                    return (
                    <div key={u.uid} className={`px-4 py-3 ${i < userList.length - 1 ? "border-b border-gray-50" : ""} ${isSelected ? "bg-emerald-50/40" : ""}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.uid)}
                          className="w-4 h-4 accent-[#1B4332] cursor-pointer mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{u.email}</p>
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ml-2 ${statusColor(u.status)}`}>{statusLabel(u.status)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                              {u.expiresAt ? `만료: ${new Date(u.expiresAt).toLocaleDateString("ko-KR")}` : "구독 없음"}
                              {u.billingKey !== "-" ? ` · ${u.billingKey}` : ""}
                              {u.status !== "active" && typeof u.planCount === "number" && (
                                <span className={`ml-2 font-bold ${u.planCount >= 4 ? "text-red-500" : u.planCount >= 3 ? "text-amber-600" : "text-gray-400"}`}>
                                  · 무료 {u.planCount}/4
                                </span>
                              )}
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
                      </div>
                    </div>
                    );
                  })}
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

        {/* Payments Tab — 결제 내역 (Firestore payments 서브컬렉션 기반) */}
        {tab === "payments" && (
          <div>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">최근 100건 합계</p>
                <p className="text-xl font-black text-[#1B4332]">₩{paymentsTotalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">건수</p>
                <p className="text-xl font-black text-[#1B4332]">{paymentsTotal}건</p>
              </div>
            </div>

            {/* 주의사항 배너 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                ⚠ 이 목록은 Firestore 기반입니다. PortOne에서 직접 취소한 건은 여기 반영되지 않을 수 있어요. 정확한 매출 정합성이 필요하면 PortOne 대시보드를 참조하세요.
              </p>
            </div>

            {/* 결제 리스트 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loadingPayments ? (
                <p className="text-center text-gray-400 py-10 text-sm">로딩 중...</p>
              ) : payments.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">결제 내역이 없습니다</p>
              ) : (
                <div>
                  {payments.map((p, i) => (
                    <div key={p.paymentId || i} className={`px-4 py-3 ${i < payments.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{p.email}</p>
                        <span className="text-sm font-black text-[#1B4332] shrink-0 ml-2">₩{p.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 gap-2">
                        <span className="shrink-0">
                          {p.paidAt ? new Date(p.paidAt).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </span>
                        <span className="font-mono text-[9px] text-gray-300 truncate">{p.paymentId}</span>
                      </div>
                      {p.periodStart && p.periodEnd && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {p.plan || "구독"} · {new Date(p.periodStart).toLocaleDateString("ko-KR")} ~ {new Date(p.periodEnd).toLocaleDateString("ko-KR")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancel Feedbacks Tab — 회의 57 Tier 3: 해지 사유 집계 차트 추가 */}
        {tab === "cancel" && (() => {
          // 키워드 기반 그룹핑 — 자유형 사유를 주요 카테고리로 매핑
          const KEYWORD_GROUPS: { label: string; keywords: string[] }[] = [
            { label: "가격/비용", keywords: ["비싸", "가격", "비용", "돈", "비싼", "금액", "expensive", "price", "cost"] },
            { label: "기능 부족", keywords: ["기능", "부족", "미완성", "필요", "없어", "없음", "지원", "feature", "missing"] },
            { label: "사용성/UX", keywords: ["어려", "복잡", "불편", "헷갈", "UI", "UX", "사용성", "difficult", "hard"] },
            { label: "결과 불만족", keywords: ["효과", "결과", "변화", "만족", "별로", "실망", "무의미", "result"] },
            { label: "서비스/버그", keywords: ["버그", "오류", "에러", "느려", "느림", "먹통", "안됨", "bug", "error", "slow"] },
            { label: "자주 안 씀", keywords: ["안 씀", "안쓰", "잘 안", "많이", "사용 안", "쓸 일", "잊", "바쁨"] },
            { label: "다른 앱/대체", keywords: ["다른 앱", "대체", "경쟁", "other", "alternative"] },
            { label: "개인 사정", keywords: ["잠시", "일시", "시간", "개인", "쉴", "잠깐", "personal"] },
          ];
          const classifyReason = (reason: string): string => {
            const lower = reason.toLowerCase();
            for (const g of KEYWORD_GROUPS) {
              if (g.keywords.some(k => lower.includes(k.toLowerCase()))) return g.label;
            }
            return "기타";
          };
          // 최근 30일 vs 전체
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const recentFeedbacks = cancelFeedbacks.filter(fb => fb.date && new Date(fb.date).getTime() >= thirtyDaysAgo);

          const groupCounts: Record<string, number> = {};
          recentFeedbacks.forEach(fb => {
            const group = classifyReason(fb.reason || "");
            groupCounts[group] = (groupCounts[group] || 0) + 1;
          });
          const sortedGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
          const maxCount = sortedGroups[0]?.[1] || 1;
          const totalRecent = recentFeedbacks.length;

          return (
            <div>
              {loadingFeedback ? (
                <p className="text-center text-gray-400 py-10 text-sm">로딩 중...</p>
              ) : (
                <>
                  {/* 집계 차트 */}
                  {totalRecent > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
                      <div className="flex items-baseline justify-between mb-4">
                        <p className="font-bold text-[#1B4332]">최근 30일 해지 사유</p>
                        <p className="text-xs text-gray-400">총 {totalRecent}건</p>
                      </div>
                      <div className="space-y-2.5">
                        {sortedGroups.map(([label, count]) => {
                          const pct = totalRecent > 0 ? Math.round((count / totalRecent) * 100) : 0;
                          const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          return (
                            <div key={label}>
                              <div className="flex items-center justify-between mb-1 text-xs">
                                <span className="font-bold text-gray-700">{label}</span>
                                <span className="text-gray-500">{count}건 <span className="text-gray-400">({pct}%)</span></span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#2D6A4F] rounded-full transition-all"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                        키워드 매칭 기반 자동 분류 · 매칭 실패 시 &apos;기타&apos;로 분류
                      </p>
                    </div>
                  )}

                  {/* 원본 리스트 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="font-bold text-[#1B4332] mb-4">전체 피드백 ({cancelFeedbacks.length}건)</p>
                    {cancelFeedbacks.length === 0 ? (
                      <p className="text-xs text-gray-400">피드백이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {cancelFeedbacks.map((fb, i) => {
                          const group = classifyReason(fb.reason || "");
                          return (
                          <div key={i} className="py-2.5 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-800 truncate">{fb.email}</p>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1B4332]/10 text-[#1B4332]">{group}</span>
                                <span className="text-[10px] text-gray-400">
                                  {fb.date ? new Date(fb.date).toLocaleDateString("ko-KR") : "-"}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">{fb.reason}</p>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

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
                      {log.action === "deactivate"
                        ? "비활성화"
                        : (log.days && log.days > 0)
                          ? `${log.days}일 활성화`
                          : `${log.months}개월 활성화`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 회의 57 Tier 2: Bulk Action 플로팅 바 */}
      {selectedUids.size > 0 && tab === "users" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#1B4332] text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 max-w-[calc(100%-32px)]">
          <span className="text-sm font-bold whitespace-nowrap">{selectedUids.size}명 선택됨</span>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={() => {
              setConfirmDialog({
                title: "일괄 활성화",
                description: `선택된 ${selectedUids.size}명을 ${1}개월 활성화합니다.`,
                confirmLabel: `${selectedUids.size}명 활성화`,
                variant: "default",
                onConfirm: () => executeBulkAction("activate", { months: 1 }),
              });
            }}
            disabled={bulkRunning}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-500 rounded-lg hover:bg-emerald-400 disabled:opacity-50"
          >
            활성화
          </button>
          <button
            onClick={() => {
              setConfirmDialog({
                title: "일괄 비활성화",
                description: `선택된 ${selectedUids.size}명의 구독을 즉시 비활성화합니다.`,
                confirmLabel: `${selectedUids.size}명 비활성화`,
                variant: "danger",
                onConfirm: () => executeBulkAction("deactivate"),
              });
            }}
            disabled={bulkRunning}
            className="px-3 py-1.5 text-xs font-bold bg-red-500 rounded-lg hover:bg-red-400 disabled:opacity-50"
          >
            비활성화
          </button>
          <button
            onClick={() => setSelectedUids(new Set())}
            className="px-2 py-1.5 text-xs font-bold text-white/60 hover:text-white"
          >
            취소
          </button>
        </div>
      )}

      {/* 회의 57 Tier 2: ActivateModal — Quick Activate prompt 교체 */}
      {activateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActivateModal(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-[#1B4332] mb-2">구독 활성화</h3>
            <p className="text-sm text-gray-500 mb-4 break-all">{activateModal.email}</p>
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 mb-2">활성화 기간</p>
              <div className="grid grid-cols-5 gap-2">
                <button
                  onClick={() => setActivateModal({ ...activateModal, months: 0, days: 7 })}
                  className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                    activateModal.days === 7
                      ? "bg-[#1B4332] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  1주
                </button>
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    onClick={() => setActivateModal({ ...activateModal, months: m, days: 0 })}
                    className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                      activateModal.days === 0 && activateModal.months === m
                        ? "bg-[#1B4332] text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {m}개월
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActivateModal(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={executeActivate}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700"
              >
                활성화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회의 57 Tier 2: ConfirmDialog — 일반 확인 모달 (confirm() 교체) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-[#1B4332] mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{confirmDialog.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => confirmDialog.onConfirm()}
                disabled={bulkRunning}
                className={`flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 ${
                  confirmDialog.variant === "danger"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {bulkRunning ? "처리 중..." : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

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
