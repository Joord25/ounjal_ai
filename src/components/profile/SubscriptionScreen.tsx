"use client";

import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { trackEvent } from "@/utils/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { detectPersona } from "@/utils/personaSystem";
import { getCachedWorkoutHistory } from "@/utils/workoutHistory";
import { getPaddle, getPaddleMonthlyPriceId } from "@/utils/paddle";

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

interface SubscriptionScreenProps {
  user: User;
  onClose: () => void;
  initialStatus?: "free" | "active" | "cancelled";
  /** 회의 30: 취소 플로우 진입/이탈 알림 — 부모가 탭바 숨김/표시 결정 */
  onCancelFlowChange?: (active: boolean) => void;
}

const FUNCTIONS_BASE = "/api";

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

// FAQ keys — actual text loaded via t() at render time
const FAQ_KEYS = [
  { qKey: "sub.faq.q1", aKey: "sub.faq.a1" },
  { qKey: "sub.faq.q2", aKey: "sub.faq.a2" },
  { qKey: "sub.faq.q3", aKey: "sub.faq.a3" },
  { qKey: "sub.faq.q4", aKey: "sub.faq.a4" },
  { qKey: "sub.faq.q5", aKey: null, key: "refund" },
  { qKey: "sub.faq.q6", aKey: "sub.faq.a6" },
];

