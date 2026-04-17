/**
 * 운동별 YouTube Shorts 영상 매핑
 *
 * key: 운동 한글 이름 (괄호 앞 부분, trim)
 * value: YouTube 영상 ID (shorts or regular)
 *
 * 매핑이 없는 운동은 유튜브 검색 폴백으로 처리됨.
 * 좋은 쇼츠를 찾으면 여기에 추가하면 됨.
 */
export const EXERCISE_VIDEOS: Record<string, string> = {
  // ══════════════════════════════════
  // ── 가슴 (PUSH - Main Compound) ──
  // ══════════════════════════════════
  "바벨 벤치 프레스": "_FkbD0FhgVE",
  "덤벨 벤치 프레스": "Ne_9EKkUVXY",
  "디클라인 벤치 프레스": "1OdTFeN90W4",
  "헤머 벤치 프레스": "ySeSg4lMgmE",
  "웨이티드 푸쉬업": "z4oz6W1X10w",
  "케틀벨 플로어 프레스": "hwm_fcTRf2g",
  "체스트 프레스 머신": "2awX3rTGa1k",
  "인클라인 바벨 프레스": "3bBng_VzwMA",
  "스미스 머신 벤치 프레스": "56DglbJlcI4",
  "덤벨 플로어 프레스": "O1x7AoUf5Vs",

  // ── 가슴 (PUSH - Accessory) ──
  "인클라인 덤벨 프레스": "98HWfiRonkE",
  "인클라인 덤벨 플라이": "aBEHkzfe4yc",
  "케이블 크로스오버": "roEVwGRVVWU",
  "케이블 체스트 프레스": "NXpRKhXg2P8",
  "펙덱 플라이": "Qia9J8Do7vw",
  "중량 딥스": "ZDOrGNvRdM0",
  "가슴 딥스": "SpSE_A5L-YA",
  "랜드마인 프레스": "Iu5pYQEkj38",
  "바텀스업 케틀벨 프레스": "PDVTbKBXAl4",
  "푸쉬업": "_OIVCwJ8JEI",
  "니 푸쉬업": "CHMJix2qYsY",
  "다이아몬드 푸쉬업": "jM_nyUZGCak",
  "와이드 푸쉬업": "j3b4AU0_moo",
  "아처 푸쉬업": "3grrK20JBDc",
  "힌두 푸쉬업": "QmaZpWt2ZOA",

  // ── 어깨 (PUSH - Vertical Press) ──
  "오버헤드 프레스": "zoN5EH50Dro",
  "덤벨 숄더 프레스": "cw4pTDmf4J0",
  "아놀드 프레스": "Kg8JD8l6ezw",
  "케틀벨 오버헤드 프레스": "bv4eXAAZhBY",
  "밀리터리 프레스": "8AaCUFgLHak",

  // ── 어깨 (PUSH - Isolation) ──
  "사이드 레터럴 레이즈": "niWbjYgkSI8",
  "프론트 레터럴 레이즈": "yPdoJZ89Xkk",
  "벤트 오버 레터럴 레이즈": "LsT-bR_zxLo",
  "케이블 레터럴 레이즈": "oHIiwKgcS4Y",
  "업라이트 로우": "PIC0MTxojZk",

  // ── 삼두 (PUSH - Isolation) ──
  "트라이셉 로프 푸쉬다운": "4NWWB0f0vzQ",
  "스컬 크러셔": "1cikFylNxqw",
  "오버헤드 트라이셉 익스텐션": "pmcUemVUnP4",
  "케이블 푸쉬 다운": "XpeCPOHJTK8",
  "케이블 오버헤드 트라이셉 익스텐션": "pmcUemVUnP4",
  "케이블 OH 트라이셉 익스텐션": "pmcUemVUnP4",
  "트라이셉스 킥백": "WhBxKbe1-NU",
  "트라이셉스 딥스": "XX1_7MN1fEM",
  "클로즈그립 벤치 프레스": "43rg7fBNP2w",

  // ══════════════════════════════════
  // ── 등 (PULL - Vertical) ──
  // ══════════════════════════════════
  "풀업": "ym1V5H35IpA",
  "중량 풀업": "qwXUU0JPYnY",
  "랫 풀다운": "bNmvKpJSWKM",
  "친업": "jIvbJzs1V4I",
  "중량 친업": "1C272Ws8WwU",
  "어시스티드 풀업": "CdO5BvP6Ti8",
  "암 풀다운": "hAMcfubonDc",
  "원 암 랫 풀다운": "8zA8DjHRaq0",

  // ── 등 (PULL - Horizontal) ──
  "바벨 로우": "FZ_ObAdQPEo",
  "펜들레이 로우": "mow6TJ4sTo8",
  "티바 로우": "30-MYPAVXqk",
  "케틀벨 고릴라 로우": "e9oCtQdOwU4",
  "인버티드 로우": "vZy_Eu_Z0WA",
  "하이로우 머신": "0QN8jx2nEQc",
  "케틀벨 로우": "Prwa0uFbSYU",
  "TRX 로우": "fAwrRJu5tw0",

  // ── 등 (PULL - Unilateral) ──
  "싱글 암 덤벨 로우": "TcaNtjAi4Z4",
  "시티드 케이블 로우": "RUygIGMN13M",
  "시티드 로우": "RUygIGMN13M",
  "체스트 서포티드 로우": "woHK8Lws2xM",
  "케이블 로우": "LyZH4UGdDTc",
  "원 암 시티드 로우 머신": "1Cfjgf2FBqc",
  "백익스텐션 머신": "9V2BlUDBn1s",
  "슈퍼맨 동작": "ZH0FS5Gp_eg",
  "랙 풀": "iBX3CV3jYMY",
  "바벨 슈러그": "CCndK7zNnVQ",
  "T-W 레이즈": "HvdLRWBprws",

  // ── 후면 어깨 (PULL - Rear Delt) ──
  "케이블 페이스 풀": "a9AaQh1dtRs",
  "리어 델트 플라이": "LsT-bR_zxLo",
  "밴드 풀 어파트": "SuvO4TBwSu4",

  // ── 이두 (PULL - Bicep) ──
  "바벨 컬": "54x2WF1_Suc",
  "해머 컬": "EXzrRuekzLU",
  "인클라인 덤벨 컬": "xHkhJK8ox0s",
  "케이블 바이셉 컬": "KbIMqVOSIiw",
  "덤벨 프리쳐 컬": "ldy9fgGWPVA",
  "덤벨 컬": "-nGL7q-eP5g",
  "프리처 컬 머신": "R5JK0d7Ji_M",
  "오버헤드 케이블 바이셉 컬": "zwBRxWpGeZE",
  "TRX 바이셉스 컬": "Dmr8E-Ho8ao",

  // ══════════════════════════════════
  // ── 하체 (LEG - Squat) ──
  // ══════════════════════════════════
  "바벨 백 스쿼트": "Ak1iHbEeeY8",
  "프론트 스쿼트": "QY1R4ycPyR8",
  "고블렛 스쿼트": "IbJdK_cH6kk",
  "더블 케틀벨 프론트 스쿼트": "e7y8jEUbQiQ",
  "케틀벨 고블릿 스쿼트": "IbJdK_cH6kk",

  // ── 하체 (LEG - Hinge) ──
  "루마니안 데드리프트": "Rg27bvMeTKA",
  "컨벤셔널 데드리프트": "rDk1oz5bbMA",
  "케틀벨 스윙": "TIy6s4O2bOY",
  "싱글 레그 케틀벨 RDL": "s32cCgmRV3I",
  "케틀벨 데드리프트": "foy5yzE4_DA",

  // ── 하체 (LEG - Unilateral) ──
  "런지": "dG89n0jQSto",
  "워킹 런지": "dG89n0jQSto",
  "불가리안 스플릿 스쿼트": "uBSoEWZu07k",
  "리버스 런지": "i3TNJmnInI0",
  "케틀벨 워킹 런지": "hzYUKP0nETA",

  // ── 하체 (LEG - Isolation) ──
  "레그 프레스": "6gx_bjn9wdk",
  "레그 익스텐션": "bKpriLIWrhk",
  "덤벨 힙 쓰러스트": "wYT_Ru0yGD0",
  "힙 쓰러스트": "_i6qpcI1Nw4",
  "케이블 풀 스루": "cRszAB1yK0c",
  "레그 컬": "7F6VF0tcgwo",
  "힙 어브덕션 머신": "tKMx0CVnECk",
  "힙 어덕션 머신": "BmMmt-c9aNM",
  "핵 스쿼트": "vaU2FSmUhNc",
  "스모 데드리프트": "k_jHUVBU-T0",
  "트랩바 데드리프트": "1bhCdJYGi1M",
  "바벨 힙 쓰러스트": "_i6qpcI1Nw4",
  "스텝업": "vhrNQLH1GwI",
  "덤벨 루마니안 데드리프트": "CBOhr6H7BEY",

  // ── 하체 (LEG - Calf) ──
  "스탠딩 카프 레이즈": "SjypFUbZBCA",
  "시티드 카프 레이즈": "ar8nav0jGoE",
  "동키 카프 레이즈": "watMaxAQBCU",

  // ══════════════════════════════════
  // ── 전신 (FULL BODY) ──
  // ══════════════════════════════════
  "덤벨 쓰러스터": "UipBcISeiGU",
  "덤벨 로우": "K0lda9eQfNo",
  "원 레그 루마니안 데드리프트": "Zvce_rEvM5U",

  // ══════════════════════════════════
  // ── 코어 ──
  // ══════════════════════════════════
  "플랭크": "F-C0CzNK22s",
  "사이드 플랭크": "BFOyHDlY2UE",
  "플랭크 숄더 탭": "sleParFUUpo",
  "러시안 트위스트": "aRUMRbl7KS4",
  "데드버그": "HrxOWhPdsOY",
  "버드 독": "L91QMACdA6Q",
  "행잉 레그 레이즈": "PUnNgY3MB1Y",
  "Ab 휠 롤아웃": "MinlHnG7j4k",
  "크런치": "RUNrHkbP4Pc",
  "바이시클 크런치": "cFDS2S6Vqis",
  "오블리크 크런치": "98eX0ndm7Z4",
  "싱글 레그 레이즈": "lhMVkcEGf9E",
  "리버스 크런치": "I-qRngqd2wY",
  "마운틴 클라이머": "7W4JEfEKuC4",
  "시저 킥": "N2aaYFrt2-0",
  "토 터치 크런치": "WShPlCySyfk",
  "플러터 킥": "Cz6iXfmgtiw",
  "레그 레이즈": "2wUpI98Ix-k",
  "케이블 크런치": "iRYIqSFN21w",
  "덤벨 사이드 벤드": "44DazvtgpGE",
  "브이 업": "saHkR_MvIdA",
  "Ab 슬라이드": "3d-19YON2nQ",
  "바벨 롤아웃": "lpXOnRMBp5A",
  "웨이티드 플랭크": "LXDpf7hHpQ8",
  "행잉 니 레이즈": "MeTo-pwrl-4",
  "케이블 우드찹": "3kdgcyMruV8",

  // ══════════════════════════════════
  // ── 모빌리티/스트레칭 (코어) ──
  // ══════════════════════════════════
  "90/90 고관절 회전": "j4XYeiitS2I",
  "흉추 회전 스트레칭": "cncdlzYmbxg",
  "딥 스쿼트 홀드": "Hv6ugN2d_ss",
  "세계에서 가장 위대한 스트레치": "kSPS_HIQv8E",
  "월 앵클 모빌리티": "OmJ6vNfZwYQ",
  "나비 자세": "kSHtwLxEEHw",
  "개구리 자세": "orMZYFWo9P0",
  "피죤 자세": "AI5A1PRYX7E",
  "능동적 다리 들어올리기": "O0ZKWgDx-AY",
  "케틀벨 고블릿 스쿼트 자세 유지": "lRYBbchqxtI",
  "월 스쿼트": "XNY6u8mE--g",
  "악어 스트레칭": "IN23yTdgO_g",
  "케틀벨 암바": "g2EhWlBX_Qw",
  "동적 발목 펌핑": "aYKc2DtV--w",
  "스파이더맨 스트레치": "zZtGw0CuIvY",
  "능형근 스트레칭": "mH-mPIVQ6uA",
  "소흉근 스트레칭": "O8rJw_TmC1Y",
  "동적 어깨 서클": "fwB71uhFU8s",
  "어깨 가동성 드릴": "9G2yKihXjy4",
  "목 주변 근육 이완": "fWa_tgaytMo",
  "고관절 이완": "_Jpt-x6bpkA",

  // ── 모빌리티 (상체) ──
  "상체 이완 플로우": "6uLDaKHtaBo",
  "월 앵글": "OmJ6vNfZwYQ",
  "밴드 페이스 풀": "1s-0WtJMsu8",
  "동적 흉근 스트레칭": "hBAFhsjkRJA",
  "능동적 어깨 서클": "XbUrBpY-LAg",
  "통증 완화 마사지": "niuFKgNLT5E",
  "어깨 돌리기": "0Tx2HnKa2s0",

  // ── 모빌리티 (하체) ──
  "나비 자세 심화": "QV-PKq5sz5Y",
  "고관절 굴곡근 스트레칭": "7lGIfjasuNo",
  "오버헤드 스쿼트 홀딩": "xU-5OAMm43M",
  "고관절 회전": "roZ6Uu0RGT0",

  // ── 모빌리티 (전신) ──
  "터키시 겟업": "-Zsx2JTfGsU",
  "케틀벨 윈드밀": "k1g44y2PsPY",
  "척추 CARs": "Jme_9Rt0pmI",
  "힙 CARs": "C4MDREc9ERg",
  "숄더 CARs": "ZOP6RPjdAhA",
  "앵클 CARs": "ipOfLWlsYY0",
  "손목 CARs": "rKCGEbsHqNE",

  // ══════════════════════════════════
  // ── 웜업 ──
  // ══════════════════════════════════
  "고블렛 스쿼트 프라잉": "e_3peYN8O9o",
  "동적 고관절 굴곡근 스트레칭": "2l73nQdZU0I",
  "내전근 동적 스트레칭": "gfHNePiCjvU",
  "동적 런지": "dG89n0jQSto",
  "동적 다리 스윙": "tjrvwbynPWE",
  "에어 스쿼트": "rj8VHVKL19c",
  "글루트 브릿지": "iOrJXNUH3to",
  "힙 브릿지": "iOrJXNUH3to",
  "점핑 잭": "yg3KQQn3QWg",
  "동적 팔 흔들기": "HMxqtrsNz60",
  "밴드 워크": "N28Hpdezg7Q",
  "클램쉘": "XoxHNiqtVPM",
  "안벅지 동적 스트레칭": "mWWb2w4KV5A",
  "앞벅지 스트레치": "aNXGOpP37CY",
  "앞벅지 스트레칭": "aNXGOpP37CY",
  "캣 카우 스트레치": "n53z-ooCrIU",
  "벽 흉추 스트레칭": "NuDipJO6uck",
  "날개뼈 푸쉬업 플러스": "emB58J1SyXA",
  "어깨 회전 및 견갑골 움직임": "0Tx2HnKa2s0",
  "어깨 회전 및 날개뼈 움직임": "0Tx2HnKa2s0",
  "월 슬라이드": "ocwEZ4bJFNk",
  "벽 엔젤": "znbqYvqRU84",
  "암 서클 전/후방": "iA6Xb4tjHS4",
  "동적 팔 스윙": "iA6Xb4tjHS4",
  "팔 흔들기": "XTbPqeswd-Y",
  "스파이더맨 런지": "cNkYSkeyONY",
  "폼롤러 흉추 스트레칭": "eJahpkJQib4",
  "폼롤러 등 마사지": "DachgMecNe0",
  "폼롤러 둔근 및 햄스트링 이완": "KibUgcGXMTY",
  "폼롤러 둔근 이완": "KibUgcGXMTY",
  "폼롤러 등 상부 및 둔근 이완": "KibUgcGXMTY",
  "폼롤러 햄스트링/둔근 이완": "KibUgcGXMTY",
  "동적 스트레칭: 다리 스윙 앞/옆": "tjrvwbynPWE",
  "동적 스트레칭: 런지 & 트위스트": "uRefI8cp5eY",
  "플랭크 잭": "eN3Ovbv7reM",
  "스텝 잭": "FJ-seqGfwzA",
  "하이니즈": "IdIlyOKozx4",
  "점핑 런지": "_5kDxC0flg0",
  "스쿼트 점프": "IfqrxS_-8oU",
  // 회의 62 후속 (2026-04-18): 와이드 스쿼트 3종 신규 추가. YouTube ID는 대표 확정 후 보완.
  "케틀벨 와이드 스쿼트": "",
  "덤벨 와이드 스쿼트": "",
  "와이드 스쿼트": "",
  "버피": "1YI2HvMsKug",
  "슬로우 버피": "AU2Rw0rMHeg",
  "베어 크롤": "NrFNOiDbJCc",
  "스피드 스케이터": "0Xio0vwEAh0",
  "파워 서킷": "xHzgehSAPcs",
  "섀도 복싱": "kKBBnEhpBGA",
  "제자리 걸음": "1_JSfrhZ5gE",

  // ══════════════════════════════════
  // ── 카디오/러닝 ──
  // ══════════════════════════════════
  "추가 유산소: 중강도 러닝": "Gn5t6izrn5Y",
  "추가 유산소: 가벼운 걷기": "S3s7E6Nb3AY",
  "추가 유산소: 가벼운 조깅 또는 걷기": "Gn5t6izrn5Y",
  "추가 유산소: 인클라인 워킹": "JGzA6FPzZS8",
  "추가 유산소: 조깅": "Gn5t6izrn5Y",
  "추가 유산소: 쿨다운 스트레칭 및 이완": "i6TzP2COtow",
  "추가 추천: 동적 스트레칭 및 이완": "FCkMI5lRcLM",
  "추가 추천: 이완 스트레칭 및 심호흡": "0dCwcVJBjlY",
  "추가 추천: 전신 스트레칭 및 폼롤링": "KibUgcGXMTY",
  "추가 추천: 편안한 속도 걷기 또는 가벼운 스트레칭": "Tj3YVlL3yQk",
  "추가 활동: 가벼운 걷기 또는 스트레칭": "dgp4dMUi8ek",
  "준비 런: 가벼운 조깅": "Gn5t6izrn5Y",
  "준비 조깅": "Gn5t6izrn5Y",
  "이지 런: 대화 가능 속도": "plREYzvF9tI",
  "인터벌 러닝": "Ph1fmsFkCkw",
  "인터벌 스프린트": "sMXvl_iOW88",
  "변속주": "pI_GfaLDEWA",
  "장거리 러닝": "eS-1btTU9oQ",
  "LSD 러닝: 페이스 유지": "eS-1btTU9oQ",
  "회복 러닝: 존 2 유지": "Gn5t6izrn5Y",
  "템포런": "FEAH8-fo-4g",
  "워크-런 인터벌": "Ph1fmsFkCkw",
  "A스킵": "xu9UqoKugSI",
  "B스킵": "-VFqhJVD2x0",
  "싱글 레그 밸런스": "mjzu4CEkTLE",
  "마무리 조깅": "Gn5t6izrn5Y",
  "걷기 또는 가벼운 조깅": "Gn5t6izrn5Y",
};

