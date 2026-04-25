/**
 * Workout Music — 사용자 기호 저장 (localStorage)
 *
 * - enabled: 음악 기능 ON/OFF (기본 false — opt-in)
 * - lastPlaylistId: 마지막으로 선택한 큐레이션 카테고리 ID
 *
 * SSR safe — window 가드 포함.
 */

const KEY_ENABLED = "ohunjal_music_enabled";
const KEY_LAST_PLAYLIST = "ohunjal_music_last_playlist_id";
const KEY_INTRO_SHOWN = "ohunjal_music_intro_shown";

export function isMusicEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY_ENABLED) === "true";
}

export function setMusicEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
}

export function getLastPlaylistId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_LAST_PLAYLIST);
}

export function setLastPlaylistId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_LAST_PLAYLIST, id);
}

export function isMusicIntroShown(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY_INTRO_SHOWN) === "1";
}

export function markMusicIntroShown(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_INTRO_SHOWN, "1");
}