export const TERMS_TEXT = `제1조(목적)
이 약관은 오운잘 AI(이하 '회사'라고 합니다)가 제공하는 제반 서비스의 이용과 관련하여 회사와 이용자(이하 '회원'이라고 합니다)와의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조(정의)
본 약관에서 사용하는 주요 용어의 정의는 다음과 같습니다.

'서비스'라 함은 구현되는 단말기(PC, 휴대형단말기 등의 각종 유무선 장치를 포함)와 상관없이 '회원'이 이용할 수 있는 회사가 제공하는 제반 서비스를 의미합니다.

'회원'이란 이 약관에 따라 '서비스'에 접속하여 이 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.

'계정'이라 함은 회원의 식별과 서비스 이용을 위하여 회원이 외부 소셜 계정(Google 등)을 통해 인증하고 회사가 승인하는 고유 식별 정보를 의미합니다.

'콘텐츠'란 정보통신망법의 규정에 따라 정보통신망에서 사용되는 부호·문자·음성·음향·이미지 또는 영상 등으로 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 말합니다.

'AI 운동 플랜'이라 함은 회사가 인공지능 기술을 활용하여 회원의 신체 상태, 운동 목표, 컨디션 등을 기반으로 자동 생성하는 맞춤형 운동 계획을 의미합니다.

'로그 및 입력 데이터'란 회원이 서비스를 이용하는 과정에서 자발적으로 입력하는 신체 정보, 운동 기록, 프롬프트(명령어), 챗봇 대화 히스토리 및 시스템이 자동으로 생성하는 이용 기록을 의미합니다.

'프리미엄 구독'이라 함은 회원이 월정액을 결제하여 서비스의 확장 기능을 이용할 수 있는 유료 이용권을 의미합니다.

제3조(약관 외 준칙)
이 약관에서 정하지 아니한 사항에 대해서는 법령 또는 회사가 정한 서비스의 개별약관, 운영정책 및 규칙 등(이하 세부지침)의 규정에 따릅니다. 또한 본 약관과 세부지침이 충돌할 경우에는 세부지침에 따릅니다.

제4조(약관의 효력과 변경)

이 약관은 회사가 제공하는 서비스 화면에 게시하여 공시합니다. 회사는 관련 법령에 위배되지 않는 범위에서 이 약관을 변경할 수 있으며, 변경된 약관의 내용과 시행일을 정하여, 그 시행일로부터 최소 7일(이용자에게 불리하거나 중대한 사항의 변경은 30일) 이전부터 공지합니다.

회원이 변경된 약관에 대해 거절의 의사를 표시하지 않았을 때에는 본 약관의 변경에 동의한 것으로 간주합니다.

제5조(이용계약의 체결)

이용자가 약관의 내용에 대하여 동의를 한 다음 Google 계정 등 외부 소셜 계정을 통한 인증으로 회원가입을 완료하고 회사가 이러한 신청에 대하여 승낙한 때 이용계약이 체결됩니다.

본 서비스는 만 14세 이상 이용자를 대상으로 합니다. 만 14세 미만의 이용자는 법정대리인의 동의 없이 서비스를 이용할 수 없습니다.

회사는 다음 각 호에 해당하는 경우 이용계약의 승낙을 거부하거나 유보할 수 있습니다.
가. 타인의 명의를 사용하거나 허위 정보를 기재한 경우
나. 이전에 약관 위반으로 이용계약이 해지된 이력이 있는 경우
다. 기타 합리적인 사유로 승낙이 부적절하다고 판단되는 경우

제6조(회원정보의 관리 및 보호, 회원의 의무)

회원의 계정에 관한 관리책임은 회원에게 있으며, 이를 제3자가 이용하도록 하여서는 안 됩니다.

회원은 계정이 도용되거나 제3자가 사용하고 있음을 인지한 경우에는 이를 즉시 회사에 통지하고 안내에 따라야 합니다.

회원은 다음 각 호의 행위를 하여서는 안 됩니다.
가. 타인의 명의 또는 계정을 도용하여 서비스를 이용하는 행위
나. 허위의 신체 정보(체중, 키, 연령 등)를 입력하여 AI 분석 결과를 조작하는 행위
다. 서비스를 무단으로 복제, 크롤링, 역설계하거나 상업적 목적으로 재배포하는 행위
라. 자동화된 수단(봇, 스크립트 등)을 이용하여 서비스에 접근하는 행위
마. 무료 이용 제한을 우회하거나 부정한 방법으로 프리미엄 기능을 이용하는 행위
바. 서비스의 정상적인 운영을 방해하거나 시스템에 과부하를 주는 행위
사. 기타 관련 법령 또는 공공질서에 위반되는 행위

회원이 입력하는 데이터에 대한 정확성과 적법성의 책임은 회원 본인에게 있습니다.

제7조(회사의 의무)
회사는 계속적이고 안정적인 서비스의 제공을 위하여 설비에 장애가 생기거나 멸실된 때에는 이를 지체 없이 수리 또는 복구하며, 부득이한 경우 예고 없이 서비스의 전부 또는 일부의 제공을 일시 중지할 수 있습니다.

제8조(개인정보보호 및 외부 AI 연동)

회사는 이용자들의 개인정보를 중요시하며, 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법 등 관련 법규를 준수하기 위해 노력합니다. 구체적인 사항은 [개인정보 처리방침]에 따릅니다.

회사는 고도화된 AI 맞춤 운동 플랜 생성을 위해 외부 인공지능 모델(예: Google Gemini 등)의 API를 연동하여 사용할 수 있습니다. 이 과정에서 회원의 입력 데이터가 익명화 처리되어 외부 모델로 전송될 수 있으며, 해당 데이터 처리는 외부 제공사의 개인정보 처리방침을 준용합니다.

제9조(서비스의 제공)
회사가 제공하는 서비스의 내용은 다음과 같습니다.
가. AI 맞춤 운동 플랜 생성 서비스
나. 세션별 AI 운동 분석 리포트 서비스
다. 운동 히스토리 기록 및 관리 서비스
라. 체중 변화 추적 서비스
마. 컨디션 기반 적응형 운동 세션 서비스
바. AI 성장 예측 서비스(추정 1RM 회귀분석, 칼로리 밸런스 분석, 체중/근력 변화 예측)
사. 기초체력 측정 및 등급 평가 서비스

제10조(유료 서비스 및 구독)

무료 플랜은 AI 운동 플랜 생성 횟수가 2회, AI 채팅이 3회로 제한됩니다.

프리미엄 구독 시 AI 맞춤 운동 플랜 무제한 생성, 세션별 AI 분석 리포트, 체중 변화 그래프 추적, 운동 히스토리 무제한 저장 등 모든 기능을 이용할 수 있습니다.

구독은 매월 자동 갱신되며, 언제든지 취소할 수 있습니다.

결제 후 7일 이내, 프리미엄 기능을 사용하지 않은 경우에 한해 환불이 가능합니다.

제11조(AI 서비스 이용에 관한 특칙 및 주의사항)

AI 운동 플랜 및 분석 리포트는 인공지능 기술을 기반으로 자동 생성되며, 전문 의료진 또는 공인된 전문 트레이너의 직접적인 운동 처방을 대체하지 않습니다.

AI의 특성상 생성된 콘텐츠(운동 루틴, 자세 교언 등)가 항상 100% 정확하거나 완전하지 않을 수 있습니다. AI 생성 콘텐츠는 전적으로 참고용이며, 회원은 본인의 건강 상태와 체력 수준을 고려하여 자율적으로 판단하여 운동해야 합니다.

본 서비스는 의료기기가 아니며, 질병의 진단·치료·예방을 목적으로 하지 않습니다. 기존 질환이 있거나 운동에 제한이 있는 경우, 서비스 이용 전 반드시 의료 전문가와 상담하여야 합니다. 이를 이행하지 않아 발생한 건강상의 문제에 대해 회사는 책임을 지지 않습니다.

제12조(면책사항)

회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 책임을 지지 않습니다.

회사는 회원의 귀책사유로 인한 서비스 이용장애에 대하여 책임을 지지 않습니다.

회사는 회원이 기대하는 운동 효과를 얻지 못한 것에 대하여 책임지지 않습니다.

회사는 AI 모델이 제공한 결과물(운동 플랜, 성장 예측, 칼로리 분석, 체중 변화 예측, 기초대사량 추정, 추정 1RM, 근력 등급 평가 등)의 오류나 부정확성으로 인해 발생한 부상이나 손해에 대하여 법적 책임을 지지 않습니다. 특히 다음의 경우 회사의 책임이 면제됩니다.

가. 칼로리 밸런스 분석은 섭취 칼로리를 통계적 가정값으로 설정하여 계산하므로 실제 식단과 차이가 발생할 수 있으며, 이에 따른 감량 예측의 오차에 대해 회사는 책임을 지지 않습니다.

나. 추정 1RM 및 성장 예측은 통계적 회귀분석에 기반한 추정치이며, 데이터 부족 시 정확도가 낮을 수 있습니다. 이를 근거로 한 과도한 중량 시도로 인한 부상에 대해 회사는 책임을 지지 않습니다.

다. 기초체력 등급 평가는 자체 기준표에 의한 참고용 지표이며, 공인된 의학적 체력 검사를 대체하지 않습니다.

라. 회원이 자신의 신체 상태를 과대평가하여 무리하게 운동을 진행함으로 인해 발생한 직·간접적인 손해에 대하여 회사는 법적 책임을 지지 않습니다.

회사는 외부 AI 모델(Third-party) 측의 장애나 정책 변경으로 인해 서비스가 제한되는 경우, 이에 대한 책임을 지지 않습니다.

회사는 기술적·관리적 보호조치를 다하더라도 해킹, DDoS 등 외부 공격, 천재지변, 이용자의 부주의 등 회사의 귀책사유가 아닌 사유로 발생한 개인정보 유출 및 손해에 대해서는 관련 법령이 허용하는 범위 내에서 책임이 제한될 수 있습니다.

제13조(권리의 귀속 및 이용제한)

회사가 제공하는 서비스에 대한 저작권 등 지식재산권은 회사에 귀속됩니다.

회원이 직접 입력한 운동 기록, 체중 데이터 등 회원 고유의 데이터에 대한 원 권리는 회원에게 귀속됩니다.

단, 회사는 회원이 입력한 데이터를 비식별화(익명화)하여 오운잘 AI 서비스의 성능 향상, 신규 기능 개발 및 AI 모델 학습을 위한 통계 자료 등으로 무상 활용할 수 있습니다.

제14조(서비스 이용 제한 및 계정 정지)

회사는 회원이 본 약관 또는 관련 법령을 위반하거나, 서비스 운영을 고의 또는 과실로 방해하는 경우 사전 통지 후(긴급한 경우 사후 통지) 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.

회사는 서비스의 전부 또는 일부를 업무상·기술상 필요에 따라 수정, 변경 또는 중단할 수 있으며, 이 경우 사전에 서비스 내 공지합니다.

제15조(서비스의 해지 및 탈퇴)
회원이 이용 계약을 해지하고자 할 때는 언제든지 서비스 내 회원 탈퇴 기능을 통해 이용계약 해지를 요청할 수 있습니다. 탈퇴 시 회원의 개인정보는 개인정보 처리방침에 따라 처리되며, 관련 법령에 따른 보관 기간이 경과한 후 지체 없이 파기합니다.

제16조(관할법원 및 준거법)
서비스와 관련하여 분쟁이 발생한 경우 관할법원은 회사 소재지 관할법원으로 정하며, 준거법은 대한민국의 법령을 적용합니다. 회사와 회원 간의 분쟁은 한국소비자원 소비자분쟁조정위원회에 조정을 신청할 수 있습니다.

제17조(분리조항)
본 약관의 일부 조항이 관계 법령에 따라 무효이거나 집행 불가능한 경우에도, 나머지 조항의 효력에는 영향을 미치지 않습니다.

부칙
본 약관은 2026년 3월 1일부터 시행합니다.`;

