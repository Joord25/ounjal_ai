"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

const PRIVACY_EN = `NOTICE: This English translation is provided for reference purposes only. The legally binding version is the Korean original. In the event of any discrepancy between this translation and the Korean original, the Korean version shall prevail.

---

Article 1 (Purpose)
This Privacy Policy describes how ohunjal AI (hereinafter "the Company") collects, uses, and protects personal information in compliance with the Personal Information Protection Act of the Republic of Korea.

Article 2 (Items Collected)
1. [Required] Email address, name (via Google social login)
2. [Required] Gender, birth year, body weight, height
3. [Required] Workout records (plans, session logs, sets/reps, feedback)
4. [Auto-generated] Health-derived metrics (BMR, calorie balance, estimated 1RM, workout intensity classification, growth predictions) — calculated from Member-provided body data and workout records, used solely for personalized AI service delivery.
5. [Auto-collected] Service usage logs, access logs, IP address, cookies, device information

Article 3 (Purpose of Collection)
1. AI-personalized workout plan generation and per-session analysis reports
2. Workout history management and growth prediction services
3. Subscription payment processing and billing management
4. Service improvement through usage analysis and AI model enhancement

Article 4 (Retention and Destruction)
1. Personal information is retained for the duration of membership.
2. Upon withdrawal, personal information is destroyed without delay, except where retention is required by law.
3. Workout records and derived metrics are deleted simultaneously upon account deletion.

Article 5 (Third-Party Provision)
The Company does not provide personal information to third parties without Member consent, except as required by law.

Article 6 (Processing Delegation)
The following third-party services process data on behalf of the Company:
- Google LLC (Firebase): Authentication, data storage, hosting
- Google LLC (Gemini API): AI workout plan and report generation — data is processed and discarded immediately, not used for model training
- PortOne: Payment processing (KakaoPay billing)

Article 7 (Member Rights)
Members may request access, correction, deletion, or suspension of processing of their personal information at any time through their Profile settings or by contacting ounjal.ai.app@gmail.com.

Article 8 (AI Model Integration and Limitations)
1. The Company utilizes external AI models (Google Gemini) to provide workout plans. Member-provided information (body data, feedback) may be transmitted to AI servers during this process.
2. AI-transmitted data is processed only for plan generation and is not stored or used for AI training by the third-party provider.
3. The Company automatically calculates health-derived metrics (BMR via Harris-Benedict equation, exercise calorie expenditure via MET, estimated 1RM via Brzycki/Epley/Lombardi formulas). These metrics are used solely for service personalization and are not used for medical diagnostic purposes.

Article 9 (Security Measures)
The Company implements technical and organizational measures to protect personal information, including encrypted transmission (HTTPS), access controls, and regular security reviews.

Article 10 (Cookies)
The Service may use cookies to enhance user experience, remember preferences, and analyze usage patterns. Members may disable cookies through their browser settings, but some features may not function properly without them.

Article 11 (Privacy Officer)
Privacy Officer: Jooyong Lim (CEO)
Email: ounjal.ai.app@gmail.com
Phone: 010-4824-2869
Address: 40-6, Euncheon-ro 35-gil, Gwanak-gu, Seoul, Republic of Korea

Members may contact the Privacy Officer at any time to exercise their rights regarding personal information.

Supplementary Provisions
This Policy shall be effective from March 1, 2026.`;

export default function EnPrivacyPage() {
  useBodyScroll();
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="/en" className="flex items-center gap-2">
            <img src="/favicon.png" alt="ohunjal AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#1B4332] text-lg">ohunjal AI</span>
          </a>
          <a href="/en" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">Back</a>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">Privacy Policy</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              This English translation is provided for reference only. The legally binding version is the Korean original.
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{PRIVACY_EN}</pre>
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
