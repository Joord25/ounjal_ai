"use client";

import React, { useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

interface LoginScreenProps {
  onLogin: () => void;
}

const TERMS_TEXT = `제1조(목적)
이 약관은 오운잘 AI(이하 '회사'라고 합니다)가 제공하는 제반 서비스의 이용과 관련하여 회사와 이용자(이하 '회원'이라고 합니다)와의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조(정의)
본 약관에서 사용하는 주요 용어의 정의는 다음과 같습니다.
1. '서비스'라 함은 구현되는 단말기(PC, 휴대형단말기 등의 각종 유무선 장치를 포함)와 상관없이 '회원'이 이용할 수 있는 회사가 제공하는 제반 서비스를 의미합니다.
2. '회원'이란 이 약관에 따라 '서비스'에 접속하여 이 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.
3. '계정'이라 함은 회원의 식별과 서비스 이용을 위하여 회원이 외부 소셜 계정(Google 등)을 통해 인증하고 회사가 승인하는 고유 식별 정보를 의미합니다.
4. '콘텐츠'란 정보통신망법의 규정에 따라 정보통신망에서 사용되는 부호·문자·음성·음향·이미지 또는 영상 등으로 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 말합니다.
5. 'AI 운동 플랜'이라 함은 회사가 인공지능 기술을 활용하여 회원의 신체 상태, 운동 목표, 컨디션 등을 기반으로 자동 생성하는 맞춤형 운동 계획을 의미합니다.
6. '프리미엄 구독'이라 함은 회원이 월정액을 결제하여 서비스의 확장 기능을 이용할 수 있는 유료 이용권을 의미합니다.

제3조(약관 외 준칙)
이 약관에서 정하지 아니한 사항에 대해서는 법령 또는 회사가 정한 서비스의 개별약관, 운영정책 및 규칙 등(이하 세부지침)의 규정에 따릅니다. 또한 본 약관과 세부지침이 충돌할 경우에는 세부지침에 따릅니다.

제4조(약관의 효력과 변경)
1. 이 약관은 회사가 제공하는 서비스 화면에 게시하여 공시합니다. 회사는 관련 법령에 위배되지 않는 범위에서 이 약관을 변경할 수 있으며, 변경된 약관의 내용과 시행일을 정하여, 그 시행일로부터 최소 7일(이용자에게 불리하거나 중대한 사항의 변경은 30일) 이전부터 공지합니다.
2. 회원이 변경된 약관에 대해 거절의 의사를 표시하지 않았을 때에는 본 약관의 변경에 동의한 것으로 간주합니다.

제5조(이용계약의 체결)
이용자가 약관의 내용에 대하여 동의를 한 다음 Google 계정 등 외부 소셜 계정을 통한 인증으로 회원가입을 완료하고 회사가 이러한 신청에 대하여 승낙한 때 이용계약이 체결됩니다.

제6조(회원정보의 관리 및 보호)
1. 회원의 계정에 관한 관리책임은 회원에게 있으며, 이를 제3자가 이용하도록 하여서는 안 됩니다.
2. 회원은 계정이 도용되거나 제3자가 사용하고 있음을 인지한 경우에는 이를 즉시 회사에 통지하고 안내에 따라야 합니다.

제7조(회사의 의무)
회사는 계속적이고 안정적인 서비스의 제공을 위하여 설비에 장애가 생기거나 멸실된 때에는 이를 지체 없이 수리 또는 복구하며, 부득이한 경우 예고 없이 서비스의 전부 또는 일부의 제공을 일시 중지할 수 있습니다.

제8조(개인정보보호)
회사는 이용자들의 개인정보를 중요시하며, 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법 등 관련 법규를 준수하기 위해 노력합니다.

제9조(서비스의 제공)
회사가 제공하는 서비스의 내용은 다음과 같습니다.
가. AI 맞춤 운동 플랜 생성 서비스
나. 세션별 AI 운동 분석 리포트 서비스
다. 운동 히스토리 기록 및 관리 서비스
라. 체중 변화 추적 서비스
마. 컨디션 기반 적응형 운동 세션 서비스

제10조(유료 서비스 및 구독)
1. 무료 플랜은 AI 운동 플랜 생성 횟수가 3회로 제한됩니다.
2. 프리미엄 구독 시 AI 맞춤 운동 플랜 무제한 생성, 세션별 AI 분석 리포트, 체중 변화 그래프 추적, 운동 히스토리 무제한 저장 등 모든 기능을 이용할 수 있습니다.
3. 구독은 매월 자동 갱신되며, 언제든지 취소할 수 있습니다.
4. 결제 후 7일 이내, 프리미엄 기능을 사용하지 않은 경우에 한해 환불이 가능합니다.

제11조(AI 서비스 이용에 관한 특칙)
1. AI 운동 플랜 및 분석 리포트는 인공지능 기술을 기반으로 자동 생성되며, 전문 의료 또는 운동 처방을 대체하지 않습니다.
2. AI 생성 콘텐츠는 참고용이며, 회원은 본인의 건강 상태와 체력 수준을 고려하여 자율적으로 판단하여 운동해야 합니다.
3. 기존 질환이 있거나 운동에 제한이 있는 경우, 서비스 이용 전 반드시 의료 전문가와 상담할 것을 권장합니다.

제12조(면책사항)
1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 책임을 지지 않습니다.
2. 회사는 회원의 귀책사유로 인한 서비스 이용장애에 대하여 책임을 지지 않습니다.
3. 회사는 회원이 기대하는 운동 효과를 얻지 못한 것에 대하여 책임지지 않습니다.

제13조(권리의 귀속)
1. 회사가 제공하는 서비스에 대한 저작권 등 지식재산권은 회사에 귀속됩니다.
2. 회원이 직접 입력한 운동 기록, 체중 데이터 등 회원 고유의 데이터에 대한 권리는 회원에게 귀속됩니다.

제14조(서비스의 해지 및 탈퇴)
회원이 이용 계약을 해지하고자 할 때는 언제든지 서비스 내 회원 탈퇴 기능을 통해 이용계약 해지를 요청할 수 있습니다.

제15조(관할법원 및 준거법)
서비스와 관련하여 분쟁이 발생한 경우 관할법원은 회사 소재지 관할법원으로 정하며, 준거법은 대한민국의 법령을 적용합니다.

부칙
본 약관은 2026년 3월 1일부터 시행합니다.`;

const PRIVACY_TEXT = `제1조(목적)
오운잘 AI(이하 '회사'라고 함)는 회사가 제공하는 서비스(이하 '회사 서비스')를 이용하는 개인(이하 '이용자' 또는 '개인')의 정보(이하 '개인정보')를 보호하기 위해, 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률(이하 '정보통신망법') 등 관련 법령을 준수하고, 서비스 이용자의 개인정보 보호 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보처리방침(이하 '본 방침')을 수립합니다.

제2조(개인정보 처리의 원칙)
개인정보 관련 법령 및 본 방침에 따라 회사는 이용자의 개인정보를 수집할 수 있으며 수집된 개인정보는 개인의 동의가 있는 경우에 한해 제3자에게 제공될 수 있습니다. 단, 법령의 규정 등에 의해 적법하게 강제되는 경우 회사는 수집한 이용자의 개인정보를 사전에 개인의 동의 없이 제3자에게 제공할 수도 있습니다.

제3조(본 방침의 공개)
1. 회사는 이용자가 언제든지 쉽게 본 방침을 확인할 수 있도록 회사 서비스 화면을 통해 본 방침을 공개하고 있습니다.
2. 회사는 제1항에 따라 본 방침을 공개하는 경우 이용자가 본 방침을 쉽게 확인할 수 있도록 합니다.

제4조(본 방침의 변경)
1. 본 방침은 개인정보 관련 법령, 지침, 고시 또는 정부나 회사 서비스의 정책이나 내용의 변경에 따라 개정될 수 있습니다.
2. 회사는 제1항에 따라 본 방침을 개정하는 경우 서비스 내 공지사항 또는 전자우편 등의 방법으로 공지합니다.
3. 회사는 제2항의 공지는 본 방침 개정의 시행일로부터 최소 7일 이전에 공지합니다. 다만, 이용자 권리의 중요한 변경이 있을 경우에는 최소 30일 전에 공지합니다.

제5조(수집하는 개인정보의 항목 및 이용목적)
회사는 회원가입, 원활한 서비스 제공을 위해 다음과 같은 개인정보를 수집하고 있으며, 각각의 목적을 위해서만 이용합니다.

[필수] Google 계정 정보(이름, 이메일 주소, 프로필 사진)
- 목적: 회원 식별, 서비스 이용 계약 이행, 본인 확인

[필수] 운동 기록(운동 플랜, 세션 기록, 세트/반복 수, 운동 피드백)
- 목적: AI 맞춤 운동 플랜 생성, 운동 분석 리포트 제공, 운동 히스토리 관리

[필수] 신체 정보(체중, 컨디션 상태, 운동 목표)
- 목적: AI 맞춤 운동 플랜 생성, 체중 변화 추적, 컨디션 기반 운동 조정

[선택] 결제 정보(구독 상태, 결제일, 카카오페이 거래 정보)
- 목적: 프리미엄 구독 관리, 결제 처리 및 환불

[자동 수집] 서비스 이용기록, 접속 로그, 기기 정보
- 목적: 부정 이용 방지, 서비스 품질 개선

제6조(개인정보의 보유·이용기간 및 파기)
1. 회사는 법령에 따른 개인정보 보유·이용기간 또는 이용자로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
2. 회원 가입 및 관리 정보는 회원 탈퇴 시까지 보유합니다. 다만, 다음의 사유에 해당하는 경우에는 해당 사유 종료 시까지 보유합니다.
- 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우, 해당 수사·조사 종료 시까지
- 서비스 이용에 따른 채권·채무관계가 잔존하는 경우, 해당 정산 완료 시까지
3. 서비스 제공 관련 정보는 '전자상거래 등에서의 소비자 보호에 관한 법률'에 따라 다음의 기간 동안 보존합니다.
- 계약 또는 청약철회 등에 관한 기록: 3년
- 대금결제 및 재화 등의 공급에 관한 기록: 3년
- 소비자의 불만 또는 분쟁처리에 관한 기록: 3년
4. 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
5. 파기절차: 파기 사유가 발생한 개인정보를 선정하고, 회사의 개인정보 보호책임자의 승인을 받아 파기합니다.
6. 파기방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하며, 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각을 통하여 파기합니다.

제7조(개인정보 처리의 위탁)
1. 회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.

수탁업체: Google LLC (Firebase Authentication, Cloud Firestore, Firebase Hosting)
위탁업무: 회원 인증, 클라우드 데이터베이스 운영, 서비스 호스팅
보유기간: 회원 탈퇴 시 혹은 위탁 계약 종료 시까지

수탁업체: Google LLC (Gemini AI)
위탁업무: AI 운동 플랜 생성 및 운동 분석 리포트 처리
보유기간: 처리 완료 즉시 파기

수탁업체: 카카오페이 주식회사
위탁업무: 프리미엄 구독 결제 처리
보유기간: 관련 법령에 따른 보존기간까지

2. 회사는 위탁계약 체결 시 개인정보보호법 제26조에 따라 위탁업무 수행목적 외 개인정보 처리금지, 기술적·관리적 보호조치, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 명시하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독하고 있습니다.

제8조(개인정보 수집 방법)
회사는 다음과 같은 방법으로 이용자의 개인정보를 수집합니다.
1. Google 소셜 로그인을 통한 회원가입 시 자동 수집
2. 서비스 이용 과정에서 이용자가 직접 입력하는 방식(체중, 운동 목표, 컨디션 등)
3. 서비스 이용 과정에서 서비스 이용기록, 기기 정보 등이 자동으로 생성 및 수집되는 방식

제9조(개인정보의 이용)
회사는 개인정보를 다음 각 호의 경우에 이용합니다.
1. 공지사항의 전달 등 회사의 운영에 필요한 경우
2. 이용문의에 대한 회신, 불만의 처리 등 이용자에 대한 서비스 개선을 위한 경우
3. AI 맞춤 운동 플랜 생성 및 운동 분석 리포트 제공을 위한 경우
4. 운동 히스토리 관리 및 체중 변화 추적 서비스 제공을 위한 경우
5. 프리미엄 구독 결제 및 관리를 위한 경우
6. 신규 서비스 개발 및 통계 분석을 위한 경우
7. 법령 및 회사 약관을 위반하는 회원에 대한 이용 제한 조치, 부정 이용 방지를 위한 경우

제10조(이용자의 의무)
1. 이용자는 자신의 개인정보를 최신의 상태로 유지해야 하며, 이용자의 부정확한 정보 입력으로 발생하는 문제의 책임은 이용자 자신에게 있습니다.
2. 타인의 개인정보를 도용한 회원가입의 경우 이용자 자격을 상실하거나 관련 개인정보보호 법령에 의해 처벌받을 수 있습니다.
3. 이용자는 개인정보에 대해 충분히 인식하고 관련 법률의 규정을 준수하여 타인의 개인정보를 침해하지 않도록 유의해야 합니다.

제11조(회사의 개인정보 보호 책임자 지정)
회사는 이용자의 개인정보를 보호하고 개인정보와 관련한 불만을 처리하기 위하여 아래와 같이 개인정보 보호 책임자를 지정하고 있습니다.

개인정보 보호 책임자
- 성명: 임주용
- 전화번호: 010-4042-2820
- 이메일: ounjal.ai.app@gmail.com

부칙
본 방침은 2026년 3월 1일부터 시행합니다.`;

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const preventCopy = {
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    onCut: (e: React.ClipboardEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "a" || e.key === "x" || e.key === "p")) {
        e.preventDefault();
      }
    },
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged in page.tsx will handle the rest
      onLogin();
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        // User closed the popup, not an error
        setError(null);
      } else {
        console.error("Login failed:", err);
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in relative overflow-y-auto scrollbar-hide">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-gray-50" />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-2 pt-2 text-center gap-12">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-[280px] sm:w-[360px] flex items-center justify-center">
            <img
              src="/login-logo-kor2.png"
              alt="Ohunjal AI"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Description */}
        <p className="text-[#1B4332] leading-relaxed text-sm max-w-[240px]">
          당신의 컨디션과 목표에 맞춰<br />
          AI 코치가 맞춤식으로 운동을 지도합니다.
        </p>

        {/* Action Area */}
        <div className="w-full flex flex-col gap-4 mt-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl bg-[#1B4332] border border-[#143728] flex items-center justify-center gap-3 shadow-[0_4px_16px_rgba(27,67,50,0.35),0_2px_6px_rgba(27,67,50,0.25)] hover:shadow-[0_8px_28px_rgba(27,67,50,0.45),0_4px_10px_rgba(27,67,50,0.30)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_8px_rgba(45,106,79,0.15)] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                <img
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google"
                  className="w-4 h-4"
                />
              </div>
            )}
            <span className="font-bold text-white">
              {isLoading ? "로그인 중..." : "Google로 계속하기"}
            </span>
          </button>

          {error && (
            <p className="text-xs text-red-500 font-medium text-center">{error}</p>
          )}

          <p className="text-[10px] text-gray-400 font-medium text-center tracking-widest">
            로그인 시 <button type="button" onClick={() => setShowTerms(true)} className="underline text-gray-500 hover:text-gray-700 transition-colors">이용약관</button> 및 <button type="button" onClick={() => setShowPrivacy(true)} className="underline text-gray-500 hover:text-gray-700 transition-colors">개인정보 처리방침</button>에 동의합니다
          </p>
        </div>
      </div>

      {/* Footer Spacer */}
      <div className="h-8 shrink-0" />

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl mx-4 max-w-[360px] w-full max-h-[80vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()} {...preventCopy}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">이용약관</h2>
              <button type="button" onClick={() => setShowTerms(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans select-none">{TERMS_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowTerms(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-2xl mx-4 max-w-[360px] w-full max-h-[80vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()} {...preventCopy}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">개인정보 처리방침</h2>
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans select-none">{PRIVACY_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
