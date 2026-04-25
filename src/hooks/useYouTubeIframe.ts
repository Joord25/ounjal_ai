/**
 * YouTube IFrame Player API 래퍼
 *
 * 운영 정책:
 * - 무료 (API 키 불필요, quota 무관)
 * - 단일 인스턴스 페이지당 1개 권장 (자세 영상 iframe 과 별도)
 * - iOS Safari 는 사용자 제스처 없이 자동 재생 차단 → play() 는 사용자 탭 후만 호출
 *
 * SSR safe — 모든 호출은 useEffect 내부에서.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type YTPlayerState = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "cued" | "unknown";

type YTPlayer = {
  loadPlaylist: (opts: { list: string; listType: "playlist"; index?: number }) => void;
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  nextVideo: () => void;
  setVolume: (v: number) => void;
  getVolume: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        opts: {
          height?: string | number;
          width?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_SRC = "https://www.youtube.com/iframe_api";

let scriptLoadingPromise: Promise<void> | null = null;

function ensureIframeApiLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };

    const existing = Array.from(document.scripts).find((s) => s.src === SCRIPT_SRC);
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = SCRIPT_SRC;
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return scriptLoadingPromise;
}

function mapState(code: number): YTPlayerState {
  switch (code) {
    case -1:
      return "unstarted";
    case 0:
      return "ended";
    case 1:
      return "playing";
    case 2:
      return "paused";
    case 3:
      return "buffering";
    case 5:
      return "cued";
    default:
      return "unknown";
  }
}

type UseYouTubeIframeOpts = {
  containerId: string;
  onReady?: () => void;
};

export function useYouTubeIframe({ containerId, onReady }: UseYouTubeIframeOpts) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<YTPlayerState>("unstarted");
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    ensureIframeApiLoaded()
      .then(() => {
        if (cancelled || !window.YT?.Player) return;
        const el = document.getElementById(containerId);
        if (!el) return;
        playerRef.current = new window.YT.Player(containerId, {
          height: "0",
          width: "0",
          playerVars: {
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              onReadyRef.current?.();
            },
            onStateChange: (e) => {
              if (cancelled) return;
              setState(mapState(e.data));
            },
          },
        });
      })
      .catch(() => {
        // API 로드 실패해도 운동 세션은 진행 (블록 금지)
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [containerId]);

  const loadPlaylist = useCallback((youtubeId: string, kind: "playlist" | "video") => {
    if (!playerRef.current || !ready || !youtubeId) return;
    try {
      if (kind === "playlist") {
        playerRef.current.loadPlaylist({ list: youtubeId, listType: "playlist" });
      } else {
        playerRef.current.loadVideoById(youtubeId);
      }
    } catch {
      // ignore
    }
  }, [ready]);

  const play = useCallback(() => {
    try {
      playerRef.current?.playVideo();
    } catch {
      // ignore
    }
  }, []);

  const pause = useCallback(() => {
    try {
      playerRef.current?.pauseVideo();
    } catch {
      // ignore
    }
  }, []);

  const next = useCallback(() => {
    try {
      playerRef.current?.nextVideo();
    } catch {
      // ignore
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    try {
      playerRef.current?.setVolume(Math.max(0, Math.min(100, vol)));
    } catch {
      // ignore
    }
  }, []);

  const getVolume = useCallback((): number => {
    try {
      return playerRef.current?.getVolume() ?? 100;
    } catch {
      return 100;
    }
  }, []);

  return { ready, state, loadPlaylist, play, pause, next, setVolume, getVolume };
}
