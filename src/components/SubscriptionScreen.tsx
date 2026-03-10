"use client";

import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchWithRetry } from "@/utils/fetchRetry";

interface SubscriptionScreenProps {
  user: User;
  onClose: () => void;
  initialStatus?: "free" | "active" | "cancelled";
}

const FUNCTIONS_BASE = "https://us-central1-ohunjal.cloudfunctions.net";

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

const FAQ_ITEMS = [
  {
    q: "무료 플랜과 프리미엄의 차이는?",
    a: "무료 플랜은 AI 운동 플랜 생성이 3회로 제한됩니다. 프리미엄 구독 시 AI 맞춤 운동 플랜 무제한 생성, 세션별 AI 분석 리포트, 운동 히스토리 무제한 저장 등 모든 기능을 이용하실 수 있습니다.",
  },
  {
    q: "결제는 어떻게 처리되나요?",
    a: "카카오페이를 통해 안전하게 결제됩니다. 결제 정보는 암호화되어 보호되며, 매월 자동으로 갱신됩니다.",
  },
  {
    q: "카카오페이 외 다른 결제수단은 없나요?",
    a: "현재는 카카오페이를 통한 결제만 가능합니다. 더 다양한 결제 옵션을 제공하기 위해 토스페이, 네이버 페이 등 추가 결제수단을 준비 중입니다.",
  },
  {
    q: "구독 취소는 어떻게 하나요?",
    a: "프로필 탭에서 구독 관리로 이동하시면 구독 취소 버튼이 있습니다. 취소 후에도 결제 주기가 끝날 때까지 프리미엄 기능을 계속 이용하실 수 있습니다.",
  },
  {
    q: "결제 후 환불도 가능한가요?",
    a: "결제 후 7일 이내, 프리미엄 기능을 사용하지 않은 경우에 한해 환불이 가능합니다. 고객센터로 문의해 주세요.",
  },
  {
    q: "앱스토어, 플레이스토어 앱은 없나요?",
    a: "현재는 웹 브라우저에서 이용하실 수 있으며, 모바일 앱은 준비 중입니다. 웹에서도 모든 기능을 동일하게 이용하실 수 있습니다.",
  },
];

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ user, onClose, initialStatus }) => {
  const [status, setStatus] = useState<"loading" | "free" | "active" | "cancelled">(initialStatus || "loading");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [lastPaymentAt, setLastPaymentAt] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=reason, 2=confirm
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmCountdown, setConfirmCountdown] = useState(5);

  // Always fetch full subscription details (initialStatus only sets initial UI state)
  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const token = await getIdToken();
      const res = await fetchWithRetry(`${FUNCTIONS_BASE}/getSubscription`, {
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
        setLastPaymentAt(data.lastPaymentAt || null);
        setAmount(data.amount || null);
        setCreatedAt(data.createdAt || null);
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
      const serverRes = await fetchWithRetry(`${FUNCTIONS_BASE}/subscribe`, {
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

  const CANCEL_REASONS = [
    "가격이 부담돼요",
    "기능이 기대에 못 미쳐요",
    "다른 앱을 사용하고 있어요",
    "운동을 쉬게 되었어요",
    "기타",
  ];

  const openCancelFlow = () => {
    setCancelStep(1);
    setCancelReason(null);
    setCancelReasonText("");
    setConfirmInput("");
    setConfirmCountdown(5);
  };

  const goToConfirmStep = () => {
    setCancelStep(2);
    setConfirmCountdown(5);
    const timer = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      const token = await getIdToken();
      const res = await fetchWithRetry(`${FUNCTIONS_BASE}/cancelSubscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason === "기타" && cancelReasonText.trim() ? `기타: ${cancelReasonText.trim()}` : cancelReason }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "구독 취소에 실패했습니다.");
      }

      setCancelStep(0);
      setStatus("cancelled");
      await checkSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 취소 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in">
      {/* Header - fixed */}
      <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0 bg-white">
        <button onClick={onClose} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-[#2D6A4F]">구독/결제</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="pb-4 px-6 text-center">
        <h1 className="text-3xl font-black text-[#1B4332]">Primium 구독</h1>
      </div>

      <div className="flex-1 px-6 pb-4">
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

            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">구독 내역</h3>
              <div className="flex flex-col gap-2.5">
                {createdAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">구독 시작일</span>
                    <span className="text-sm font-medium text-gray-900">{new Date(createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                )}
                {lastPaymentAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">최근 결제일</span>
                    <span className="text-sm font-medium text-gray-900">{new Date(lastPaymentAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">결제 금액</span>
                    <span className="text-sm font-medium text-gray-900">{amount.toLocaleString()}원</span>
                  </div>
                )}
                {expiresAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">다음 결제일</span>
                    <span className="text-sm font-medium text-[#2D6A4F]">{new Date(expiresAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                )}
              </div>
            </div>

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

        {/* FAQ */}
        {status !== "loading" && (
          <div className="mt-8">
            <h2 className="text-lg font-black text-gray-900 text-center mb-4">자주 묻는 질문</h2>
            <div className="flex flex-col gap-2.5">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 active:opacity-60"
                  >
                    <span className="text-sm font-bold text-gray-900 text-left">{item.q}</span>
                    <span className="text-[#2D6A4F] text-lg font-bold shrink-0 ml-3">
                      {openFaqIndex === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaqIndex === i && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancel button - bottom of page, only for active */}
        {status === "active" && (
          <div className="mt-6">
            <button
              onClick={openCancelFlow}
              className="w-full py-3 text-xs text-gray-400 underline underline-offset-2"
            >
              구독 취소
            </button>
          </div>
        )}

        {/* Business Registration Footer */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex flex-col gap-1 text-[10px] text-gray-500 leading-relaxed text-center">
            <p className="font-medium text-gray-600">주드(Joord) · 대표 임주용</p>
            <p>사업자등록번호 623-36-01460</p>
            <p>서울특별시 관악구 은천로35길 40-6, 404호</p>
            <p>Tel 010-4042-2820</p>
            <p>ounjal.ai.app@gmail.com</p>
            <p className="mt-2">Copyright © 2026 Joord. All rights reserved.</p>
          </div>
        </div>
      </div>
      </div>

      {/* Cancel Flow Overlay */}
      {cancelStep > 0 && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0">
            <button onClick={() => setCancelStep(0)} className="p-2 -ml-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-red-400">구독 취소</span>
            <div className="w-9" />
          </div>

          {cancelStep === 1 ? (
            <div className="flex-1 px-6 pb-8">
              {/* What you'll lose */}
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 mb-6">
                <h3 className="text-sm font-bold text-amber-800 mb-3">취소하면 잃게 되는 혜택</h3>
                <div className="flex flex-col gap-2">
                  {["AI 맞춤 운동 플랜 무제한 생성", "세션별 AI 분석 리포트", "운동 히스토리 무제한 저장", "체중 변화 그래프 추적"].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm text-amber-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason selection */}
              <h3 className="text-base font-black text-gray-900 mb-1">취소 사유를 선택해 주세요</h3>
              <p className="text-xs text-gray-400 mb-4">서비스 개선에 활용됩니다</p>
              <div className="flex flex-col gap-2.5">
                {CANCEL_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                      cancelReason === reason
                        ? "border-red-300 bg-red-50 text-red-600"
                        : "border-gray-200 bg-gray-50 text-gray-700 active:opacity-60"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
                {cancelReason === "기타" && (
                  <textarea
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    placeholder="취소 사유를 알려주세요..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl border border-red-200 bg-red-50/50 text-sm font-medium text-gray-900 outline-none focus:border-red-300 transition-colors resize-none"
                  />
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={goToConfirmStep}
                  disabled={!cancelReason}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-red-400 bg-red-50 active:scale-[0.98] transition-all disabled:opacity-30"
                >
                  취소 계속 진행
                </button>
                <button
                  onClick={() => setCancelStep(0)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#2D6A4F] active:scale-[0.98] transition-all"
                >
                  구독 유지하기
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-6 pb-8">
              {/* Warning */}
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 mb-6">
                <h3 className="text-base font-black text-amber-800 mb-2">환불 전 꼭 확인하세요</h3>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span className="text-sm text-amber-700">환불은 결제일로부터 7일 이내에만 가능합니다.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span className="text-sm text-amber-700">결제 후 프리미엄 기능을 사용한 경우 환불이 불가합니다.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span className="text-sm text-amber-700">취소 후에도 현재 결제 기간까지는 이용 가능합니다.</span>
                  </div>
                </div>
              </div>

              {/* Type to confirm */}
              <h3 className="text-base font-black text-gray-900 mb-1">정말 취소하시겠습니까?</h3>
              <p className="text-xs text-gray-400 mb-4">확인을 위해 아래에 <span className="font-bold text-red-400">"취소"</span>를 입력해 주세요</p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="취소"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 outline-none focus:border-red-300 transition-colors"
              />

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={handleCancel}
                  disabled={confirmInput !== "취소" || confirmCountdown > 0 || isProcessing}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-red-400 bg-red-50 active:scale-[0.98] transition-all disabled:opacity-30"
                >
                  {isProcessing ? "처리 중..." : confirmCountdown > 0 ? `${confirmCountdown}초 후 취소 가능` : "구독 취소 확정"}
                </button>
                <button
                  onClick={() => setCancelStep(0)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#2D6A4F] active:scale-[0.98] transition-all"
                >
                  구독 유지하기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
