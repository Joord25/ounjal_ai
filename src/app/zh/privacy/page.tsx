"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

const PRIVACY_ZH = `注意：本中文翻译仅供参考。具有法律约束力的版本为韩文原文。如本翻译与韩文原文存在任何差异，以韩文版本为准。

---

第1条（目的）
本隐私政策说明 ohunjal AI（以下简称"本公司"）依据大韩民国《个人信息保护法》，如何收集、使用及保护会员的个人信息。

第2条（收集项目）
1. 【必填】电子邮件地址、姓名（通过 Google 社交登录获取）
2. 【必填】性别、出生年份、体重、身高
3. 【必填】运动记录（训练计划、课次日志、组数/次数、反馈）
4. 【自动生成】健康衍生指标（基础代谢率、热量消耗、预计1RM、运动强度分类、成长预测）——根据会员提供的身体数据及运动记录计算得出，仅用于提供个性化 AI 服务。
5. 【自动收集】服务使用日志、访问日志、IP 地址、Cookie、设备信息

第3条（收集目的）
1. AI 个性化训练计划生成及每次课程分析报告
2. 运动历史管理与成长预测服务
3. 订阅付款处理与账单管理
4. 通过使用分析及 AI 模型优化改善服务

第4条（保留与销毁）
1. 个人信息在会员资格存续期间予以保留。
2. 会员注销后，个人信息将立即销毁，但法律要求保留的情形除外。
3. 运动记录及衍生指标将在账户删除时同步删除。

第5条（第三方提供）
本公司不会在未经会员同意的情况下向第三方提供个人信息，法律另有规定者除外。

第6条（处理委托）
以下第三方服务代本公司处理数据：
- Google LLC（Firebase）：身份验证、数据存储、托管服务
- Google LLC（Gemini API）：AI 训练计划及报告生成——数据仅用于生成处理，处理后立即丢弃，不用于模型训练
- PortOne：付款处理（KakaoPay 定期付款）

第7条（会员权利）
会员可随时通过个人资料设置或发送邮件至 ounjal.ai.app@gmail.com，申请查阅、更正、删除或暂停处理本人个人信息。

第8条（AI 模型集成与局限性）
1. 本公司使用外部 AI 模型（Google Gemini）提供训练计划。在此过程中，会员提供的信息（身体数据、反馈）可能传输至 AI 服务器。
2. 传输至 AI 的数据仅用于计划生成，不会被第三方服务商存储或用于 AI 训练。
3. 本公司自动计算健康衍生指标（通过 Harris-Benedict 公式计算基础代谢率、通过 MET 计算运动热量消耗、通过 Brzycki/Epley/Lombardi 公式估算1RM）。上述指标仅用于服务个性化，不用于医疗诊断目的。

第9条（安全措施）
本公司采取技术和管理措施保护个人信息，包括加密传输（HTTPS）、访问控制及定期安全审查。

第10条（联系方式）
个人信息保护负责人：林周用（代表）
电子邮件：ounjal.ai.app@gmail.com
电话：010-4824-2869

附则
本政策自2026年3月1日起施行。`;

export default function ZhPrivacyPage() {
  useBodyScroll();
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="/zh" className="flex items-center gap-2">
            <img src="/favicon.png" alt="ohunjal AI" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-[#1B4332] text-lg">ohunjal AI</span>
          </a>
          <a href="/zh" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">返回</a>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">隐私政策</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              本中文翻译仅供参考。具有法律约束力的版本为韩文原文。
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{PRIVACY_ZH}</pre>
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
