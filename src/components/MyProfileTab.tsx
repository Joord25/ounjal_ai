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
}

// 영어 약관/개인정보 요약 (모달용)
const TERMS_EN = `NOTICE: This English translation is provided for reference only. The legally binding version is the Korean original.\n\n---\n\nArticle 1 (Purpose)\nThese Terms govern the rights, obligations, and responsibilities between ohunjal AI ("the Company") and users ("Members") regarding the use of services provided by the Company.\n\nArticle 11 (AI Service Disclosure)\nAI workout plans and analysis reports are generated automatically and do not replace professional medical consultation. AI-generated content may not always be 100% accurate. Members should exercise their own judgment.\n\nArticle 12 (Limitation of Liability)\nThe Company is not liable for injuries or damages resulting from AI-generated content.\n\nFull terms available at ohunjal.com/en/terms\n\nEffective from March 1, 2026.`;

const PRIVACY_EN = `NOTICE: This English translation is provided for reference only. The legally binding version is the Korean original.\n\n---\n\nArticle 1 (Purpose)\nThis Privacy Policy describes how ohunjal AI collects, uses, and protects personal information.\n\nItems Collected: Email, name (Google login), gender, birth year, weight, workout records, auto-generated health metrics.\n\nPurpose: AI workout plan generation, growth predictions, payment processing, service improvement.\n\nThird-party Processing: Google Firebase (auth/storage), Google Gemini API (AI plans), PortOne (payments).\n\nFull policy available at ohunjal.com/en/privacy\n\nEffective from March 1, 2026.`;

const REFUND_EN = `NOTICE: This English translation is provided for reference only.\n\n---\n\nRefunds are available within 7 days of the initial subscription if no premium features have been used.\n\nTo request a refund, contact ounjal.ai.app@gmail.com.\n\nUpon cancellation, the subscription remains active until the end of the current billing period.`;

export const MyProfileTab: React.FC<MyProfileTabProps> = ({ user, onLogout, autoEdit1RM }) => {
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
    return <SubscriptionScreen user={user} onClose={() => setShowSubscription(false)} initialStatus={subStatus === "loading" ? undefined : subStatus} />;
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
            {seasonLabel} - {tierInfo.tier.name}
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
            <span className="text-sm font-bold text-gray-500">{t("Subscription")}</span>
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
            <span className="text-sm font-bold text-gray-500">3대 1RM</span>
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
            <span className="text-lg font-bold text-red-500">Log Out</span>
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
            <p className="font-medium text-gray-600">주드(Joord) · 대표 임주용</p>
            <p>사업자등록번호 623-36-01460</p>
            <p>통신판매 2026-서울관악-0647</p>
            <p>서울특별시 관악구 은천로35길 40-6, 404호</p>
            <p>H.P 010-4824-2869</p>
            <p>ounjal.ai.app@gmail.com</p>
            <p className="mt-2">Copyright © 2026 오운잘 AI. All rights reserved.</p>
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
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{locale === "en" ? TERMS_EN : TERMS_TEXT}</pre>
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
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{locale === "en" ? PRIVACY_EN : PRIVACY_TEXT}</pre>
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
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{locale === "en" ? REFUND_EN : REFUND_TEXT}</pre>
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
