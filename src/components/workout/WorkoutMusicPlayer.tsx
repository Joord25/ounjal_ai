/**
 * WorkoutMusicPlayer — FitScreen 의 DONE 버튼 위 미니 플레이어
 *
 * 정책 (회의 2026-04-26 음악 도입):
 * - YouTube IFrame Player API 사용 (무료, API 키 불필요)
 * - 큐레이션 카테고리만 노출 (검색 X)
 * - iOS 자동재생 정책: mount 후 사용자가 ▶ 직접 탭해야 첫 재생
 * - 자세 영상 ↔ 음악 자동 일시정지 (P2 단계에서 wire 됨)
 * - 알람 발사 직전 ducking 200ms 30% (P2 단계)
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/utils/analytics";
import {
  CURATED_PLAYLISTS,
  curatedPlaylistLabel,
  findCuratedPlaylist,
  isCuratedPlaylistAvailable,
  type CuratedPlaylist,
} from "@/constants/curatedPlaylists";
import {
  getLastPlaylistId,
  setLastPlaylistId,
} from "@/utils/musicPreference";
import { useYouTubeIframe } from "@/hooks/useYouTubeIframe";

const PLAYER_CONTAINER_ID = "ohunjal-workout-music-iframe";

export type WorkoutMusicPlayerHandle = {
  pauseForOverride: () => void;
  resumeAfterOverride: () => void;
  duckVolumeFor: (durationMs: number) => void;
  isUserPlaying: () => boolean;
};

type Props = {
  enabled: boolean;
  onUnavailable?: () => void;
  registerHandle?: (h: WorkoutMusicPlayerHandle | null) => void;
  /**
   * UI 미니바를 portal 로 렌더할 대상 element.
   * FitScreen 이 운동 전환 시 unmount/remount 되어도 음악 인스턴스는 stable 유지하기 위함.
   * null 이면 미니바 미렌더 (음악 인스턴스만 살아있음).
   */
  uiPortalTarget?: HTMLElement | null;
};

