import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Music2, Pause, Play, Plus, Trash2, History } from "lucide-react";
import { PageHeader, GlassCard, SectionTitle } from "@/components/app/ui-bits";
import { ErrorState, LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth";
import { useMusic } from "@/lib/music";
import { apiMusicAdd, apiMusicDelete, apiMusicHistory, apiMusicLibrary, parseYouTubeId } from "@/lib/api";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "เพลย์ลิสต์ — WK Health App" },
      { name: "description", content: "เปิดเพลงคลอระหว่างออกกำลังกาย รองรับลิงก์ YouTube และไฟล์เสียงตรง เล่นต่อได้ทุกหน้า" },
      { property: "og:title", content: "เพลย์ลิสต์ — WK Health App" },
      { property: "og:description", content: "ฟังเพลงคลอระหว่างใช้แอป รองรับ YouTube และไฟล์เสียง" },
    ],
  }),
  component: MusicPage,
});

function MusicPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { current, isPlaying, play, toggle } = useMusic();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const lib = useQuery({ queryKey: ["music", "library"], queryFn: apiMusicLibrary, enabled: isAuthenticated });
  const history = useQuery({ queryKey: ["music", "history"], queryFn: apiMusicHistory, enabled: isAuthenticated });

  const add = useMutation({
    mutationFn: () => {
      const ytId = parseYouTubeId(url);
      return apiMusicAdd({ url: url.trim(), title: title.trim() || url.trim(), type: ytId ? "youtube" : "audio", ...(ytId ? { ytId } : {}) });
    },
    onSuccess: () => { setUrl(""); setTitle(""); void qc.invalidateQueries({ queryKey: ["music"] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiMusicDelete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["music", "library"] }),
  });

  const tracks = lib.data ?? [];

  return (
    <div className="rise-in">
      <PageHeader title="เพลย์ลิสต์" emoji="🎵" subtitle="เปิดเพลงคลอระหว่างใช้แอป" />

      <GlassCard className="p-4">
        <SectionTitle title="เพิ่มเพลง" />
        <div className="space-y-2">
          <span className="glass flex items-center gap-2 rounded-2xl px-3">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ลิงก์ YouTube หรือไฟล์เสียง (.mp3/.wav)" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
          </span>
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อเพลง (ไม่บังคับ)" className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" />
            <button onClick={() => url.trim() && add.mutate()} disabled={add.isPending || !url.trim()}
              className="press bg-mint-gradient flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} เพิ่ม
            </button>
          </div>
          {add.isError && <p className="rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{add.error instanceof Error ? add.error.message : "เพิ่มเพลงไม่สำเร็จ"}</p>}
          <p className="text-xs text-muted-foreground">ระบบตรวจอัตโนมัติว่าเป็น YouTube หรือไฟล์เสียง และเล่นต่อเนื่องแม้สลับหน้า</p>
        </div>
      </GlassCard>

      <section className="mt-4">
        <SectionTitle title="คลังเพลงของฉัน" />
        {lib.isLoading ? (
          <LoadingState label="กำลังโหลดเพลย์ลิสต์…" />
        ) : lib.isError ? (
          <ErrorState error={lib.error} onRetry={() => void lib.refetch()} />
        ) : tracks.length === 0 ? (
          <p className="glass rounded-3xl px-4 py-6 text-center text-sm text-muted-foreground">ยังไม่มีเพลง — วางลิงก์ด้านบนเพื่อเพิ่มเพลงแรก 🎧</p>
        ) : (
          <div className="space-y-2">
            {tracks.map((t) => {
              const active = current?.id === t.id;
              return (
                <div key={t.id} className={`glass-strong flex items-center gap-3 rounded-3xl p-3 shadow-soft ${active ? "ring-2 ring-primary/40" : ""}`}>
                  <button onClick={() => (active ? toggle() : play(t, tracks))} aria-label={active && isPlaying ? "หยุดชั่วคราว" : `เล่น ${t.title}`}
                    className="press bg-mint-gradient grid size-11 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow">
                    {active && isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.type === "youtube" ? "▶️ YouTube" : "🎧 ไฟล์เสียง"}</p>
                  </div>
                  <button onClick={() => del.mutate(t.id)} aria-label={`ลบ ${t.title}`} className="press grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <GlassCard className="mt-4 p-4">
        <SectionTitle title="ประวัติการฟัง" action={<History className="size-4 text-muted-foreground" />} />
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : history.data && history.data.length > 0 ? (
          <div className="space-y-2">
            {history.data.map((h, i) => (
              <div key={`${h.id}-${i}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                <Music2 className="size-4 shrink-0 text-mint" />
                <span className="min-w-0 flex-1 truncate text-sm">{h.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.playedAt}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการฟัง</p>
        )}
      </GlassCard>
    </div>
  );
}
