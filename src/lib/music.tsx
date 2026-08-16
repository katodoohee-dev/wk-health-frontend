import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiMusicPlayed, type Track } from "@/lib/api";

type MusicCtx = {
  current: Track | null;
  isPlaying: boolean;
  queue: Track[];
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
};

const Ctx = createContext<MusicCtx | null>(null);

export function useMusic() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  loadVideoById: (id: string) => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: Record<string, unknown>,
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const ytHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = new Audio();
    el.preload = "none";
    audioRef.current = el;
    const onEnd = () => setIsPlaying(false);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("ended", onEnd);
      el.pause();
      audioRef.current = null;
    };
  }, []);

  const playTrack = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (track.type === "youtube") {
      audio?.pause();
      const vid = track.ytId || "";
      // FIX: ถ้าไม่มี video id จริง (parseYouTubeId คืนค่าว่าง เพราะลิงก์ไม่ใช่รูปแบบ YouTube ที่รู้จัก)
      // อย่าแสร้งว่ากำลังเล่น — โชว์สถานะไม่เล่นไปเลย ดีกว่าปุ่ม pause ค้างแบบไม่มีเสียงจริง
      if (!vid) {
        setIsPlaying(false);
        return;
      }
      void loadYouTubeApi().then(() => {
        if (!window.YT?.Player || !ytHostRef.current) return;
        if (!ytRef.current) {
          ytRef.current = new window.YT.Player(ytHostRef.current, {
            height: "1",
            width: "1",
            videoId: vid,
            playerVars: { autoplay: 1, playsinline: 1 },
            events: {
              onReady: (e: { target: YTPlayer }) => e.target.playVideo(),
              // FIX: isPlaying มาจาก event onStateChange จริงเท่านั้น ไม่ใช่ optimistic setIsPlaying(true)
              // ก่อนหน้านี้ (เดิมเซ็ต true ทันทีตอนกดเล่น ทำให้ UI โชว์ปุ่ม pause แม้เสียงไม่ออกจริง)
              onStateChange: (e: { data: number }) => {
                if (e.data === 1) setIsPlaying(true);
                if (e.data === 2 || e.data === 0) setIsPlaying(false);
              },
            },
          });
        } else {
          ytRef.current.loadVideoById(vid);
          ytRef.current.playVideo();
        }
      });
    } else {
      ytRef.current?.pauseVideo();
      if (audio) {
        audio.src = track.url;
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, []);

  const play = useCallback(
    (track: Track, list?: Track[]) => {
      if (list) setQueue(list);
      setCurrent(track);
      playTrack(track);
      void apiMusicPlayed(track).catch(() => undefined);
    },
    [playTrack],
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (isPlaying) {
      if (current.type === "youtube") ytRef.current?.pauseVideo();
      else audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (current.type === "youtube") ytRef.current?.playVideo();
      else void audioRef.current?.play().catch(() => undefined);
      setIsPlaying(true);
    }
  }, [current, isPlaying]);

  const stop = useCallback(() => {
    ytRef.current?.stopVideo();
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrent(null);
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!current || queue.length === 0) return;
      const i = queue.findIndex((t) => t.id === current.id);
      const nextTrack = queue[(i + dir + queue.length) % queue.length];
      if (nextTrack) play(nextTrack, queue);
    },
    [current, queue, play],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (current) {
      ms.metadata = new MediaMetadata({
        title: current.title,
        artist: "WK Health App",
        album: "เพลย์ลิสต์ของฉัน",
      });
      ms.playbackState = isPlaying ? "playing" : "paused";
      ms.setActionHandler("play", () => toggle());
      ms.setActionHandler("pause", () => toggle());
      ms.setActionHandler("nexttrack", () => next());
      ms.setActionHandler("previoustrack", () => prev());
    } else {
      ms.playbackState = "none";
    }
  }, [current, isPlaying, toggle, next, prev]);

  const value = useMemo(
    () => ({ current, isPlaying, queue, play, toggle, stop, next, prev }),
    [current, isPlaying, queue, play, toggle, stop, next, prev],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 size-px overflow-hidden opacity-0"
      >
        <div ref={ytHostRef} />
      </div>
    </Ctx.Provider>
  );
}
