"use client";

import React, { useState, useRef, useEffect } from "react";
import { User, updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import { SubscriptionScreen } from "./SubscriptionScreen";
import { updateGender, updateBirthYear } from "@/utils/userProfile";

interface MyProfileTabProps {
  user: User | null;
  onLogout: () => void;
}

export const MyProfileTab: React.FC<MyProfileTabProps> = ({ user, onLogout }) => {
  const [showSubscription, setShowSubscription] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || "");
  const [isUploading, setIsUploading] = useState(false);
  const [displayPhoto, setDisplayPhoto] = useState(user?.photoURL || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
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
  const [subStatus, setSubStatus] = useState<"loading" | "free" | "active" | "cancelled">("loading");
  const [showBodyInfo, setShowBodyInfo] = useState(false);

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

  const handleBirthYearSave = () => {
    const trimmed = birthYearInput.trim();
    const year = parseInt(trimmed);
    if (isNaN(year) || year < 1930 || year > 2015) return;
    setBirthYear(trimmed);
    updateBirthYear(year);
    setIsEditingBirthYear(false);
  };

  const handleLogoutClick = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
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
      alert("사진 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleNameSave = async () => {
    if (!user || !nameInput.trim()) return;
    try {
      await updateProfile(user, { displayName: nameInput.trim() });
      setDisplayName(nameInput.trim());
      setIsEditingName(false);
    } catch (err) {
      console.error("Name update failed:", err);
      alert("이름 변경에 실패했습니다.");
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
          {displayPhoto ? (
            <img
              src={displayPhoto}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
          {/* Camera overlay */}
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 group-active:bg-black/30 transition-all flex items-center justify-center">
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
                {displayName || "프로필"}
              </h1>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <p className="text-xs text-gray-400 font-medium">
            {user?.email || ""}
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
            <span className="text-sm font-bold text-gray-500">구독</span>
            {subStatus === "loading" ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <button
                onClick={() => setShowSubscription(true)}
                className="flex items-center gap-2 active:opacity-60"
              >
                <span className={`text-sm font-medium ${subStatus === "active" ? "text-[#2D6A4F]" : "text-gray-900"}`}>
                  {subStatus === "active" ? "프리미엄" : subStatus === "cancelled" ? "취소됨" : "무료"}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowBodyInfo(!showBodyInfo)}
          className="flex items-center justify-between w-full px-2 mt-2 active:opacity-60"
        >
          <p className="text-[11px] font-serif font-medium text-gray-400 uppercase tracking-widest">
            Body Info
          </p>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${showBodyInfo ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showBodyInfo && (
        <div className="bg-gray-50 rounded-2xl p-5 flex flex-col gap-3">
          {/* Gender */}
          <div className="flex justify-between items-center min-h-[32px]">
            <span className="text-sm font-bold text-gray-500">성별</span>
            <button
              onClick={handleGenderToggle}
              className="flex items-center gap-2 active:opacity-60"
            >
              <span className="text-sm font-medium text-gray-900">
                {gender === "male" ? "남성" : gender === "female" ? "여성" : "미설정"}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          </div>
          <div className="h-px bg-gray-100" />

          {/* Birth Year */}
          <div className="flex justify-between items-center min-h-[32px]">
            <span className="text-sm font-bold text-gray-500">출생연도</span>
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
                <span className="text-sm font-medium text-gray-900">{birthYear || "미설정"}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        )}

        <button
          onClick={() => setShowSubscription(true)}
          className="w-full bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-2xl p-6 flex items-center justify-between transition-all active:scale-[0.98] mt-4 shadow-lg shadow-[#1B4332]/20"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-bold text-white">프리미엄 구독</span>
            <span className="text-xs text-emerald-300/60">AI 맞춤 운동 무제한</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-emerald-300/50 line-through">9,900원</span>
            <div className="bg-[#FEE500] rounded-full px-3 py-1">
              <span className="text-xs font-black text-[#3C1E1E]">6,900원/월</span>
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
            <span className="text-lg font-bold text-white">버그 / 개선사항 제안</span>
            <span className="text-xs text-emerald-300/60">여기로 남겨주세요</span>
          </div>
          <svg className="w-6 h-6 text-emerald-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <button
          onClick={handleLogoutClick}
          className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl p-6 flex items-center justify-between transition-all active:scale-[0.98]"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-bold text-red-500">Log Out</span>
            <span className="text-xs text-gray-400">계정 로그아웃</span>
          </div>
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
};
