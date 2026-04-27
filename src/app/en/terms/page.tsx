"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

const TERMS_EN = `NOTICE: This English translation is provided for reference purposes only. The legally binding version is the Korean original. In the event of any discrepancy between this translation and the Korean original, the Korean version shall prevail.

---

Article 1 (Purpose)
These Terms govern the rights, obligations, and responsibilities between ohunjal AI (hereinafter "the Company") and users (hereinafter "Members") regarding the use of services provided by the Company.

Article 2 (Definitions)
1. "Service" refers to the AI-based workout planning, tracking, and analysis services provided by the Company through ohunjal.com.
2. "Member" refers to any person who has agreed to these Terms and uses the Service.
3. "AI Workout Plan" refers to workout routines automatically generated based on the Member's body condition, goals, and exercise history.

Article 3 (Effectiveness and Amendment of Terms)
The Company shall post these Terms on the Service screen. The Company may amend these Terms within the scope permitted by applicable laws, providing at least 7 days' notice (or 30 days for changes unfavorable to Members) before the effective date.

Article 4 (Registration)
1. Membership is established when a person agrees to these Terms and completes the sign-up process via Google Account authentication.
2. The Company may reject or cancel registration if false information is provided or if registration requirements are not met.

Article 5 (Member Obligations)
1. Members shall manage their account credentials responsibly and shall not allow third parties to use their accounts.
2. Members shall not engage in the following: impersonating others, posting false information, infringing intellectual property, interfering with Service operations, or engaging in illegal activities.
3. Members are responsible for the accuracy and legality of data they input.

Article 6 (Service Provision and Modification)
1. The Service is provided 24/7 in principle, but may be temporarily suspended for maintenance, system updates, or force majeure.
2. The Company may modify or discontinue part or all of the Service for operational or technical reasons, with prior notice.

Article 7 (Subscription and Payment)
1. The Service operates on a freemium model with limited free features and a paid Premium subscription.
2. Premium subscriptions are billed monthly and auto-renew unless cancelled. Payment method depends on region: KakaoPay (Korea) or card payment via Paddle (international).
3. The Company may change subscription pricing with at least 30 days' notice.

Article 8 (Cancellation and Refund)
1. Members may cancel their subscription at any time through their Profile settings.
2. Upon cancellation, the subscription remains active until the end of the current billing period.
3. Refunds are available within 7 days of the initial subscription if no premium features have been used. Refund requests may be submitted to ounjal.ai.app@gmail.com.
4. Refunds for company-caused issues (system errors, duplicate charges, etc.) are available regardless of the time limits above.

Article 9 (Intellectual Property)
All intellectual property related to the Service, including AI algorithms, workout plans, UI design, and content, belongs to the Company. Members may not copy, modify, distribute, or commercially exploit any Service content without prior written consent.

Article 10 (Personal Information)
The Company handles Member personal information in accordance with the Privacy Policy. AI-generated workout plans may use Member-provided body data for personalization purposes only.

Article 11 (AI Service Disclosure)
1. AI workout plans and analysis reports are generated automatically using artificial intelligence and do not replace direct exercise prescription by certified professionals or medical practitioners.
2. AI-generated content (workout routines, form guidance, etc.) may not always be 100% accurate or complete. All AI-generated content is for reference only. Members should exercise their own judgment based on their health condition and fitness level.
3. This Service is not a medical device and is not intended for diagnosis, treatment, or prevention of disease. Members with pre-existing conditions or physical limitations must consult a medical professional before using the Service. The Company is not liable for health issues arising from failure to do so.

Article 12 (Limitation of Liability)
1. The Company is not liable for service interruption due to force majeure or similar circumstances.
2. The Company is not liable for service disruptions caused by Member negligence.
3. The Company is not liable for failure to achieve expected workout results.
4. The Company is not legally liable for injuries or damages resulting from errors or inaccuracies in AI-generated content (workout plans, growth predictions, calorie analysis, estimated 1RM, strength assessments, etc.).

Article 13 (Intellectual Property and Usage Restrictions)
All intellectual property related to the Service, including AI algorithms, workout plans, UI design, and content, belongs to the Company. Members may not copy, modify, distribute, or commercially exploit any Service content without prior written consent. Unauthorized crawling, scraping, or automated access to the Service is prohibited.

Article 14 (Service Restriction and Account Suspension)
The Company may restrict or suspend a Member's account in the following cases: violation of these Terms, interference with Service operations, impersonation, distribution of false information, or any activity that threatens other Members' use of the Service. The Company will provide prior notice where possible, except in urgent cases.

Article 15 (Termination and Withdrawal)
Members may terminate their agreement and withdraw from the Service at any time through the account deletion feature. Upon withdrawal, personal information is processed in accordance with the Privacy Policy and destroyed after the legally required retention period.

Article 16 (Governing Law and Jurisdiction)
Disputes related to the Service shall be governed by the laws of the Republic of Korea, with jurisdiction at the court of the Company's registered address. Disputes between the Company and Members may also be submitted for mediation to the Korea Consumer Agency.

Article 17 (Severability)
If any provision of these Terms is found to be invalid or unenforceable under applicable law, the remaining provisions shall remain in full force and effect.

Supplementary Provisions
These Terms shall be effective from March 1, 2026.`;

export default function EnTermsPage() {
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
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">Terms of Service</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              This English translation is provided for reference only. The legally binding version is the Korean original.
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{TERMS_EN}</pre>
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
