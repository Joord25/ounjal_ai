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

const REFUND_EN = `Article 1 (Purpose)
This Refund Policy outlines the refund criteria and procedures for the Premium subscription service provided by ohunjal AI (hereinafter "the Company").

Article 2 (Refund Eligibility)
Refunds are available only if requested within 7 days of the payment date. However, if any premium features (AI workout plan generation, AI analysis reports, etc.) have been used even once after payment, refunds are not available.

Article 3 (Non-Refundable Cases)
- More than 7 days have passed since the payment date
- Premium-exclusive features have been used
- Account restriction or forced termination due to Terms of Service violation

Article 4 (Cancellation vs. Refund)
Subscription Cancellation: Automatic billing stops from the next billing cycle. After cancellation, premium features remain accessible until the current billing period expires.
Refund: The payment amount is returned. Upon refund processing, premium features are immediately discontinued.

Article 5 (Refund Procedure)
1. Request a refund through the in-app support or the contact information below.
2. The Company will verify refund eligibility after receiving the request (1-3 business days).
3. Once approved, the refund will be processed to the original payment method. Processing time: 3-5 business days for KakaoPay; 5-10 business days for Paddle (subject to your card issuer; some banks may take longer).

Article 6 (Partial Refunds)
Partial refunds (pro-rated) are not available for monthly subscriptions. Refunds are processed as either a full refund or no refund.

Article 6.1 (Company-caused Refunds)
Refunds for company-caused issues (system errors, duplicate charges, etc.) are available regardless of the time limits or usage history above.

Article 7 (Refund Inquiries)
Email: ounjal.ai.app@gmail.com
Phone: 010-4824-2869

Supplementary Provisions
This Refund Policy shall be effective from March 1, 2026.`;

export default function EnRefundPage() {
  useBodyScroll();
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="/en" className="flex items-center gap-2">
            <img src="/favicon.png" alt="ohunjal AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#1B4332] text-lg">ohunjal AI</span>
          </a>
          <a href="/en" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">
            Back
          </a>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">Refund Policy</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              This English translation is provided for reference only. The legally binding version is the Korean original.
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">
            {REFUND_EN}
          </pre>
        </div>
      </div>
      <footer className="py-8 bg-[#143728] text-gray-400">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs">
          <p>&copy; 2026 ohunjal AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
