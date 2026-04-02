"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

const TERMS_JA = `第1条（目的）
本規約は、ohunjal AI（以下「当社」）が提供するサービスの利用に関して、当社と利用者（以下「会員」）との間の権利・義務・責任事項を定めることを目的とします。

第2条（定義）
1.「サービス」とは、当社がohunjal.comを通じて提供するAIベースのトレーニング計画・記録・分析サービスをいいます。
2.「会員」とは、本規約に同意し、サービスを利用するすべての者をいいます。
3.「AIトレーニングプラン」とは、会員の身体状態・目標・運動履歴をもとに自動生成されるトレーニングルーティンをいいます。

第3条（規約の効力および変更）
当社はサービス画面に本規約を掲示します。当社は関連法令の範囲内で本規約を改定することができ、施行日の少なくとも7日前（会員に不利な変更の場合は30日前）に通知します。

第4条（会員登録）
1. 会員資格は、本規約に同意のうえ、Googleアカウント認証によってサービスへの登録を完了した時点で成立します。
2. 当社は、虚偽情報の提供や登録要件を満たさない場合、登録を拒否または取り消すことができます。

第5条（会員の義務）
1. 会員は自己のアカウント情報を適切に管理し、第三者にアカウントを使用させてはなりません。
2. 会員は以下の行為を行ってはなりません：他者へのなりすまし、虚偽情報の投稿、知的財産の侵害、サービス運営の妨害、その他の違法行為。
3. 会員は自らが入力するデータの正確性および合法性について責任を負います。

第6条（サービスの提供および変更）
1. サービスは原則として24時間365日提供されますが、メンテナンス・システム更新・不可抗力により一時的に停止する場合があります。
2. 当社は運営上または技術上の理由により、事前に通知のうえサービスの一部または全部を変更・終了することができます。

第7条（サブスクリプションおよび支払い）
1. サービスは無料機能が限定されたフリーミアムモデルと、有料のプレミアムサブスクリプションで構成されます。
2. プレミアムサブスクリプションはKakaoPayにより月次請求され、解約しない限り自動更新されます。
3. 当社はサブスクリプション料金を少なくとも30日前に通知のうえ変更することができます。

第8条（解約および返金）
1. 会員はプロフィール設定からいつでもサブスクリプションを解約することができます。
2. 解約後も、現在の請求期間終了までサービスを利用できます。
3. プレミアム機能を一切利用していない場合に限り、初回サブスクリプションから7日以内であれば返金を受けることができます。返金のご依頼はounjal.ai.app@gmail.comまでご連絡ください。

第9条（知的財産権）
AIアルゴリズム・トレーニングプラン・UIデザイン・コンテンツを含む、サービスに関するすべての知的財産権は当社に帰属します。会員は当社の事前書面による同意なく、サービスのコンテンツをコピー・改変・配布・商業利用することはできません。

第10条（個人情報）
当社はプライバシーポリシーに従い会員の個人情報を取り扱います。AIが生成するトレーニングプランは、パーソナライズの目的でのみ会員が提供した身体データを使用することがあります。

第11条（AIサービスに関する開示）
1. AIトレーニングプランおよび分析レポートは人工知能によって自動生成されるものであり、認定専門家または医療従事者による直接的な運動処方の代替にはなりません。
2. AIが生成するコンテンツ（トレーニングルーティン・フォームアドバイス等）は常に100%正確または完全であるとは限りません。AIが生成するすべてのコンテンツは参考情報に過ぎません。会員は自身の健康状態および体力レベルに基づいて適切な判断を行ってください。
3. 本サービスは医療機器ではなく、疾病の診断・治療・予防を目的とするものではありません。既往症や身体的制限のある会員は、サービスを利用する前に医療専門家に相談してください。これを怠ることで生じた健康上の問題について、当社は責任を負いません。

第12条（免責事項）
1. 当社は不可抗力その他これに準じる事由によるサービス中断について責任を負いません。
2. 当社は会員の過失によるサービス障害について責任を負いません。
3. 当社は期待されるトレーニング成果が達成されなかった場合について責任を負いません。
4. 当社はAIが生成するコンテンツ（トレーニングプラン・成長予測・カロリー分析・推定1RM・体力評価等）の誤りや不正確さに起因する怪我・損害について法的責任を負いません。

第13条（準拠法および管轄）
本サービスに関する紛争は大韓民国法に準拠し、当社の登録住所地を管轄する裁判所を専属的合意管轄とします。

附則
本規約は2026年3月1日より施行します。`;

export default function JaTermsPage() {
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
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">利用規約</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              この日本語訳は参考用です。法的拘束力を持つのは韓国語の原文です。
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{TERMS_JA}</pre>
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
