export interface GuideFAQ {
  q: string;
  a: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string; // meta description, 75자 이내
  keyword: string; // 주요 타겟 키워드
  content: string; // HTML 본문
  faqs: GuideFAQ[];
  publishedAt: string; // ISO date
  updatedAt: string;
}

export const GUIDES: Guide[] = [
  {
    slug: "pt-without-trainer",
    title: "PT 없이 혼자 헬스장에서 운동하는 법",
    description: "PT 없이 혼자 운동하려면 주 3-4일 분할 루틴과 점진적 과부하가 핵심입니다. 초보자 2분할 루틴 가이드.",
    keyword: "PT 없이 운동",
    publishedAt: "2026-04-02",
    updatedAt: "2026-04-02",
    faqs: [
      {
        q: "PT 없이 운동하면 자세가 잘못될 수 있지 않나요?",
        a: "각 운동의 자세는 유튜브에서 '운동이름 + 자세' 검색으로 확인할 수 있어요. 처음에는 가벼운 무게로 자세를 익히고, 익숙해지면 무게를 올리세요.",
      },
      {
        q: "얼마나 해야 효과가 보이나요?",
        a: "ACSM 기준으로 주 2-3회, 8주 이상 꾸준히 하면 근력 향상을 체감할 수 있습니다. 체형 변화는 보통 12주(3개월) 정도 걸립니다.",
      },
    ],
    content: `
      <p class="text-base sm:text-lg text-gray-700 leading-relaxed mb-8">
        PT 없이 혼자 운동하려면 주 3-4일 분할 루틴을 짜고 점진적 과부하 원칙을 따르면 됩니다.
        상체/하체 2분할이나 밀기/당기기/하체 3분할로 시작하고,
        복합 운동을 중심으로 매주 무게를 2.5-5%씩 올리세요.
        ACSM에 따르면 초보자는 각 운동 3세트 8-12회가 근비대에 최적입니다.
      </p>

      <h2 class="text-xl sm:text-2xl font-black text-[#1B4332] mb-4 mt-10">초보자 추천 2분할 루틴</h2>

      <h3 class="text-lg font-bold text-[#2D6A4F] mb-3 mt-6">A일 (상체 — 밀기 + 당기기)</h3>
      <div class="overflow-x-auto mb-6">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-[#f0fdf4]">
              <th class="text-left p-3 font-bold text-[#1B4332]">운동</th>
              <th class="text-center p-3 font-bold text-[#1B4332]">세트</th>
              <th class="text-center p-3 font-bold text-[#1B4332]">횟수</th>
              <th class="text-center p-3 font-bold text-[#1B4332]">무게 기준</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-gray-100"><td class="p-3">벤치프레스</td><td class="p-3 text-center">3</td><td class="p-3 text-center">10/10/10</td><td class="p-3 text-center">체중 40-50%</td></tr>
            <tr class="border-b border-gray-100"><td class="p-3">덤벨 숄더프레스</td><td class="p-3 text-center">3</td><td class="p-3 text-center">12/12/12</td><td class="p-3 text-center">가벼운 무게</td></tr>
            <tr class="border-b border-gray-100"><td class="p-3">랫풀다운</td><td class="p-3 text-center">3</td><td class="p-3 text-center">10/10/10</td><td class="p-3 text-center">체중의 40-50%</td></tr>
            <tr class="border-b border-gray-100"><td class="p-3">덤벨 컬</td><td class="p-3 text-center">3</td><td class="p-3 text-center">15/15/15</td><td class="p-3 text-center">가벼운 무게</td></tr>
            <tr><td class="p-3">크런치</td><td class="p-3 text-center">3</td><td class="p-3 text-center">30/30/40</td><td class="p-3 text-center">맨몸</td></tr>
          </tbody>
        </table>
      </div>

      <h3 class="text-lg font-bold text-[#2D6A4F] mb-3 mt-6">B일 (하체 + 코어)</h3>
      <div class="overflow-x-auto mb-6">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-[#f0fdf4]">
              <th class="text-left p-3 font-bold text-[#1B4332]">운동</th>
              <th class="text-center p-3 font-bold text-[#1B4332]">세트</th>
              <th class="text-center p-3 font-bold text-[#1B4332]">횟수</th>
              <th class="text-center p-3 font-bold text-[#1B4332]">무게 기준</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-gray-100"><td class="p-3">스쿼트</td><td class="p-3 text-center">3</td><td class="p-3 text-center">10/10/10</td><td class="p-3 text-center">체중 50-60%</td></tr>
            <tr class="border-b border-gray-100"><td class="p-3">레그프레스</td><td class="p-3 text-center">3</td><td class="p-3 text-center">15/15/15</td><td class="p-3 text-center">적당한 무게</td></tr>
            <tr class="border-b border-gray-100"><td class="p-3">루마니안 데드리프트</td><td class="p-3 text-center">3</td><td class="p-3 text-center">10/10/10</td><td class="p-3 text-center">체중의 40-50%</td></tr>
            <tr class="border-b border-gray-100"><td class="p-3">레그컬</td><td class="p-3 text-center">3</td><td class="p-3 text-center">15/15/15</td><td class="p-3 text-center">가벼운 무게</td></tr>
            <tr><td class="p-3">크런치</td><td class="p-3 text-center">3</td><td class="p-3 text-center">30/30/40</td><td class="p-3 text-center">맨몸</td></tr>
          </tbody>
        </table>
      </div>

      <h3 class="text-lg font-bold text-[#2D6A4F] mb-3 mt-6">주간 스케줄 예시</h3>
      <p class="text-sm text-gray-600 mb-8">월: A일 / 화: 휴식 / 수: B일 / 목: 휴식 / 금: A일 / 주말: 휴식</p>

      <h2 class="text-xl sm:text-2xl font-black text-[#1B4332] mb-4 mt-10">왜 이 루틴이 효과적인가</h2>
      <p class="text-base text-gray-700 leading-relaxed mb-4">
        ACSM(미국스포츠의학회)의 저항 운동 가이드라인에 따르면,
        초보자는 주 2-3일 전신 또는 분할 운동이 최적입니다.
        복합 운동(스쿼트, 벤치프레스, 데드리프트)을 중심으로 하면
        한 번의 세션으로 여러 근육군을 효율적으로 자극할 수 있어요.
      </p>
      <p class="text-base text-gray-700 leading-relaxed mb-8">
        점진적 과부하 원칙은 간단합니다. 매주 무게를 2.5-5% 올리거나,
        같은 무게에서 횟수를 1-2회 늘리세요. 이 작은 증가가
        3개월이면 복합적으로 큰 차이를 만듭니다.
      </p>

      <h2 class="text-xl sm:text-2xl font-black text-[#1B4332] mb-4 mt-10">오운잘로 바로 시작하기</h2>
      <p class="text-base text-gray-700 leading-relaxed mb-4">
        매번 루틴을 직접 짜기 귀찮다면, 오운잘 AI가 대신 해줍니다.
        컨디션만 고르면 3초 만에 오늘 운동이 나와요.
        PT 없이도 체계적으로 운동할 수 있습니다.
      </p>
    `,
  },
];
