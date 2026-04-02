"use client";

import React, { useState, useEffect } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";

const ADMIN_UIDS = ["jDkXqeAFCMgJj8cFbRZITpokS2H2"];

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

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<UserInfo | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  // Activate
  const [months, setMonths] = useState(1);
  const [activating, setActivating] = useState(false);
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

  useEffect(() => {
    if (isAdmin) loadLogs();
  }, [isAdmin]);

  const getToken = async () => {
    const token = await user?.getIdToken();
    return token || "";
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    setActivateResult("");
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
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : "검색 실패");
    } finally {
      setSearching(false);
    }
  };

  const handleActivate = async () => {
    if (!searchResult) return;
    setActivating(true);
    setActivateResult("");
    try {
      const token = await getToken();
      const res = await fetch("/api/adminActivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: searchResult.email, months }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivateResult(`${data.email} → ${data.months}개월 활성화 완료 (만료: ${new Date(data.expiresAt).toLocaleDateString("ko-KR")})`);
      // Refresh search result
      handleSearch();
      loadLogs();
    } catch (e: unknown) {
      setActivateResult(e instanceof Error ? e.message : "활성화 실패");
    } finally {
      setActivating(false);
    }
  };

  const loadLogs = async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/adminLogs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch { /* ignore */ }
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-emerald-100 text-emerald-700";
    if (s === "cancelled") return "bg-amber-100 text-amber-700";
    if (s === "expired") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };

  // Loading
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">로딩 중...</p></div>;

  // Not logged in
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-800 mb-4">관리자 로그인</h1>
        <button
          onClick={() => signInWithPopup(auth, googleProvider)}
          className="px-6 py-3 bg-[#1B4332] text-white font-bold rounded-xl hover:bg-[#143728] transition-colors"
        >
          Google로 로그인
        </button>
      </div>
    </div>
  );

  // Not admin
  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-xl font-bold text-red-500 mb-2">접근 권한이 없습니다</p>
        <p className="text-sm text-gray-400">{user.email}</p>
      </div>
    </div>
  );

  // Admin UI
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-black text-[#1B4332]">오운잘 관리자</h1>
          <span className="text-xs text-gray-400">{user.email}</span>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-3">유저 검색</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="이메일 입력"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#059669]"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-3 bg-[#1B4332] text-white text-sm font-bold rounded-xl hover:bg-[#143728] transition-colors disabled:opacity-50"
            >
              {searching ? "..." : "검색"}
            </button>
          </div>
          {searchError && <p className="text-sm text-red-500 mt-2">{searchError}</p>}
        </div>

        {/* User Info */}
        {searchResult && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-[#1B4332] text-lg">{searchResult.email}</p>
                {searchResult.displayName && (
                  <p className="text-xs text-gray-400 mt-0.5">이름: {searchResult.displayName}</p>
                )}
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusColor(searchResult.status)}`}>
                {searchResult.status === "active" ? "구독중" : searchResult.status === "free" ? "무료" : searchResult.status === "cancelled" ? "해지됨" : searchResult.status === "expired" ? "만료됨" : searchResult.status}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">UID</span><span className="font-mono text-xs">{searchResult.uid}</span></div>
              {searchResult.expiresAt && <div className="flex justify-between"><span className="text-gray-400">만료일</span><span className="font-bold">{new Date(searchResult.expiresAt).toLocaleDateString("ko-KR")}</span></div>}
              {searchResult.lastPaymentAt && <div className="flex justify-between"><span className="text-gray-400">마지막 결제</span><span>{new Date(searchResult.lastPaymentAt).toLocaleDateString("ko-KR")}</span></div>}
              {searchResult.billingKey && <div className="flex justify-between"><span className="text-gray-400">결제 방식</span><span>{searchResult.billingKey}</span></div>}
              {searchResult.amount !== null && <div className="flex justify-between"><span className="text-gray-400">금액</span><span>{searchResult.amount === 0 ? "수동 (무료)" : `₩${searchResult.amount?.toLocaleString()}`}</span></div>}
            </div>

            {/* Activate */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                >
                  <option value={1}>1개월</option>
                  <option value={3}>3개월</option>
                  <option value={6}>6개월</option>
                  <option value={12}>12개월</option>
                </select>
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="flex-1 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors disabled:opacity-50"
                >
                  {activating ? "처리 중..." : "구독 활성화"}
                </button>
              </div>
              {activateResult && (
                <p className={`text-xs mt-2 ${activateResult.includes("완료") ? "text-emerald-600" : "text-red-500"}`}>
                  {activateResult}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-3">최근 활성화 이력</p>
          {logs.length === 0 ? (
            <p className="text-xs text-gray-400">이력이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{log.targetEmail}</p>
                    <p className="text-xs text-gray-400">
                      {log.timestamp ? new Date(log.timestamp).toLocaleDateString("ko-KR") : "-"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#059669]">{log.months}개월</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
