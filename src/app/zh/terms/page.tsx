"use client";

import React, { useEffect } from "react";

function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}

const TERMS_ZH = `注意：本中文翻译仅供参考。具有法律约束力的版本为韩文原文。如本翻译与韩文原文存在任何差异，以韩文版本为准。

---

第1条（目的）
本条款规定ohunjal AI（以下简称"公司"）与用户（以下简称"会员"）在使用公司所提供服务过程中的权利、义务及责任。

第2条（定义）
1. "服务"是指公司通过ohunjal.com提供的基于人工智能的运动计划制定、追踪与分析服务。
2. "会员"是指同意本条款并使用服务的人员。
3. "AI运动计划"是指根据会员的身体状况、目标及运动历史自动生成的训练方案。

第3条（条款的效力及修改）
公司应在服务页面上公示本条款。公司可在法律允许的范围内修改本条款，并在生效日期前至少提前7天（对会员不利的变更须提前30天）发出通知。

第4条（会员注册）
1. 当用户同意本条款并通过谷歌账号认证完成注册流程后，即成为会员。
2. 若提供虚假信息或不符合注册要求，公司可拒绝注册申请或注销会员资格。

第5条（会员义务）
1. 会员应妥善管理自己的账号凭据，不得允许第三方使用本人账号。
2. 会员不得从事以下行为：冒充他人、发布虚假信息、侵犯知识产权、干扰服务运营或从事违法活动。
3. 会员对其输入数据的准确性和合法性承担责任。

第6条（服务的提供及变更）
1. 服务原则上全天候提供，但因维护、系统更新或不可抗力等情况可能临时中断。
2. 公司可因运营或技术原因对部分或全部服务进行变更或中止，并提前通知。

第7条（订阅与付款）
1. 服务采用免费增值模式，提供有限免费功能及付费高级订阅。
2. 高级订阅通过KakaoPay按月计费，取消前将自动续订。
3. 公司可在至少提前30天通知的情况下变更订阅价格。

第8条（取消与退款）
1. 会员可随时通过个人资料设置取消订阅。
2. 取消后，订阅将在当前计费周期结束前保持有效。
3. 初次订阅后7天内且未使用任何高级功能的，可申请退款。退款申请请发送至ounjal.ai.app@gmail.com。

第9条（知识产权）
服务相关的所有知识产权，包括AI算法、运动计划、界面设计及内容，均归公司所有。未经公司事先书面同意，会员不得复制、修改、分发或以商业目的使用任何服务内容。

第10条（个人信息）
公司依据隐私政策处理会员个人信息。AI生成的运动计划可能使用会员提供的身体数据，仅用于个性化目的。

第11条（AI服务披露）
1. AI运动计划和分析报告由人工智能自动生成，不能替代持证专业人员或医疗从业者的直接运动处方。
2. AI生成的内容（训练方案、动作指导等）不一定百分之百准确或完整。所有AI生成内容仅供参考，会员应根据自身健康状况和体能水平自行判断。
3. 本服务不是医疗器械，不用于疾病的诊断、治疗或预防。有既往病史或身体限制的会员在使用服务前必须咨询医疗专业人员。公司对因未能做到这一点而导致的健康问题不承担责任。

第12条（免责声明）
1. 因不可抗力或类似情形导致的服务中断，公司不承担责任。
2. 因会员自身疏忽导致的服务中断，公司不承担责任。
3. 因未能达到预期运动效果，公司不承担责任。
4. 因AI生成内容（运动计划、成长预测、卡路里分析、估算1RM、力量评估等）的错误或不准确而导致的伤害或损失，公司不承担法律责任。

第13条（管辖法律及争议解决）
与服务相关的争议适用大韩民国法律，由公司注册地址所在地法院管辖。

附则
本条款自2026年3月1日起生效。`;

export default function ZhTermsPage() {
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
        <h1 className="text-3xl font-black text-[#1B4332] mb-8">服务条款</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              本中文翻译仅供参考。具有法律约束力的版本为韩文原文。
            </p>
          </div>
          <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{TERMS_ZH}</pre>
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