export const PRIVACY_TEXT = `제1조(목적)
오운잘 AI(이하 '회사'라고 함)는 회사가 제공하는 서비스(이하 '회사 서비스')를 이용하는 개인(이하 '이용자' 또는 '개인')의 정보(이하 '개인정보')를 보호하기 위해, 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률(이하 '정보통신망법') 등 관련 법령을 준수하고, 서비스 이용자의 개인정보 보호 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보처리방침(이하 '본 방침')을 수립합니다.

제2조(개인정보 처리의 원칙)
개인정보 관련 법령 및 본 방침에 따라 회사는 이용자의 개인정보를 수집할 수 있으며 수집된 개인정보는 개인의 동의가 있는 경우에 한해 제3자에게 제공될 수 있습니다. 단, 법령의 규정 등에 의해 적법하게 강제되는 경우 회사는 수집한 이용자의 개인정보를 사전에 개인의 동의 없이 제3자에게 제공할 수도 있습니다.

제3조(본 방침의 공개 및 변경)

회사는 이용자가 언제든지 쉽게 본 방침을 확인할 수 있도록 서비스 초기 화면 또는 연결 화면을 통해 공개합니다.

본 방침은 관련 법령이나 회사의 정책 변경에 따라 개정될 수 있으며, 개정 시 시행일 최소 7일 전(이용자 권리의 중요한 변경은 최소 30일 전)에 서비스 내 공지사항 등을 통해 안내합니다.

제4조(수집하는 개인정보의 항목 및 수집 방법)
회사는 원활한 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.

수집 항목

[필수] Google 계정 정보(이름, 이메일 주소, 프로필 사진)

[필수] 운동 기록(운동 플랜, 세션 기록, 세트/반복 수, 프롬프트 입력 등 운동 피드백)

[필수] 신체 정보(성별, 출생연도, 키, 체중, 컨디션 상태, 운동 목표)

[선택] 프로필 사진(이용자가 직접 업로드한 사진, Firebase Storage에 저장)

[선택] 결제 정보(구독 상태, 결제일, 결제 수단 정보)

[자동 생성] 건강 파생 지표(기초대사량(BMR), 칼로리 밸런스, 추정 1RM, 운동 강도 분류, 성장 예측 등) — 이용자가 입력한 신체 정보 및 운동 기록을 기반으로 자동 계산되며, AI 맞춤 서비스 제공 목적으로만 활용됩니다.

[자동 수집] 서비스 이용기록, 접속 로그, IP 주소, 쿠키(Cookie), 기기 정보

수집 방법

Google 소셜 로그인을 통한 자동 수집

서비스 이용 과정에서 이용자가 직접 입력(체중, 컨디션, 피드백 등)

서비스 실행 및 이용 과정에서 시스템을 통한 자동 수집

제5조(개인정보의 이용 목적)
회사는 수집한 개인정보를 다음의 목적을 위해서만 이용합니다.

회원 식별, 서비스 가입 및 의사 확인, 고객 문의 응대

AI 맞춤 운동 플랜 생성, 세션별 운동 분석 리포트 제공

운동 히스토리 관리 및 체중 변화 추적 서비스 제공

프리미엄 구독 자동 결제 처리 및 환불, 구독 관리

서비스 이용 기록 분석을 통한 AI 모델 성능 향상 및 신규 맞춤형 서비스 개발

부정 이용 방지 및 법령이나 약관 위반에 대한 조치

제6조(개인정보의 보유·이용기간 및 파기)

회사는 원칙적으로 개인정보 처리 목적이 달성된 후에는 지체 없이 해당 정보를 파기합니다. 단, 관계 법령에 따라 일정 기간 보존해야 하는 경우 해당 기간 동안 안전하게 보관합니다.

계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)

대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)

소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)

서비스 접속 및 이용기록: 3개월 (통신비밀보호법)

단, 위 법정 보관 기간 동안의 정보는 개인정보보호법 제21조 제2항에 따라 이름·이메일 등 이용자를 식별할 수 있는 정보와 분리하여 저장·관리하며, 세무조사·환불·분쟁해결·법집행 등 법령에서 정한 목적 외에는 이용하지 않습니다.

파기 절차 및 방법: 전자적 파일 형태의 정보는 복구 및 재생할 수 없는 기술적 방법을 사용하여 영구 삭제하며, 종이 문서는 분쇄기로 분쇄하거나 소각합니다.

제7조(개인정보 처리의 위탁)
회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있으며, 관계 법령에 따라 수탁자가 개인정보를 안전하게 처리하도록 관리·감독하고 있습니다.

Google LLC: 클라우드 데이터베이스 운영(Firestore), 서비스 호스팅(Firebase) / 회원 탈퇴 또는 계약 종료 시까지

Google LLC: 맞춤형 운동 플랜 및 리포트 생성을 위한 AI 연동(Gemini API) / 처리 완료 후 지체 없이 파기 (별도 학습에 사용되지 않도록 조치)

PortOne(포트원) / 카카오페이 주식회사 등: 프리미엄 구독 결제 처리 / 전송 데이터: 사용자 식별자(UID), 이메일, 표시 이름, 빌링키 / 법정 보유기간까지

제8조(AI 모델 연동 및 책임의 한계)

회사는 정교한 운동 플랜을 제공하기 위해 Google의 Gemini 등 외부 AI 모델을 활용합니다. 이 과정에서 이용자가 입력한 정보(신체 데이터, 피드백 등)가 AI 서버로 전송될 수 있습니다.

회사가 제공하는 AI 결과물(운동 플랜, 성장 예측, 칼로리 분석, 체중 변화 예측, 기초대사량 추정 등)은 통계적 추정치로서 전문가의 의료적 진단이나 직접적인 처방을 대신할 수 없으며, 100%의 정확성을 보장하지 않습니다. 특히 칼로리 밸런스 분석은 섭취 칼로리를 가정값으로 설정하여 계산하므로 실제와 차이가 있을 수 있습니다. 이를 활용함에 따른 최종적인 의사결정 및 신체적 결과에 대한 책임은 이용자 본인에게 있습니다.

회사는 이용자의 신체 정보(성별, 연령, 키, 체중)를 기반으로 해리스-베네딕트 공식에 의한 기초대사량(BMR), MET 기반 운동 칼로리 소모량, Brzycki/Epley/Lombardi 공식에 의한 추정 1RM 등 건강 관련 파생 지표를 자동 계산합니다. 이러한 파생 지표는 맞춤 서비스 제공 목적으로만 사용되며, 의학적 진단 목적으로 사용되지 않습니다.

제9조(이용자 및 법정대리인의 권리와 그 행사 방법)

이용자는 언제든지 등록되어 있는 자신의 개인정보를 열람하거나 수정할 수 있으며, 서비스 내 '회원 탈퇴' 기능을 통해 가입 해지(개인정보 삭제)를 요청할 수 있습니다.

전항의 권리 행사는 서비스 내 설정 메뉴를 이용하거나, 개인정보 보호책임자에게 서면, 전화 또는 이메일로 연락하여 하실 수 있으며 회사는 지체 없이 조치하겠습니다.

이용자가 개인정보의 오류에 대한 정정을 요청하신 경우, 정정을 완료하기 전까지 당해 개인정보를 이용 또는 제공하지 않습니다.

제10조(개인정보의 안전성 확보 조치)
회사는 이용자의 개인정보가 분실, 도난, 유출, 위조 또는 변조되지 않도록 다음과 같은 조치를 취하고 있습니다.

기술적 조치: 개인정보 통신 구간의 암호화(SSL), 주요 데이터의 암호화 저장, 해킹 등에 대비한 보안 시스템 운영

관리적 조치: 개인정보 취급 직원의 최소화 및 정기적인 보안 교육 실시, 내부 관리계획 수립 및 시행

제11조(쿠키(Cookie)의 설치, 운영 및 거부)

회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용 정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.

이용자는 웹 브라우저의 옵션을 설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 모든 쿠키의 저장을 거부할 수 있습니다. 단, 쿠키 저장을 거부할 경우 맞춤형 운동 서비스 이용에 어려움이 있을 수 있습니다.

제12조(회사의 개인정보 보호 책임자)
회사는 이용자의 개인정보를 보호하고 관련 불만을 처리하기 위하여 아래와 같이 책임자를 지정하고 있습니다.

성명: 임주용

연락처: 010-4824-2869

이메일: ounjal.ai.app@gmail.com

부칙
본 방침은 2026년 3월 1일부터 시행합니다.`;

