import { useEffect, useState } from "react";
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

/** ปก YouTube แบบสี่เหลี่ยมจัตุรัส — hqdefault เป็น 4:3 ต้อง crop กลางด้วย CSS (object-cover) ให้เป็นจัตุรัส */
function ytThumb(ytId: string) {
  return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
}

function MusicPage() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { current, isPlaying, play, toggle } = useMusic();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  // FIX: ก่อนหน้านี้ผู้ใช้ต้องพิมพ์ชื่อเพลงเองทุกครั้ง แม้เป็นลิงก์ YouTube ที่มีชื่อ/ปกอยู่แล้ว
  // ตอนนี้พอวางลิงก์ YouTube ปุ๊บ ระบบดึงปก (สี่เหลี่ยมจัตุรัส) + ชื่อเพลงจาก YouTube oEmbed มาให้ทันที
  // (oEmbed เป็น public endpoint ไม่ต้อง API key) ผู้ใช้ยังแก้ชื่อเองได้ถ้าต้องการ
  const [autoTitle, setAutoTitle] = useState<string | null>(null);
  const ytId = parseYouTubeId(url);

  useEffect(() => {
    if (!ytId) { setAutoTitle(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (!cancelled && data?.title) setAutoTitle(String(data.title)); })
        .catch(() => { if (!cancelled) setAutoTitle(null); });
    }, 400); // debounce กันยิง request รัวๆ ตอนพิมพ์
    return () => { cancelled = true; clearTimeout(timer); };
  }, [url, ytId]);

  const lib = useQuery({ queryKey: ["music", "library"], queryFn: apiMusicLibrary, enabled: isAuthenticated });
  const history = useQuery({ queryKey: ["music", "history"], queryFn: apiMusicHistory, enabled: isAuthenticated });

  const add = useMutation({
    mutationFn: () => {
      const id = parseYouTubeId(url);
      const finalTitle = title.trim() || autoTitle || url.trim();
      return apiMusicAdd({ url: url.trim(), title: finalTitle, type: id ? "youtube" : "audio", ...(id ? { ytId: id } : {}) });
    },
    onSuccess: () => { setUrl(""); setTitle(""); setAutoTitle(null); void qc.invalidateQueries({ queryKey: ["music"] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiMusicDelete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["music", "library"] }),
  });

  // FIX: เพิ่มใหม่ — นำเข้าเพลงจำนวนมากพร้อมกันทีเดียว (สำหรับกรณีมีรายการเพลงเป็นร้อยๆ)
  // วางทีละบรรทัด รูปแบบ "ลิงก์ YouTube" หรือ "ลิงก์ YouTube | ชื่อเพลง" (ถ้าไม่ใส่ชื่อ จะดึงจาก oEmbed ให้)
  // รันทีละเพลงตามลำดับ (ไม่ยิงพร้อมกันหมด กัน rate limit ของ backend/YouTube oEmbed) พร้อมแถบความคืบหน้า
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  const runBulkImport = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: lines.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < lines.length; i++) {
      const [rawUrl, rawTitle] = lines[i]!.split("|").map((s) => s.trim());
      const link = rawUrl ?? "";
      const id = parseYouTubeId(link);
      try {
        let finalTitle = rawTitle;
        if (!finalTitle && id) {
          try {
            const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`);
            if (r.ok) { const d = await r.json(); finalTitle = d?.title; }
          } catch {}
        }
        await apiMusicAdd({ url: link, title: finalTitle || link, type: id ? "youtube" : "audio", ...(id ? { ytId: id } : {}) });
      } catch {
        failed++;
      }
      setBulkProgress({ done: i + 1, total: lines.length, failed });
    }
    setBulkRunning(false);
    void qc.invalidateQueries({ queryKey: ["music"] });
  };

  const tracks = lib.data ?? [];

  return (
    <div className="rise-in">
      <PageHeader title="เพลย์ลิสต์" subtitle="เปิดเพลงคลอระหว่างใช้แอป" />

      <GlassCard className="p-4">
        <SectionTitle title="เพิ่มเพลง" />
        <div className="space-y-2">
          <span className="glass flex items-center gap-2 rounded-2xl px-3">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ลิงก์ YouTube หรือไฟล์เสียง (.mp3/.wav)" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
          </span>

          {ytId && (
            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2">
              <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                <img src={ytThumb(ytId)} alt="" className="size-full object-cover" />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {autoTitle ?? "กำลังดึงชื่อเพลง…"}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle ? `ชื่อเพลง (ดึงมาให้แล้ว แก้ได้ถ้าต้องการ)` : "ชื่อเพลง (ไม่บังคับ)"} className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none" />
            <button onClick={() => url.trim() && add.mutate()} disabled={add.isPending || !url.trim()}
              className="press bg-mint-gradient flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} เพิ่ม
            </button>
          </div>
          {add.isError && <p className="rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{add.error instanceof Error ? add.error.message : "เพิ่มเพลงไม่สำเร็จ"}</p>}
          <p className="text-xs text-muted-foreground">วางลิงก์ YouTube แล้วระบบดึงปกและชื่อเพลงให้อัตโนมัติ หรือใส่ไฟล์เสียงตรงก็ได้</p>
        </div>
      </GlassCard>

      <GlassCard className="mt-3 p-4">
        <button onClick={() => setBulkOpen((v) => !v)} className="press flex w-full items-center justify-between text-left">
          <SectionTitle title="นำเข้าเพลงหลายเพลงพร้อมกัน" />
          <span className="text-xs text-muted-foreground">{bulkOpen ? "ซ่อน" : "เปิด"}</span>
        </button>
        {bulkOpen && (
          <div className="rise-in mt-2 space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              disabled={bulkRunning}
              rows={6}
              placeholder={"วางลิงก์ YouTube ทีละบรรทัด เช่น\nhttps://youtube.com/watch?v=xxxxx\nhttps://youtube.com/watch?v=yyyyy | ชื่อเพลง (ไม่ใส่ก็ได้ ระบบดึงให้)"}
              className="glass w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none disabled:opacity-60"
            />
            <button
              onClick={() => void runBulkImport()}
              disabled={bulkRunning || !bulkText.trim()}
              className="press bg-mint-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {bulkRunning ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {bulkRunning ? "กำลังนำเข้า…" : "นำเข้าทั้งหมด"}
            </button>
            {bulkProgress && (
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  นำเข้าแล้ว {bulkProgress.done}/{bulkProgress.total} เพลง
                  {bulkProgress.failed > 0 ? ` (ผิดพลาด ${bulkProgress.failed} เพลง — เช็คว่าลิงก์ถูกต้องไหม)` : ""}
                  {!bulkRunning && bulkProgress.done === bulkProgress.total ? " — เสร็จแล้ว ✓" : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <section className="mt-4">
        <SectionTitle title="คลังเพลงของฉัน" />
        {lib.isLoading ? (
          <LoadingState label="กำลังโหลดเพลย์ลิสต์…" />
        ) : lib.isError ? (
          <ErrorState error={lib.error} onRetry={() => void lib.refetch()} />
        ) : tracks.length === 0 ? (
          <p className="glass rounded-3xl px-4 py-6 text-center text-sm text-muted-foreground">ยังไม่มีเพลง — วางลิงก์ด้านบนเพื่อเพิ่มเพลงแรก</p>
        ) : (
          <div className="space-y-2">
            {tracks.map((t) => {
              const active = current?.id === t.id;
              return (
                <div key={t.id} className={`glass-strong flex items-center gap-3 rounded-3xl p-3 shadow-soft ${active ? "ring-2 ring-primary/40" : ""}`}>
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {t.type === "youtube" && t.ytId ? (
                      <img src={ytThumb(t.ytId)} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center bg-mint-soft"><Music2 className="size-5 text-mint" /></div>
                    )}
                  </div>
                  <button onClick={() => (active ? toggle() : play(t, tracks))} aria-label={active && isPlaying ? "หยุดชั่วคราว" : `เล่น ${t.title}`}
                    className="press bg-mint-gradient grid size-11 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow">
                    {active && isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.type === "youtube" ? "YouTube" : "ไฟล์เสียง"}</p>
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
