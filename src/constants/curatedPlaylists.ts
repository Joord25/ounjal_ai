/**
 * Workout Music — 큐레이션된 YouTube 플레이리스트/비디오 카탈로그
 *
 * 운영 정책:
 * - YouTube Data API 호출 0 (재생만, IFrame Player API 무료)
 * - playlistId 또는 videoId 둘 중 하나만 채움
 * - 대표 큐레이션 대기 중 — youtubeId 빈 값이면 컴포넌트가 비활성 표시
 */

export type PlaylistKind = "playlist" | "video";

export type CuratedPlaylist = {
  id: string;
  labelKo: string;
  labelEn: string;
  kind: PlaylistKind;
  youtubeId: string;
};

/**
 * 큐레이션 매핑 (대표 선정 2026-04-26):
 * - 처음 URL (24BjLtCLKvY) = 러닝 카디오 (명시)
 * - 마지막 URL (5MtZBEK_nRs) = 가슴/등 펌프업 (명시)
 * - 구 "쿨다운 로파이" → "어깨/팔 펌프업" 으로 라벨 변경 (명시)
 * - 중간 4곡 = 하체/인터벌/어깨팔/추가BGM 임시 매핑 — 대표 컨펌 대기
 *
 * 1차 시도: RD<videoId> 라디오 믹스 (kind: "playlist") → IFrame Player 에서 작동 X 확인 (실측 2026-04-26).
 * 현재 정책: 단일 videoId + kind: "video" + 끝나면 자동 재시작 (한 곡 무한 반복).
 *   다곡 회전이 필요하면 일반 YouTube 플레이리스트 ID (PL... 형식) 또는 카테고리당 videoId 배열 도입.
 */
export const CURATED_PLAYLISTS: CuratedPlaylist[] = [
  {
    id: "cardio_running",
    labelKo: "러닝 카디오",
    labelEn: "Running Cardio",
    kind: "video",
    youtubeId: "24BjLtCLKvY",
  },
  {
    id: "pump_legs",
    labelKo: "하체 데이",
    labelEn: "Leg Day",
    kind: "video",
    youtubeId: "trFbU8ryNnc",
  },
  {
    id: "intervals_high_bpm",
    labelKo: "인터벌 고BPM",
    labelEn: "Intervals High BPM",
    kind: "video",
    youtubeId: "50wqlgoUcWA",
  },
  {
    id: "pump_shoulders_arms",
    labelKo: "어깨/팔 펌프업",
    labelEn: "Shoulders/Arms Pump",
    kind: "video",
    youtubeId: "ceYtWuWIOoE",
  },
  {
    id: "extra_bgm",
    labelKo: "추가 운동 BGM",
    labelEn: "Extra Workout BGM",
    kind: "video",
    youtubeId: "GQRp5E2gFSQ",
  },
  {
    id: "pump_chest_back",
    labelKo: "가슴/등 펌프업",
    labelEn: "Chest/Back Pump",
    kind: "video",
    youtubeId: "5MtZBEK_nRs",
  },
];

export function findCuratedPlaylist(id: string): CuratedPlaylist | undefined {
  return CURATED_PLAYLISTS.find((p) => p.id === id);
}

export function curatedPlaylistLabel(p: CuratedPlaylist, locale: "ko" | "en"): string {
  return locale === "ko" ? p.labelKo : p.labelEn;
}

export function isCuratedPlaylistAvailable(p: CuratedPlaylist): boolean {
  return p.youtubeId.trim().length > 0;
}