/** 동의어 → 대표 이름 정규화 */
const NAME_ALIASES: Record<string, string> = {
  "캣-카멜 스트레칭": "캣 카우 스트레치",
  "캣 카멜 스트레치": "캣 카우 스트레치",
  "캣-카멜 자세": "캣 카우 스트레치",
  "고양이-낙타 자세": "캣 카우 스트레치",
  "캣-카우 스트레칭": "캣 카우 스트레치",
  "캣-카우 자세": "캣 카우 스트레치",
  "고양이-소 자세": "캣 카우 스트레치",
  "90/90 힙 로테이션": "90/90 고관절 회전",
  "고관절 90/90 스트레치": "90/90 고관절 회전",
  // 폼롤러 흉추 계열 → 대표: 폼롤러 흉추 스트레칭
  "폼롤러 흉추 가동성": "폼롤러 흉추 스트레칭",
  "폼롤러 등 마사지 및 흉추 신전": "폼롤러 흉추 스트레칭",
  "폼롤러 흉추/광배근 마사지": "DachgMecNe0",
  // 벽 흉추 계열 → 대표: 벽 흉추 스트레칭
  "벽 흉추 회전": "벽 흉추 스트레칭",
  // 흉추 회전 계열 (영상 없는 것들) → 대표: 흉추 회전 스트레칭
  "흉추 스트레칭 및 회전": "흉추 회전 스트레칭",
  "흉추 스트레칭": "흉추 회전 스트레칭",
  "동적 흉추 회전": "흉추 회전 스트레칭",
  "흉추 회전 운동": "흉추 회전 스트레칭",
  // Phase 12 전수 감사 — workoutEngine.ts 운동 풀에만 있고 매핑 miss였던 항목들
  "하프 닐링 흉추 로테이션": "흉추 회전 스트레칭",
  "딥 스쿼트 & 흉추 로테이션": "흉추 회전 스트레칭",
  "동적 가슴 스트레칭": "상체 이완 플로우",
  "만세 스쿼트 홀드": "오버헤드 스쿼트 홀딩",
  "만세 스쿼트 홀드 프라잉": "오버헤드 스쿼트 홀딩",
  "케틀벨 고블릿 스쿼트 홀드": "케틀벨 고블릿 스쿼트 자세 유지",
  "스트레이트 암 풀다운": "암 풀다운",
  "스텝아웃 버피": "버피",
  "점프 런지": "점핑 런지",
  "트리거 포인트 해제": "폼롤러 등 마사지",
  "폼롤링 전신": "폼롤러 등 마사지",
  "가벼운 요가 플로우": "상체 이완 플로우",
  "준비 걷기": "추가 유산소: 가벼운 걷기",
  "마무리 걷기": "추가 유산소: 가벼운 걷기",
};

