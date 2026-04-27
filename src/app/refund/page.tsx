"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
}

const REFUND_TEXT = `제1조(목적)
본 환불정책은 오운잘 AI(이하 '회사')가 제공하는 프리미엄 구독 서비스의 환불 기준 및 절차를 안내합니다.

제2조(환불 가능 조건)

결제일로부터 7일 이내에 환불을 요청한 경우에 한해 환불이 가능합니다.

단, 결제 후 프리미엄 기능(AI 운동 플랜 생성, AI 분석 리포트 등)을 1회라도 사용한 경우에는 환불이 불가합니다.

제3조(환불 불가 사유)

결제일로부터 7일이 경과한 경우

프리미엄 전용 기능을 사용한 이력이 있는 경우

이용약관 위반으로 인한 이용 제한 또는 강제 해지의 경우

제4조(구독 취소와 환불의 구분)

구독 취소: 다음 결제 주기부터 자동 결제가 중단됩니다. 취소 후에도 현재 결제 기간이 만료될 때까지 프리미엄 기능을 계속 이용할 수 있습니다.

환불: 결제 금액을 돌려받는 것으로, 환불 처리 시 프리미엄 기능 이용이 즉시 중단됩니다.

제5조(환불 절차)

서비스 내 고객센터 또는 아래 연락처로 환불을 요청합니다.

회사는 요청 접수 후 환불 가능 여부를 확인합니다 (영업일 기준 1~3일 소요).

환불이 승인되면 원래 결제 수단으로 환불이 진행됩니다. 카카오페이는 3~5 영업일, Paddle(해외 카드 결제)은 카드사 처리 포함 5~10 영업일 소요됩니다 (카드사 정책에 따라 변동 가능).

제6조(부분 환불)

월 구독의 경우 부분 환불(일할 계산)은 제공하지 않습니다.

환불은 전액 환불 또는 환불 불가 중 하나로 처리됩니다.

회사 귀책 사유(시스템 오류, 중복 결제 등)로 인한 환불은 위 기한·이용 이력 제한 없이 가능합니다.

제7조(환불 문의)

이메일: ounjal.ai.app@gmail.com

전화: 010-4824-2869

부칙
본 환불정책은 2026년 3월 1일부터 시행합니다.`;

export default function RefundPage() {
  useBodyScroll();
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2">
            <img src="/favicon.png" alt="오운잘 AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#1B4332] text-lg">오운잘 AI</span>
          </a>
          <a
            href="/"
            className="px-5 py-2.5 bg-[#1B4332] text-white text-sm font-bold rounded-xl hover:bg-[#143728] transition-colors"
          >
            돌아가기
          </a>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">환불정책</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">
            {REFUND_TEXT}
          </pre>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 bg-[#143728] text-gray-400">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs">
          <p>&copy; 2026 오운잘 AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