export const REFUND_TEXT = `제1조(목적)
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

환불이 승인되면 원래 결제 수단으로 환불이 진행됩니다 (카카오페이 기준 3~5 영업일 소요).

제6조(부분 환불)

월 구독의 경우 부분 환불(일할 계산)은 제공하지 않습니다.

환불은 전액 환불 또는 환불 불가 중 하나로 처리됩니다.

제7조(환불 문의)

이메일: ounjal.ai.app@gmail.com

전화: 010-4824-2869

부칙
본 환불정책은 2026년 3월 1일부터 시행합니다.`;

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ user, onClose, initialStatus, onCancelFlowChange }) => {
  const { t, locale } = useTranslation();
  const [status, setStatus] = useState<"loading" | "free" | "active" | "cancelled">(initialStatus || "loading");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubDetail, setShowSubDetail] = useState(false);
  const [payments, setPayments] = useState<Array<{ paymentId: string; amount: number; plan: string; status: string; paidAt: string; periodStart: string; periodEnd: string }>>([]);
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=reason, 2=confirm

  // 회의 30: 취소 플로우 활성화 시 부모(page.tsx)에 알려서 탭바 숨김
  useEffect(() => {
    onCancelFlowChange?.(cancelStep > 0);
  }, [cancelStep, onCancelFlowChange]);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmCountdown, setConfirmCountdown] = useState(5);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundStep, setRefundStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=form, 2=submitted
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Handle redirect response from mobile KakaoPay (REDIRECTION mode)
  const processRedirectBillingKey = async (billingKey: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const token = await getIdToken();
      const serverRes = await fetch(`${FUNCTIONS_BASE}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ billingKey }),
      });
      if (!serverRes.ok) {
        const err = await serverRes.json().catch(() => ({}));
        throw new Error(err.error || t("sub.error.failed"));
      }
      const data = await serverRes.json().catch(() => ({} as { paymentId?: string; amount?: number; plan?: string; currency?: string }));
      trackEvent("purchase", {
        transaction_id: data.paymentId || "",
        value: data.amount || 6900,
        currency: data.currency || "KRW",
        plan: data.plan || "monthly",
        payment_method: "kakaopay",
      });
      sessionStorage.removeItem("portone_billing_processed");
      setStatus("active");
      await checkSubscription();
    } catch (err) {
      sessionStorage.removeItem("portone_billing_processed");
      console.error("[Subscribe redirect]", err);
      setError(t("sub.error.generic"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Always fetch full subscription details (initialStatus only sets initial UI state)
  useEffect(() => {
    checkSubscription();
    // Lazy-load PortOne SDK
    if (!window.PortOne && !document.querySelector('script[src*="portone"]')) {
      const s = document.createElement("script");
      s.src = "https://cdn.portone.io/v2/browser-sdk.js";
      s.async = true;
      document.head.appendChild(s);
    }
    // Check for billing key from redirect (mobile REDIRECTION mode)
    const params = new URLSearchParams(window.location.search);
    const billingKey = params.get("billing_key") || params.get("billingKey");
    if (billingKey && !sessionStorage.getItem("portone_billing_processed")) {
      // Clean up URL params + prevent duplicate processing
      window.history.replaceState({}, "", window.location.pathname);
      sessionStorage.setItem("portone_billing_processed", "1");
      processRedirectBillingKey(billingKey);
    } else if (billingKey) {
      window.history.replaceState({}, "", window.location.pathname);
    }
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
        setAmount(data.amount || null);
        setPayments(data.payments || []);
      } else {
        setStatus("free");
      }
    } catch {
      setStatus("free");
    }
  };

  const handlePaddleSubscribe = async () => {
    const priceId = getPaddleMonthlyPriceId();
    if (!priceId) {
      setError(t("sub.error.generic"));
      console.error("[Paddle] Price ID missing (NEXT_PUBLIC_PADDLE_PRICE_MONTHLY)");
      return;
    }

    setIsProcessing(true);
    setError(null);
    trackEvent("paywall_tap_subscribe", { plan: "monthly", value: 4.99, currency: "USD" });

    try {
      const paddle = await getPaddle();
      if (!paddle) {
        setError(t("sub.error.loading"));
        return;
      }

      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: user.email || "" },
        customData: { firebaseUid: user.uid },
        settings: {
          displayMode: "overlay",
          theme: "light",
          locale: "en",
          successUrl: `${window.location.origin}/app?paddle_success=1`,
        },
      });
    } catch (err) {
      console.error("[Paddle Subscribe]", err);
      setError(t("sub.error.generic"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    if (status === "active") return;
    if (isProcessing) return;

    // Locale-based routing: non-Korean → Paddle (international), Korean → PortOne
    if (locale !== "ko") {
      return handlePaddleSubscribe();
    }

    if (!window.PortOne) {
      setError(t("sub.error.loading"));
      return;
    }

    trackEvent("paywall_tap_subscribe", { plan: "monthly", value: 6900, currency: "KRW" });
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Issue billing key via PortOne SDK
      const response = await window.PortOne.requestIssueBillingKey({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "",
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "",
        billingKeyMethod: "EASY_PAY",
        issueName: "오운잘 AI 월간 구독",
        redirectUrl: `${window.location.origin}/app`,
        windowType: { pc: "IFRAME", mobile: "REDIRECTION" },
        customer: {
          customerId: user.uid,
          email: user.email || undefined,
          fullName: user.displayName || undefined,
        },
      });

      if (response.code) {
        // User cancelled or error
        if (response.code === "FAILURE_TYPE_PG") {
          setError(t("sub.error.cancelled"));
        } else {
          setError(t("sub.error.generic"));
          console.error("[PortOne]", response.code, response.message);
        }
        return;
      }

      if (!response.billingKey) {
        setError(t("sub.error.generic"));
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
        throw new Error(err.error || t("sub.error.failed"));
      }

      // Success
      const data = await serverRes.json().catch(() => ({} as { paymentId?: string; amount?: number; plan?: string; currency?: string }));
      trackEvent("purchase", {
        transaction_id: data.paymentId || "",
        value: data.amount || 6900,
        currency: data.currency || "KRW",
        plan: data.plan || "monthly",
        payment_method: "kakaopay",
      });
      setStatus("active");
      await checkSubscription();
    } catch (err) {
      console.error("[Subscribe]", err);
      setError(t("sub.error.generic"));
    } finally {
      setIsProcessing(false);
    }
  };

  const CANCEL_REASONS = [
    t("sub.cancel.reason.price"),
    t("sub.cancel.reason.feature"),
    t("sub.cancel.reason.other"),
    t("sub.cancel.reason.rest"),
    t("sub.cancel.reason.etc"),
  ];

  const openCancelFlow = () => {
    setRefundStep(0); // 환불 폼과 상호 배제
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
      const res = await fetch(`${FUNCTIONS_BASE}/cancelSubscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason === t("sub.cancel.reason.etc") && cancelReasonText.trim() ? `${cancelReason}: ${cancelReasonText.trim()}` : cancelReason }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("sub.error.failed"));
      }

      setCancelStep(0);
      setStatus("cancelled");
      await checkSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sub.error.generic"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!refundReason.trim()) return;
    setRefundSubmitting(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/submitRefundRequest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: refundReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("sub.refundRequest.errorGeneric"));
      }
      setRefundStep(2);
      setStatus("cancelled");
      await checkSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sub.refundRequest.errorGeneric"));
    } finally {
      setRefundSubmitting(false);
    }
  };

  if (showSubDetail) {
    const formatDate = (iso: string | null) => {
      if (!iso) return "-";
      try { return new Date(iso).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long", day: "numeric" }); }
      catch { return iso; }
    };

    return (
      <div className="flex flex-col h-full bg-[#FAFBF9] animate-fade-in relative overflow-hidden">
        <div className="pt-[max(3rem,env(safe-area-inset-top))] pb-3 sm:pb-4 px-4 sm:px-6 flex items-center justify-between bg-[#FAFBF9] z-10 shrink-0">
          <button onClick={() => setShowSubDetail(false)} className="p-2 -ml-2">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg sm:text-xl font-serif font-medium text-[#1B4332] uppercase tracking-wide">{t("sub.history.title")}</h1>
          <div className="w-10" />
        </div>

        <div className="flex-1 px-4 sm:px-6 overflow-y-auto scrollbar-hide" style={{ paddingBottom: "calc(128px + var(--safe-area-bottom, 0px))" }}>
          {payments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {payments.map((p) => (
                <div key={p.paymentId} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{formatDate(p.paidAt)}</span>
                  <span className="text-sm font-bold text-[#1B4332]">{t("sub.amount.krw", { amount: p.amount.toLocaleString() })}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm">{t("sub.history.empty")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in">
      {/* Header - fixed */}
      <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0 bg-white">
        <button onClick={onClose} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-[#2D6A4F]">{t("sub.title")}</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="pb-4 px-6 text-center">
        <h1 className="text-3xl font-black text-[#1B4332]">{t("sub.heading")}</h1>
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
              <h2 className="text-xl font-black text-white mb-1">{t("sub.active.header")}</h2>
              <p className="text-sm text-emerald-300/70">
                {expiresAt ? t("sub.active.nextPayment", { date: new Date(expiresAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US") }) : t("sub.active.using")}
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">{t("sub.features.header")}</h3>
              <div className="flex flex-col gap-2">
                {[t("sub.feature.unlimited"), t("sub.feature.prediction"), t("sub.feature.levelAnalysis"), t("sub.feature.sessionReport"), t("sub.feature.nutritionCoach")].map((feature) => (
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
              onClick={() => setShowSubDetail(true)}
              className="bg-gray-50 rounded-2xl p-5 w-full text-left active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">{t("sub.history.header")}</h3>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex flex-col gap-2.5">
                {expiresAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t("sub.history.nextDate")}</span>
                    <span className="text-sm font-medium text-[#2D6A4F]">{new Date(expiresAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t("sub.history.amount")}</span>
                    <span className="text-sm font-medium text-gray-900">{t("sub.amount.krw", { amount: amount.toLocaleString() })}</span>
                  </div>
                )}
              </div>
            </button>

          </div>
        ) : (
          /* Free / Cancelled - Show subscription offer */
          <div className="flex flex-col gap-4">
            {status === "cancelled" && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <p className="text-sm font-bold text-amber-700">{t("sub.cancel.header")}</p>
                <p className="text-xs text-amber-600 mt-1">
                  {expiresAt ? t("sub.cancelled.until", { date: new Date(expiresAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US") }) : t("sub.cancelled.expire")}
                </p>
              </div>
            )}

            {/* Brand Admiration 인트로 — 회의 53 (박충환 Enrich) */}
            {status === "free" && (() => {
              const history = getCachedWorkoutHistory();
              if (history.length < 3) return null;
              const persona = detectPersona(history);
              return (
                <div className="rounded-3xl bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-5 text-white">
                  <p className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.2em] mb-2">
                    {locale === "ko" ? `★ ${history.length}번의 여정 ★` : `★ ${history.length} workouts in ★`}
                  </p>
                  <p className="text-xl font-black leading-tight mb-1">
                    {locale === "ko"
                      ? <>지금까지의 당신,<br />{persona.name}형이 완성되고 있어요</>
                      : <>You are becoming<br />a {persona.nameEn}</>}
                  </p>
                  <p className="text-sm text-emerald-100/80 mt-3 leading-relaxed">
                    {locale === "ko"
                      ? "이 정체성과 기록, 당신만의 것이에요. 계속 지키시겠어요?"
                      : "This identity and record is yours alone. Will you keep it?"}
                  </p>
                </div>
              );
            })()}

            {/* Pricing Card */}
            <div className="p-6 rounded-2xl border-2 border-[#2D6A4F] bg-[#f0fdf4] relative text-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#2D6A4F] text-white text-xs font-bold rounded-full whitespace-nowrap">{t("sub.earlyBird")}</div>
              <div className="mb-5 mt-2">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-lg text-gray-400 line-through">{t("my.premium.originalPrice")}</span>
                  <span className="text-4xl font-black text-[#1B4332]">{locale === "en" ? "$4.99" : "₩6,900"}</span>
                  <span className="text-base font-medium text-gray-400">{t("sub.perMonth")}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{t("sub.discount")}</span>
                  <span className="text-xs text-[#2D6A4F] font-semibold">{t("sub.earlyBird")}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 text-left">
                {[t("sub.feature.unlimited"), t("sub.feature.prediction"), t("sub.feature.levelAnalysis"), t("sub.feature.sessionReport"), t("sub.feature.nutritionCoach")].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
                      <path d="M4 9L7.5 12.5L14 6" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              className={
                locale === "ko"
                  ? "w-full py-4 rounded-2xl bg-[#FEE500] text-[#3C1E1E] font-bold text-base active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
                  : "w-full py-4 rounded-2xl bg-[#1B4332] text-white font-bold text-base active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 hover:bg-[#143728]"
              }
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className={`w-4 h-4 border-2 ${locale === "ko" ? "border-[#3C1E1E]" : "border-white"} border-t-transparent rounded-full animate-spin`} />
                  {t("sub.cancel.processing")}
                </span>
              ) : (
                locale === "ko" ? t("sub.kakaoPay") : t("sub.subscribeIntl")
              )}
            </button>

            <p className="text-[10px] text-gray-400 text-center">
              {t("sub.autoRenew")}
            </p>
          </div>
        )}

        {/* FAQ */}
        {status !== "loading" && (
          <div className="mt-8">
            <h2 className="text-lg font-black text-gray-900 text-center mb-4">{t("sub.faq.title")}</h2>
            <div className="flex flex-col gap-2.5">
              {FAQ_KEYS.map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 active:opacity-60"
                  >
                    <span className="text-sm font-bold text-gray-900 text-left">{t(faq.qKey)}</span>
                    <span className="text-[#2D6A4F] text-lg font-bold shrink-0 ml-3">
                      {openFaqIndex === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaqIndex === i && (
                    <div className="px-4 pb-4">
                      {faq.key === "refund" ? (
                        <div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            <span className="font-bold text-gray-900">{t("sub.faq.a5.bold")}</span>
                            {t("sub.faq.a5.prefix")}{" "}
                            <button type="button" onClick={() => setShowRefund(true)} className="text-[#2D6A4F] font-bold underline underline-offset-2">{t("my.refund")}</button>
                            {t("sub.faq.a5.suffix")}
                          </p>
                          {(status === "active" || status === "cancelled") && (
                            <button
                              onClick={() => { setCancelStep(0); setRefundStep(1); setRefundReason(""); setError(null); }}
                              className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 active:scale-[0.98] transition-all"
                            >
                              {t("sub.refundRequest.submit")}
                            </button>
                          )}
                        </div>
                      ) : faq.aKey ? (
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{t(faq.aKey)}</p>
                      ) : null}
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
              {t("sub.cancel.button")}
            </button>
          </div>
        )}

      </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">{locale === "en" ? "Terms of Service" : "이용약관"}</h2>
              <button type="button" onClick={() => setShowTerms(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{TERMS_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowTerms(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-[#1B4332]">개인정보 처리방침</h2>
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="#666" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{PRIVACY_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowPrivacy(false)} className="w-full py-3 rounded-xl bg-[#1B4332] text-white text-sm font-bold hover:bg-[#143728] transition-colors">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Policy Modal */}
      {showRefund && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowRefund(false)}>
          <div className="bg-white rounded-2xl mx-4 w-full max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
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

      {/* Cancel Flow Overlay */}
      {/* 회의 30: 진입 시 onCancelFlowChange(true)로 부모(page.tsx) 탭바 숨김 →
          탭바 높이 padding 불필요. 세이프 에리어만 확보. */}
      {/* Refund Request Overlay */}
      {refundStep > 0 && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in overflow-y-auto scrollbar-hide" style={{ paddingBottom: "calc(24px + var(--safe-area-bottom, 0px))" }}>
          <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0">
            <button onClick={() => setRefundStep(0)} className="p-2 -ml-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-gray-500">{t("sub.refundRequest.header")}</span>
            <div className="w-9" />
          </div>

          {refundStep === 1 ? (
            <div className="flex-1 px-6 pb-8">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 mb-6">
                <p className="text-sm text-gray-600 leading-relaxed">{t("sub.refundRequest.info")}</p>
              </div>

              <h3 className="text-base font-black text-gray-900 mb-3">{t("sub.refundRequest.reasonLabel")}</h3>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t("sub.refundRequest.reasonPlaceholder")}
                rows={4}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 outline-none focus:border-[#059669] transition-colors resize-none"
              />

              {error && (
                <div className="bg-red-50 rounded-xl p-3 border border-red-200 mt-4">
                  <p className="text-xs text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={handleRefundSubmit}
                  disabled={!refundReason.trim() || refundSubmitting}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#2D6A4F] active:scale-[0.98] transition-all disabled:opacity-30"
                >
                  {refundSubmitting ? t("sub.cancel.processing") : t("sub.refundRequest.submit")}
                </button>
                <button
                  onClick={() => setRefundStep(0)}
                  className="w-full py-3 text-sm font-bold text-gray-400"
                >
                  {t("common.back")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-6 pb-8 flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-base font-bold text-gray-900 text-center mb-2">{t("sub.refundRequest.successTitle")}</p>
              <p className="text-sm text-gray-500 text-center leading-relaxed">{t("sub.refundRequest.successMessage")}</p>
              <button
                onClick={() => setRefundStep(0)}
                className="mt-8 w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#2D6A4F] active:scale-[0.98] transition-all"
              >
                {t("common.confirm")}
              </button>
            </div>
          )}
        </div>
      )}

      {cancelStep > 0 && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in overflow-y-auto scrollbar-hide" style={{ paddingBottom: "calc(24px + var(--safe-area-bottom, 0px))" }}>
          {/* Header */}
          <div className="pt-5 pb-3 px-6 flex items-center justify-between shrink-0">
            <button onClick={() => setCancelStep(0)} className="p-2 -ml-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[11px] tracking-[0.3em] uppercase font-serif font-medium text-red-400">{t("sub.cancel.header")}</span>
            <div className="w-9" />
          </div>

          {cancelStep === 1 ? (
            <div className="flex-1 px-6 pb-8">
              {/* What you'll lose */}
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 mb-6">
                <h3 className="text-sm font-bold text-amber-800 mb-3">{t("sub.cancel.lostBenefits")}</h3>
                <div className="flex flex-col gap-2">
                  {[t("sub.feature.unlimited"), t("sub.feature.prediction"), t("sub.feature.levelAnalysis"), t("sub.feature.sessionReport"), t("sub.feature.nutritionCoach")].map((feature) => (
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
              <h3 className="text-base font-black text-gray-900 mb-1">{t("sub.cancel.reasonHeader")}</h3>
              <p className="text-xs text-gray-400 mb-4">{t("sub.cancel.reasonSubtitle")}</p>
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
                {cancelReason === t("sub.cancel.reason.etc") && (
                  <textarea
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    placeholder={t("sub.cancel.reasonPlaceholder")}
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
                  {t("sub.cancel.continueToCancel")}
                </button>
                <button
                  onClick={() => setCancelStep(0)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#2D6A4F] active:scale-[0.98] transition-all"
                >
                  {t("sub.cancel.keep")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-6 pb-8">
              {/* Warning */}
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 mb-6">
                <h3 className="text-base font-black text-amber-800 mb-2">{t("sub.cancel.refundTitle")}</h3>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span className="text-sm text-amber-700">{t("sub.cancel.refundBullet1")}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span className="text-sm text-amber-700">{t("sub.cancel.refundBullet2")}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span className="text-sm text-amber-700">{t("sub.cancel.refundBullet3")}</span>
                  </div>
                </div>
              </div>

              {/* Type to confirm */}
              <h3 className="text-base font-black text-gray-900 mb-1">{t("sub.cancel.confirmTitle")}</h3>
              <p className="text-xs text-gray-400 mb-4">{t("sub.cancel.confirmLabelPrefix")}<span className="font-bold text-red-400">&quot;{t("sub.cancel.confirmWord")}&quot;</span>{t("sub.cancel.confirmLabelSuffix")}</p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={t("sub.cancel.confirmWord")}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-900 outline-none focus:border-red-300 transition-colors"
              />

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={handleCancel}
                  disabled={confirmInput !== t("sub.cancel.confirmWord") || confirmCountdown > 0 || isProcessing}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-red-400 bg-red-50 active:scale-[0.98] transition-all disabled:opacity-30"
                >
                  {isProcessing ? t("sub.cancel.processing") : confirmCountdown > 0 ? t("sub.cancel.countdown", { n: String(confirmCountdown) }) : t("sub.cancel.confirmButton")}
                </button>
                <button
                  onClick={() => setCancelStep(0)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#2D6A4F] active:scale-[0.98] transition-all"
                >
                  {t("sub.cancel.keep")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