export function WorkoutMusicPlayer({ enabled, onUnavailable, registerHandle, uiPortalTarget }: Props) {
  const { locale, t } = useTranslation();
  const { ready, state, loadPlaylist, play, pause, next, setVolume } = useYouTubeIframe({
    containerId: PLAYER_CONTAINER_ID,
  });

  const [selected, setSelected] = useState<CuratedPlaylist | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const userIntendedPlayingRef = useRef(false);
  const duckingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preDuckVolumeRef = useRef<number | null>(null);

  const availablePlaylists = useMemo(
    () => CURATED_PLAYLISTS.filter(isCuratedPlaylistAvailable),
    [],
  );
  const hasAnyAvailable = availablePlaylists.length > 0;

  useEffect(() => {
    if (!enabled || !hasAnyAvailable) return;
    const lastId = getLastPlaylistId();
    const initial = (lastId && findCuratedPlaylist(lastId)) || availablePlaylists[0];
    if (initial) setSelected(initial);
  }, [enabled, hasAnyAvailable, availablePlaylists]);

  useEffect(() => {
    if (!enabled || !ready || !selected) return;
    loadPlaylist(selected.youtubeId, selected.kind);
  }, [enabled, ready, selected, loadPlaylist]);

  // 단일 비디오 모드 (kind: "video") 에서 끝나면 자동 재시작 — 운동 중 음악 끊기지 않도록.
  useEffect(() => {
    if (state === "ended" && userIntendedPlayingRef.current) {
      play();
    }
  }, [state, play]);

  // 회의 2026-04-26 음악 도입: 백그라운드 진입 시 자동 일시정지 + 복귀 시 자동 재생.
  // - hidden: 모바일 OS 가 어차피 audio 끊지만 명시적 pause 로 상태 정리
  // - visible: 사용자가 재생 의도였으면 play() 호출 (iOS 자동재생 정책으로 막힐 수 있음 — 그땐 사용자 ▶ 한 번 필요)
  useEffect(() => {
    if (typeof document === "undefined" || !enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (state === "playing") pause();
      } else if (document.visibilityState === "visible") {
        if (userIntendedPlayingRef.current && state !== "playing") {
          play();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, state, play, pause]);

  useEffect(() => {
    if (!enabled && !hasAnyAvailable) {
      onUnavailable?.();
    }
  }, [enabled, hasAnyAvailable, onUnavailable]);

  useEffect(() => {
    if (!registerHandle) return;
    const handle: WorkoutMusicPlayerHandle = {
      pauseForOverride: () => {
        if (state === "playing") pause();
      },
      resumeAfterOverride: () => {
        if (userIntendedPlayingRef.current) play();
      },
      duckVolumeFor: (durationMs: number) => {
        if (state !== "playing") return;
        if (preDuckVolumeRef.current == null) {
          preDuckVolumeRef.current = 100;
        }
        setVolume(30);
        if (duckingTimerRef.current) clearTimeout(duckingTimerRef.current);
        duckingTimerRef.current = setTimeout(() => {
          setVolume(preDuckVolumeRef.current ?? 100);
          preDuckVolumeRef.current = null;
        }, durationMs);
      },
      isUserPlaying: () => userIntendedPlayingRef.current,
    };
    registerHandle(handle);
    return () => registerHandle(null);
  }, [registerHandle, state, pause, play, setVolume]);

  if (!enabled || !hasAnyAvailable) {
    return <div id={PLAYER_CONTAINER_ID} style={{ display: "none" }} />;
  }

  const isPlaying = state === "playing" || state === "buffering";

  const onTogglePlay = () => {
    if (!selected) return;
    if (isPlaying) {
      pause();
      userIntendedPlayingRef.current = false;
      trackEvent("workout_music_pause", { playlistId: selected.id });
    } else {
      play();
      userIntendedPlayingRef.current = true;
      trackEvent("workout_music_play", { playlistId: selected.id });
    }
  };

  const onNext = () => {
    next();
    if (selected) trackEvent("workout_music_next", { playlistId: selected.id });
  };

  const onSelect = (p: CuratedPlaylist) => {
    setSelected(p);
    setLastPlaylistId(p.id);
    setSheetOpen(false);
    userIntendedPlayingRef.current = true;
    trackEvent("workout_music_select", { playlistId: p.id });
  };

  const ui = (
    <>
      <div
        className="border-t border-gray-200 bg-white px-3 flex items-center gap-2"
        style={{ height: collapsed ? 24 : 48 }}
      >
        {!collapsed && (
          <>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex-1 min-w-0 text-left text-xs font-medium text-gray-700 truncate"
              aria-label={t("music.changePlaylist")}
            >
              <span className="text-emerald-700">♪</span>{" "}
              {selected ? curatedPlaylistLabel(selected, locale) : t("music.choosePlaylist")}
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"
              aria-label={isPlaying ? t("music.pause") : t("music.play")}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"
              aria-label={t("music.next")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 1.5v11l8-5.5z" /><rect x="11" y="1.5" width="2" height="11" rx="0.5" /></svg>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-6 h-6 flex items-center justify-center text-gray-500"
          aria-label={collapsed ? t("music.expand") : t("music.collapse")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>
            <path d="M5 2L1 6h8z" />
          </svg>
        </button>
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-4 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-bold mb-3">{t("music.choosePlaylist")}</div>
            <div className="grid grid-cols-2 gap-2">
              {availablePlaylists.map((p) => {
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`p-3 rounded-2xl text-left text-sm font-medium border ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-600 text-emerald-900"
                        : "bg-white border-gray-200 text-gray-800"
                    }`}
                  >
                    {curatedPlaylistLabel(p, locale)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="w-full mt-4 py-3 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-700"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/*
        wrapper 패턴 — IFrame Player 가 inner div(PLAYER_CONTAINER_ID)를 iframe 으로 대체하므로
        React 가 그 영역을 직접 관리하면 unmount 시 insertBefore mismatch 발생.
        wrapper div 만 React 가 관리하고, inner div 는 외부 라이브러리(YouTube)에 위임.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <div id={PLAYER_CONTAINER_ID} />
      </div>
      {/*
        미니바 UI:
        - 1차: FitScreen 의 DONE 직전 portal 슬롯 (와이어프레임 정확 위치, strength/cardio 등 일반 케이스)
        - fallback: portal target 없거나 어떤 이유로 미마운트 시 화면 하단 fixed (러닝 등 콘텐츠 풍부 케이스)
        2026-04-26: 러닝 운동에서 미니바 미노출 보고 → 어떤 운동에서도 항상 노출 보장.
      */}
      {uiPortalTarget
        ? createPortal(ui, uiPortalTarget)
        : <div className="fixed bottom-0 left-0 right-0 z-40">{ui}</div>}
    </>
  );
}
