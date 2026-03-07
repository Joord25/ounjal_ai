"use client";

import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface SubscriptionScreenProps {
  user: User;
  onClose: () => void;
}

const FUNCTIONS_BASE = "https://us-central1-ounjal.cloudfunctions.net";

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ user, onClose }) => {
  const [status, setStatus] = useState<"loading" | "free" | "active" | "cancelled">("loading");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check subscription status on mount
  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/getSubscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || "free");
        setExpiresAt(data.expiresAt || null);
      } else {
        setStatus("free");
      }
    } catch {
      setStatus("free");
    }
  };

  const handleSubscribe = async () => {
    if (!window.PortOne) {
      setError("결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Issue billing key via PortOne SDK
      const response = await window.PortOne.requestIssueBillingKey({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "",
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "",
        billingKeyMethod: "EASY_PAY",
        issueName: "오운잘 AI 월간 구독",
        customer: {
          customerId: user.uid,
          email: user.email || undefined,
          fullName: user.displayName || undefined,
        },
      });

      if (response.code) {
        // User cancelled or error
        if (response.code === "FAILURE_TYPE_PG") {
          setError("결제가 취소되었습니다.");
        } else {
          setError(response.message || "빌링키 발급에 실패했습니다.");
        }
        return;
      }

      if (!response.billingKey) {
        setError("빌링키 발급에 실패했습니다.");
        return;
      }

      // 2. Send billing key to server to save and process first payment
      const token = await getIdToken();
      const serverRes = await fetch(`${FUNCTIONS_BASE}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          billingKey: response.billingKey,
        }),
      });

      if (!serverRes.ok) {
        const err = await serverRes.json().catch(() => ({}));
        throw new Error(err.error || "구독 처리에 실패했습니다.");
      }

      // Success
      setStatus("active");
      await checkSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("구독을 취소하시겠습니까?\n현재 결제 기간이 끝날 때까지 이용 가능합니다.")) return;

    setIsProcessing(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/cancelSubscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "구독 취소에 실패했습니다.");
      }

      setStatus("cancelled");
      await checkSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 취소 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="pt-8 pb-4 px-6 text-center shrink-0">
        <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-[#2D6A4F]">Subscription</span>
        <h1 className="text-3xl font-black text-[#1B4332] mt-2">프리미엄 구독</h1>
      </div>

      <div className="flex-1 px-6 pb-6">
        {status === "loading" ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : status === "active" ? (
          /* Active Subscription */
          <div className="flex flex-col gap-4">
            <div className="bg-[#1B4332] rounded-3xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-white mb-1">구독 활성화</h2>
              <p className="text-sm text-emerald-300/70">
                {expiresAt ? `다음 결제일: ${new Date(expiresAt).toLocaleDateString("ko-KR")}` : "프리미엄 이용 중"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">포함된 기능</h3>
              <div className="flex flex-col gap-2">
                {["AI 맞춤 운동 플랜 무제한", "운동 분석 리포트", "체중 변화 추적", "운동 히스토리 관리"].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="w-full py-3 rounded-2xl text-sm font-bold text-red-400 bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isProcessing ? "처리 중..." : "구독 취소"}
            </button>
          </div>
        ) : (
          /* Free / Cancelled - Show subscription offer */
          <div className="flex flex-col gap-4">
            {status === "cancelled" && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <p className="text-sm font-bold text-amber-700">구독이 취소되었습니다</p>
                <p className="text-xs text-amber-600 mt-1">
                  {expiresAt ? `${new Date(expiresAt).toLocaleDateString("ko-KR")}까지 이용 가능` : "기간 만료 후 무료 플랜으로 전환됩니다"}
                </p>
              </div>
            )}

            {/* Pricing Card */}
            <div className="bg-[#1B4332] rounded-3xl p-6 text-center">
              <p className="text-xs font-bold text-emerald-300/60 uppercase tracking-wider mb-2">Monthly</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-black text-white">9,900</span>
                <span className="text-lg text-emerald-300/70">원/월</span>
              </div>
              <p className="text-xs text-emerald-400/50 mt-2">카카오페이로 간편 결제</p>
            </div>

            {/* Features */}
            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">프리미엄 기능</h3>
              <div className="flex flex-col gap-2">
                {["AI 맞춤 운동 플랜 무제한 생성", "세션별 AI 분석 리포트", "체중 변화 그래프 추적", "운동 히스토리 무제한 저장"].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2D6A4F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-[#FEE500] text-[#3C1E1E] font-bold text-base active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#3C1E1E] border-t-transparent rounded-full animate-spin" />
                  처리 중...
                </span>
              ) : (
                "카카오페이로 구독하기"
              )}
            </button>

            <p className="text-[10px] text-gray-400 text-center">
              구독은 매월 자동 갱신되며, 언제든 취소할 수 있습니다
            </p>
          </div>
        )}
      </div>

      {/* Close button */}
      <div className="px-6 pb-6 shrink-0">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-bold text-gray-400 active:scale-[0.98] transition-all"
        >
          닫기
        </button>
      </div>
    </div>
  );
};
