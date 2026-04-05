"use client";

import React, { useState, useRef, useEffect } from "react";
import { User, updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import { SubscriptionScreen, TERMS_TEXT, PRIVACY_TEXT, REFUND_TEXT } from "./SubscriptionScreen";
import { updateGender, updateBirthYear, saveUserProfile } from "@/utils/userProfile";
import { useTranslation } from "@/hooks/useTranslation";
import { getTierFromExp, getOrRebuildSeasonExp, getCurrentSeason } from "@/utils/questSystem";
import { loadWorkoutHistory } from "@/utils/workoutHistory";

interface MyProfileTabProps {
  user: User | null;
  onLogout: () => void;
  onShowPrediction?: () => void;
  autoEdit1RM?: boolean;
  /** 회의 30: 구독 취소 플로우 활성 상태를 page.tsx로 전달 (탭바 숨김용) */
  onCancelFlowChange?: (active: boolean) => void;
}

// 영어 약관/개인정보 요약 (모달용)
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
2. Premium subscriptions are billed monthly via KakaoPay and auto-renew unless cancelled.
3. The Company may change subscription pricing with at least 30 days' notice.

Article 8 (Cancellation and Refund)
1. Members may cancel their subscription at any time through their Profile settings.
2. Upon cancellation, the subscription remains active until the end of the current billing period.
3. Refunds are available within 7 days of the initial subscription if no premium features have been used. Refund requests may be submitted to ounjal.ai.app@gmail.com.

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

const REFUND_EN = `NOTICE: This English translation is provided for reference purposes only. The legally binding version is the Korean original.

---

Article 1 (Purpose)
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
3. Once approved, the refund will be processed to the original payment method (3-5 business days for KakaoPay).

Article 6 (Partial Refunds)
Partial refunds (pro-rated) are not available for monthly subscriptions. Refunds are processed as either a full refund or no refund.

Article 7 (Refund Inquiries)
Email: ounjal.ai.app@gmail.com
Phone: 010-4824-2869

Supplementary Provisions
This Refund Policy shall be effective from March 1, 2026.`;

export const MyProfileTab: React.FC<MyProfileTabProps> = ({ user, onLogout, autoEdit1RM, onCancelFlowChange }) => {
  const { t, locale, setLocale } = useTranslation();
  const [showSubscription, setShowSubscription] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || "");
  const [isUploading, setIsUploading] = useState(false);
  const [displayPhoto, setDisplayPhoto] = useState(user?.photoURL || "");
  const [displayName, setDisplayName] = useState((user?.displayName || "").slice(0, 10));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gender, setGender] = useState<"male" | "female" | null>(() => {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem("alpha_gender") as "male" | "female") || null;
  });
  const [birthYear, setBirthYear] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("alpha_birth_year") || "";
  });
  const [isEditingBirthYear, setIsEditingBirthYear] = useState(false);
  const [birthYearInput, setBirthYearInput] = useState(birthYear);
  const [height, setHeight] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}").height || ""; } catch { return ""; }
  });
  const [isEditingHeight, setIsEditingHeight] = useState(false);
  const [heightInput, setHeightInput] = useState(height);
  const [subStatus, setSubStatus] = useState<"loading" | "free" | "active" | "cancelled">("loading");
  const [showBodyInfo, setShowBodyInfo] = useState(!!autoEdit1RM);
  const rmRef = useRef<HTMLDivElement>(null);

  // autoEdit1RM → BODY INFO 열고 1RM으로 자동 스크롤
  useEffect(() => {
    if (autoEdit1RM && rmRef.current) {
      setTimeout(() => rmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [autoEdit1RM]);

  // 1RM states
  const [editing1RM, setEditing1RM] = useState(!!autoEdit1RM);
  const [bench1RM, setBench1RM] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
      return fp.bench1RM ? String(fp.bench1RM) : "";
    } catch { return ""; }
  });
  const [squat1RM, setSquat1RM] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
      return fp.squat1RM ? String(fp.squat1RM) : "";
    } catch { return ""; }
  });
  const [deadlift1RM, setDeadlift1RM] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
      return fp.deadlift1RM ? String(fp.deadlift1RM) : "";
    } catch { return ""; }
  });
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [tierInfo, setTierInfo] = useState(() => getTierFromExp(0));
  const [seasonLabel, setSeasonLabel] = useState(() => getCurrentSeason().label);

  // Load tier from workout history
  useEffect(() => {
    loadWorkoutHistory().then(history => {
      const bYear = typeof window !== "undefined" ? parseInt(localStorage.getItem("alpha_birth_year") || "") : NaN;
      const g = typeof window !== "undefined" ? (localStorage.getItem("alpha_gender") as "male" | "female") || undefined : undefined;
      const seasonExp = getOrRebuildSeasonExp(history, !isNaN(bYear) ? bYear : undefined, g);
      setTierInfo(getTierFromExp(seasonExp.totalExp));
      setSeasonLabel(getCurrentSeason().label);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkSub = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setSubStatus("free"); return; }
        const res = await fetch("/api/getSubscription", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSubStatus(data.status || "free");
        } else {
          setSubStatus("free");
        }
      } catch {
        setSubStatus("free");
      }
    };
    checkSub();
  }, [user, showSubscription]);

  const handleGenderToggle = () => {
    const next = gender === "male" ? "female" : "male";
    setGender(next);
    updateGender(next);
  };

  const handleHeightSave = () => {
    const val = parseInt(heightInput.trim());
    if (isNaN(val) || val < 100 || val > 250) return;
    setHeight(String(val));
    try {
      const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
      fp.height = val;
      localStorage.setItem("alpha_fitness_profile", JSON.stringify(fp));
    } catch { /* ignore */ }
    setIsEditingHeight(false);
  };

  const handleBirthYearSave = () => {
    const trimmed = birthYearInput.trim();
    const year = parseInt(trimmed);
    if (isNaN(year) || year < 1930 || year > 2015) return;
    setBirthYear(trimmed);
    updateBirthYear(year);
    setIsEditingBirthYear(false);
  };

  const handle1RMSave = () => {
    const b = parseFloat(bench1RM.trim()) || undefined;
    const s = parseFloat(squat1RM.trim()) || undefined;
    const d = parseFloat(deadlift1RM.trim()) || undefined;
    try {
      const fp = JSON.parse(localStorage.getItem("alpha_fitness_profile") || "{}");
      const updated = { ...fp, bench1RM: b, squat1RM: s, deadlift1RM: d };
      localStorage.setItem("alpha_fitness_profile", JSON.stringify(updated));
      saveUserProfile({ fitnessProfile: updated }).catch(() => {});
    } catch {}
    setEditing1RM(false);
  };

  const handleLogoutClick = () => {
    if (confirm(t("my.logoutConfirm"))) {
      onLogout();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profile_photos/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: downloadURL });
      setDisplayPhoto(downloadURL);
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert(t("my.photoFail"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleNameSave = async () => {
    if (!user || !nameInput.trim()) return;
    try {
      const trimmed = nameInput.trim().slice(0, 10);
      await updateProfile(user, { displayName: trimmed });
      setDisplayName(trimmed);
      setIsEditingName(false);
    } catch (err) {
      console.error("Name update failed:", err);
      alert(t("my.nameFail"));
    }
  };

  if (showSubscription && user) {
    return <SubscriptionScreen user={user} onClose={() => setShowSubscription(false)} initialStatus={subStatus === "loading" ? undefined : subStatus} onCancelFlowChange={onCancelFlowChange} />;
  }

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in overflow-y-auto scrollbar-hide">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Profile Header - Fixed */}
      <div className="pt-8 pb-8 flex flex-col items-center text-center gap-4 px-8 shrink-0">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="relative group"
        >
          {/* Tier-colored ring */}
          <div className="w-[104px] h-[104px] rounded-full flex items-center justify-center p-[3px]" style={{ background: `linear-gradient(135deg, ${tierInfo.tier.color}, ${tierInfo.tier.color}80)` }}>
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt="Profile"
                className="w-full h-full rounded-full object-cover border-2 border-white"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center border-2 border-white">
                <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
          {/* Tier badge */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow-md" style={{ backgroundColor: tierInfo.tier.color }}>
            {tierInfo.tier.name}
          </div>
          {/* Camera overlay */}
          <div className="absolute inset-[3px] rounded-full bg-black/0 group-hover:bg-black/30 group-active:bg-black/30 transition-all flex items-center justify-center">
            {isUploading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
        </button>

        <div className="flex flex-col gap-1 items-center">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                maxLength={10}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                className="text-2xl font-black text-[#1B4332] bg-white border border-gray-200 rounded-lg px-3 py-1 w-[180px] outline-none focus:border-[#2D6A4F] transition-colors text-center"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") { setIsEditingName(false); setNameInput(displayName); }
                }}
              />
              <button
                onClick={handleNameSave}
                className="text-xs font-bold text-[#2D6A4F] active:opacity-60 shrink-0"
              >
                저장
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNameInput(displayName); setIsEditingName(true); }}
              className="flex items-center gap-1.5 active:opacity-60"
            >
              <h1 className="text-2xl font-black text-[#1B4332]">
                {displayName || t("my.defaultProfile")}
              </h1>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <p className="text-xs text-gray-400 font-medium">
            {user?.email || ""}
          </p>
          <p className="text-[10px] font-bold mt-1" style={{ color: tierInfo.tier.color }}>
            {locale === "en" ? seasonLabel.replace("시즌", "Season") : seasonLabel} - {tierInfo.tier.name}
          </p>
        </div>
      </div>

      {/* Account Info - Fixed */}
      <div className="flex flex-col gap-4 px-8 pb-8">
        <p className="text-[11px] font-serif font-medium text-gray-400 uppercase tracking-widest px-2">
          Account
        </p>

        <div className="bg-gray-50 rounded-2xl p-5 flex flex-col gap-3">
          {/* Subscription status */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-500">{t("my.subscription")}</span>
            {subStatus === "loading" ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <button
                onClick={() => setShowSubscription(true)}
                className="flex items-center gap-2 active:opacity-60"
              >
                <span className={`text-sm font-medium ${subStatus === "active" ? "text-[#2D6A4F]" : "text-gray-900"}`}>
                  {subStatus === "active" ? t("my.sub.premium") : subStatus === "cancelled" ? t("my.sub.cancelled") : t("my.sub.free")}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {(() => {
          const missing = [!gender, !birthYear].filter(Boolean).length;
          return (
            <button
              onClick={() => setShowBodyInfo(!showBodyInfo)}
              className="flex items-center justify-between w-full px-2 mt-2 active:opacity-60"
            >
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-serif font-medium text-gray-400 uppercase tracking-widest">
                  Body Info
                </p>
                {missing > 0 && !showBodyInfo && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                    {missing}개 미설정
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showBodyInfo ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          );
        })()}

        {showBodyInfo && (
        <div className="bg-gray-50 rounded-2xl p-5 flex flex-col gap-3">
          {/* Gender */}
          <div className="flex justify-between items-center min-h-[32px]">
            <span className="text-sm font-bold text-gray-500">{t("my.gender")}</span>
            <button
              onClick={handleGenderToggle}
              className="flex items-center gap-2 active:opacity-60"
            >
              <span className="text-sm font-medium text-gray-900">
                {gender === "male" ? t("my.gender.male") : gender === "female" ? t("my.gender.female") : t("my.notSet")}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          </div>
          <div className="h-px bg-gray-100" />

          {/* Birth Year */}
          <div className="flex justify-between items-center min-h-[32px]">
            <span className="text-sm font-bold text-gray-500">{t("my.birthYear")}</span>
            {isEditingBirthYear ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={birthYearInput}
                  onChange={(e) => setBirthYearInput(e.target.value)}
                  autoFocus
                  placeholder="1990"
                  className="text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 w-[100px] outline-none focus:border-[#2D6A4F] transition-colors text-right"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBirthYearSave();
                    if (e.key === "Escape") { setIsEditingBirthYear(false); setBirthYearInput(birthYear); }
                  }}
                />
                <button
                  onClick={handleBirthYearSave}
                  className="text-xs font-bold text-[#2D6A4F] active:opacity-60 shrink-0"
                >
                  저장
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setBirthYearInput(birthYear); setIsEditingBirthYear(true); }}
                className="flex items-center gap-2 active:opacity-60"
              >
                <span className="text-sm font-medium text-gray-900">{birthYear || t("my.notSet")}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <div className="h-px bg-gray-100" />

          {/* Height */}
          <div className="flex justify-between items-center min-h-[32px]">
            <span className="text-sm font-bold text-gray-500">{t("my.height")}</span>
            {isEditingHeight ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  autoFocus
                  placeholder="170"
                  className="text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 w-[100px] outline-none focus:border-[#2D6A4F] transition-colors text-right"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleHeightSave();
                    if (e.key === "Escape") { setIsEditingHeight(false); setHeightInput(height); }
                  }}
                />
                <span className="text-sm text-gray-400">cm</span>
                <button onClick={handleHeightSave} className="text-xs font-bold text-[#2D6A4F] active:opacity-60 shrink-0">저장</button>
              </div>
            ) : (
              <button
                onClick={() => { setHeightInput(height); setIsEditingHeight(true); }}
                className="flex items-center gap-2 active:opacity-60"
              >
                <span className="text-sm font-medium text-gray-900">{height ? `${height}cm` : t("my.notSet")}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <div className="h-px bg-gray-100" />

          {/* 3대 운동 1RM */}
          <div ref={rmRef} className="flex justify-between items-center min-h-[32px]">
            <span className="text-sm font-bold text-gray-500">{t("my.oneRM")}</span>
            {editing1RM ? (
              <button onClick={handle1RMSave} className="text-xs font-bold text-[#2D6A4F] active:opacity-60">저장</button>
            ) : (
              <button onClick={() => setEditing1RM(true)} className="flex items-center gap-2 active:opacity-60">
                <span className="text-sm font-medium text-gray-900">
                  {bench1RM || squat1RM || deadlift1RM
                    ? [bench1RM && `B${bench1RM}`, squat1RM && `S${squat1RM}`, deadlift1RM && `D${deadlift1RM}`].filter(Boolean).join(" / ")
                    : t("my.notSet")}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          {editing1RM && (
            <div className="flex gap-2">
              {[
                { label: t("my.1rm.bench"), value: bench1RM, setter: setBench1RM },
                { label: t("my.1rm.squat"), value: squat1RM, setter: setSquat1RM },
                { label: t("my.1rm.deadlift"), value: deadlift1RM, setter: setDeadlift1RM },
              ].map((lift) => (
                <div key={lift.label} className="flex-1">
                  <p className="text-[9px] font-bold text-gray-400 mb-1">{lift.label}</p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={lift.value}
                    onChange={(e) => lift.setter(e.target.value)}
                    placeholder="kg"
                    className="w-full text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#2D6A4F] transition-colors text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onKeyDown={(e) => { if (e.key === "Enter") handle1RMSave(); }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        <button
          onClick={() => setShowSubscription(true)}
          className="w-full bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-2xl p-6 flex items-center justify-between transition-all active:scale-[0.98] shadow-lg shadow-[#1B4332]/20"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-bold text-white">{t("my.premium")}</span>
            <span className="text-xs text-emerald-300/60">{t("my.premium.desc")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-emerald-300/50 line-through">{t("my.premium.originalPrice")}</span>
            <div className="bg-[#FEE500] rounded-full px-3 py-1">
              <span className="text-xs font-black text-[#3C1E1E]">{t("my.premium.price")}</span>
            </div>
          </div>
        </button>

        <a
          href="https://forms.gle/N9inup92JWtZAphS7"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] rounded-2xl p-6 flex items-center justify-between transition-all active:scale-[0.98]"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-bold text-white">{t("my.bugReport")}</span>
            <span className="text-xs text-emerald-300/60">{t("my.bugReport.desc")}</span>
          </div>
          <svg className="w-6 h-6 text-emerald-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        {/* Language Selector */}
        <div className="w-full bg-[#1B4332] rounded-2xl p-5 flex items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <span className="text-base font-bold text-white">{t("my.language")}</span>
            <span className="text-xs text-white/50">{locale === "en" ? "English" : "한국어"}</span>
          </div>
          <div className="flex gap-2">
            {([["ko", "🇰🇷"], ["en", "🇺🇸"]] as const).map(([code, flag]) => (
              <button
                key={code}
                onClick={() => setLocale(code)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${locale === code ? "bg-white shadow-md scale-105" : "bg-white/10 hover:bg-white/20"}`}
              >
                {flag}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleLogoutClick}
          className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl p-6 flex items-center justify-between transition-all active:scale-[0.98]"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-bold text-red-500">{t("my.logout")}</span>
            <span className="text-xs text-gray-400">{t("my.logout.desc")}</span>
          </div>
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>

        {/* Business Registration Footer */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-center gap-3 mb-4">
            <button type="button" onClick={() => setShowTerms(true)} className="text-[10px] text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors">{t("my.terms")}</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={() => setShowPrivacy(true)} className="text-[10px] text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors">{t("my.privacy")}</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={() => setShowRefund(true)} className="text-[10px] text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors">{t("my.refund")}</button>
          </div>
          <div className="flex flex-col gap-1 text-[10px] text-gray-500 leading-relaxed text-center">
            <p className="font-medium text-gray-600">{t("my.footer.company")}</p>
            <p>{t("my.footer.bizNum")}</p>
            <p>{t("my.footer.salesNum")}</p>
            <p>{t("my.footer.address")}</p>
            <p>H.P 010-4824-2869</p>
            <p>ounjal.ai.app@gmail.com</p>
            <p className="mt-2">Copyright © 2026 ohunjal AI. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-h-[70vh] flex flex-col shadow-xl mb-24" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">{t("my.terms")}</h2>
              <button type="button" onClick={() => setShowTerms(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {locale === "en" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">This English translation is provided for reference only. The legally binding version is the Korean original.</p>
                </div>
              )}
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{locale === "en" ? TERMS_EN.replace(/^NOTICE:.*?\n\n---\n\n/, "") : TERMS_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowTerms(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">{t("common.confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-h-[70vh] flex flex-col shadow-xl mb-24" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">{t("my.privacy")}</h2>
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {locale === "en" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">This English translation is provided for reference only. The legally binding version is the Korean original.</p>
                </div>
              )}
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{locale === "en" ? PRIVACY_EN.replace(/^NOTICE:.*?\n\n---\n\n/, "") : PRIVACY_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">{t("common.confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Policy Modal */}
      {showRefund && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowRefund(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-h-[70vh] flex flex-col shadow-xl mb-24" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">{t("my.refund")}</h2>
              <button type="button" onClick={() => setShowRefund(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {locale === "en" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">This English translation is provided for reference only. The legally binding version is the Korean original.</p>
                </div>
              )}
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{locale === "en" ? REFUND_EN.replace(/^NOTICE:.*?\n\n---\n\n/, "") : REFUND_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowRefund(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">{t("common.confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
