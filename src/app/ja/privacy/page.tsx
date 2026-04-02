"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

const PRIVACY_JA = `第1条（目的）
本プライバシーポリシーは、오훈잘 AI（以下「当社」）が大韓民国の個人情報保護法に基づき、会員の個人情報をどのように収集・利用・保護するかを定めるものです。

第2条（収集する個人情報の項目）
1. 【必須】メールアドレス、氏名（Googleソーシャルログインによる取得）
2. 【必須】性別、生まれ年、体重、身長
3. 【必須】運動記録（プラン、セッションログ、セット数・回数、フィードバック）
4. 【自動生成】健康派生指標（基礎代謝量、消費カロリーバランス、推定1RM、運動強度分類、成長予測）— 会員が入力した身体データおよび運動記録をもとに算出され、AIパーソナライズサービスの提供のみに使用されます。
5. 【自動収集】サービス利用ログ、アクセスログ、IPアドレス、クッキー、端末情報

第3条（収集・利用目的）
1. AIパーソナライズ運動プランの生成および各セッション分析レポートの提供
2. 運動履歴管理および成長予測サービスの提供
3. サブスクリプション決済処理および請求管理
4. 利用分析によるサービス改善およびAIモデルの高度化

第4条（保有期間および廃棄）
1. 個人情報は会員資格の存続期間中保有します。
2. 退会時、法令で保有が義務付けられている場合を除き、個人情報は遅滞なく廃棄します。
3. 運動記録および派生指標は、アカウント削除と同時に削除されます。

第5条（第三者への提供）
当社は、法令に基づく場合を除き、会員の同意なく個人情報を第三者に提供しません。

第6条（処理の委託）
当社は、以下の第三者サービスにデータ処理の一部を委託しています。
- Google LLC（Firebase）：認証、データストレージ、ホスティング
- Google LLC（Gemini API）：AIによる運動プランおよびレポート生成 — データは処理後ただちに破棄され、モデルのトレーニングには使用されません
- PortOne：決済処理（KakaoPay請求）

第7条（会員の権利）
会員はいつでも、プロフィール設定または ounjal.ai.app@gmail.com へのお問い合わせを通じて、個人情報の閲覧・訂正・削除・処理停止を請求することができます。

第8条（AIモデルの利用と制限）
1. 当社は、運動プランを提供するために外部AIモデル（Google Gemini）を使用しています。このプロセスにおいて、会員が提供した情報（身体データ、フィードバック）がAIサーバーに送信される場合があります。
2. AIに送信されたデータはプラン生成のみに使用され、第三者提供者によるAIトレーニングへの保存・利用は行われません。
3. 当社は健康派生指標（Harris-Benedict式による基礎代謝量、MET式による運動消費カロリー、Brzycki / Epley / Lombardi式による推定1RM）を自動算出します。これらの指標はサービスのパーソナライズのみを目的とし、医療診断目的には使用されません。

第9条（安全管理措置）
当社は、暗号化通信（HTTPS）、アクセス制御、定期的なセキュリティレビューなど、個人情報を保護するための技術的・組織的な措置を講じています。

第10条（お問い合わせ）
個人情報保護責任者：Jooyong Lim（代表）
メール：ounjal.ai.app@gmail.com
電話：010-4824-2869

附則
本ポリシーは2026年3月1日より施行します。`;

export default function JaPrivacyPage() {
  useBodyScroll();
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="/ja" className="flex items-center gap-2">
            <img src="/favicon.png" alt="ohunjal AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#1B4332] text-lg">ohunjal AI</span>
          </a>
          <a href="/ja" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">戻る</a>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">プライバシーポリシー</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              この日本語訳は参考用です。法的拘束力を持つのは韓国語の原文です。
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{PRIVACY_JA}</pre>
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