/**
 * 운동 이름에서 한글 이름 추출 (괄호 앞) + 동의어 정규화
 */
export function getExerciseKoreanName(fullName: string): string {
  const raw = fullName.split("(")[0].trim();
  return NAME_ALIASES[raw] || raw;
}

/**
 * 운동 이름에서 영어 이름 추출 (괄호 안)
 */
export function getExerciseEnglishName(fullName: string): string {
  const match = fullName.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : fullName.trim();
}

/**
 * 운동에 대한 YouTube embed URL 반환
 * 매핑된 영상이 있으면 embed URL, 없으면 null
 */
export function getVideoEmbedUrl(exerciseName: string): string | null {
  const korName = getExerciseKoreanName(exerciseName);
  const videoId = EXERCISE_VIDEOS[korName];
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&playsinline=1&controls=0&showinfo=0&rel=0`;
  }
  return null;
}

/**
 * 유튜브 검색 URL (폴백용)
 * 바텀시트 내에서 iframe으로 보여줌
 */
export function getYoutubeSearchUrl(exerciseName: string): string {
  const korName = getExerciseKoreanName(exerciseName);
  const engName = getExerciseEnglishName(exerciseName);
  // 한글 이름 + 영어 이름 + "자세" 로 검색하면 좋은 결과 나옴
  const query = engName !== korName
    ? `${korName} ${engName} 자세 운동`
    : `${korName} 자세 운동`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * YouTube 쇼츠 썸네일 URL (매핑된 영상만)
 */
export function getVideoThumbnail(exerciseName: string): string | null {
  const korName = getExerciseKoreanName(exerciseName);
  const videoId = EXERCISE_VIDEOS[korName];
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
  return null;
}
